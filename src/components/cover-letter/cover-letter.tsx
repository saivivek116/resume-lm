import CoverLetterEditor from "./cover-letter-editor";
import { useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useResumeContext } from '@/components/resume/editor/resume-editor-context';


interface CoverLetterProps {
    containerWidth: number;

}

export default function CoverLetter({ containerWidth }: CoverLetterProps) {
  const { state, dispatch } = useResumeContext();

  const handleContentChange = useCallback((data: Record<string, unknown>) => {
    const coverLetterData: import('@/lib/types').CoverLetterData = {
      ...state.resume.cover_letter,
      content: data.content as string,
      lastUpdated: new Date().toISOString(),
    };
    dispatch({
      type: 'UPDATE_FIELD',
      field: 'cover_letter',
      value: coverLetterData
    });
  }, [dispatch, state.resume.cover_letter]);


  if (!state.resume.has_cover_letter) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-emerald-600/50 text-emerald-700 hover:bg-emerald-50"
          onClick={() => dispatch({
            type: 'UPDATE_FIELD',
            field: 'has_cover_letter',
            value: true
          })}
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
          initialData={{ content: state.resume.cover_letter?.content || '' }}
          onChange={handleContentChange}
          containerWidth={containerWidth}
        />
      </div>
    </div>
  );
}
