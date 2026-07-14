'use client';

import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { Resume } from '@/lib/types';
import {
  createResumeEditorStore,
  type ResumeEditorStore,
  type ResumeEditorStoreApi,
} from './resume-editor-store';

const ResumeEditorStoreContext = createContext<ResumeEditorStoreApi | null>(null);

interface ResumeStoreProviderProps {
  initialResume: Resume;
  children: ReactNode;
}

/**
 * Seeds a per-editor Zustand store from `initialResume` (created once via a ref so it
 * survives re-renders) and exposes it through context. This is the standard Zustand
 * "store factory + context" pattern for stores initialized from props.
 */
export function ResumeStoreProvider({ initialResume, children }: ResumeStoreProviderProps) {
  const storeRef = useRef<ResumeEditorStoreApi | null>(null);
  if (!storeRef.current) {
    storeRef.current = createResumeEditorStore(initialResume);
  }

  return (
    <ResumeEditorStoreContext.Provider value={storeRef.current}>
      {children}
    </ResumeEditorStoreContext.Provider>
  );
}

/** Select state/actions from the resume editor store. */
export function useResumeEditorStore<T>(selector: (store: ResumeEditorStore) => T): T {
  const store = useContext(ResumeEditorStoreContext);
  if (!store) {
    throw new Error('useResumeEditorStore must be used within a ResumeStoreProvider');
  }
  return useStore(store, selector);
}
