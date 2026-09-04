'use client';

import { Trash2, Copy, FileText, Sparkles, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { MiniResumePreview } from '@/components/resume/shared/mini-resume-preview';
import { CreateResumeDialog } from '@/components/resume/management/dialogs/create-resume-dialog';
import { ResumeSortControls, type SortOption, type SortDirection } from '@/components/resume/management/resume-sort-controls';
import { ResumeSearchInput } from '@/components/resume/management/resume-search-input';
import type { Profile, ResumeSummary } from '@/lib/types';
import { deleteResume, copyResume } from '@/utils/actions/resumes/actions';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useOptimistic, useTransition } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { toast } from 'sonner';

// Extended Resume type for optimistic updates
interface OptimisticResume extends ResumeSummary {
  isOptimistic?: boolean;
  originalId?: string;
}

interface ResumesSectionProps {
  type: 'base' | 'tailored';
  /** A single server-rendered page of resumes, already sorted and filtered in SQL. */
  resumes: ResumeSummary[];
  profile: Profile;
  sortParam: string;
  directionParam: string;
  currentSort: SortOption;
  currentDirection: SortDirection;
  /** URL params this section owns, so both sections can page and search independently. */
  pageParam: string;
  searchParam: string;
  currentPage: number;
  pageSize: number;
  /** Total matching rows in the database, not just the ones on this page. */
  totalCount: number;
}

// Per-section styling, keyed by section type. Module scope so the card components
// below can read it without closing over `ResumesSection`.
const SECTION_CONFIG = {
    base: {
      gradient: 'from-purple-600 to-indigo-600',
      border: 'border-purple-300',
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      icon: FileText,
      accent: {
        bg: 'purple-100',
        hover: 'purple-100/50'
      }
    },
    tailored: {
      gradient: 'from-pink-600 to-rose-600',
      border: 'border-pink-300',
      bg: 'bg-pink-50',
      text: 'text-pink-600',
      icon: Sparkles,
      accent: {
        bg: 'pink-100',
        hover: 'pink-100/50'
      }
    }
} as const;

// Declared at module scope, NOT inside `ResumesSection`. A component defined in a render
// body gets a new type on every render, so React remounts its whole subtree — which
// would reset the create-resume dialog's `open` state and close it mid-interaction.
function CreateResumeCard({ type, profile }: { type: ResumesSectionProps['type']; profile: Profile }) {
  const config = SECTION_CONFIG[type];
  return (
    <CreateResumeDialog
      type={type}
      profile={profile}
    >
      <button className={cn(
        "aspect-[8.5/11] rounded-lg",
        "relative overflow-hidden",
        "border-2 border-dashed transition-all duration-500",
        "group/new-resume flex flex-col items-center justify-center gap-4",
        type === 'base'
          ? "border-purple-300/70 hover:border-purple-400"
          : "border-pink-300/70 hover:border-pink-400",
        type === 'base'
          ? "bg-gradient-to-br from-purple-50/80 via-purple-50/40 to-purple-100/60"
          : "bg-gradient-to-br from-pink-50/80 via-pink-50/40 to-pink-100/60",
        "hover:shadow-lg hover:shadow-purple-100/50 hover:-translate-y-1",
        "after:absolute after:inset-0 after:bg-gradient-to-br",
        type === 'base'
          ? "after:from-purple-600/[0.03] after:to-indigo-600/[0.03]"
          : "after:from-pink-600/[0.03] after:to-rose-600/[0.03]",
        "after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-500 w-full sm:w-auto mr-8 sm:mr-0"
      )}>
        <div className={cn(
          "relative z-10 flex flex-col items-center",
          "transform transition-all duration-500",
          "group-hover/new-resume:scale-105"
        )}>
          <div className={cn(
            "h-12 w-12 rounded-xl",
            "flex items-center justify-center",
            "transform transition-all duration-500",
            "shadow-sm group-hover/new-resume:shadow-md",
            type === 'base'
              ? "bg-gradient-to-br from-purple-100 to-purple-50"
              : "bg-gradient-to-br from-pink-100 to-pink-50",
            "group-hover/new-resume:scale-110"
          )}>
            <config.icon className={cn(
              "h-5 w-5 transition-all duration-500",
              type === 'base' ? "text-purple-600" : "text-pink-600",
              "group-hover/new-resume:scale-110"
            )} />
          </div>

          <span className={cn(
            "mt-4 text-sm font-medium",
            "transition-all duration-500",
            type === 'base' ? "text-purple-600" : "text-pink-600",
            "group-hover/new-resume:font-semibold"
          )}>
            Create {type === 'base' ? 'Base' : 'Tailored'} Resume
          </span>

          <span className={cn(
            "mt-2 text-xs",
            "transition-all duration-500 opacity-0",
            type === 'base' ? "text-purple-500" : "text-pink-500",
            "group-hover/new-resume:opacity-70"
          )}>
            Click to start
          </span>
        </div>
      </button>
    </CreateResumeDialog>
  );
}

