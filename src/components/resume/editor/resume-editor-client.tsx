'use client';

import { Resume, Profile, Job } from "@/lib/types";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { createClient } from "@/utils/supabase/client";
import { EditorLayout } from "./layout/EditorLayout";
import { EditorPanel } from './panels/editor-panel';
import { PreviewPanel } from './panels/preview-panel';
import { UnsavedChangesDialog } from './dialogs/unsaved-changes-dialog';
import { ResumeStoreProvider, useResumeEditorStore } from './store/resume-editor-store-provider';
import { useAutoSave } from './store/use-auto-save';

interface ResumeEditorClientProps {
  initialResume: Resume;
  profile: Profile;
  initialJob?: Job | null;
}

export function ResumeEditorClient({
  initialResume,
  profile,
  initialJob,
}: ResumeEditorClientProps) {
  return (
    <ResumeStoreProvider initialResume={initialResume}>
      <ResumeEditorContent profile={profile} initialJob={initialJob} />
    </ResumeStoreProvider>
  );
}

function ResumeEditorContent({
  profile,
  initialJob,
}: {
  profile: Profile;
  initialJob?: Job | null;
}) {
  const router = useRouter();
  const resume = useResumeEditorStore((s) => s.resume);
  const hasUnsavedChanges = useResumeEditorStore((s) => s.hasUnsavedChanges);
  const updateField = useResumeEditorStore((s) => s.updateField);

  // Debounced auto-save: persists settled edits so points are never lost.
  useAutoSave();

  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const debouncedResume = useDebouncedValue(resume, 100);
  const [job, setJob] = useState<Job | null>(initialJob ?? null);
  const [isLoadingJob, setIsLoadingJob] = useState(false);

  // Single job fetching effect
  useEffect(() => {
    if (!resume.job_id) {
      setJob(null);
      setIsLoadingJob(false);
      return;
    }

    if (job?.id === resume.job_id) {
      return;
    }

    let isCancelled = false;

    async function fetchJob() {
      try {
        setIsLoadingJob(true);
        const supabase = createClient();
        const { data: jobData, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', resume.job_id)
          .single();

        if (isCancelled) {
          return;
        }

        if (error) {
          void error;
          setJob(null);
          return;
        }

        setJob(jobData);
      } catch {
        if (!isCancelled) {
          setJob(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingJob(false);
        }
      }
    }

    fetchJob();

    return () => {
      isCancelled = true;
    };
  }, [resume.job_id, job?.id]);

  // Handle beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Editor Panel
  const editorPanel = (
    <EditorPanel
      resume={resume}
      profile={profile}
      job={job}
      isLoadingJob={isLoadingJob}
      onResumeChange={updateField}
    />
  );

  // Preview Panel
  const previewPanel = (width: number) => (
    <PreviewPanel
      resume={debouncedResume}
      onResumeChange={updateField}
      width={width}
    />
  );

  return (
    <>
      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showExitDialog}
        onOpenChange={setShowExitDialog}
        onConfirm={() => {
          if (pendingNavigation) {
            router.push(pendingNavigation);
          }
          setShowExitDialog(false);
          setPendingNavigation(null);
        }}
      />

      {/* Editor Layout */}
      <EditorLayout
        isBaseResume={resume.is_base_resume}
        editorPanel={editorPanel}
        previewPanel={previewPanel}
      />
    </>
  );
}
