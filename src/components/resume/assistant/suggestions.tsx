'use client';

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, Sparkles } from "lucide-react";
import { WorkExperience, Project, Skill, Education } from "@/lib/types";
import { useState } from 'react';
import Tiptap from "@/components/ui/tiptap";

const DIFF_HIGHLIGHT_CLASSES = "bg-green-300 px-1  rounded-sm";

type SuggestionContent = WorkExperience | Project | Skill | Education | string;

interface SuggestionProps {
  type: 'work_experience' | 'project' | 'skill' | 'education' | 'summary';
  content?: SuggestionContent;
  currentContent: SuggestionContent | null;
  // Work-experience suggestions carry a sparse list of bullet operations
  // instead of a full content object.
  operations?: BulletOperation[];
  technologies?: string[] | null;
  onAccept: () => void;
  onReject: () => void;
}

interface WholeResumeSuggestionProps {
  onReject: () => void;
}

interface WorkExperienceSuggestionProps {
  // The current entry being edited; header (position/company/date) is shown
  // as-is since this path only edits bullets and technologies.
  currentContent: WorkExperience;
  operations: BulletOperation[];
  technologies?: string[] | null;
}

// Renders a single bullet using the word-level green diff against its previous
// text (or all-green when there is no previous text, i.e. an added bullet).
function DiffBullet({ current, suggested }: { current: string | null; suggested: string }) {
  const comparedWords = current
    ? compareDescriptions(current, suggested)
    : [{ text: suggested.replace(/\*\*/g, ''), isNew: true, isBold: false, isStart: true, isEnd: true }];

  return (
    <p className="text-sm text-gray-800 flex-1 flex flex-wrap">
      {comparedWords.map((word, wordIndex) => (
        <span
          key={wordIndex}
          className={cn(
            "inline-flex items-center",
            word.isStart && "rounded-l-sm pl-1",
            word.isEnd && "rounded-r-sm pr-1",
            wordIndex < comparedWords.length - 1 && "mr-1",
            word.isNew && "bg-green-300 px-1 mx-0",
          )}
        >
          {word.isBold ? <strong>{word.text}</strong> : word.text}
        </span>
      ))}
    </p>
  );
}