function ResumeCard({
  resume,
  type,
  isDeleting,
  isCopying,
  onCopy,
  onDelete,
}: {
  resume: OptimisticResume;
  type: ResumesSectionProps['type'];
  isDeleting: boolean;
  isCopying: boolean;
  onCopy: (resume: OptimisticResume) => void;
  onDelete: (resume: OptimisticResume) => void;
}) {
  return (
    <div className={cn(
      "group relative transition-all duration-300",
      isDeleting && "opacity-50 pointer-events-none",
      resume.isOptimistic && "animate-in slide-in-from-top-1 duration-300"
    )}>
      <AlertDialog>
        <div className="relative">
          {/* Resume Preview - Conditional Link */}
          {resume.isOptimistic ? (
            // Not clickable during processing
            <div className={cn(
              "cursor-wait",
              "relative"
            )}>
              <MiniResumePreview
                name={resume.name}
                type={type}
                target_role={resume.target_role}
                createdAt={resume.created_at}
                className={cn(
                  "transition-all duration-300 opacity-60",
                  "pointer-events-none"
                )}
              />
              {/* Loading Overlay */}
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="text-xs font-medium text-blue-600">Copying...</span>
                </div>
              </div>
            </div>
          ) : (
            // Normal clickable resume
            <Link href={`/resumes/${resume.id}`}>
              <MiniResumePreview
                name={resume.name}
                type={type}
                target_role={resume.target_role}
                createdAt={resume.created_at}
                className="hover:-translate-y-1 transition-transform duration-300"
              />
            </Link>
          )}

          {/* Action Buttons */}
          {!resume.isOptimistic && (
            <div className="absolute bottom-2 left-2 flex gap-2">
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isDeleting}
                  className={cn(
                    "h-8 w-8 rounded-lg",
                    "bg-rose-50/80 hover:bg-rose-100/80",
                    "text-rose-600 hover:text-rose-700",
                    "border border-rose-200/60",
                    "shadow-sm",
                    "transition-all duration-300",
                    "hover:scale-105 hover:shadow-md",
                    "hover:-translate-y-0.5",
                    isDeleting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              
              {/* Copy Button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onCopy(resume)}
                disabled={isDeleting || isCopying}
                className={cn(
                  "h-8 w-8 rounded-lg",
                  "bg-teal-50/80 hover:bg-teal-100/80",
                  "text-teal-600 hover:text-teal-700",
                  "border border-teal-200/60",
                  "shadow-sm",
                  "transition-all duration-300",
                  "hover:scale-105 hover:shadow-md",
                  "hover:-translate-y-0.5",
                  (isDeleting || isCopying) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isCopying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resume</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{resume.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(resume)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


export function ResumesSection({
  type,
  resumes,
  profile,
  sortParam,
  directionParam,
  currentSort,
  currentDirection,
  pageParam,
  searchParam,
  currentPage,
  pageSize,
  totalCount,
}: ResumesSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Optimistic state for deletions
  const [optimisticResumes, removeOptimisticResume] = useOptimistic(
    resumes as OptimisticResume[],
    (state, deletedResumeId: string) => 
      state.filter(resume => resume.id !== deletedResumeId)
  );

  // Optimistic state for copying
  const [optimisticCopiedResumes, addOptimisticCopy] = useOptimistic(
    optimisticResumes,
    (state, newResume: OptimisticResume) => {
      // Always add new resume at the beginning (leftmost position)
      return [newResume, ...state];
    }
  );

  // `optimisticCopiedResumes` is this page's rows minus optimistic deletes plus optimistic
  // copies, so its drift from `resumes.length` is exactly the pending delta.
  const displayCount = Math.max(0, totalCount + optimisticCopiedResumes.length - resumes.length);

  const [, startTransition] = useTransition();
  const [deletingResumes, setDeletingResumes] = useState<Set<string>>(new Set());
  const [copyingResumes, setCopyingResumes] = useState<Set<string>>(new Set());

  const config = SECTION_CONFIG[type];

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeSearch = searchParams.get(searchParam) ?? '';

  // Handle optimistic deletion
  const handleDeleteResume = async (resumeId: string, resumeName: string) => {
    // Add to deleting set for visual feedback
    setDeletingResumes(prev => new Set(prev).add(resumeId));
    
    // Optimistically remove from UI immediately
    removeOptimisticResume(resumeId);
    
    // Show immediate feedback
    toast.loading(`Deleting "${resumeName}"...`, { id: resumeId });
    
    try {
      // Call server action in background
      await deleteResume(resumeId);
      
      // Success feedback
      toast.success(`"${resumeName}" deleted successfully`, { id: resumeId });
    } catch (error) {
      // On error, the optimistic update will automatically rollback
      console.error('Failed to delete resume:', error);
      toast.error(`Failed to delete "${resumeName}". Please try again.`, { id: resumeId });
    } finally {
      // Remove from deleting set
      setDeletingResumes(prev => {
        const newSet = new Set(prev);
        newSet.delete(resumeId);
        return newSet;
      });
    }
  };

  // Handle optimistic copying
  const handleCopyResume = async (sourceResume: OptimisticResume) => {
    // Add to copying set for visual feedback
    setCopyingResumes(prev => new Set(prev).add(sourceResume.id));
    
    // Create optimistic copy
    const optimisticCopy: OptimisticResume = {
      ...sourceResume,
      id: `temp-${Date.now()}-${Math.random()}`, // Temporary unique ID
      name: `${sourceResume.name} (Copy)`,
      isOptimistic: true,
      originalId: sourceResume.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Only show it where the real row will actually land once revalidation runs. On any
    // other page the card would appear and then silently vanish.
    const showsOptimisticCopy = currentPage === 1 && currentSort === 'createdAt' && currentDirection === 'desc';
    if (showsOptimisticCopy) {
      addOptimisticCopy(optimisticCopy);
    }
    
    // Show immediate feedback
    toast.loading(`Copying "${sourceResume.name}"...`, { id: `copy-${sourceResume.id}` });
    
    try {
      // Call server action in background
      await copyResume(sourceResume.id);
      
      // Success feedback - the real resume will appear via revalidation
      toast.success(`"${sourceResume.name}" copied successfully`, { id: `copy-${sourceResume.id}` });
    } catch (error) {
      // On error, the optimistic update will automatically rollback
      console.error('Failed to copy resume:', error);
      toast.error(`Failed to copy "${sourceResume.name}". Please try again.`, { id: `copy-${sourceResume.id}` });
    } finally {
      // Remove from copying set
      setCopyingResumes(prev => {
        const newSet = new Set(prev);
        newSet.delete(sourceResume.id);
        return newSet;
      });
    }
  };

  // Paging is a URL concern: the server reads it and returns only that page of rows.
  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;

    const params = new URLSearchParams(searchParams);
    if (page === 1) {
      params.delete(pageParam);
    } else {
      params.set(pageParam, String(page));
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }


  return (
    <div className="relative ">
      <div className="flex flex-col gap-4 w-full">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className={`text-2xl sm:text-3xl font-semibold tracking-tight bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`}>
            {type === 'base' ? 'Base' : 'Tailored'} Resumes
            {displayCount > 0 && (
              <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
                {displayCount}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2 mb-4">
            <ResumeSearchInput
              searchParam={searchParam}
              pageParam={pageParam}
              className={cn(
                "h-9 w-48",
                type === 'base'
                  ? "border-purple-200/60 focus-visible:ring-purple-400/40"
                  : "border-pink-200/60 focus-visible:ring-pink-400/40"
              )}
            />
            <ResumeSortControls
              sortParam={sortParam}
              directionParam={directionParam}
              pageParam={pageParam}
              currentSort={currentSort}
              currentDirection={currentDirection}
            />
          </div>
        </div>

        {/* Desktop Pagination (hidden on mobile) */}
        {totalPages > 1 && (
          <div className="hidden md:flex w-full items-start justify-start -mt-4">
            <Pagination className="flex justify-end">
              <PaginationContent className="gap-1">
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </PaginationItem>

                {Array.from({ length: totalPages }).map((_, index) => {
                  const pageNumber = index + 1;

                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={index}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePageChange(pageNumber)}
                          className={cn(
                            "h-8 w-8 p-0",
                            "text-muted-foreground hover:text-foreground",
                            currentPage === pageNumber && "font-medium text-foreground"
                          )}
                        >
                          {pageNumber}
                        </Button>
                      </PaginationItem>
                    );
                  }

                  if (
                    pageNumber === 2 && currentPage > 3 ||
                    pageNumber === totalPages - 1 && currentPage < totalPages - 2
                  ) {
                    return (
                      <PaginationItem key={index}>
                        <span className="text-muted-foreground px-2">...</span>
                      </PaginationItem>
                    );
                  }

                  return null;
                })}

                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <div className="relative pb-6">
        {/* Mobile View */}
        <div className="md:hidden w-full space-y-6">
          {/* Mobile Create Resume Button Row */}
          <div className="px-2 w-full  flex">
            <CreateResumeCard type={type} profile={profile} />
          </div>

          {/* Mobile Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 px-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Mobile Resumes Carousel */}
          {optimisticCopiedResumes.length > 0 && (
            <div className="w-full">
              <Carousel className="w-full">
                <CarouselContent>
                  {optimisticCopiedResumes.map((resume) => (
                    <CarouselItem key={resume.id} className="basis-[85%] pl-4">
                      <ResumeCard
                        resume={resume}
                        type={type}
                        isDeleting={deletingResumes.has(resume.id)}
                        isCopying={copyingResumes.has(resume.originalId || resume.id)}
                        onCopy={(target) => startTransition(() => { handleCopyResume(target); })}
                        onDelete={(target) => startTransition(() => { handleDeleteResume(target.id, target.name); })}
            />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <div className="hidden sm:block">
                  <CarouselPrevious className="absolute -left-12 top-1/2" />
                  <CarouselNext className="absolute -right-12 top-1/2" />
                </div>
              </Carousel>
            </div>
          )}
        </div>

        {/* Desktop Grid View */}
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          <CreateResumeCard type={type} profile={profile} />

          {optimisticCopiedResumes.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              type={type}
              isDeleting={deletingResumes.has(resume.id)}
              isCopying={copyingResumes.has(resume.originalId || resume.id)}
              onCopy={(target) => startTransition(() => { handleCopyResume(target); })}
              onDelete={(target) => startTransition(() => { handleDeleteResume(target.id, target.name); })}
            />
          ))}
          {optimisticCopiedResumes.length === 0 && (
            <div className="col-span-full sm:col-span-1 md:col-span-2 lg:col-span-3 flex items-center text-sm text-muted-foreground">
              {activeSearch
                ? `No ${type} resumes match "${activeSearch}".`
                : `No ${type} resumes yet.`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
