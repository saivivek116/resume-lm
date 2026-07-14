'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { updateResume } from '@/utils/actions/resumes/actions';
import { toast } from '@/hooks/use-toast';
import { useResumeEditorStore } from './resume-editor-store-provider';

const AUTO_SAVE_DELAY = 1000;

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Debounced auto-save for the resume editor. Subscribes to the store's `resume` and,
 * once edits settle for {@link AUTO_SAVE_DELAY}ms, persists it via the `updateResume`
 * server action — so points are never lost even if the user never clicks Save.
 *
 * Returns the current auto-save status for a subtle indicator in the UI.
 */
export function useAutoSave(): AutoSaveStatus {
  const resume = useResumeEditorStore((s) => s.resume);
  const hasUnsavedChanges = useResumeEditorStore((s) => s.hasUnsavedChanges);
  const setSaving = useResumeEditorStore((s) => s.setSaving);
  const markSaved = useResumeEditorStore((s) => s.markSaved);

  const debouncedResume = useDebouncedValue(resume, AUTO_SAVE_DELAY);
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!hasUnsavedChanges || inFlightRef.current) return;

    let cancelled = false;
    inFlightRef.current = true;
    setSaving(true);
    setStatus('saving');

    (async () => {
      try {
        await updateResume(debouncedResume.id, debouncedResume);
        if (cancelled) return;
        markSaved(debouncedResume);
        setStatus('saved');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        toast({
          title: 'Auto-save failed',
          description:
            error instanceof Error ? error.message : 'Your changes will be saved on the next edit.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) {
          inFlightRef.current = false;
          setSaving(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-run when the debounced snapshot changes; hasUnsavedChanges gates the actual save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedResume]);

  return status;
}
