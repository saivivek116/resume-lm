'use client';

import { Resume } from "@/lib/types";
import { Document, Page, pdfjs } from 'react-pdf';
import { useState, useEffect, memo, useMemo, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import { CoverLetterPDFDocument } from './cover-letter-pdf-document';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { FileText } from 'lucide-react';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Separate cache from resume preview
const clPdfCache = new Map<string, { url: string; timestamp: number }>();

const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;
const CACHE_EXPIRATION_TIME = 30 * 60 * 1000;

function generateCoverLetterHash(resume: Resume): string {
  const content = JSON.stringify({
    coverLetter: resume.cover_letter,
    contact: {
      name: `${resume.first_name} ${resume.last_name}`,
      email: resume.email,
      phone: resume.phone_number,
      location: resume.location,
      website: resume.website,
      linkedin: resume.linkedin_url,
      github: resume.github_url,
    },
  });

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `cl_${hash.toString(36)}`;
}

function cleanupClCache() {
  const now = Date.now();
  for (const [hash, { url, timestamp }] of clPdfCache.entries()) {
    if (now - timestamp > CACHE_EXPIRATION_TIME) {
      URL.revokeObjectURL(url);
      clPdfCache.delete(hash);
    }
  }
}

if (typeof window !== 'undefined') {
  setInterval(cleanupClCache, CACHE_CLEANUP_INTERVAL);
}

interface CoverLetterPreviewProps {
  resume: Resume;
  containerWidth: number;
}

export const CoverLetterPreview = memo(function CoverLetterPreview({ resume, containerWidth }: CoverLetterPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const debouncedWidth = useDebouncedValue(containerWidth, 100);
  const [shouldRenderTextLayer, setShouldRenderTextLayer] = useState(false);

  const getPixelWidth = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    return debouncedWidth;
  }, [debouncedWidth]);

  const coverLetterHash = useMemo(() => generateCoverLetterHash(resume), [resume]);

  const content = resume.cover_letter?.content || '';

  // Generate or retrieve PDF from cache
  useEffect(() => {
    if (!content) {
      setUrl(null);
      return;
    }

    let currentUrl: string | null = null;

    async function generatePDF() {
      const cached = clPdfCache.get(coverLetterHash);
      if (cached) {
        currentUrl = cached.url;
        setUrl(cached.url);
        return;
      }

      const blob = await pdf(<CoverLetterPDFDocument resume={resume} />).toBlob();
      const newUrl = URL.createObjectURL(blob);
      currentUrl = newUrl;

      clPdfCache.set(coverLetterHash, { url: newUrl, timestamp: Date.now() });
      setUrl(newUrl);
    }

    generatePDF();

    return () => {
      if (currentUrl && !clPdfCache.has(coverLetterHash)) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [coverLetterHash, resume, content]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (url && !clPdfCache.has(coverLetterHash)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [coverLetterHash, url]);

  // Text layer visibility
  useEffect(() => {
    setShouldRenderTextLayer(false);
  }, [coverLetterHash]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
    setTimeout(() => setShouldRenderTextLayer(true), 1000);
  }

  // Empty state
  if (!content) {
    return (
      <div className="w-full aspect-[8.5/11] bg-white shadow-lg flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
        <FileText className="w-12 h-12" />
        <p className="text-sm">Cover letter preview will appear here</p>
      </div>
    );
  }

  // Loading state
  if (!url) {
    return (
      <div className="w-full aspect-[8.5/11] bg-white shadow-lg p-8">
        <div className="space-y-4 animate-pulse">
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 w-1/3 mx-auto" />
            <div className="flex justify-center gap-4">
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          </div>
          <div className="h-px bg-gray-200 my-4" />
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: `${85 + Math.random() * 15}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative bg-black/15">
      <Document
        file={url}
        onLoadSuccess={onDocumentLoadSuccess}
        className="relative h-full"
        externalLinkTarget="_blank"
        loading={
          <div className="w-full aspect-[8.5/11] bg-white p-8">
            <div className="space-y-4 animate-pulse">
              <div className="h-8 bg-gray-200 rounded-md w-1/3 mx-auto" />
              <div className="h-px bg-gray-200 my-4" />
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-3 bg-gray-200 rounded w-full" />
                ))}
              </div>
            </div>
          </div>
        }
      >
        {Array.from(new Array(numPages), (_, index) => (
          <Page
            key={`cl_page_${index + 1}`}
            pageNumber={index + 1}
            className="mb-4 shadow-xl"
            width={getPixelWidth()}
            renderAnnotationLayer={true}
            renderTextLayer={shouldRenderTextLayer}
          />
        ))}
      </Document>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.resume === nextProps.resume &&
    prevProps.containerWidth === nextProps.containerWidth
  );
});
