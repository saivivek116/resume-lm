'use client'

import { useSyncExternalStore, useCallback } from 'react'

// Storage key for default model
const MODEL_STORAGE_KEY = 'resumelm-default-model'

// Listener set for model store
const modelListeners = new Set<() => void>()

// Cached server snapshot for SSR (MUST be cached to avoid infinite loops)
const EMPTY_MODEL = ''

// In-memory cache to keep snapshot stable between calls
let currentDefaultModel = EMPTY_MODEL

// Track initialization status
let hasInitializedStore = false
let hasAttachedStorageListener = false

// Emit changes to all subscribers
function emitModelChange() {
  modelListeners.forEach(listener => listener())
}

function ensureClientStoreInitialized() {
  if (typeof window === 'undefined') return

  if (!hasInitializedStore) {
    currentDefaultModel = readStoredModel()
    hasInitializedStore = true
  }

  if (!hasAttachedStorageListener) {
    window.addEventListener('storage', handleStorageChange)
    hasAttachedStorageListener = true
  }
}

function handleStorageChange(event: StorageEvent) {
  if (event.key === MODEL_STORAGE_KEY) {
    const nextModel = event.newValue ?? EMPTY_MODEL
    if (nextModel !== currentDefaultModel) {
      currentDefaultModel = nextModel
      emitModelChange()
    }
  }
}

function readStoredModel(): string {
  if (typeof window === 'undefined') return EMPTY_MODEL
  return localStorage.getItem(MODEL_STORAGE_KEY) ?? EMPTY_MODEL
}

// Subscribe function for useSyncExternalStore
function subscribeModel(listener: () => void) {
  ensureClientStoreInitialized()
  modelListeners.add(listener)
  return () => {
    modelListeners.delete(listener)
  }
}

// Snapshot functions - return stable references
function getModelSnapshot(): string {
  if (typeof window === 'undefined') return EMPTY_MODEL
  ensureClientStoreInitialized()
  return currentDefaultModel
}

function getServerModelSnapshot(): string {
  return EMPTY_MODEL
}

/**
 * Hook to manage the default AI model selection with real-time sync.
 * Uses useSyncExternalStore to ensure all consumers update instantly
 * when localStorage changes.
 */
export function useDefaultModel() {
  const defaultModel = useSyncExternalStore(
    subscribeModel,
    getModelSnapshot,
    getServerModelSnapshot
  )

  const setDefaultModel = useCallback((model: string) => {
    ensureClientStoreInitialized()

    const nextModel = model ?? EMPTY_MODEL
    if (nextModel === currentDefaultModel) {
      return
    }

    currentDefaultModel = nextModel

    if (typeof window !== 'undefined') {
      localStorage.setItem(MODEL_STORAGE_KEY, currentDefaultModel)
    }

    emitModelChange()
  }, [])

  return { defaultModel, setDefaultModel }
}

// Re-export storage key for consistency
export { MODEL_STORAGE_KEY }
