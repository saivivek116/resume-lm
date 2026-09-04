'use client';

import { useEffect, useState } from "react";
import { useDefaultModel } from "@/hooks/use-api-keys";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Profile, ResumeSummary } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Plus, Brain, Copy, AlertTriangle } from "lucide-react";
import { getBaseResumeOptions } from "@/utils/actions";
import { createTailoredResume, getResumeById } from "@/utils/actions/resumes/actions";
import { CreateBaseResumeDialog } from "./create-base-resume-dialog";
import { tailorResumeToJob, formatJobListing, checkJobEligibility } from "@/utils/actions/jobs/ai";
import { confirmEligibilityOverride } from "@/utils/eligibility-warning";
import { createJob } from "@/utils/actions/jobs/actions";
import { MiniResumePreview } from "../../shared/mini-resume-preview";
import { LoadingOverlay, type CreationStep } from "../loading-overlay";
import { BaseResumeSelector } from "../base-resume-selector"; 
import { ImportMethodRadioGroup } from "../import-method-radio-group";
import { JobDescriptionInput } from "../job-description-input";
import { ApiErrorDialog } from "@/components/ui/api-error-dialog";
import { cn, withBasePath } from "@/lib/utils";

interface CreateTailoredResumeDialogProps {
  children: React.ReactNode;
  baseResumes?: ResumeSummary[];
  profile?: Profile;
}

/** 'idle' only ever shows before the first open; the dialog loads its list on open. */
type BaseResumesStatus = 'idle' | 'loading' | 'ready' | 'error';