function WorkExperienceSuggestion({ currentContent: currentWork, operations, technologies }: WorkExperienceSuggestionProps) {
  const rows = buildBulletRows(currentWork.description, operations);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-base font-bold text-gray-900">
            {currentWork.position.replace(/\*\*/g, '')}
          </h3>
          <p className="text-xs text-gray-700">
            {currentWork.company}
          </p>
        </div>
        <span className="text-[10px] text-gray-600">
          {currentWork.date}
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div key={index} className="flex items-start gap-1.5">
            <span className="text-gray-800 mt-0.5 text-xs">•</span>
            {row.kind === 'removed' ? (
              <p className="text-sm flex-1 line-through text-rose-700 bg-rose-100 rounded-sm px-1">
                {row.text.replace(/\*\*/g, '')}
              </p>
            ) : row.kind === 'replaced' ? (
              <DiffBullet current={row.currentText} suggested={row.text} />
            ) : row.kind === 'added' ? (
              <DiffBullet current={null} suggested={row.text} />
            ) : (
              <p className="text-sm text-gray-800 flex-1">{row.text.replace(/\*\*/g, '')}</p>
            )}
          </div>
        ))}
      </div>
      {technologies && technologies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {technologies.map((tech, index) => (
            <span
              key={index}
              className={cn(
                "px-2 py-0.5 text-xs rounded-full border text-gray-700",
                isNewItem(currentWork.technologies, technologies, tech)
                  ? DIFF_HIGHLIGHT_CLASSES
                  : "bg-gray-100/80 border-gray-200/60"
              )}
            >
              {tech.replace(/\*\*/g, '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProjectSuggestionProps {
  content: Project;
  currentContent: Project | null;
}

function ProjectSuggestion({ content: project, currentContent: currentProject }: ProjectSuggestionProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-start">
        <h3 className={cn(
          "text-lg font-bold text-gray-900",
          !currentProject || currentProject.name !== project.name && DIFF_HIGHLIGHT_CLASSES
        )}>
          {project.name}
        </h3>
        {project.date && (
          <span className={cn(
            "text-xs text-gray-600",
            !currentProject || currentProject.date !== project.date && DIFF_HIGHLIGHT_CLASSES
          )}>
            {project.date}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {project.description.map((point, index) => {
          const currentPoint = currentProject?.description?.[index];
          const comparedWords = currentPoint 
            ? compareDescriptions(currentPoint, point)
            : [{ text: point.replace(/\*\*/g, ''), isNew: true, isBold: false, isStart: true, isEnd: true }];

          return (
            <div key={index} className="flex items-start gap-1.5">
              <span className="text-gray-800 mt-0.5 text-xs">•</span>
              <p className="text-xs text-gray-800 flex-1 flex flex-wrap">
                {comparedWords.map((word, wordIndex) => (
                  <span
                    key={wordIndex}
                    className={cn(
                      "inline-flex items-center",
                      word.isNew && "bg-green-300",
                      word.isStart && "rounded-l-sm pl-1",
                      word.isEnd && "rounded-r-sm pr-1",
                      wordIndex < comparedWords.length - 1 && "mr-1",
                      word.isNew && "bg-green-300 px-1 mx-0",
                    )}
                  >
                    {word.isBold ? (
                      <strong>{word.text}</strong>
                    ) : (
                      word.text
                    )}
                  </span>
                ))}
              </p>
            </div>
          );
        })}
      </div>
      {project.technologies && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {project.technologies.map((tech, index) => (
            <span
              key={index}
              className={cn(
                "px-2 py-0.5 text-xs rounded-full border text-gray-700",
                !currentProject || isNewItem(currentProject.technologies, project.technologies, tech)
                  ? DIFF_HIGHLIGHT_CLASSES
                  : "bg-gray-100/80 border-gray-200/60"
              )}
            >
              {tech.replace(/\*\*/g, '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface SkillSuggestionProps {
  content: Skill;
  currentContent: Skill | null;
}

function SkillSuggestion({ content: skill, currentContent: currentSkill }: SkillSuggestionProps) {
  return (
    <div className="space-y-3">
      {/* Category Header */}
      <div className="flex-1">
        <Tiptap
          content={skill.category}
          onChange={() => {}}
          readOnly={true}
          variant="skill"
          className={cn(
            "text-sm font-semibold tracking-wide",
            "bg-transparent",
            "border-none shadow-none",
            !currentSkill || currentSkill.category !== skill.category && "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 px-2 py-1 rounded-md"
          )}
        />
      </div>

      {/* Skills Grid */}
      <div className="flex flex-wrap gap-2">
        {skill.items.map((item, index) => {
          const isNew = !currentSkill || isNewItem(currentSkill.items, skill.items, item);
          
          return (
            <div
              key={index}
              className={cn(
                "relative group transition-all duration-500",
                "rounded-lg overflow-hidden",
                isNew ? [
                  "bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50",
                  "border border-emerald-200",
                  "shadow-sm shadow-emerald-100",
                ] : [
                  "bg-gradient-to-br from-gray-50 via-white to-gray-50",
                  "border border-gray-200/60",
                  "shadow-sm",
                ],
                "hover:-translate-y-0.5 hover:shadow-md",
                "transition-all duration-500 ease-in-out"
              )}
            >
              {/* Animated Background Gradient */}
              <div className={cn(
                "absolute inset-0 opacity-0 transition-opacity duration-500",
                "group-hover:opacity-100",
                isNew 
                  ? "bg-gradient-to-br from-emerald-100/50 via-teal-100/50 to-emerald-100/50"
                  : "bg-gradient-to-br from-gray-100/50 via-white to-gray-100/50"
              )} />

              {/* Skill Content */}
              <div className="relative px-3 py-1.5">
                <Tiptap
                  content={item}
                  onChange={() => {}}
                  readOnly={true}
                  variant="skill"
                  className={cn(
                    "border-none shadow-none p-0",
                    "text-sm",
                    "bg-transparent",
                    isNew ? "text-emerald-700" : "text-gray-700"
                  )}
                />
              </div>

              {/* New Indicator */}
              {isNew && (
                <div className="absolute -top-1 -right-1">
                  <div className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500/10"></span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EducationSuggestionProps {
  content: Education;
  currentContent: Education | null;
}

function EducationSuggestion({ content: education, currentContent: currentEducation }: EducationSuggestionProps) {
  return (
    <div className="space-y-2 w-full">
      <div className="flex justify-between items-start">
        <div>
          <h3 className={cn(
            "font-medium text-gray-900",
            !currentEducation || (currentEducation.degree !== education.degree || currentEducation.field !== education.field) && DIFF_HIGHLIGHT_CLASSES
          )}>
            <span>
              {education.degree.split(/(\*\*.*?\*\*)/).map((part, i) => 
                part.startsWith('**') && part.endsWith('**') ? 
                  <strong key={i}>{part.slice(2, -2)}</strong> : 
                  part
              )}
            </span>
            {' in '}
            <span>
              {education.field.split(/(\*\*.*?\*\*)/).map((part, i) => 
                part.startsWith('**') && part.endsWith('**') ? 
                  <strong key={i}>{part.slice(2, -2)}</strong> : 
                  part
              )}
            </span>
          </h3>
          <p className={cn(
            "text-sm text-gray-700",
            !currentEducation || currentEducation.school !== education.school && DIFF_HIGHLIGHT_CLASSES
          )}>
            {education.school.replace(/\*\*/g, '')}
          </p>
        </div>
        <span className={cn(
          "text-xs text-gray-600",
          !currentEducation || currentEducation.date !== education.date && DIFF_HIGHLIGHT_CLASSES
        )}>
          {education.date.replace(/\*\*/g, '')}
        </span>
      </div>
      {education.achievements && (
        <div className="space-y-1.5">
          {education.achievements.map((achievement, index) => {
            const currentAchievement = currentEducation?.achievements?.[index];
            const comparedWords = currentAchievement 
              ? compareDescriptions(currentAchievement, achievement)
              : [{ text: achievement.replace(/\*\*/g, ''), isNew: true, isBold: false, isStart: true, isEnd: true }];

            return (
              <div key={index} className="flex items-start gap-1.5">
                <span className="text-gray-800 mt-0.5 text-xs">•</span>
                <p className="text-xs text-gray-800 flex-1 flex flex-wrap">
                  {comparedWords.map((word, wordIndex) => (
                    <span
                      key={wordIndex}
                      className={cn(
                        "inline-flex items-center",
                        word.isNew && "bg-green-300",
                        word.isStart && "rounded-l-sm pl-1",
                        word.isEnd && "rounded-r-sm pr-1",
                        wordIndex < comparedWords.length - 1 && "mr-1",
                        word.isNew && "bg-green-300 px-1 mx-0",
                      )}
                    >
                      {word.isBold ? (
                        <strong>{word.text}</strong>
                      ) : (
                        word.text
                      )}
                    </span>
                  ))}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function compareDescriptions(current: string, suggested: string): {
  text: string;
  isNew: boolean;
  isBold: boolean;
  isStart: boolean;
  isEnd: boolean;
}[] {
  // Clean the text by normalizing spaces and removing extra whitespace
  const cleanText = (text: string): string => {
    return text.trim().replace(/\s+/g, ' ');
  };

  // Split text into words, preserving bold markdown
  const splitText = (text: string): string[] => {
    // First, split by bold markdown
    const parts = text.split(/(\*\*[^*]+\*\*)/).filter(Boolean);
    
    // Then split non-bold parts by spaces while preserving bold parts
    return parts.flatMap(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return [part];
      }
      return part.split(/\s+/).filter(Boolean);
    });
  };

  const currentText = cleanText(current);
  const suggestedText = cleanText(suggested);
  
  const currentWords = splitText(currentText);
  const suggestedWords = splitText(suggestedText);
  
  return suggestedWords.map((word, index) => {
    const isBold = word.startsWith('**') && word.endsWith('**');
    const cleanedWord = isBold ? word.slice(2, -2) : word;
    
    // Check if the word exists in current text (considering bold status)
    const isNew = !currentWords.some(currentWord => {
      const currentIsBold = currentWord.startsWith('**') && currentWord.endsWith('**');
      const currentCleaned = currentIsBold ? currentWord.slice(2, -2) : currentWord;
      return currentCleaned === cleanedWord;
    });
    
    // Check if adjacent words are new
    const prevWord = index > 0 ? suggestedWords[index - 1] : null;
    const nextWord = index < suggestedWords.length - 1 ? suggestedWords[index + 1] : null;
    
    const prevIsNew = prevWord ? !currentWords.includes(prevWord) : false;
    const nextIsNew = nextWord ? !currentWords.includes(nextWord) : false;
    
    return {
      text: cleanedWord,
      isNew,
      isBold,
      isStart: isNew && !prevIsNew,
      isEnd: isNew && !nextIsNew
    };
  });
}
  

function isNewItem<T>(current: T[] | undefined, suggested: T[] | undefined, item: T): boolean {
  if (!current) return true;
  return !current.includes(item);
}

// A single change to a work experience's bullet list. Indices refer to the
// CURRENT description array; adds are appended at the end so indices never shift.
export interface BulletOperation {
  operation: 'replace' | 'add' | 'remove';
  // Position of the bullet in the CURRENT description array. Adds use -1, which
  // isValidIndex rejects, since they are appended rather than positioned.
  index: number;
  // Empty for removes.
  text: string;
}

// Render model for the suggestion card: current bullets in order (tagged),
// followed by appended adds.
export type BulletRow =
  | { kind: 'unchanged'; text: string }
  | { kind: 'replaced'; currentText: string; text: string }
  | { kind: 'removed'; text: string }
  | { kind: 'added'; text: string };

function isValidIndex(idx: number, length: number): boolean {
  return Number.isInteger(idx) && idx >= 0 && idx < length;
}

function hasText(text: string): boolean {
  return text.trim() !== '';
}

export function buildBulletRows(current: string[], ops: BulletOperation[]): BulletRow[] {
  // Map each current bullet to its (last) replace/remove op, if any.
  const replacements = new Map<number, string>();
  const removed = new Set<number>();

  for (const op of ops) {
    if (op.operation === 'replace' && isValidIndex(op.index, current.length) && hasText(op.text)) {
      replacements.set(op.index, op.text);
      removed.delete(op.index);
    } else if (op.operation === 'remove' && isValidIndex(op.index, current.length)) {
      removed.add(op.index);
      replacements.delete(op.index);
    }
  }

  const rows: BulletRow[] = current.map((text, i) => {
    if (removed.has(i)) return { kind: 'removed', text };
    const replacement = replacements.get(i);
    if (replacement !== undefined) return { kind: 'replaced', currentText: text, text: replacement };
    return { kind: 'unchanged', text };
  });

  for (const op of ops) {
    if (op.operation === 'add' && hasText(op.text)) {
      rows.push({ kind: 'added', text: op.text });
    }
  }

  return rows;
}

export function applyBulletOperations(current: string[], ops: BulletOperation[]): string[] {
  const rows = buildBulletRows(current, ops);
  return rows
    .filter((row) => row.kind !== 'removed')
    .map((row) => row.text);
}

// The tool returns technologies as an ADDITIVE delta, so merge rather than
// replace: keep the existing list and order, and append only what is genuinely
// new (compared case-insensitively, since the model rarely matches casing).
export function mergeTechnologies(current: string[] | undefined, additions: string[]): string[] {
  const merged = [...(current ?? [])];
  const seen = new Set(merged.map((tech) => tech.trim().toLowerCase()));

  for (const addition of additions) {
    const key = addition.trim().toLowerCase();
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    merged.push(addition.trim());
  }

  return merged;
}

// const renderBoldText = (text: string) => {
//   return text.split(/(\*\*.*?\*\*)/).map((part, index) => {
//     if (part.startsWith('**') && part.endsWith('**')) {
//       return <strong key={index}>{part.slice(2, -2)}</strong>;
//     }
//     return part;
//   });
// };

interface SummarySuggestionProps {
  content: string;
  currentContent: string | null;
}

function SummarySuggestion({ content, currentContent }: SummarySuggestionProps) {
  return (
    <div className="space-y-2 w-full">
      {currentContent && (
        <p className="text-xs text-gray-400 line-through">{currentContent}</p>
      )}
      <p className={cn("text-sm leading-relaxed text-gray-900", DIFF_HIGHLIGHT_CLASSES)}>{content}</p>
    </div>
  );
}

export function Suggestion({ type, content, currentContent, operations, technologies, onAccept, onReject }: SuggestionProps) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');

  const handleAccept = () => {
    setStatus('accepted');
    onAccept();
  };

  const handleReject = () => {
    setStatus('rejected');
    onReject();
  };

  // Helper function to get status-based styles
  const getStatusStyles = () => {
    switch (status) {
      case 'accepted':
        return {
          card: "bg-gradient-to-br from-emerald-200/95 via-emerald-200/90 to-green-200/95 border-emerald-200/60",
          icon: "from-emerald-100/90 to-green-100/90",
          iconColor: "text-emerald-600",
          label: "text-emerald-600",
          text: "Accepted"
        };
      case 'rejected':
        return {
          card: "bg-gradient-to-br from-rose-200/95 via-rose-200/90 to-red-200/95 border-rose-200/60",
          icon: "from-rose-100/90 to-red-100/90",
          iconColor: "text-rose-600",
          label: "text-rose-600",
          text: "Rejected"
        };
      default:
        return {
          card: "bg-gradient-to-br from-white/95 via-purple-50/30 to-indigo-50/40 border-white/60",
          icon: "from-purple-100/90 to-indigo-100/90",
          iconColor: "text-purple-600",
          label: "text-gray-900",
          text: "AI Suggestion"
        };
    }
  };

  const statusStyles = getStatusStyles();

  // Helper function to render content based on type
  const renderContent = () => {
    switch (type) {
      case 'work_experience':
        return <WorkExperienceSuggestion currentContent={currentContent as WorkExperience} operations={operations ?? []} technologies={technologies} />;
      case 'project':
        return <ProjectSuggestion content={content as Project} currentContent={currentContent as Project | null} />;
      case 'skill':
        return <SkillSuggestion content={content as Skill} currentContent={currentContent as Skill | null} />;
      case 'education':
        return <EducationSuggestion content={content as Education} currentContent={currentContent as Education | null} />;
      case 'summary':
        return <SummarySuggestion content={content as string} currentContent={currentContent as string | null} />;
    }
  };

  return (
    <Card className={cn(
      "group relative overflow-hidden",
      "border ",
      statusStyles.card,
      "shadow-xl shadow-purple-500/10",
      "transition-all duration-500 ease-in-out",
      "hover:shadow-2xl hover:shadow-purple-500/20",
      "backdrop-blur-xl"
    )}>
      {/* Enhanced Background Pattern */}
      <div className="absolute inset-0  opacity-[0.15]" />
      
      {/* Improved Floating Gradient Orbs */}

      {/* Content */}
      <div className="relative ">
        {/* Header */}
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg  shadow-sm", statusStyles.icon)}>
              <Sparkles className={cn("h-3.5 w-3.5", statusStyles.iconColor)} />
            </div>
            <span className={cn("font-semibold text-sm", statusStyles.label)}>{statusStyles.text}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white from-white/80 to-white/60 rounded-lg p-3 backdrop-blur-md border border-white/60 shadow-sm">
          {renderContent()}
        </div>

        {/* Action Buttons */}
        {status === 'pending' && (
          <div className="flex justify-end gap-2 pt-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReject}
              className={cn(
                "relative group/button overflow-hidden",
                "h-8 px-4 text-xs",
                "bg-gradient-to-br from-rose-50 to-rose-100/90",
                "text-rose-700",
                "border border-rose-200/60",
                "shadow-sm",
                "transition-all duration-500",
                "hover:shadow-md hover:shadow-rose-500/10",
                "hover:border-rose-300/80",
                "hover:-translate-y-0.5",
                "active:translate-y-0"
              )}
            >
              {/* Animated background on hover */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-rose-100 to-rose-200/90 
                opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
              
              <div className="relative flex items-center justify-center gap-1.5">
                <X className="h-3.5 w-3.5 transition-transform duration-500 group-hover/button:rotate-90" />
                <span className="font-medium">Reject</span>
              </div>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleAccept}
              className={cn(
                "relative group/button overflow-hidden",
                "h-8 px-4 text-xs",
                "bg-gradient-to-br from-emerald-50 to-emerald-100/90",
                "text-emerald-700",
                "border border-emerald-200/60",
                "shadow-sm",
                "transition-all duration-500",
                "hover:shadow-md hover:shadow-emerald-500/10",
                "hover:border-emerald-300/80",
                "hover:-translate-y-0.5",
                "active:translate-y-0"
              )}
            >
              {/* Animated background on hover */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-100 to-emerald-200/90 
                opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
              
              <div className="relative flex items-center justify-center gap-1.5">
                <Check className="h-3.5 w-3.5 transition-transform duration-500 group-hover/button:scale-110" />
                <span className="font-medium">Accept</span>
              </div>
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function WholeResumeSuggestion({ onReject }: WholeResumeSuggestionProps) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');

  const handleAccept = () => {
    setStatus('accepted');
    // No need to do anything as changes are already applied
  };

  const handleReject = () => {
    setStatus('rejected');
    onReject();
  };

  const statusStyles = {
    pending: {
      card: "bg-gradient-to-br from-white/95 via-purple-50/30 to-indigo-50/40 border-white/60",
      icon: "from-purple-100/90 to-indigo-100/90",
      iconColor: "text-purple-600",
      label: "text-gray-900",
      text: "Modified Resume"
    },
    accepted: {
      card: "bg-gradient-to-br from-emerald-200/95 via-emerald-200/90 to-green-200/95 border-emerald-200/60",
      icon: "from-emerald-100/90 to-green-100/90",
      iconColor: "text-emerald-600",
      label: "text-emerald-600",
      text: "Changes Accepted"
    },
    rejected: {
      card: "bg-gradient-to-br from-rose-200/95 via-rose-200/90 to-red-200/95 border-rose-200/60",
      icon: "from-rose-100/90 to-red-100/90",
      iconColor: "text-rose-600",
      label: "text-rose-600",
      text: "Changes Rejected"
    }
  }[status];

  return (
    <Card className={cn(
      "group relative overflow-hidden p-4",
      "border",
      statusStyles.card,
      "shadow-xl shadow-purple-500/10",
      "transition-all duration-500 ease-in-out",
      "hover:shadow-2xl hover:shadow-purple-500/20",
      "backdrop-blur-xl"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("p-1.5 rounded-lg shadow-sm", statusStyles.icon)}>
          <Sparkles className={cn("h-3.5 w-3.5", statusStyles.iconColor)} />
        </div>
        <span className={cn("font-semibold text-sm", statusStyles.label)}>
          {statusStyles.text}
        </span>
      </div>

      {status === 'pending' && (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReject}
            className={cn(
              "relative group/button overflow-hidden",
              "h-8 px-4 text-xs",
              "bg-gradient-to-br from-rose-50 to-rose-100/90",
              "text-rose-700",
              "border border-rose-200/60",
              "shadow-sm",
              "transition-all duration-500",
              "hover:shadow-md hover:shadow-rose-500/10",
              "hover:border-rose-300/80",
              "hover:-translate-y-0.5",
              "active:translate-y-0"
            )}
          >
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-rose-100 to-rose-200/90 
              opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
            
            <div className="relative flex items-center justify-center gap-1.5">
              <X className="h-3.5 w-3.5 transition-transform duration-500 group-hover/button:rotate-90" />
              <span className="font-medium">Undo Changes</span>
            </div>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleAccept}
            className={cn(
              "relative group/button overflow-hidden",
              "h-8 px-4 text-xs",
              "bg-gradient-to-br from-emerald-50 to-emerald-100/90",
              "text-emerald-700",
              "border border-emerald-200/60",
              "shadow-sm",
              "transition-all duration-500",
              "hover:shadow-md hover:shadow-emerald-500/10",
              "hover:border-emerald-300/80",
              "hover:-translate-y-0.5",
              "active:translate-y-0"
            )}
          >
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-100 to-emerald-200/90 
              opacity-0 group-hover/button:opacity-100 transition-opacity duration-500" />
            
            <div className="relative flex items-center justify-center gap-1.5">
              <Check className="h-3.5 w-3.5 transition-transform duration-500 group-hover/button:scale-110" />
              <span className="font-medium">Keep Changes</span>
            </div>
          </Button>
        </div>
      )}
    </Card>
  );
}
