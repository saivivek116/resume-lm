'use client';

import { useEffect, useState } from "react";
import { useDefaultModel } from "@/hooks/use-api-keys";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Job, Resume, ResumeSummary } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { getResumeById, regenerateTailoredResume } from "@/utils/actions/resumes/actions";
import { tailorResumeToJob } from "@/utils/actions/jobs/ai";
import { getBaseResumeOptions } from "@/utils/actions";
import { BaseResumeSelector } from "../../management/base-resume-selector";
import { LoadingOverlay, type CreationStep } from "../../management/loading-overlay";
import { ApiErrorDialog } from "@/components/ui/api-error-dialog";
import { withBasePath } from "@/lib/utils";

interface RegenerateResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resume: Resume;
  job: Job;
  /** Called with the persisted resume once regeneration succeeds. */
  onRegenerated: (resume: Resume) => void;
}

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

function isApiKeyError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('api key') ||
    message.includes('unauthorized') ||
    message.includes('invalid key')
  );
}

export function RegenerateResumeDialog({
  open,
  onOpenChange,
  resume,
  job,
  onRegenerated,
}: RegenerateResumeDialogProps) {
  const { defaultModel } = useDefaultModel();
  const [baseResumes, setBaseResumes] = useState<ResumeSummary[] | null>(null);
  const [selectedBaseResume, setSelectedBaseResume] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<CreationStep>('tailoring');
  const [isBaseResumeInvalid, setIsBaseResumeInvalid] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState({ title: '', description: '' });

  // Base resumes are only needed once the dialog is opened, so load them lazily.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    getBaseResumeOptions()
      .then((resumes) => {
        if (cancelled) return;
        setBaseResumes(resumes);
        setSelectedBaseResume((current) => current || resumes[0]?.id || '');
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load base resumes:', error);
        setBaseResumes([]);
        toast({
          title: "Error",
          description: "Failed to load your base resumes. Please try again.",
          variant: "destructive",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isRegenerating) return;
    if (!nextOpen) setIsBaseResumeInvalid(false);
    onOpenChange(nextOpen);
  };

  const handleRegenerate = async () => {
    if (!selectedBaseResume) {
      setIsBaseResumeInvalid(true);
      toast({
        title: "Required Field Missing",
        description: "Please select a base resume to regenerate from.",
        variant: "destructive",
      });
      return;
    }

    setIsBaseResumeInvalid(false);
    setIsRegenerating(true);
    setCurrentStep('tailoring');

    try {
      const { resume: baseResume } = await getResumeById(selectedBaseResume);
      if (!baseResume) throw new Error("Base resume not found");

      const jobListing = {
        company_name: job.company_name,
        position_title: job.position_title,
        job_url: job.job_url,
        description: job.description,
        location: job.location,
        salary_range: job.salary_range,
        keywords: job.keywords,
        work_location: job.work_location,
        employment_type: job.employment_type ?? 'full_time',
        is_active: job.is_active,
      };

      let tailoredContent;
      try {
        tailoredContent = await tailorResumeToJob(baseResume, jobListing, {
          model: defaultModel || '',
        });
      } catch (error: unknown) {
        setErrorMessage({
          title: isApiKeyError(error) ? "API Key Error" : "Error",
          description: buildErrorDescription(
            isApiKeyError(error)
              ? "There was an issue with your API key. Please check your settings and try again"
              : "Failed to regenerate resume. Please try again",
            error
          ),
        });
        setShowErrorDialog(true);
        setIsRegenerating(false);
        return;
      }

      setCurrentStep('finalizing');
      const updated = await regenerateTailoredResume(resume.id, baseResume, tailoredContent);

      onRegenerated(updated);
      toast({
        title: "Resume regenerated",
        description: "Your resume has been re-tailored to this job.",
      });
      setIsRegenerating(false);
      onOpenChange(false);
    } catch (error: unknown) {
      console.error('Failed to regenerate resume:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to regenerate resume",
        variant: "destructive",
      });
      setIsRegenerating(false);
    }
  };

  const hasNoBaseResumes = baseResumes !== null && baseResumes.length === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[680px] p-0 max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-lg rounded-lg">
          {isRegenerating && (
            <LoadingOverlay currentStep={currentStep} />
          )}

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-50 border border-pink-100">
                <RefreshCw className="w-5 h-5 text-pink-600" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Regenerate Resume
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Re-tailor this resume for {job.position_title}
                  {job.company_name ? ` at ${job.company_name}` : ''}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* What regeneration does */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-amber-900">
                    This replaces the current resume — it can&apos;t be undone.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-amber-800">
                    <li>Work experience, skills, projects, education, certifications and the professional summary are rewritten.</li>
                    <li>Any cover letter on this resume is deleted.</li>
                    <li>Fonts, spacing, section order and the resume title are kept.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Base resume selection */}
            {baseResumes === null ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading your base resumes...
              </div>
            ) : hasNoBaseResumes ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
                <div className="p-3 rounded-lg bg-pink-50 border border-pink-100">
                  <Sparkles className="w-6 h-6 text-pink-600" />
                </div>
                <h3 className="font-semibold text-gray-900">No Base Resumes Found</h3>
                <p className="text-sm text-gray-600 max-w-sm">
                  Regeneration re-tailors a base resume for this job. Create a base resume first,
                  then come back here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Regenerate from</h3>
                  <p className="text-xs text-gray-600">
                    Pick the base resume the AI should tailor.
                  </p>
                </div>
                <BaseResumeSelector
                  baseResumes={baseResumes}
                  selectedResumeId={selectedBaseResume}
                  onResumeSelect={setSelectedBaseResume}
                  isInvalid={isBaseResumeInvalid}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerate}
              disabled={isRegenerating || hasNoBaseResumes || baseResumes === null}
              className="bg-pink-600 hover:bg-pink-700 text-white"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </>
              )}
            </Button>
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
