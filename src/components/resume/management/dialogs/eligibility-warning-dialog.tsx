'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EligibilityWarningDialogProps {
  open: boolean;
  flaggedSentences: string[];
  onContinue: () => void;
  onGoBack: () => void;
}

export function EligibilityWarningDialog({
  open,
  flaggedSentences,
  onContinue,
  onGoBack,
}: EligibilityWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onGoBack(); }}>
      <AlertDialogContent
        className="border-red-200 max-w-lg"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">⚠️</span>
            </div>
            <div>
              <AlertDialogTitle className="text-red-700 text-base">
                Work Authorization Required
              </AlertDialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                This job may not be available to F1 visa holders
              </p>
            </div>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 mt-2">
              <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-foreground uppercase tracking-wide">
                  Detected Requirements
                </p>
                <ul className="space-y-2">
                  {flaggedSentences.map((sentence) => (
                    <li key={sentence} className="flex gap-2 items-start">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="border-l-2 border-red-400 bg-red-50 pl-3 pr-2 py-1.5 rounded-r text-sm italic text-red-800 leading-relaxed">
                        &ldquo;{sentence}&rdquo;
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                As an F1 visa holder you typically cannot hold a security clearance or work without visa sponsorship. You may still tailor your resume, but consider whether to apply for this role.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onGoBack}>
            &larr; Go Back
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onContinue}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Continue Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
