'use client';

import { Resume } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ResumePreview } from "../preview/resume-preview";
import { CoverLetterPreview } from "@/components/cover-letter/cover-letter-preview";
import { CoverLetterContextMenu } from "@/components/cover-letter/cover-letter-context-menu";
import { ResumeContextMenu } from "../preview/resume-context-menu";
import { pdf } from '@react-pdf/renderer';
import { CoverLetterPDFDocument } from "@/components/cover-letter/cover-letter-pdf-document";
import { toast } from "@/hooks/use-toast";

interface PreviewPanelProps {
  resume: Resume;
  onResumeChange: (field: keyof Resume, value: Resume[keyof Resume]) => void;
  width: number;
}

export function PreviewPanel({
  resume,
  width
}: PreviewPanelProps) {
  const handleDownloadCoverLetterPDF = async () => {
    try {
      const blob = await pdf(<CoverLetterPDFDocument resume={resume} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resume.first_name}_${resume.last_name}_Cover_Letter.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: "Your cover letter is being downloaded." });
    } catch (error) {
      console.error(error);
      toast({ title: "Download failed", description: "Unable to download cover letter.", variant: "destructive" });
    }
  };

  const handleCopyCoverLetterToClipboard = async () => {
    try {
      const content = resume.cover_letter?.content || '';
      // Strip HTML tags to get plain text
      const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      await navigator.clipboard.writeText(plainText);
      toast({ title: "Copied!", description: "Cover letter copied to clipboard." });
    } catch (error) {
      console.error(error);
      toast({ title: "Copy failed", description: "Unable to copy cover letter.", variant: "destructive" });
    }
  };

  return (
    <ScrollArea className={cn(
      "z-50 h-full",
      resume.is_base_resume
        ? "bg-purple-50/30"
        : "bg-pink-50/60 shadow-sm shadow-pink-200/20"
    )}>
      <div className="">
      <ResumeContextMenu resume={resume}>
          <ResumePreview resume={resume} containerWidth={width} />
        </ResumeContextMenu>
      </div>

      {resume.has_cover_letter && resume.cover_letter?.content && (
        <CoverLetterContextMenu
          onDownloadPDF={handleDownloadCoverLetterPDF}
          onCopyToClipboard={handleCopyCoverLetterToClipboard}
        >
          <CoverLetterPreview resume={resume} containerWidth={width} />
        </CoverLetterContextMenu>
      )}
    </ScrollArea>
  );
}
