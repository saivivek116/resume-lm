# Stop per-token re-rendering of completed chat messages and suggestion cards

> **Status: DEFERRED — not implemented.** Investigated 2026-07-26 and parked in favour of a
> higher-priority issue. Nothing in the "Changes" section below has been applied. The only
> change actually made to the codebase from this investigation was deleting a temporary
> `[work-exp tool args]` `console.log` from `chatbot.tsx`.
>
> When picking this up, read the "Context" section first — the `structuredClone` finding is
> the crux and is non-obvious.

## Context

Asking the assistant to add a bullet to a work experience produced ~92 identical
`[work-exp tool args]` console lines from a temporary debug log, for a **single** tool call.
That log has since been removed, but deleting it only addressed the symptom. The log fired 92
times because `ChatBot` genuinely re-renders ~92 times — once per streamed token — and it
still does. This document describes fixing the re-rendering itself.

### What actually happens per token

`useChat` owns `messages`; every stream chunk calls `setMessages`, so `ChatBot` re-rendering
per token is unavoidable and fine. The cost is that **everything below it re-renders too**:

- `messages.map` (`chatbot.tsx:349`) rebuilds every message's JSX.
- Each `m.toolInvocations?.map` (`chatbot.tsx:437`) re-runs. For the work-experience branch
  (`chatbot.tsx:487–516`) that means `mergeTechnologies(...)` recomputes, two fresh closures
  are allocated, and `<Suggestion>` re-renders — which re-runs `buildBulletRows`
  (`suggestions.tsx:471`) over the whole bullet list and rebuilds the entire card subtree.
- This scales with conversation length: every suggestion card ever shown re-renders on every
  token of every later response.

`MemoizedMarkdown` (`memoized-markdown.tsx:97`) is the one part already protected — and *how*
it is protected is the key to the fix (below).

### The constraint that dictates the design (verified in node_modules, ai@4.3.19)

`@ai-sdk/ui-utils/dist/index.mjs:918` does `structuredClone(message)` on **every chunk** and
stamps a fresh `revisionId`; `@ai-sdk/react/dist/index.mjs:337` then swaps that clone in as
the last message. So:

- Older, completed messages **keep object identity** — reference-based `React.memo` works.
- The **currently streaming message gets brand-new object identity every token**, including
  a new `toolInvocations` array and new `args` objects.

The suggestion card lives on that streaming message (the model keeps writing prose after the
tool call, `maxSteps: 5`). So a plain `React.memo` would miss on every single token — the
memo must compare **by value**, not by reference. That is exactly why `MemoizedMarkdown`
already survives: it compares the `content` string, not the message object. The fix extends
the codebase's existing pattern rather than inventing one.

The safe value key: a tool invocation with `state === 'result'` is **immutable** — its
`toolCallId` and `args` never change again.

## Changes

All in `src/components/resume/assistant/chatbot.tsx` unless noted.

### 1. Extract a memoized `ToolInvocationBubble`

Move the entire body of the `m.toolInvocations?.map` callback (lines 437–~560: the `switch`,
the professional-summary branch, the work-experience branch, and the `toolConfig` map) into a
new top-level component in its own file,
`src/components/resume/assistant/tool-invocation-bubble.tsx`.

Props: `{ toolInvocation, resume, onResumeChange }`.

Wrap in `React.memo` with an explicit comparator:

- different `toolCallId` or different `state` → re-render;
- both `state === 'result'` with the same `toolCallId` → **skip** (immutable, so the
  per-token `structuredClone` identity change is correctly ignored);
- otherwise fall back to comparing `args` by reference (covers `partial-call`/`call`, which
  render only `SuggestionSkeleton` and don't read `args`);
- also compare `resume` and `onResumeChange` by reference.

`onResumeChange` is safe to compare by reference: it is `updateField` from the Zustand store
(`resume-editor-client.tsx:43`), which is referentially stable. `resume` changes only when
the user actually edits the resume, never mid-stream — so accepting a suggestion still
re-renders correctly.

### 2. Extract a memoized `ChatMessage` for the text bubble

Move the `m.content &&` block (lines 353–434) into a memoized component taking
`{ id, role, content, isEditing, editContent, onEdit, onDelete, onSaveEdit, onEditContentChange }`.
Compare by value on the primitives. It keeps rendering `MemoizedMarkdown` internally.

### 3. Make the parent's handlers stable

`handleDelete` (197), `handleEdit` (202), `handleSaveEdit` (208) are recreated every render,
and `handleDelete`/`handleSaveEdit` close over `messages` — which would defeat the memo in
step 2. Wrap all three in `useCallback` and switch the two that read `messages` to
`setMessages`'s **functional updater** form, so `messages` drops out of the dependency array
and the callbacks become stable.

Verified this is supported on the installed version: `setMessages` is typed
`(messages: Message[] | ((messages: Message[]) => Message[])) => void`
(`node_modules/@ai-sdk/react/dist/index.d.ts:96`).

### 4. Fix the `key={index}` bug (correctness, not just perf)

`messages.map((m, index) => <React.Fragment key={index}>` (`chatbot.tsx:350`) keys by array
position, but `handleDelete` removes by `id`, so every later message shifts down one index.
`Suggestion` holds local `status` state (`suggestions.tsx:552`), so after a delete an
accepted/rejected badge can attach to the wrong suggestion. Key by `m.id` instead, and key
the tool bubbles by `toolCallId` (already the case).

### 5. Memoize the work-experience derived values

- In the work-experience branch, wrap
  `mergeTechnologies(currentWork.technologies, args.technologies)` in `useMemo` (inside the
  new `ToolInvocationBubble`, so hooks are legal — it cannot be a `useMemo` inside the
  current `.map` callback).
- In `Suggestion` (`suggestions.tsx:551`), wrap the `buildBulletRows(...)` call in `useMemo`
  keyed on `currentContent`/`operations`.

## Explicitly out of scope

The `structuredClone`-per-chunk inside the AI SDK is the SDK's own cost and is not something
this codebase can remove. The goal here is to stop *our* component tree from amplifying it.

## Verification

1. `npm run lint` and `npx tsc --noEmit` (note: the repo has pre-existing type errors in
   Stripe/Supabase/tailored-resume-dialog files — confirm no *new* ones in the touched files).
2. **Measure the improvement, don't assume it.** `npm run dev`, open a resume editor, React
   DevTools → Profiler → enable "Record why each component rendered", record one full
   assistant response that includes a work-experience suggestion.
   - Before: `Suggestion` appears in ~90 commits.
   - After: `Suggestion` should appear in ~1–2 commits (its initial mount and its transition
     to `state === 'result'`), while `ChatBot` still commits per token.
3. Functional regression pass, since this touches the render path:
   - Suggestion card renders once; **Accept** applies the bullet and merged technologies to
     the resume; **Reject** dismisses.
   - Send a second message after accepting — the first card keeps its accepted state.
   - Delete a middle message, then confirm remaining suggestion cards keep their *own*
     accepted/rejected state (this is the `key={index}` fix; it is broken today).
   - Edit + save a message still works.
   - `modifyWholeResume` and the summary/project/skill/education branches still render.
