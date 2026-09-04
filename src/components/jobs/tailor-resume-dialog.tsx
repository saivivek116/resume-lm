'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDefaultModel } from "@/hooks/use-api-keys";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, MapPin, Building2 } from "lucide-react";
import { getBaseResumeOptions } from "@/utils/actions";
import { getResumeById, createTailoredResume } from "@/utils/actions/resumes/actions";
import { tailorResumeToJob, checkJobEligibility } from "@/utils/actions/jobs/ai";
import { BaseResumeSelector } from "@/components/resume/management/base-resume-selector";
import { LoadingOverlay, type CreationStep } from "@/components/resume/management/loading-overlay";
import { confirmEligibilityOverride } from "@/utils/eligibility-warning";
import { ApiErrorDialog } from "@/components/ui/api-error-dialog";
import { toast } from "@/hooks/use-toast";
import type { Job, ResumeSummary } from "@/lib/types";

interface TailorResumeDialogProps {
  job: Job;
  children: React.ReactNode;
}

export function TailorResumeDialog({ job, children }: TailorResumeDialogProps) {
  const { defaultModel } = useDefaultModel();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [baseResumes, setBaseResumes] = useState<ResumeSummary[]>([]);
  const [isFetchingResumes, setIsFetchingResumes] = useState(false);
  const [selectedBaseResume, setSelectedBaseResume] = useState('');
  const [isBaseResumeInvalid, setIsBaseResumeInvalid] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [currentStep, setCurrentStep] = useState<CreationStep>('tailoring');
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState({ title: '', description: '' });

  function redactSecrets(text: string) {
    return text
      .replace(/Bearer\s+[^,\s]+/gi, 'Bearer ***')
      .replace(/sk-[a-zA-Z0-9]{8,}/g, 'sk-***')
      .replace(/AIza[0-9A-Za-z\-_]{20,}/g, 'AIza***');
  }

  function buildErrorDescription(summary: string, error: unknown) {
    let details = '';
    if (error instanceof Error) details = redactSecrets(error.message);
    else if (typeof error === 'string') details = redactSecrets(error);
    return `${summary}${details ? ` Details: ${details}` : ''}. Contact the developer at hi@alexo.ca for help.`;
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelectedBaseResume('');
      setIsBaseResumeInvalid(false);
      setIsFetchingResumes(true);
      getBaseResumeOptions().then(resumes => {
        setBaseResumes(resumes);
        setSelectedBaseResume(resumes[0]?.id || '');
      }).finally(() => setIsFetchingResumes(false));
    } else {
      setIsCheckingEligibility(false);
    }
  };

  const doTailor = async (skipEligibilityCheck = false) => {
    if (!selectedBaseResume) {
      setIsBaseResumeInvalid(true);
      toast({ title: "Error", description: "Please select a base resume", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      if (!skipEligibilityCheck) {
        setIsCheckingEligibility(true);
        let flagged = false;
        let flaggedSentences: string[] = [];
        try {
          const result = await checkJobEligibility(job.description || '');
          flagged = result.flagged;
          flaggedSentences = result.flaggedSentences;
        } finally {
          setIsCheckingEligibility(false);
        }

        if (flagged && !confirmEligibilityOverride(flaggedSentences)) {
          setIsCreating(false);
          return;
        }
      }

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

      setCurrentStep('tailoring');
      let tailoredContent;
      try {
        tailoredContent = await tailorResumeToJob(baseResume, jobListing, { model: defaultModel || '' });
      } catch (error: unknown) {
        const isApiKeyError = error instanceof Error && (
          error.message.toLowerCase().includes('api key') ||
          error.message.toLowerCase().includes('unauthorized') ||
          error.message.toLowerCase().includes('invalid key')
        );
        setErrorMessage({
          title: isApiKeyError ? "API Key Error" : "Error",
          description: buildErrorDescription(
            isApiKeyError
              ? "There was an issue with your API key. Please check your settings and try again"
              : "Failed to tailor resume. Please try again",
            error
          )
        });
        setShowErrorDialog(true);
        setIsCreating(false);
        return;
      }

      setCurrentStep('finalizing');
      const resume = await createTailoredResume(
        baseResume,
        job.id,
        job.position_title,
        job.company_name,
        tailoredContent,
      );

      toast({ title: "Success", description: "Resume tailored successfully" });
      setOpen(false);
      router.push(`/resumes/${resume.id}`);
    } catch (error: unknown) {
      console.error('Failed to tailor resume:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to tailor resume",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[680px] p-0 max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-lg rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-50 border border-teal-100">
                <Sparkles className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Tailor Resume
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Select a base resume to tailor for this role
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-5 min-h-[320px] relative">
            {(isCreating || isCheckingEligibility) && <LoadingOverlay currentStep={currentStep} />}

            {/* Job summary */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-4 space-y-1.5">
              <p className="text-sm font-semibold text-teal-900">{job.position_title}</p>
              <div className="flex items-center gap-1.5 text-teal-700">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <p className="text-sm">{job.company_name}</p>
              </div>
              {job.location && (
                <div className="flex items-center gap-1.5 text-teal-600">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <p className="text-xs">{job.location}</p>
                </div>
              )}
              {job.work_location && (
                <p className="text-xs text-teal-500 capitalize">{job.work_location.replace('_', ' ')}</p>
              )}
            </div>

            {/* Base resume selector */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Choose your foundation</h4>
              {isFetchingResumes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                  <span className="ml-2 text-sm text-gray-500">Loading your resumes…</span>
                </div>
              ) : baseResumes.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No base resumes found. Create a base resume first on the home page.
                </div>
              ) : (
                <BaseResumeSelector
                  baseResumes={baseResumes}
                  selectedResumeId={selectedBaseResume}
                  onResumeSelect={setSelectedBaseResume}
                  isInvalid={isBaseResumeInvalid}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} size="sm" disabled={isCreating}>
              Cancel
            </Button>
            <Button
              onClick={() => doTailor()}
              disabled={isCreating || isCheckingEligibility || isFetchingResumes || baseResumes.length === 0}
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isCheckingEligibility ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking…</>
              ) : isCreating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Tailoring…</>
              ) : (
                'Tailor Resume'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ApiErrorDialog
        open={showErrorDialog}
        onOpenChange={setShowErrorDialog}
        errorMessage={errorMessage}
        onUpgrade={() => { setShowErrorDialog(false); router.push('/subscription'); }}
        onSettings={() => { setShowErrorDialog(false); router.push('/settings'); }}
      />
    </>
  );
}
