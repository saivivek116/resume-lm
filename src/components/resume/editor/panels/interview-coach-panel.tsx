'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  GraduationCap,
  Sparkles,
  Loader2,
  ExternalLink,
  RefreshCw,
  Building2,
  Lightbulb,
  AlertCircle,
  Globe,
  MessagesSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  Job,
  Resume,
  InterviewQuestion,
  InterviewQuestionCategory,
  CompanyResearch,
  InterviewExperiencesResult,
} from '@/lib/types';
import type { AIConfig } from '@/utils/ai-tools';
import { useDefaultModel } from '@/hooks/use-api-keys';
import {
  planInterviewCategories,
  generateCategoryQuestions,
  researchCompany,
  researchInterviewExperiences,
} from '@/utils/actions/interview-coach/ai';

interface InterviewCoachPanelProps {
  resume: Resume;
  job: Job;
}

type CategoryStatus = 'loading' | 'done' | 'error';
type ExperiencesStatus = 'idle' | 'loading' | 'done' | 'error';

const CATEGORY_LABELS: Record<InterviewQuestionCategory, string> = {
  screening: 'Screening / Fit',
  behavioral: 'Behavioral',
  technical: 'Technical',
  system_design: 'System Design',
  dsa: 'DSA / Coding',
  culture_fit: 'Culture Fit',
};

const CATEGORY_ORDER: InterviewQuestionCategory[] = [
  'screening',
  'behavioral',
  'technical',
  'system_design',
  'dsa',
  'culture_fit',
];

// Flatten structured research into a plain-text summary for question generation.
function buildCompanySummary(research: CompanyResearch | null): string {
  if (!research) return '';
  const parts: string[] = [];
  if (research.cultureAndValues) {
    parts.push(`Culture and values: ${research.cultureAndValues}`);
  }
  if (research.productsAndServices.length > 0) {
    const items = research.productsAndServices
      .map((p) => (p.description ? `${p.name}: ${p.description}` : p.name))
      .join('. ');
    parts.push(`Products and services: ${items}`);
  }
  return parts.join('\n\n');
}

