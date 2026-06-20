import CoverLetterEditor from "./cover-letter-editor";
import { useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useResumeEditorStore } from '@/components/resume/editor/store/resume-editor-store-provider';


interface CoverLetterProps {
    containerWidth: number;

}

export default function CoverLetter({ containerWidth }: CoverLetterProps) {
  const coverLetter = useResumeEditorStore((s) => s.resume.cover_letter);
  const hasCoverLetter = useResumeEditorStore((s) => s.resume.has_cover_letter);
  const updateField = useResumeEditorStore((s) => s.updateField);

  const handleContentChange = useCallback((data: Record<string, unknown>) => {
    const coverLetterData: import('@/lib/types').CoverLetterData = {
      ...coverLetter,
      content: data.content as string,
      lastUpdated: new Date().toISOString(),
    };
    updateField('cover_letter', coverLetterData);
  }, [updateField, coverLetter]);


  if (!hasCoverLetter) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-emerald-600/50 text-emerald-700 hover:bg-emerald-50"
          onClick={() => updateField('has_cover_letter', true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Cover Letter
        </Button>
      </div>
    );
  }

  return (
    <div className="">
      {/* Interactive editor */}
      <div className="[&_.print-hidden]:hidden">
        <CoverLetterEditor
          initialData={{ content: coverLetter?.content || '' }}
          onChange={handleContentChange}
          containerWidth={containerWidth}
        />
      </div>
    </div>
  );
}
