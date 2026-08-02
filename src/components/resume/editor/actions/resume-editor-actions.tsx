'use client';

import { Job, Resume } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Download, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { pdf } from '@react-pdf/renderer';
import { TextImport } from "../../text-import";
import { RegenerateResumeDialog } from "../dialogs/regenerate-resume-dialog";
import { ResumePDFDocument } from "../preview/resume-pdf-document";
import { CoverLetterPDFDocument } from "@/components/cover-letter/cover-letter-pdf-document";
import { generateResumeDocx } from "@/lib/docx/resume-docx";
import { generateCoverLetterDocx } from "@/lib/docx/cover-letter-docx";
import { downloadBlob, buildDocFilename } from "@/lib/download-utils";
import { cn } from "@/lib/utils";
import { useResumeEditorStore } from "../store/resume-editor-store-provider";

import { updateResume } from "@/utils/actions/resumes/actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface ResumeEditorActionsProps {
  onResumeChange: (field: keyof Resume, value: Resume[keyof Resume]) => void;
  /** The job this resume is tailored to, if any. Required to offer regeneration. */
  job?: Job | null;
}

export function ResumeEditorActions({
  onResumeChange,
  job
}: ResumeEditorActionsProps) {
  const resume = useResumeEditorStore((s) => s.resume);
  const isSaving = useResumeEditorStore((s) => s.isSaving);
  const hasUnsavedChanges = useResumeEditorStore((s) => s.hasUnsavedChanges);
  const setSaving = useResumeEditorStore((s) => s.setSaving);
  const markSaved = useResumeEditorStore((s) => s.markSaved);
  const replaceResume = useResumeEditorStore((s) => s.replaceResume);
  const [downloadOptions, setDownloadOptions] = useState({
    resume: true,
    coverLetter: true
  });
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'word'>('pdf');
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  // Regeneration re-tailors against a linked job, so it only applies to tailored resumes.
  const canRegenerate = !resume.is_base_resume && !!resume.job_id && !!job;

  // Save Resume
  const handleSave = async () => {
    try {
      setSaving(true);
      await updateResume(resume.id, resume);
      markSaved(resume);
      toast({
        title: "Changes saved",
        description: "Your resume has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unable to save your changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  // Dynamic color classes based on resume type
  const colors = resume.is_base_resume ? {
    // Import button colors
    importBg: "bg-indigo-600",
    importHover: "hover:bg-indigo-700",
    importShadow: "shadow-indigo-400/20",
    // Action buttons colors (download & save)
    actionBg: "bg-purple-600",
    actionHover: "hover:bg-purple-700",
    actionShadow: "shadow-purple-400/20"
  } : {
    // Import button colors
    importBg: "bg-rose-600",
    importHover: "hover:bg-rose-700",
    importShadow: "shadow-rose-400/20",
    // Action buttons colors (download & save)
    actionBg: "bg-pink-600",
    actionHover: "hover:bg-pink-700",
    actionShadow: "shadow-pink-400/20"
  };

  
  const buttonBaseStyle = cn(
    "transition-all duration-300",
    "relative overflow-hidden",
    "h-8 px-3 text-[11px] font-medium",
    "rounded-md border-none",
    "text-white shadow-sm",
    "hover:shadow-md hover:-translate-y-[1px]",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
  );

  const importButtonClasses = cn(
    buttonBaseStyle,
    colors.importBg,
    colors.importHover,
    colors.importShadow
  );

  const actionButtonClasses = cn(
    buttonBaseStyle,
    colors.actionBg,
    colors.actionHover,
    colors.actionShadow
  );

  const saveStatus = isSaving
    ? "Saving…"
    : hasUnsavedChanges
      ? "Unsaved changes"
      : "All changes saved";

  return (
    <div className="px-1 py-2 @container">
      <div className="flex justify-end px-1 pb-1">
        <span
          className={cn(
            "text-[10px] font-medium transition-colors",
            isSaving
              ? "text-amber-600"
              : hasUnsavedChanges
                ? "text-gray-400"
                : "text-emerald-600"
          )}
        >
          {saveStatus}
        </span>
      </div>
      <div className={cn(
        "grid gap-2",
        // Four buttons are too cramped in a narrow editor panel, so wrap to two rows.
        canRegenerate ? "grid-cols-2 @md:grid-cols-4" : "grid-cols-3"
      )}>
        {/* Text Import Button */}
        <TextImport
          resume={resume}
          onResumeChange={onResumeChange}
          className={importButtonClasses}
        />

        {/* Download Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={async () => {
                  try {
                    const isWord = downloadFormat === 'word';
                    const ext = isWord ? 'docx' : 'pdf';

                    // Download Resume if selected
                    if (downloadOptions.resume) {
                      const blob = isWord
                        ? await generateResumeDocx(resume)
                        : await pdf(<ResumePDFDocument resume={resume} />).toBlob();
                      downloadBlob(blob, buildDocFilename(resume, 'Resume', ext));
                    }

                    // Download Cover Letter if selected and exists
                    if (downloadOptions.coverLetter && resume.has_cover_letter) {
                      const clBlob = isWord
                        ? await generateCoverLetterDocx(resume)
                        : await pdf(<CoverLetterPDFDocument resume={resume} />).toBlob();
                      downloadBlob(clBlob, buildDocFilename(resume, 'Cover_Letter', ext));
                    }

                    toast({
                      title: "Download started",
                      description: `Your documents are being downloaded as ${isWord ? 'Word' : 'PDF'}.`,
                    });
                  } catch (error) {
                    console.error(error);
                    toast({
                      title: "Download failed",
                      description: error instanceof Error ? error.message : "Unable to download your documents. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
                className={actionButtonClasses}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download
              </Button>
            </TooltipTrigger>
            <TooltipContent 
              side="bottom" 
              align="start"
              sideOffset={5}
              className={cn(
                "w-48 p-3",
                resume.is_base_resume 
                  ? "bg-indigo-50 border-2 border-indigo-200"
                  : "bg-rose-50 border-2 border-rose-200",
                "rounded-lg shadow-lg"
              )}
            >
              <div className="space-y-3">
                {/* Format selector */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-foreground/70">Format</span>
                  <div className={cn(
                    "flex rounded-md p-0.5",
                    resume.is_base_resume ? "bg-indigo-100" : "bg-rose-100"
                  )}>
                    {(['pdf', 'word'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setDownloadFormat(fmt)}
                        className={cn(
                          "flex-1 rounded-[5px] px-2 py-1 text-xs font-medium transition-all",
                          downloadFormat === fmt
                            ? cn(
                                "shadow-sm",
                                resume.is_base_resume ? "bg-indigo-600 text-white" : "bg-rose-600 text-white"
                              )
                            : "text-foreground/60 hover:text-foreground"
                        )}
                      >
                        {fmt === 'pdf' ? 'PDF' : 'Word'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={cn(
                  "h-px w-full",
                  resume.is_base_resume ? "bg-indigo-200" : "bg-rose-200"
                )} />
                <label className="flex items-center space-x-2">
                  <Checkbox
                    checked={downloadOptions.resume}
                    onCheckedChange={(checked) => 
                      setDownloadOptions(prev => ({ ...prev, resume: checked as boolean }))
                    }
                    className={cn(
                      resume.is_base_resume 
                        ? "border-indigo-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        : "border-rose-400 data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                    )}
                  />
                  <span className="text-sm font-medium text-foreground">Resume</span>
                </label>
                <label className="flex items-center space-x-2">
                  <Checkbox 
                    checked={downloadOptions.coverLetter}
                    onCheckedChange={(checked) => 
                      setDownloadOptions(prev => ({ ...prev, coverLetter: checked as boolean }))
                    }
                    className={cn(
                      resume.is_base_resume 
                        ? "border-indigo-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        : "border-rose-400 data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                    )}
                  />
                  <span className="text-sm font-medium text-foreground">Cover Letter</span>
                </label>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Save Button */}
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className={actionButtonClasses}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save
            </>
          )}
        </Button>

        {/* Regenerate Button (tailored resumes with a linked job only) */}
        {canRegenerate && (
          <Button
            onClick={() => setShowRegenerateDialog(true)}
            className={actionButtonClasses}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Regenerate
          </Button>
        )}
      </div>

      {canRegenerate && job && (
        <RegenerateResumeDialog
          open={showRegenerateDialog}
          onOpenChange={setShowRegenerateDialog}
          resume={resume}
          job={job}
          onRegenerated={replaceResume}
        />
      )}
    </div>
  );
}