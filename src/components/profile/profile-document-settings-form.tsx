'use client';

import { DocumentSettings, ResumeSectionId } from "@/lib/types";
import { DocumentSettingsForm } from "@/components/resume/editor/forms/document-settings-form";

interface ProfileDocumentSettingsFormProps {
  documentSettings: DocumentSettings;
  onChange: (field: 'document_settings', value: DocumentSettings) => void;
  sectionOrder?: ResumeSectionId[];
  onSectionOrderChange?: (order: ResumeSectionId[]) => void;
}

export function ProfileDocumentSettingsForm({
  documentSettings,
  onChange,
  sectionOrder,
  onSectionOrderChange,
}: ProfileDocumentSettingsFormProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200/50 bg-blue-50/50 p-4">
        <p className="text-sm text-blue-700">
          Set your default resume style settings here. These will be applied automatically when you create new base resumes.
        </p>
      </div>
      <DocumentSettingsForm
        documentSettings={documentSettings}
        onChange={onChange}
        showSavedStyles={false}
        sectionOrder={sectionOrder}
        onSectionOrderChange={onSectionOrderChange}
      />
    </div>
  );
}