export function InterviewCoachPanel({ resume, job }: InterviewCoachPanelProps) {
  const { defaultModel } = useDefaultModel();

  // Company research (runs on mount)
  const [research, setResearch] = useState<CompanyResearch | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const researchRunIdRef = useRef(0);

  // Generation
  const [phase, setPhase] = useState<'profile' | 'results'>('profile');
  const [isGenerating, setIsGenerating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [categoryStatus, setCategoryStatus] = useState<
    Record<string, CategoryStatus>
  >({});
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const generateRunIdRef = useRef(0);

  // Web-sourced interview experiences (runs alongside question generation).
  const [experiences, setExperiences] =
    useState<InterviewExperiencesResult | null>(null);
  const [experiencesStatus, setExperiencesStatus] =
    useState<ExperiencesStatus>('idle');
  const experiencesRunIdRef = useRef(0);

  const runExperiences = useCallback(async () => {
    const runId = ++experiencesRunIdRef.current;
    setExperiencesStatus('loading');
    setExperiences(null);

    const config: AIConfig = { model: defaultModel || '' };

    try {
      const result = await researchInterviewExperiences({
        jobTitle: job.position_title,
        companyName: job.company_name,
        targetRole: resume.target_role,
        jobDescription: job.description ?? '',
        config,
      });
      if (experiencesRunIdRef.current !== runId) return;
      setExperiences(result);
      setExperiencesStatus('done');
    } catch (err) {
      if (experiencesRunIdRef.current !== runId) return;
      console.error('[runExperiences]', err);
      setExperiencesStatus('error');
    }
  }, [
    defaultModel,
    job.position_title,
    job.company_name,
    job.description,
    resume.target_role,
  ]);

  const runResearch = useCallback(async () => {
    const runId = ++researchRunIdRef.current;

    setIsResearching(true);
    setResearch(null);

    const config: AIConfig = { model: defaultModel || '' };

    try {
      const result = await researchCompany({
        companyName: job.company_name,
        jobDescription: job.description ?? '',
        jobUrl: job.job_url,
        config,
      });
      // Ignore stale runs (e.g. a newer Re-research superseded this one).
      if (researchRunIdRef.current !== runId) return;
      setResearch(result);
    } catch (err) {
      if (researchRunIdRef.current !== runId) return;
      console.error('[runResearch]', err);
      setResearch({
        websiteUrl: null,
        cultureAndValues:
          'Company research could not be completed. You can still generate interview questions from the job description and resume.',
        productsAndServices: [],
      });
    } finally {
      if (researchRunIdRef.current === runId) {
        setIsResearching(false);
      }
    }
  }, [defaultModel, job.company_name, job.description, job.job_url]);

  // Auto-run research on first mount.
  useEffect(() => {
    runResearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateQuestions = async () => {
    // Supersede any in-flight run so its stale category promises can't append
    // to (or overwrite the status of) this fresh generation.
    const runId = ++generateRunIdRef.current;

    setIsGenerating(true);
    setPlanError(null);
    setQuestions([]);
    setCategoryStatus({});
    setPhase('results');

    // Web-sourced experiences run independently so a slow search never blocks
    // the agent questions (and vice-versa).
    runExperiences();

    const config: AIConfig = { model: defaultModel || '' };

    let plan: { category: InterviewQuestionCategory; count: number }[];
    try {
      plan = await planInterviewCategories({
        jobDescription: job.description ?? '',
        resume,
        config,
      });
    } catch (err) {
      if (generateRunIdRef.current !== runId) return;
      console.error('[planInterviewCategories]', err);
      setPlanError('Could not plan interview categories. Please try again.');
      setIsGenerating(false);
      setPhase('profile');
      return;
    }

    if (generateRunIdRef.current !== runId) return;

    // Seed all planned categories as loading.
    setCategoryStatus(
      Object.fromEntries(plan.map((p) => [p.category, 'loading' as CategoryStatus]))
    );

    const companySummary = buildCompanySummary(research);

    // Fire all category agents in parallel; fill in as each resolves.
    await Promise.allSettled(
      plan.map(async (p) => {
        try {
          const result = await generateCategoryQuestions({
            category: p.category,
            count: p.count,
            jobDescription: job.description ?? '',
            resume,
            companySummary,
            config,
          });
          if (generateRunIdRef.current !== runId) return;
          setQuestions((prev) => [...prev, ...result]);
          setCategoryStatus((prev) => ({ ...prev, [p.category]: 'done' }));
        } catch (err) {
          if (generateRunIdRef.current !== runId) return;
          console.error(`[generateCategoryQuestions:${p.category}]`, err);
          setCategoryStatus((prev) => ({ ...prev, [p.category]: 'error' }));
        }
      })
    );

    if (generateRunIdRef.current !== runId) return;
    setIsGenerating(false);
  };

  const orderedCategories = CATEGORY_ORDER.filter((c) => c in categoryStatus);

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-blue-600" />
        <h3 className="font-semibold text-sm text-gray-800">Interview Coach</h3>
      </div>

      {/* Company research stays visible in both phases so the candidate can
          keep referencing the website, culture, and products while reviewing
          the generated questions. */}
      <CompanyProfileCard
        companyName={job.company_name}
        careersUrl={job.job_url}
        research={research}
        isResearching={isResearching}
        onReResearch={runResearch}
        onGenerate={generateQuestions}
        isGenerating={isGenerating}
        planError={planError}
        generateLabel={phase === 'results' ? 'Regenerate Interview Questions' : undefined}
      />

      {phase === 'results' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Predicted interview questions for{' '}
            <span className="font-medium text-gray-700">{job.company_name}</span>
          </p>

          {orderedCategories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              status={categoryStatus[category]}
              questions={questions.filter((q) => q.category === category)}
              onRetry={generateQuestions}
            />
          ))}

          <ExperiencesSection
            companyName={job.company_name}
            status={experiencesStatus}
            experiences={experiences}
            onRetry={runExperiences}
          />
        </div>
      )}
    </div>
  );
}

