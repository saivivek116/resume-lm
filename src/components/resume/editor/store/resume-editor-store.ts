import { createStore } from 'zustand/vanilla';
import { Resume } from '@/lib/types';

/**
 * Fields whose value is an array of items, each carrying a `description: string[]`
 * of bullet "points". Work experience and projects share this shape, so the bullet
 * actions below are written generically over these two fields.
 */
type BulletField = 'work_experience' | 'projects';

export interface ResumeEditorState {
  resume: Resume;
  /** Baseline used to derive `hasUnsavedChanges` and to reset after a successful save. */
  initialResume: Resume;
  isSaving: boolean;
  isDeleting: boolean;
  hasUnsavedChanges: boolean;
}

export interface ResumeEditorActions {
  /** Generic whole-field update (scalars and whole arrays alike). */
  updateField: <K extends keyof Resume>(field: K, value: Resume[K]) => void;

  // --- Granular bullet actions (operate on the LATEST state, never a snapshot) ---
  /** Append a bullet (empty by default) to an item's description. */
  addBullet: (field: BulletField, itemIndex: number, value?: string) => void;
  updateBullet: (field: BulletField, itemIndex: number, bulletIndex: number, value: string) => void;
  removeBullet: (field: BulletField, itemIndex: number, bulletIndex: number) => void;
  /** Move a bullet by `direction` (-1 up, +1 down); no-op if out of bounds. */
  moveBullet: (field: BulletField, itemIndex: number, bulletIndex: number, direction: number) => void;

  setSaving: (value: boolean) => void;
  setDeleting: (value: boolean) => void;
  /** Mark the current resume as the saved baseline (clears `hasUnsavedChanges`). */
  markSaved: (savedResume?: Resume) => void;
}

export type ResumeEditorStore = ResumeEditorState & ResumeEditorActions;

/**
 * Returns whether `resume` differs from its saved baseline. Kept in the store so
 * `hasUnsavedChanges` stays consistent across every mutation instead of a separate
 * diffing effect in the client component.
 */
function hasChanges(resume: Resume, initialResume: Resume): boolean {
  return JSON.stringify(resume) !== JSON.stringify(initialResume);
}

/**
 * Immutably maps the `description` array of one item in a bullet-bearing field.
 * Returns the same resume reference (no state change) if the item doesn't exist.
 */
function mapBullets(
  resume: Resume,
  field: BulletField,
  itemIndex: number,
  fn: (bullets: string[]) => string[],
): Resume {
  const items = resume[field];
  if (!items?.[itemIndex]) return resume;

  const nextItems = items.map((item, i) =>
    i === itemIndex ? { ...item, description: fn(item.description) } : item,
  );

  return { ...resume, [field]: nextItems };
}

export function createResumeEditorStore(initialResume: Resume) {
  return createStore<ResumeEditorStore>((set) => {
    /** Applies `updater` to the resume and recomputes `hasUnsavedChanges`. */
    const updateResume = (updater: (resume: Resume) => Resume) =>
      set((state) => {
        const resume = updater(state.resume);
        if (resume === state.resume) return state;
        return { resume, hasUnsavedChanges: hasChanges(resume, state.initialResume) };
      });

    return {
      resume: initialResume,
      initialResume,
      isSaving: false,
      isDeleting: false,
      hasUnsavedChanges: false,

      updateField: (field, value) =>
        updateResume((resume) => ({ ...resume, [field]: value })),

      addBullet: (field, itemIndex, value = '') =>
        updateResume((resume) => mapBullets(resume, field, itemIndex, (b) => [...b, value])),

      updateBullet: (field, itemIndex, bulletIndex, value) =>
        updateResume((resume) =>
          mapBullets(resume, field, itemIndex, (b) =>
            b.map((bullet, i) => (i === bulletIndex ? value : bullet)),
          ),
        ),

      removeBullet: (field, itemIndex, bulletIndex) =>
        updateResume((resume) =>
          mapBullets(resume, field, itemIndex, (b) => b.filter((_, i) => i !== bulletIndex)),
        ),

      moveBullet: (field, itemIndex, bulletIndex, direction) =>
        updateResume((resume) =>
          mapBullets(resume, field, itemIndex, (b) => {
            const target = bulletIndex + direction;
            if (target < 0 || target >= b.length) return b;
            const next = [...b];
            [next[bulletIndex], next[target]] = [next[target], next[bulletIndex]];
            return next;
          }),
        ),

      setSaving: (value) => set({ isSaving: value }),
      setDeleting: (value) => set({ isDeleting: value }),
      markSaved: (savedResume) =>
        set((state) => {
          // Baseline becomes whatever was actually persisted. hasUnsavedChanges is
          // recomputed against the live resume so edits made DURING an in-flight save
          // are still flagged as unsaved.
          const baseline = savedResume ?? state.resume;
          return {
            initialResume: baseline,
            hasUnsavedChanges: hasChanges(state.resume, baseline),
          };
        }),
    };
  });
}

export type ResumeEditorStoreApi = ReturnType<typeof createResumeEditorStore>;