export function CreateTailoredResumeDialog({ children, baseResumes: initialBaseResumes, profile }: CreateTailoredResumeDialogProps) {
  const { defaultModel } = useDefaultModel();
  const [open, setOpen] = useState(false);
  // Loaded when the dialog opens rather than on every dashboard render: the picker is the
  // only consumer, and eager-loading cost the page an extra query it usually never used.
  const [baseResumes, setBaseResumes] = useState<ResumeSummary[]>(initialBaseResumes ?? []);
  const [baseResumesStatus, setBaseResumesStatus] = useState<BaseResumesStatus>(
    initialBaseResumes?.length ? 'ready' : 'idle'
  );
  // Bumped by the retry button to re-run the load effect.
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedBaseResume, setSelectedBaseResume] = useState<string>(initialBaseResumes?.[0]?.id || '');
  const [jobDescription, setJobDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [currentStep, setCurrentStep] = useState<CreationStep>('analyzing');
  const [dialogStep, setDialogStep] = useState<1 | 2>(1);
  const [importOption, setImportOption] = useState<'import-profile' | 'ai'>('ai');
  const [isBaseResumeInvalid, setIsBaseResumeInvalid] = useState(false);
  const [isJobDescriptionInvalid, setIsJobDescriptionInvalid] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState({ title: '', description: '' });
  const router = useRouter();

  function redactSecrets(text: string) {
    return text
      .replace(/Bearer\s+[^,\s]+/gi, 'Bearer ***')
      .replace(/sk-[a-zA-Z0-9]{8,}/g, 'sk-***')
      .replace(/AIza[0-9A-Za-z\-_]{20,}/g, 'AIza***');
  }

  function getErrorDetails(error: unknown) {
    if (error instanceof Error) return redactSecrets(error.message);
    if (typeof error === 'string') return redactSecrets(error);
    if (!error) return '';
    try {
      return redactSecrets(JSON.stringify(error));
    } catch {
      return '';
    }
  }

  function buildErrorDescription(summary: string, error: unknown) {
    const details = getErrorDetails(error);
    const detailsText = details ? ` Details: ${details}` : '';
    return `${summary}${detailsText}. Contact the developer at hi@alexo.ca for help.`;
  }

  const handleNext = () => {
    if (!selectedBaseResume) {
      setIsBaseResumeInvalid(true);
      toast({
        title: "Required Field Missing",
        description: "Please select a base resume to continue.",
        variant: "destructive",
      });
      return;
    }
    setDialogStep(2);
  };

  const handleBack = () => {
    setDialogStep(1);
  };

  const proceedWithCreate = async () => {
    try {
      setIsCreating(true);
      setCurrentStep('analyzing');

      // Reset validation states
      setIsBaseResumeInvalid(false);
      setIsJobDescriptionInvalid(false);

      if (importOption === 'import-profile') {
        // Direct copy logic
        const { resume: baseResume } = await getResumeById(selectedBaseResume);
        if (!baseResume) throw new Error("Base resume not found");

        let jobId: string | null = null;
        let jobTitle = 'Copied Resume';
        let companyName = '';

        if (jobDescription.trim()) {
          try {
            setCurrentStep('analyzing');
            const formattedJobListing = await formatJobListing(jobDescription, {
              model: defaultModel || '',
            });

            setCurrentStep('formatting');
            const jobEntry = await createJob(formattedJobListing);
            if (!jobEntry?.id) throw new Error("Failed to create job entry");
            
            jobId = jobEntry.id;
            jobTitle = formattedJobListing.position_title || 'Copied Resume';
            companyName = formattedJobListing.company_name || '';
          } catch (error: Error | unknown) {
            if (error instanceof Error && (
                error.message.toLowerCase().includes('api key') || 
                error.message.toLowerCase().includes('unauthorized') ||
                error.message.toLowerCase().includes('invalid key'))
            ) {
              setErrorMessage({
                title: "API Key Error",
                description: buildErrorDescription(
                  "There was an issue with your API key. Please check your settings and try again",
                  error
                )
              });
            } else {
              setErrorMessage({
                title: "Error",
                description: buildErrorDescription("Failed to process job description. Please try again", error)
              });
            }
            setShowErrorDialog(true);
            setIsCreating(false);
            return;
          }
        }

        const resume = await createTailoredResume(
          baseResume,
          jobId,
          jobTitle,
          companyName,
          {
            work_experience: baseResume.work_experience.map(we => ({
              ...we,
              location: we.location ?? '',
              technologies: we.technologies ?? []
            })),
            education: baseResume.education.map(edu => ({
              ...edu,
              gpa: edu.gpa?.toString() ?? '',
              location: edu.location ?? '',
              achievements: edu.achievements ?? []
            })),
            skills: baseResume.skills,
            projects: baseResume.projects?.map(p => ({
              ...p,
              date: p.date ?? '',
              technologies: p.technologies ?? [],
              url: p.url ?? '',
              github_url: p.github_url ?? ''
            })),
            target_role: baseResume.target_role
          }
        );

        toast({
          title: "Success",
          description: "Resume created successfully",
        });

        router.push(`/resumes/${resume.id}`);
        setOpen(false);
        return;
      }

      // 1. Format the job listing
      let formattedJobListing;
      try {
        formattedJobListing = await formatJobListing(jobDescription, {
          model: defaultModel || '',
        });
      } catch (error: Error | unknown) {
        if (error instanceof Error && (
            error.message.toLowerCase().includes('api key') || 
            error.message.toLowerCase().includes('unauthorized') ||
            error.message.toLowerCase().includes('invalid key'))
        ) {
          setErrorMessage({
            title: "API Key Error",
            description: buildErrorDescription(
              "There was an issue with your API key. Please check your settings and try again",
              error
            )
          });
        } else {
          setErrorMessage({
            title: "Error",
            description: buildErrorDescription("Failed to analyze job description. Please try again", error)
          });
        }
        setShowErrorDialog(true);
        setIsCreating(false);
        return;
      }

      setCurrentStep('formatting');

      // 2. Create job in database and get ID
      const jobEntry = await createJob(formattedJobListing);
      if (!jobEntry?.id) throw new Error("Failed to create job entry");


      // 3. Get the base resume object
      const { resume: baseResume } = await getResumeById(selectedBaseResume);
      if (!baseResume) throw new Error("Base resume not found");

      setCurrentStep('tailoring');

      // 4. Tailor the resume using the formatted job listing
      let tailoredContent;

      try {
        tailoredContent = await tailorResumeToJob(baseResume, formattedJobListing, {
          model: defaultModel || '',
        });
      } catch (error: Error | unknown) {
        if (error instanceof Error && (
            error.message.toLowerCase().includes('api key') || 
            error.message.toLowerCase().includes('unauthorized') ||
            error.message.toLowerCase().includes('invalid key'))
        ) {
          setErrorMessage({
            title: "API Key Error",
            description: buildErrorDescription(
              "There was an issue with your API key. Please check your settings and try again",
              error
            )
          });
        } else {
          setErrorMessage({
            title: "Error",
            description: buildErrorDescription("Failed to tailor resume. Please try again", error)
          });
        }
        setShowErrorDialog(true);
        setIsCreating(false);
        return;
      }


      setCurrentStep('finalizing');

      
      // 5. Create the tailored resume with job reference
      const resume = await createTailoredResume(
        baseResume,
        jobEntry.id,
        formattedJobListing.position_title || '',
        formattedJobListing.company_name || '',
        tailoredContent,
      );

      toast({
        title: "Success",
        description: "Resume created successfully",
      });

      router.push(`/resumes/${resume.id}`);
      setOpen(false);
    } catch (error: unknown) {
      console.error('Failed to create resume:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create resume",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    // A re-open with a list already in hand refreshes in the background instead of
    // flashing a spinner over resumes the user can already see.
    setBaseResumesStatus((current) => (current === 'ready' ? current : 'loading'));
    getBaseResumeOptions()
      .then((resumes) => {
        if (cancelled) return;
        setBaseResumes(resumes);
        setSelectedBaseResume((current) => current || resumes[0]?.id || '');
        setBaseResumesStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load base resumes:', error);
        setBaseResumesStatus('error');
      });

    return () => { cancelled = true; };
  }, [open, reloadToken]);

  // Reset form when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setJobDescription('');
      setDialogStep(1);
      setImportOption('ai');
      setSelectedBaseResume(baseResumes[0]?.id || '');
      // Set here as well as in the effect: effects run after paint, so without this the
      // first painted frame would show the "no base resumes" state before the spinner.
      setBaseResumesStatus((current) => (current === 'ready' ? current : 'loading'));
    } else {
      setIsCheckingEligibility(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedBaseResume) {
      setIsBaseResumeInvalid(true);
      toast({
        title: "Error",
        description: "Please select a base resume",
        variant: "destructive",
      });
      return;
    }

    if (!jobDescription.trim() && importOption === 'ai') {
      setIsJobDescriptionInvalid(true);
      toast({
        title: "Error",
        description: "Please enter a job description",
        variant: "destructive",
      });
      return;
    }

    if (importOption === 'ai' && jobDescription.trim()) {
      let flagged = false;
      let flaggedSentences: string[] = [];
      setIsCheckingEligibility(true);
      try {
        const result = await checkJobEligibility(jobDescription);
        flagged = result.flagged;
        flaggedSentences = result.flaggedSentences;
      } finally {
        setIsCheckingEligibility(false);
      }

      if (flagged && !confirmEligibilityOverride(flaggedSentences)) {
        return;
      }
    }

    await proceedWithCreate();
  };

  // The list arrives after the dialog is already open, so loading, empty, error and ready
  // are rendered as *content* inside one persistent <Dialog>. Returning a differently
  // shaped tree for any of them changes the root element type mid-interaction, which makes
  // React tear down and rebuild the whole Radix subtree — and the dialog closes itself.
  const isLoadingBaseResumes = baseResumesStatus === 'loading';
  const hasLoadFailed = baseResumesStatus === 'error';
  const showWizard = !isLoadingBaseResumes && !hasLoadFailed && baseResumes.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className={cn(
          "p-0 max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-lg rounded-lg",
          showWizard ? "sm:max-w-[800px]" : "sm:max-w-[500px]"
        )}>
          <style jsx global>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
              20%, 40%, 60%, 80% { transform: translateX(2px); }
            }
            .shake {
              animation: shake 0.8s cubic-bezier(.36,.07,.19,.97) both;
            }
          `}</style>
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-50 border border-pink-100">
                <Sparkles className="w-5 h-5 text-pink-600" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Create Tailored Resume
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  {isLoadingBaseResumes
                    ? "Loading your base resumes"
                    : hasLoadFailed
                      ? "We couldn't load your base resumes"
                      : !showWizard
                        ? "A base resume is required to tailor from"
                        : dialogStep === 1
                          ? "Choose a base resume to start with"
                          : "Configure job details and tailoring method"
                  }
                </DialogDescription>
              </div>
              {/* Step indicator */}
              {showWizard && (
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                    dialogStep >= 1 ? "bg-pink-600 text-white" : "bg-gray-200 text-gray-600"
                  )}>
                    1
                  </div>
                  <div className={cn(
                    "w-4 h-0.5",
                    dialogStep >= 2 ? "bg-pink-600" : "bg-gray-200"
                  )} />
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                    dialogStep >= 2 ? "bg-pink-600 text-white" : "bg-gray-200 text-gray-600"
                  )}>
                    2
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className={cn("px-6 py-2 relative", showWizard && "min-h-[400px]")}>
            {isCreating && <LoadingOverlay currentStep={currentStep} />}

            {isLoadingBaseResumes && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <Loader2 className="w-6 h-6 text-pink-600 animate-spin" />
                <p className="text-sm text-gray-600">Loading your base resumes...</p>
              </div>
            )}

            {hasLoadFailed && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <h3 className="font-semibold text-lg text-gray-900">Couldn&apos;t Load Base Resumes</h3>
                  <p className="text-sm text-gray-600">
                    Something went wrong while fetching your base resumes. Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => setReloadToken((token) => token + 1)}
                >
                  Try Again
                </Button>
              </div>
            )}

            {!isLoadingBaseResumes && !hasLoadFailed && baseResumes.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="p-3 rounded-lg bg-pink-50 border border-pink-100">
                  <Sparkles className="w-6 h-6 text-pink-600" />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <h3 className="font-semibold text-lg text-gray-900">No Base Resumes Found</h3>
                  <p className="text-sm text-gray-600">
                    You need to create a base resume first before you can create a tailored version.
                  </p>
                </div>
                {profile ? (
                  <CreateBaseResumeDialog profile={profile}>
                    <Button className="mt-2 bg-purple-600 hover:bg-purple-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Base Resume
                    </Button>
                  </CreateBaseResumeDialog>
                ) : (
                  <Button disabled className="mt-2">
                    No profile available to create base resume
                  </Button>
                )}
              </div>
            )}

            {showWizard && dialogStep === 1 && (
              <div className="space-y-6">
                {/* Header Section */}
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 mb-1">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Choose Your Foundation</h3>
                  <p className="text-gray-600 max-w-sm mx-auto text-sm">
                    Select a base resume to tailor for this job opportunity.
                  </p>
                </div>
                
                {/* Resume Selector */}
                <div className="space-y-4">
                  <BaseResumeSelector
                    baseResumes={baseResumes}
                    selectedResumeId={selectedBaseResume}
                    onResumeSelect={setSelectedBaseResume}
                    isInvalid={isBaseResumeInvalid}
                  />
                </div>

              </div>
            )}

            {showWizard && dialogStep === 2 && (
              <div className="space-y-6">

                {/* Selected Resume Summary */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <MiniResumePreview
                        name={baseResumes.find(r => r.id === selectedBaseResume)?.name || ''}
                        type="base"
                        className="w-10 h-10"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-purple-900">Foundation:</span>
                        <span className="text-sm text-purple-700 font-semibold truncate">
                          {baseResumes.find(r => r.id === selectedBaseResume)?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Job Description Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center">
                      <span className="text-pink-600 font-bold text-sm">1</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Job Information <span className="text-red-500">*</span></h4>
                      <p className="text-xs text-gray-600">Paste the job posting details</p>
                    </div>
                  </div>

                  <div className="ml-10">
                    <JobDescriptionInput
                      value={jobDescription}
                      onChange={setJobDescription}
                      isInvalid={isJobDescriptionInvalid}
                    />
                  </div>
                </div>

                {/* Tailoring Method Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center">
                      <span className="text-pink-600 font-bold text-sm">2</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Tailoring Method</h4>
                      <p className="text-xs text-gray-600">Choose your customization approach</p>
                    </div>
                  </div>
                  
                  <div className="ml-10">
                    <ImportMethodRadioGroup
                      value={importOption}
                      onChange={setImportOption}
                    />
                  </div>
                </div>

                {/* Method Description */}
                {importOption === 'ai' && (
                  <div className="ml-10 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Brain className="w-3 h-3 text-blue-600" />
                      </div>
                      <div className="space-y-1">
                        <h5 className="font-medium text-blue-900 text-sm">AI Tailoring Process</h5>
                        <ul className="text-xs text-blue-800 space-y-0.5">
                          <li className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                            Analyzes job requirements and keywords
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                            Optimizes your experience descriptions
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                            Highlights relevant skills and achievements
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {importOption === 'import-profile' && (
                  <div className="ml-10 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Copy className="w-3 h-3 text-amber-600" />
                      </div>
                      <div className="space-y-1">
                        <h5 className="font-medium text-amber-900 text-sm">Direct Copy Process</h5>
                        <ul className="text-xs text-amber-800 space-y-0.5">
                          <li className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-amber-400"></div>
                            Creates an exact copy of your base resume
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-amber-400"></div>
                            Links it to the job posting for organization
                          </li>
                          <li className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-amber-400"></div>
                            You can manually edit it afterwards
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex justify-between">
              <div>
                {showWizard && dialogStep === 2 && (
                  <Button variant="outline" onClick={handleBack} size="sm">
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} size="sm">
                  Cancel
                </Button>
                {showWizard && dialogStep === 1 && (
                  <Button onClick={handleNext} size="sm" className="bg-pink-600 hover:bg-pink-700">
                    Next
                  </Button>
                )}
                {showWizard && dialogStep === 2 && (
                  <Button
                    onClick={handleCreate}
                    disabled={isCreating || isCheckingEligibility}
                    size="sm"
                    className="bg-pink-600 hover:bg-pink-700 text-white"
                  >
                    {isCheckingEligibility ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Resume'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <ApiErrorDialog
        open={showErrorDialog}
        onOpenChange={setShowErrorDialog}
        errorMessage={errorMessage}
        onUpgrade={() => {
          setShowErrorDialog(false);
          window.location.href = withBasePath('/subscription');
        }}
        onSettings={() => {
          setShowErrorDialog(false);
          window.location.href = withBasePath('/settings');
        }}
      />
    </>
  );
} 
