# Application Questionnaire Feature — Design Spec

**Date:** 2026-05-12  
**Status:** Approved

---

## Context

Job applications often include custom questionnaire fields (e.g., "What interests you about joining us?", "Describe a recent achievement"). These vary per company and are tedious to fill out manually. This feature adds a Questions tab to the tailored resume editor where users can add questions one at a time and have AI generate short, human, factual answers grounded in the resume content and real-time company research.

Questions and answers are stored per job (on the `jobs` table) since they belong to the job application context, not a specific resume.

---

## Data Model

### Database Migration

Add a new JSONB column to the `jobs` table:

```sql
ALTER TABLE jobs
  ADD COLUMN application_questions JSONB DEFAULT '[]'::jsonb;
```

### TypeScript (`src/lib/types.ts`)

```typescript
export interface ApplicationQuestion {
  id: string;        // client-generated UUID (crypto.randomUUID())
  question: string;  // user-typed question text
  answer: string;    // AI-generated or user-edited answer
  createdAt: string; // ISO timestamp
}
```

Update the `Job` interface to include:
```typescript
application_questions: ApplicationQuestion[];
```

---

## API Route

**File:** `src/app/api/application-questions/generate/route.ts`

**Method:** `POST`

**Request body:**
```typescript
{
  question: string;
  companyName: string;
  jobDescription: string;
  resume: Resume;
  aiConfig?: AIConfig;
}
```

**Response:** Streamed plain text (same pattern as `/api/cover-letter`)

### Tools available to the model

| Tool | Purpose |
|------|---------|
| `getCurrentDate()` | Returns today's date string for experience-year calculations |
| `searchWeb(query: string)` | Calls Tavily Search API, returns top 3 result snippets about the company |

### System prompt rules

- Search the company name first to gather real product/tech/mission context
- Use resume facts (work experience, skills, projects) as the only personal claims — no fabrication
- Use the job description to align answer to the role
- Write in first person, natural and professional tone
- Target ≤ 400 characters
- Complete sentences only
- **No em dashes (`—`)**, **no semicolons (`;`)**
- Never use filler phrases ("I am passionate about", "leverage synergies", etc.)

### Tavily integration

Requires `TAVILY_API_KEY` environment variable. Called directly via `fetch` inside the `searchWeb` tool definition (no extra npm package needed). Free tier (1000 req/month) is sufficient for this use case.

---

## Server Action

**File:** `src/utils/actions/jobs/actions.ts`

Add `updateJobQuestions(jobId: string, questions: ApplicationQuestion[]): Promise<void>` — performs a Supabase update on the `jobs` row, setting `application_questions` to the provided array. Uses the existing RLS-aware Supabase client pattern from the same file.

---

## UI

### Tab trigger

**File:** `src/components/resume/editor/header/resume-editor-tabs.tsx`

- Change the top `TabsList` from `grid-cols-2` to `grid-cols-3`
- Add a third `TabsTrigger` with `value="app-questions"`, using a blue/indigo color scheme (distinct from emerald for Resume Score and amber for Cover Letter)
- Label: **"App Questions"**
- Icon: `MessageSquare` from lucide-react
- Only shown when `resume.job_id` is present (pass `isBase` prop and conditionally render)

### Panel

**File:** `src/components/resume/editor/panels/application-questions-panel.tsx` (new)

Rendered inside the existing `editor-panel.tsx` as a new `TabsContent value="app-questions"`, same as `cover-letter` and `resume-score` panels.

**Panel layout:**

```
[ + Add Question ]                  ← button, top right

┌──────────────────────────────────┐
│ Question text (read-only label)  │
│                                  │
│ [Generate ▶]        [🗑 Delete]  │
├──────────────────────────────────┤
│ [editable textarea — streams in] │
│                          142/400 │
└──────────────────────────────────┘
```

**Interaction details:**

1. "Add Question" opens an inline input + "Save" button (or Enter to confirm)
2. Saved question card appears with empty answer area and "Generate" button
3. Clicking "Generate" calls the API route, streams answer into the textarea
4. Textarea is editable; character counter updates live (red if > 400)
5. Changes auto-save via debounced call to `updateJobQuestions` (500ms debounce)
6. Delete button removes the card immediately (optimistic) and saves
7. No explicit Save button — auto-save handles persistence

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `schema.sql` | Add `application_questions` column to jobs table |
| `src/lib/types.ts` | Add `ApplicationQuestion` interface; update `Job` |
| `src/app/api/application-questions/generate/route.ts` | **New** — streaming AI route with tools |
| `src/utils/actions/jobs/actions.ts` | Add `updateJobQuestions` action |
| `src/components/resume/editor/header/resume-editor-tabs.tsx` | Add 3rd tab trigger, change grid-cols-2 → grid-cols-3 |
| `src/components/resume/editor/panels/editor-panel.tsx` | Add TabsContent for `app-questions` |
| `src/components/resume/editor/panels/application-questions-panel.tsx` | **New** — Q&A panel component |
| `.env.local` (user adds) | `TAVILY_API_KEY=...` |

---

## Environment Variables

```
TAVILY_API_KEY=your_tavily_api_key_here
```

User must obtain a free API key from tavily.com and add it to `.env.local`.

---

## Verification

1. Open a tailored resume (one with a linked job)
2. The top tab row now shows 3 buttons: Resume Score / Cover Letter / App Questions
3. Click "App Questions" → panel loads, empty state shown
4. Add a question → card appears with "Generate" button
5. Click Generate → answer streams in, stops under 400 chars, no em dashes or semicolons
6. Edit the answer → character counter updates
7. Refresh the page → questions and answers persist (fetched from jobs table)
8. Base resume → "App Questions" tab is hidden
9. Check Supabase `jobs` table → `application_questions` column contains the saved array
