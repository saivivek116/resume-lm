'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Sparkles, Loader2, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Job, Resume, ApplicationQuestion } from '@/lib/types';
import { updateJobQuestions } from '@/utils/actions/jobs/actions';
import type { AIConfig } from '@/utils/ai-tools';
import { useDefaultModel } from '@/hooks/use-api-keys';

interface ApplicationQuestionsPanelProps {
  resume: Resume;
  job: Job;
  questions: ApplicationQuestion[];
  onQuestionsChange: (questions: ApplicationQuestion[]) => void;
}

const MAX_CHARS = 400;
const AUTOSAVE_DELAY_MS = 500;

export function ApplicationQuestionsPanel({ resume, job, questions, onQuestionsChange }: ApplicationQuestionsPanelProps) {
  const { defaultModel } = useDefaultModel();
  const [newQuestionText, setNewQuestionText] = useState('');
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionsRef = useRef(questions);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const persistQuestions = useCallback(
    (updated: ApplicationQuestion[]) => {
      onQuestionsChange(updated);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateJobQuestions(job.id, updated).catch(console.error);
      }, AUTOSAVE_DELAY_MS);
    },
    [job.id, onQuestionsChange]
  );

  const addQuestion = () => {
    const text = newQuestionText.trim();
    if (!text) return;
    const newQ: ApplicationQuestion = {
      id: crypto.randomUUID(),
      question: text,
      answer: '',
      createdAt: new Date().toISOString(),
    };
    persistQuestions([newQ, ...questions]);
    setNewQuestionText('');
    setIsAddingQuestion(false);
  };

  const deleteQuestion = (id: string) => {
    persistQuestions(questionsRef.current.filter((q) => q.id !== id));
  };

  const updateAnswer = (id: string, answer: string) => {
    persistQuestions(questionsRef.current.map((q) => (q.id === id ? { ...q, answer } : q)));
  };

  const generateAnswer = async (question: ApplicationQuestion) => {
    setGeneratingId(question.id);

    const config: AIConfig = { model: defaultModel || '' };

    try {
      const response = await fetch('/api/application-questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          companyName: job.company_name,
          jobDescription: job.description ?? '',
          resume,
          config,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Generation failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        updateAnswer(question.id, accumulated);
      }
    } catch (err) {
      console.error('[generateAnswer]', err);
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <h3 className="font-semibold text-sm text-gray-800">Application Questions</h3>
        </div>
        {!isAddingQuestion && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddingQuestion(true)}
            className="h-7 text-xs gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Question
          </Button>
        )}
      </div>

      {/* Add question input */}
      {isAddingQuestion && (
        <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <Textarea
            autoFocus
            placeholder="Paste the question from the application form..."
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addQuestion();
              }
              if (e.key === 'Escape') {
                setIsAddingQuestion(false);
                setNewQuestionText('');
              }
            }}
            className="min-h-[80px] text-sm bg-white"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={addQuestion} className="h-7 text-xs bg-blue-600 hover:bg-blue-700">
              Save Question
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setIsAddingQuestion(false); setNewQuestionText(''); }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {questions.length === 0 && !isAddingQuestion && (
        <p className="text-sm text-gray-400 text-center py-6">
          No questions yet. Click &quot;Add Question&quot; to get started.
        </p>
      )}

      {/* Question cards */}
      {questions.map((q) => {
        const charCount = q.answer.length;
        const isOver = charCount > MAX_CHARS;
        const isGenerating = generatingId === q.id;

        return (
          <div
            key={q.id}
            className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
              <p className="text-sm font-medium text-gray-800 flex-1 leading-snug">{q.question}</p>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => generateAnswer(q)}
                  disabled={isGenerating}
                  className="h-7 text-xs gap-1.5 text-blue-600 hover:bg-blue-50"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteQuestion(q.id)}
                  disabled={isGenerating}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="px-3 pb-3 space-y-1">
              <Textarea
                value={q.answer}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder={isGenerating ? 'Generating answer...' : 'Click Generate or type your answer...'}
                disabled={isGenerating}
                className={cn(
                  'min-h-[90px] text-sm resize-none bg-gray-50/50',
                  isOver && 'border-red-300 focus-visible:ring-red-300'
                )}
              />
              <div className={cn(
                'text-xs text-right tabular-nums',
                isOver ? 'text-red-500 font-medium' : 'text-gray-400'
              )}>
                {charCount} / {MAX_CHARS}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