// Web-sourced interview experiences: real questions/experiences other
// candidates shared online, with source attribution. Reference-only.
function ExperiencesSection({
  companyName,
  status,
  experiences,
  onRetry,
}: {
  companyName: string;
  status: ExperiencesStatus;
  experiences: InterviewExperiencesResult | null;
  onRetry: () => void;
}) {
  const items = experiences?.items ?? [];

  return (
    <div className="rounded-lg border border-violet-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold text-gray-800">
            Interview Experiences
          </span>
          <span className="text-[11px] text-violet-600/80">from the web</span>
          {status === 'done' && items.length > 0 && (
            <span className="text-xs text-gray-400 tabular-nums">
              {items.length}
            </span>
          )}
        </div>
        {status === 'loading' && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
        )}
      </div>

      {status === 'loading' && (
        <div className="p-4 space-y-2 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            Could not load interview experiences.
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRetry}
            className="h-7 text-xs text-violet-600 hover:bg-violet-50"
          >
            Retry
          </Button>
        </div>
      )}

      {status === 'done' && items.length === 0 && (
        <p className="px-4 py-3 text-xs text-gray-400">
          No interview experiences found online for this role at {companyName}.
        </p>
      )}

      {status === 'done' && items.length > 0 && (
        <div className="px-4 py-3 space-y-3">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Sourced from public posts by other candidates. Verify independently.
          </p>
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                  {item.source}
                </span>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline shrink-0"
                >
                  View source
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {item.roleContext && (
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  {item.roleContext}
                </p>
              )}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {item.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyProfileCard({
  companyName,
  careersUrl,
  research,
  isResearching,
  onReResearch,
  onGenerate,
  isGenerating,
  planError,
  generateLabel,
}: {
  companyName: string;
  careersUrl: string | null;
  research: CompanyResearch | null;
  isResearching: boolean;
  onReResearch: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  planError: string | null;
  generateLabel?: string;
}) {
  const websiteUrl =
    research?.websiteUrl && research.websiteUrl.startsWith('http')
      ? research.websiteUrl
      : null;
  const products = research?.productsAndServices ?? [];

  return (
    <div className="rounded-lg border border-blue-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-blue-100 bg-blue-50/50 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 shrink-0 text-blue-600" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-gray-800 truncate">{companyName}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <Globe className="h-3 w-3" />
                  Visit company website
                </a>
              )}
              {careersUrl && (
                <a
                  href={careersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  View job posting
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onReResearch}
          disabled={isResearching}
          className="h-7 text-xs gap-1.5 text-blue-600 hover:bg-blue-50 shrink-0"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isResearching && 'animate-spin')} />
          Re-research
        </Button>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
            Culture &amp; values
          </p>
          {isResearching ? (
            <div className="space-y-2 animate-pulse py-1">
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-11/12" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
            </div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {research?.cultureAndValues}
            </p>
          )}
        </div>

        {!isResearching && products.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
              Products &amp; services
            </p>
            <ul className="list-disc pl-4 space-y-1">
              {products.map((p, i) => (
                <li key={i} className="text-sm text-gray-700 leading-relaxed">
                  <span className="font-medium text-gray-800">{p.name}</span>
                  {p.description ? `: ${p.description}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {planError && (
          <div className="flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            {planError}
          </div>
        )}

        <Button
          onClick={onGenerate}
          disabled={isGenerating || isResearching}
          className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isGenerating
            ? 'Generating...'
            : generateLabel ?? 'Generate Interview Questions'}
        </Button>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  status,
  questions,
  onRetry,
}: {
  category: InterviewQuestionCategory;
  status: CategoryStatus;
  questions: InterviewQuestion[];
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            {CATEGORY_LABELS[category]}
          </span>
          {status === 'done' && (
            <span className="text-xs text-gray-400 tabular-nums">
              {questions.length}
            </span>
          )}
        </div>
        {status === 'loading' && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
        )}
      </div>

      {status === 'loading' && (
        <div className="p-4 space-y-2 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            Failed to generate this category.
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRetry}
            className="h-7 text-xs text-blue-600 hover:bg-blue-50"
          >
            Retry all
          </Button>
        </div>
      )}

      {status === 'done' && questions.length > 0 && (
        <Accordion type="multiple" className="px-4">
          {questions.map((q) => (
            <AccordionItem key={q.id} value={q.id} className="last:border-b-0">
              <AccordionTrigger className="text-sm font-medium text-gray-800 gap-2">
                {q.question}
              </AccordionTrigger>
              <AccordionContent>
                <QuestionDetail question={q} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {status === 'done' && questions.length === 0 && (
        <p className="px-4 py-3 text-xs text-gray-400">No questions generated.</p>
      )}
    </div>
  );
}

function QuestionDetail({ question }: { question: InterviewQuestion }) {
  const star = [
    { label: 'Situation', value: question.star.situation },
    { label: 'Task', value: question.star.task },
    { label: 'Action', value: question.star.action },
    { label: 'Result', value: question.star.result },
  ];

  return (
    <div className="space-y-3">
      {/* STAR block, collapsed by default */}
      <Accordion type="single" collapsible className="rounded-md border border-gray-100 bg-gray-50/50 px-3">
        <AccordionItem value="star" className="border-b-0">
          <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-blue-600 py-2.5 hover:no-underline">
            Suggested Answer (STAR)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pb-1">
              {star.map((s) => (
                <div key={s.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {s.label}
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{s.value}</p>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* What you learned */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
          What you learned
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          {question.whatYouLearned}
        </p>
      </div>

      {/* Tips */}
      {question.tips && question.tips.length > 0 && (
        <div className="rounded-md bg-amber-50/60 border border-amber-100 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              Tips
            </p>
          </div>
          <ul className="list-disc pl-4 space-y-0.5">
            {question.tips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-700 leading-relaxed">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
