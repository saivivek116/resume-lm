# BYOK — Bring Your Own API Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace server-side and localStorage API key handling with per-user encrypted DB storage so every user brings their own OpenAI/Anthropic/OpenRouter keys.

**Architecture:** A new `user_api_keys` table stores AES-256-GCM encrypted keys; server actions encrypt/decrypt them; `initializeAIClient` becomes async and fetches keys from DB instead of env vars or localStorage. The Pro tier is removed entirely.

**Tech Stack:** Next.js 15 App Router, Supabase, Node.js `crypto` (built-in, no new deps), TypeScript, Shadcn UI, Tailwind CSS.

---

## File Map

| Status | Path | Role |
|--------|------|------|
| CREATE | `src/utils/encryption.ts` | AES-256-GCM encrypt/decrypt |
| CREATE | `src/utils/actions/api-keys/actions.ts` | Server actions: upsert/delete/has/getDecrypted/getAvailable |
| CREATE | `src/components/profile/profile-api-keys-form.tsx` | UI form for managing API keys |
| MODIFY | `schema.sql` | Add `user_api_keys` table + RLS |
| MODIFY | `src/utils/ai-tools.ts` | Make async, use DB keys, remove isPro |
| MODIFY | `src/lib/ai-models.ts` | Remove isPro from isModelAvailable, simplify AIConfig, collapse DEFAULT_MODELS |
| MODIFY | `src/app/(dashboard)/profile/page.tsx` | Pre-fetch key status, pass to form |
| MODIFY | `src/components/profile/profile-edit-form.tsx` | Add API Keys tab, remove localStorage reads |
| MODIFY | `src/components/shared/model-selector.tsx` | Replace isProPlan+apiKeys with availableProviders |
| MODIFY | `src/app/api/chat/route.ts` | Remove isPro, await initializeAIClient |
| MODIFY | `src/utils/actions/resumes/ai.ts` | Remove isPro, await initializeAIClient |
| MODIFY | `src/utils/actions/cover-letter/actions.ts` | Remove isPro, await initializeAIClient |
| MODIFY | `src/utils/actions/profiles/ai.ts` | Remove isPro, await initializeAIClient |
| MODIFY | `src/utils/actions/jobs/ai.ts` | Remove isPro, await initializeAIClient |
| MODIFY | `src/components/resume/assistant/chatbot.tsx` | Remove useApiKeys, stop passing apiKeys |
| MODIFY | `src/components/resume/editor/panels/resume-score-panel.tsx` | Remove useApiKeys |
| MODIFY | `src/components/resume/editor/panels/cover-letter-panel.tsx` | Remove localStorage reads |
| MODIFY | `src/components/resume/management/dialogs/create-tailored-resume-dialog.tsx` | Remove localStorage reads |
| MODIFY | `src/components/resume/management/dialogs/create-base-resume-dialog.tsx` | Remove localStorage reads |
| MODIFY | `src/components/settings/settings-content.tsx` | Remove ApiKeysForm and isProPlan prop |
| MODIFY | `src/app/(dashboard)/settings/page.tsx` | Remove subscription/isProPlan plumbing |
| MODIFY | `src/hooks/use-api-keys.ts` | Remove `useApiKeys`, keep `useDefaultModel` for model preference |
| DELETE | `src/components/settings/api-keys-form.tsx` | Replaced by ProfileApiKeysForm |

---

## Task 1: Add `user_api_keys` table to schema

**Files:**
- Modify: `schema.sql`

- [ ] **Step 1: Add table and RLS to schema.sql**

Open `schema.sql` and append after the last existing table's RLS policy block:

```sql
-- User API Keys (encrypted, BYOK)
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  user_id       uuid NOT NULL,
  provider      text NOT NULL,
  encrypted_key text NOT NULL,
  updated_at    timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_api_keys_pkey PRIMARY KEY (user_id, provider),
  CONSTRAINT user_api_keys_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_api_keys_policy ON public.user_api_keys
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Run the migration in Supabase**

If using local Supabase:
```bash
# In the project root
npx supabase db push
# or paste the SQL above directly in Supabase Studio → SQL Editor
```

If using hosted Supabase: paste the SQL block above into Supabase Studio → SQL Editor → Run.

Expected: no errors, `user_api_keys` table appears in the Table Editor.

- [ ] **Step 3: Verify table exists**

```bash
# Check via Supabase Studio or:
npx supabase db diff
```

Expected: table `user_api_keys` with columns `user_id`, `provider`, `encrypted_key`, `updated_at`.

- [ ] **Step 4: Commit**

```bash
git add schema.sql
git commit -m "feat: add user_api_keys table with RLS for BYOK"
```

---

## Task 2: Create AES-256-GCM encryption utility

**Files:**
- Create: `src/utils/encryption.ts`

- [ ] **Step 1: Create the encryption module**

```typescript
// src/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getSecret(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret || secret.length !== 64) {
    throw new Error('API_KEY_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32')
  }
  return Buffer.from(secret, 'hex')
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getSecret(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decrypt(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted key format')
  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, getSecret(), iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}
```

- [ ] **Step 2: Add env var to .env.local (dev only)**

```bash
# Generate a 32-byte hex secret
openssl rand -hex 32
```

Copy the output and add to `.env.local`:
```
API_KEY_ENCRYPTION_SECRET=<paste-output-here>
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/encryption.ts
git commit -m "feat: add AES-256-GCM encryption utility for API key storage"
```

---

## Task 3: Create server actions for API key management

**Files:**
- Create: `src/utils/actions/api-keys/actions.ts`

- [ ] **Step 1: Create the actions file**

```typescript
// src/utils/actions/api-keys/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { encrypt, decrypt } from '@/utils/encryption'
import type { ServiceName } from '@/lib/types'

export async function upsertApiKey(provider: ServiceName, rawKey: string): Promise<{ error?: string }> {
  if (!rawKey.trim()) return { error: 'API key cannot be empty' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const encrypted_key = encrypt(rawKey.trim())
  const { error } = await supabase
    .from('user_api_keys')
    .upsert(
      { user_id: user.id, provider, encrypted_key, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,provider' }
    )

  if (error) return { error: error.message }
  return {}
}

export async function deleteApiKey(provider: ServiceName): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider)

  if (error) return { error: error.message }
  return {}
}

export async function hasApiKey(provider: ServiceName): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('user_api_keys')
    .select('provider')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle()

  return !!data
}

export async function getDecryptedApiKey(provider: ServiceName): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .maybeSingle()

  if (!data) return null
  try {
    return decrypt(data.encrypted_key)
  } catch {
    return null
  }
}

export async function getAvailableProviders(): Promise<ServiceName[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('user_api_keys')
    .select('provider')
    .eq('user_id', user.id)

  return (data ?? []).map(row => row.provider as ServiceName)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors from these files (pre-existing errors are documented in memory as acceptable).

- [ ] **Step 3: Commit**

```bash
git add src/utils/actions/api-keys/actions.ts
git commit -m "feat: add server actions for BYOK API key management"
```

---

## Task 4: Simplify ai-models.ts — remove Pro tier, simplify AIConfig

**Files:**
- Modify: `src/lib/ai-models.ts`

- [ ] **Step 1: Remove `apiKeys` from `AIConfig` and `isPro` from relevant fields**

In `src/lib/ai-models.ts`, make these changes:

**Change `AIConfig` interface** (around line 47):
```typescript
// BEFORE:
export interface AIConfig {
  model: string
  apiKeys: ApiKey[]
  customPrompts?: import('./types').CustomPrompts
}

// AFTER:
export interface AIConfig {
  model: string
  customPrompts?: import('./types').CustomPrompts
}
```

**Change `AIModel.features`** — remove `isPro` field (around line 33):
```typescript
// BEFORE:
features: {
  isFree?: boolean
  isRecommended?: boolean
  isUnstable?: boolean
  maxTokens?: number
  supportsVision?: boolean
  supportsTools?: boolean
  isPro?: boolean
}

// AFTER:
features: {
  isFree?: boolean
  isRecommended?: boolean
  isUnstable?: boolean
  maxTokens?: number
  supportsVision?: boolean
  supportsTools?: boolean
}
```

Remove `isPro: true` from any model definitions that have it (search for `isPro: true` in the models array and delete that line from each).

- [ ] **Step 2: Collapse `DEFAULT_MODELS` and update `isModelAvailable`**

**Change `DEFAULT_MODELS`** (around line 394):
```typescript
// BEFORE:
export const DEFAULT_MODELS = {
  PRO_USER: 'gpt-5.2',
  FREE_USER: 'deepseek/deepseek-v3.2:nitro'
} as const

// AFTER:
export const DEFAULT_MODEL = 'deepseek/deepseek-v3.2:nitro' as const
```

**Change `isModelAvailable`** (around line 464):
```typescript
// BEFORE:
export function isModelAvailable(
  modelId: string,
  isPro: boolean,
  apiKeys: ApiKey[]
): boolean {
  modelId = MODEL_ALIASES[modelId] || modelId
  if (isPro) return true
  const model = getModelById(modelId)
  if (!model) return false
  if (model.features.isFree) return true
  if (modelId.includes('/')) {
    return apiKeys.some(key => key.service === 'openrouter')
  }
  return apiKeys.some(key => key.service === model.provider)
}

// AFTER:
export function isModelAvailable(
  modelId: string,
  availableProviders: ServiceName[]
): boolean {
  modelId = MODEL_ALIASES[modelId] || modelId
  const model = getModelById(modelId)
  if (!model) return false
  if (model.features.isFree) return true
  if (modelId.includes('/')) {
    return availableProviders.includes('openrouter')
  }
  return availableProviders.includes(model.provider)
}
```

**Change `getDefaultModel`** (around line 491):
```typescript
// BEFORE:
export function getDefaultModel(isPro: boolean): string {
  return isPro ? DEFAULT_MODELS.PRO_USER : DEFAULT_MODELS.FREE_USER
}

// AFTER:
export function getDefaultModel(): string {
  return DEFAULT_MODEL
}
```

**Change `getSelectableModels`** (around line 537):
```typescript
// BEFORE:
export function getSelectableModels(isPro: boolean, apiKeys: ApiKey[]): AIModel[] {
  return AI_MODELS.filter(model => isModelAvailable(model.id, isPro, apiKeys))
}

// AFTER:
export function getSelectableModels(availableProviders: ServiceName[]): AIModel[] {
  return AI_MODELS.filter(model => isModelAvailable(model.id, availableProviders))
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors about callers of `isModelAvailable`, `getDefaultModel`, `getSelectableModels` using old signatures — these will be fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai-models.ts
git commit -m "refactor: remove Pro tier from ai-models, simplify AIConfig and isModelAvailable"
```

---

## Task 5: Refactor `initializeAIClient` to be async and use DB keys

**Files:**
- Modify: `src/utils/ai-tools.ts`

- [ ] **Step 1: Replace the entire file contents**

```typescript
// src/utils/ai-tools.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LanguageModelV1 } from 'ai';
import { getModelById, getProviderById, type AIModel, type AIConfig } from '@/lib/ai-models';
import { getDecryptedApiKey } from '@/utils/actions/api-keys/actions';

export type { ApiKey, AIConfig } from '@/lib/ai-models';

type HiddenModel = Pick<AIModel, 'id' | 'provider' | 'features' | 'availability'>;
const HIDDEN_MODELS: Record<string, HiddenModel> = {
  'openai/gpt-5-nano': {
    id: 'openai/gpt-5-nano',
    provider: 'openrouter',
    features: { isFree: true, isUnstable: false, maxTokens: 400000, supportsVision: false, supportsTools: true },
    availability: { requiresApiKey: true, requiresPro: false },
  },
};

export async function initializeAIClient(config: AIConfig): Promise<LanguageModelV1> {
  const modelData = getModelById(config.model) ?? HIDDEN_MODELS[config.model];
  const resolvedModelId = modelData?.id ?? config.model;
  const provider = modelData ? getProviderById(modelData.provider) : undefined;

  if (!modelData || !provider) {
    throw new Error(`Unknown model: ${config.model}`);
  }

  // All models with a slash in their ID go through OpenRouter
  if (resolvedModelId.includes('/')) {
    const apiKey = await getDecryptedApiKey('openrouter');
    if (!apiKey) {
      throw new Error('Add your OpenRouter API key in Profile settings to use this model');
    }
    return createOpenRouter({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'ResumeLM',
      },
    })(resolvedModelId) as LanguageModelV1;
  }

  const apiKey = await getDecryptedApiKey(provider.id);
  if (!apiKey) {
    throw new Error(`Add your ${provider.name} API key in Profile settings to use this model`);
  }

  switch (provider.id) {
    case 'anthropic':
      return createAnthropic({ apiKey })(resolvedModelId) as LanguageModelV1;
    case 'openai':
      return createOpenAI({ apiKey, compatibility: 'strict' })(resolvedModelId) as LanguageModelV1;
    case 'openrouter':
      return createOpenRouter({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'ResumeLM',
        },
      })(resolvedModelId) as LanguageModelV1;
    default:
      throw new Error(`Unsupported provider: ${provider.id}`);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors in callers that don't await `initializeAIClient` — fixed in next task.

- [ ] **Step 3: Commit**

```bash
git add src/utils/ai-tools.ts
git commit -m "refactor: make initializeAIClient async, fetch keys from DB instead of env/localStorage"
```

---

## Task 6: Update all server-side AI callers

Remove `isPro`, subscription plan fetches, and `apiKeys` from all AI action files. Await `initializeAIClient`.

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/utils/actions/resumes/ai.ts`
- Modify: `src/utils/actions/cover-letter/actions.ts`
- Modify: `src/utils/actions/profiles/ai.ts`
- Modify: `src/utils/actions/jobs/ai.ts`

### 6a: Update `/api/chat/route.ts`

- [ ] **Step 1: Remove isPro and subscription, await initializeAIClient**

In `src/app/api/chat/route.ts`:

Remove the import of `getSubscriptionPlan` and all `isPro` / rate-limiting logic. The `config` in `ChatRequest` no longer has `apiKeys`. Replace:

```typescript
// REMOVE these lines:
import { getSubscriptionPlan } from '@/utils/actions/stripe/actions';
// ...
const { plan, id } = await getSubscriptionPlan(true);
const isPro = plan === 'pro';
if (isPro) {
  try {
    await checkRateLimit(id);
  } catch (error) { ... }
}
const aiClient = initializeAIClient(config, isPro);
```

With:
```typescript
if (!config) {
  return new Response(JSON.stringify({ error: 'Model config is required' }), { status: 400 });
}
const aiClient = await initializeAIClient(config);
```

Keep everything else (message streaming, tool invocations, temperature logic) unchanged.

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | grep "chat/route" | head -10
```

Expected: no errors in this file.

### 6b: Update `resumes/ai.ts`

- [ ] **Step 3: Remove isPro and subscription from resumes/ai.ts**

In `src/utils/actions/resumes/ai.ts`, find every occurrence of:
```typescript
const subscriptionPlan = await getSubscriptionPlan();
const isPro = subscriptionPlan === 'pro';
const aiClient = isPro ? initializeAIClient(candidate, isPro, true) : initializeAIClient(candidate);
```

Replace with:
```typescript
const aiClient = await initializeAIClient(candidate);
```

Also update the function that builds the fallback model list — remove `apiKeys: config?.apiKeys || []` from the candidate configs since `AIConfig` no longer has `apiKeys`:
```typescript
// BEFORE:
{ model: 'deepseek/deepseek-v3.2:nitro', apiKeys: config?.apiKeys || [] }

// AFTER:
{ model: 'deepseek/deepseek-v3.2:nitro' }
```

Apply this `apiKeys` removal to all candidate config objects in that file.

Remove the `getSubscriptionPlan` import if no longer used.

### 6c: Update `cover-letter/actions.ts`

- [ ] **Step 4: Remove isPro from cover-letter/actions.ts**

In `src/utils/actions/cover-letter/actions.ts`, replace:
```typescript
const subscriptionPlan = await getSubscriptionPlan();
const isPro = subscriptionPlan === 'pro';
const aiClient = isPro ? initializeAIClient(config, isPro) : initializeAIClient(config);
```
With:
```typescript
const aiClient = await initializeAIClient(config);
```

Remove the `getSubscriptionPlan` import if no longer used.

### 6d: Update `profiles/ai.ts`

- [ ] **Step 5: Remove isPro from profiles/ai.ts**

In `src/utils/actions/profiles/ai.ts`, replace:
```typescript
const subscriptionPlan = await getSubscriptionPlan();
const isPro = subscriptionPlan === 'pro';
const aiClient = isPro ? initializeAIClient(config, isPro) : initializeAIClient(config);
```
With:
```typescript
const aiClient = await initializeAIClient(config);
```

Remove the `getSubscriptionPlan` import if no longer used.

### 6e: Update `jobs/ai.ts`

- [ ] **Step 6: Remove isPro from jobs/ai.ts**

In `src/utils/actions/jobs/ai.ts`, replace all occurrences of:
```typescript
const isPro = plan === 'pro';
// ...
const aiClient = isPro ? initializeAIClient(candidate, isPro, true) : initializeAIClient(candidate);
```
With:
```typescript
const aiClient = await initializeAIClient(candidate);
```

Remove `apiKeys: config?.apiKeys || []` from candidate config objects.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors should now be limited to client-side components (next tasks).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/chat/route.ts src/utils/actions/resumes/ai.ts src/utils/actions/cover-letter/actions.ts src/utils/actions/profiles/ai.ts src/utils/actions/jobs/ai.ts
git commit -m "refactor: remove Pro tier from all AI action callers, await initializeAIClient"
```

---

## Task 7: Create `ProfileApiKeysForm` component

**Files:**
- Create: `src/components/profile/profile-api-keys-form.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/profile/profile-api-keys-form.tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Key, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { upsertApiKey, deleteApiKey } from '@/utils/actions/api-keys/actions'
import { PROVIDERS } from '@/lib/ai-models'
import type { ServiceName } from '@/lib/types'

interface ProviderKeyState {
  hasKey: boolean
  inputValue: string
}

interface ProfileApiKeysFormProps {
  keyStatus: Record<ServiceName, boolean>
}

const SUPPORTED_PROVIDERS: ServiceName[] = ['openai', 'anthropic', 'openrouter']

export function ProfileApiKeysForm({ keyStatus }: ProfileApiKeysFormProps) {
  const [states, setStates] = useState<Record<ServiceName, ProviderKeyState>>(
    () => Object.fromEntries(
      SUPPORTED_PROVIDERS.map(p => [p, { hasKey: keyStatus[p] ?? false, inputValue: '' }])
    ) as Record<ServiceName, ProviderKeyState>
  )
  const [isPending, startTransition] = useTransition()

  const handleSave = (provider: ServiceName) => {
    const value = states[provider].inputValue.trim()
    if (!value) {
      toast.error('Please enter an API key', { position: 'bottom-right' })
      return
    }
    startTransition(async () => {
      const result = await upsertApiKey(provider, value)
      if (result.error) {
        toast.error(result.error, { position: 'bottom-right' })
        return
      }
      setStates(prev => ({
        ...prev,
        [provider]: { hasKey: true, inputValue: '' },
      }))
      toast.success(`${PROVIDERS[provider]?.name} API key saved`, {
        position: 'bottom-right',
        className: 'bg-gradient-to-r from-emerald-500 to-green-500 text-white border-none',
      })
    })
  }

  const handleRemove = (provider: ServiceName) => {
    startTransition(async () => {
      const result = await deleteApiKey(provider)
      if (result.error) {
        toast.error(result.error, { position: 'bottom-right' })
        return
      }
      setStates(prev => ({
        ...prev,
        [provider]: { hasKey: false, inputValue: '' },
      }))
      toast.success(`${PROVIDERS[provider]?.name} API key removed`, { position: 'bottom-right' })
    })
  }

  return (
    <Card className="bg-white/50 backdrop-blur-sm border-white/40 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-5 w-5 text-teal-600" />
          API Keys
        </CardTitle>
        <CardDescription>
          Add your own API keys to use AI features. Keys are encrypted and never shown after saving.
          Get keys from each provider&apos;s dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {SUPPORTED_PROVIDERS.map(provider => {
          const providerInfo = PROVIDERS[provider]
          const state = states[provider]
          if (!providerInfo) return null

          return (
            <div key={provider} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {providerInfo.name}
                  {state.hasKey && (
                    <span className="ml-2 text-xs text-emerald-600 font-normal">● Key saved</span>
                  )}
                </Label>
                <a
                  href={providerInfo.apiLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:underline"
                >
                  Get API key →
                </a>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={state.hasKey ? '••••••••••••••••' : `Enter ${providerInfo.name} API key`}
                  value={state.inputValue}
                  onChange={e =>
                    setStates(prev => ({
                      ...prev,
                      [provider]: { ...prev[provider], inputValue: e.target.value },
                    }))
                  }
                  className="flex-1 bg-white/50 border-white/40"
                  disabled={isPending}
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(provider)}
                  disabled={isPending || !states[provider].inputValue.trim()}
                  className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
                >
                  <Save className="h-4 w-4" />
                </Button>
                {state.hasKey && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemove(provider)}
                    disabled={isPending}
                    className="border-rose-500/20 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | grep "profile-api-keys" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/profile-api-keys-form.tsx
git commit -m "feat: add ProfileApiKeysForm component for BYOK key management"
```

---

## Task 8: Wire API Keys tab into profile page

**Files:**
- Modify: `src/app/(dashboard)/profile/page.tsx`
- Modify: `src/components/profile/profile-edit-form.tsx`

### 8a: Update profile page to pre-fetch key status

- [ ] **Step 1: Update `profile/page.tsx`**

```typescript
// src/app/(dashboard)/profile/page.tsx
import { redirect } from "next/navigation";
import { getDashboardData } from "@/utils/actions";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { Suspense } from "react";
import { hasApiKey } from "@/utils/actions/api-keys/actions";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditProfilePage() {
  let data;
  try {
    data = await getDashboardData();
  } catch {
    redirect("/");
  }

  const { profile } = data;
  if (!profile) redirect("/home");

  const [hasOpenAI, hasAnthropic, hasOpenRouter] = await Promise.all([
    hasApiKey('openai'),
    hasApiKey('anthropic'),
    hasApiKey('openrouter'),
  ]);

  const keyStatus = { openai: hasOpenAI, anthropic: hasAnthropic, openrouter: hasOpenRouter };

  return (
    <main className="min-h-screen relative">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 via-sky-50/50 to-violet-50/50" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-r from-pink-200/20 to-violet-200/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-gradient-to-r from-blue-200/20 to-teal-200/20 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:14px_24px]" />
      </div>
      <div className="relative z-10">
        <Suspense fallback={<div>Loading...</div>}>
          <ProfileEditForm profile={profile} keyStatus={keyStatus} />
        </Suspense>
      </div>
    </main>
  );
}
```

### 8b: Update ProfileEditForm to add API Keys tab and remove localStorage

- [ ] **Step 2: Update `ProfileEditFormProps` interface**

In `src/components/profile/profile-edit-form.tsx`, update the interface:
```typescript
import type { ServiceName } from '@/lib/types'
import { ProfileApiKeysForm } from '@/components/profile/profile-api-keys-form'

interface ProfileEditFormProps {
  profile: Profile;
  keyStatus: Record<ServiceName, boolean>;
}

export function ProfileEditForm({ profile: initialProfile, keyStatus }: ProfileEditFormProps) {
```

- [ ] **Step 3: Remove all localStorage reads**

Remove the `handleResumeUpload` function's localStorage code (lines ~153–170). Replace:
```typescript
// REMOVE:
const MODEL_STORAGE_KEY = 'resumelm-default-model';
const LOCAL_STORAGE_KEY = 'resumelm-api-keys';
const selectedModel = localStorage.getItem(MODEL_STORAGE_KEY) || 'claude-sonnet-4-20250514';
const storedKeys = localStorage.getItem(LOCAL_STORAGE_KEY);
let apiKeys = [];
try {
  apiKeys = storedKeys ? JSON.parse(storedKeys) : [];
} catch (error) {
  console.error('Error parsing API keys:', error);
}
const result = await formatProfileWithAI(content, {
  model: selectedModel,
  apiKeys
});

// REPLACE WITH:
const result = await formatProfileWithAI(content, {
  model: 'deepseek/deepseek-v3.2:nitro'
});
```

- [ ] **Step 4: Update error message for missing API key**

Find the error handler in `handleResumeUpload` (around line 254):
```typescript
// BEFORE:
setApiKeyError(
  'API key required. Please add your OpenAI API key in settings or upgrade to our Pro Plan.'
);

// AFTER:
setApiKeyError(
  'API key required. Please add your API key in the API Keys tab of your Profile.'
);
```

- [ ] **Step 5: Remove ProUpgradeButton import**

Remove:
```typescript
import { ProUpgradeButton } from "@/components/settings/pro-upgrade-button";
```

And any usage of `<ProUpgradeButton />` in the JSX.

- [ ] **Step 6: Add API Keys tab to the Tabs component**

In the `<TabsList>` of the profile form, add after the last existing trigger:
```tsx
<TabsTrigger value="api-keys" className="...same classes as other triggers...">
  <Key className="h-4 w-4" />
  <span className="hidden sm:inline">API Keys</span>
</TabsTrigger>
```

Add `Key` to the lucide-react import at the top.

In `<TabsContent>` area, add after the last existing content:
```tsx
<TabsContent value="api-keys">
  <ProfileApiKeysForm keyStatus={keyStatus} />
</TabsContent>
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | grep -E "profile-edit|profile/page" | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/profile/page.tsx src/components/profile/profile-edit-form.tsx
git commit -m "feat: add API Keys tab to profile page, pre-fetch key status server-side"
```

---

## Task 9: Update `ModelSelector` to use `availableProviders`

**Files:**
- Modify: `src/components/shared/model-selector.tsx`

- [ ] **Step 1: Update props interface**

In `src/components/shared/model-selector.tsx`, change the props:

```typescript
// BEFORE:
interface ModelSelectorProps {
  value: string
  onValueChange: (value: string) => void
  apiKeys: ApiKey[]
  isProPlan: boolean
  className?: string
  placeholder?: string
  showToast?: boolean
}

// AFTER:
import type { ServiceName } from '@/lib/types'

interface ModelSelectorProps {
  value: string
  onValueChange: (value: string) => void
  availableProviders: ServiceName[]
  className?: string
  placeholder?: string
  showToast?: boolean
}
```

- [ ] **Step 2: Update `isModelSelectable` inside the component**

```typescript
// BEFORE:
const isModelSelectable = (modelId: string) => {
  return isModelAvailable(modelId, isProPlan, apiKeys)
}

// AFTER:
const isModelSelectable = (modelId: string) => {
  return isModelAvailable(modelId, availableProviders)
}
```

- [ ] **Step 3: Update `UnavailableModelPopover` — remove Pro upgrade CTA**

Find the `UnavailableModelPopover` component (around lines 32–112). Remove the "Upgrade to Pro" section and replace the whole content with just the "Add API Key" option:

```tsx
function UnavailableModelPopover({ modelId, children }: { modelId: string; children: React.ReactNode }) {
  const provider = getModelProvider(modelId)
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <p className="text-sm font-medium">API Key Required</p>
          <p className="text-xs text-muted-foreground">
            Add your {provider?.name ?? 'provider'} API key in Profile settings to use this model.
          </p>
          <a
            href="/profile"
            className="flex items-center gap-2 text-xs text-teal-600 hover:underline"
          >
            <Key className="h-3 w-3" />
            Go to Profile → API Keys
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

Add `Key` to lucide-react imports. Add `Popover, PopoverContent, PopoverTrigger` imports from `@/components/ui/popover` if not already present.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | grep "model-selector" | head -10
```

Expected: errors in callers passing old props — fixed in next task.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/model-selector.tsx
git commit -m "refactor: update ModelSelector to use availableProviders, remove Pro tier CTA"
```

---

## Task 10: Update client components — remove localStorage reads

All these components currently read `localStorage` for API keys or use the `useApiKeys` hook. After BYOK they just pass a model string. For `ModelSelector` usage they need `availableProviders` from `getAvailableProviders()`.

**Files:**
- Modify: `src/components/resume/assistant/chatbot.tsx`
- Modify: `src/components/resume/editor/panels/resume-score-panel.tsx`
- Modify: `src/components/resume/editor/panels/cover-letter-panel.tsx`
- Modify: `src/components/resume/management/dialogs/create-tailored-resume-dialog.tsx`
- Modify: `src/components/resume/management/dialogs/create-base-resume-dialog.tsx`

### Pattern to apply in each component:

**Remove:**
```typescript
import { useApiKeys, useDefaultModel } from '@/hooks/use-api-keys'
const { apiKeys } = useApiKeys()
// or:
const LOCAL_STORAGE_KEY = 'resumelm-api-keys'
const storedKeys = localStorage.getItem(LOCAL_STORAGE_KEY)
let apiKeys = []
apiKeys = storedKeys ? JSON.parse(storedKeys) : []
```

**Add (for components using ModelSelector):**
```typescript
import { getAvailableProviders } from '@/utils/actions/api-keys/actions'
import type { ServiceName } from '@/lib/types'
import { useEffect, useState } from 'react'

const [availableProviders, setAvailableProviders] = useState<ServiceName[]>([])
useEffect(() => {
  getAvailableProviders().then(setAvailableProviders)
}, [])
```

**Update ModelSelector usage:**
```tsx
// BEFORE:
<ModelSelector apiKeys={apiKeys} isProPlan={isProPlan} ... />

// AFTER:
<ModelSelector availableProviders={availableProviders} ... />
```

**Update AIConfig passed to server actions (remove apiKeys field):**
```typescript
// BEFORE:
{ model: selectedModel, apiKeys }

// AFTER:
{ model: selectedModel }
```

- [ ] **Step 1: Update `chatbot.tsx`**

Remove `useApiKeys` import and usage. Add `getAvailableProviders` + `availableProviders` state. Update `ModelSelector` and the fetch config object.

- [ ] **Step 2: Update `resume-score-panel.tsx`**

Remove `useApiKeys` import and usage. Add `getAvailableProviders` + `availableProviders` state. Update `ModelSelector` and fetch configs.

- [ ] **Step 3: Update `cover-letter-panel.tsx`**

Remove localStorage reads. Update the config object passed to the cover letter server action.

- [ ] **Step 4: Update `create-tailored-resume-dialog.tsx`**

Remove localStorage reads. Update the AIConfig objects passed to server actions.

- [ ] **Step 5: Update `create-base-resume-dialog.tsx`**

Remove localStorage reads. Update the AIConfig objects passed to server actions.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | head -40
```

Expected: minimal errors remaining.

- [ ] **Step 7: Commit**

```bash
git add src/components/resume/assistant/chatbot.tsx src/components/resume/editor/panels/resume-score-panel.tsx src/components/resume/editor/panels/cover-letter-panel.tsx src/components/resume/management/dialogs/create-tailored-resume-dialog.tsx src/components/resume/management/dialogs/create-base-resume-dialog.tsx
git commit -m "refactor: remove localStorage API key reads from client components"
```

---

## Task 11: Update settings page — remove API keys section

**Files:**
- Modify: `src/components/settings/settings-content.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx` (at `src/app/settings/page.tsx`)

- [ ] **Step 1: Update `settings-content.tsx`**

Remove `isProPlan` from the interface and component props. Remove the `<ApiKeysForm>` import and its JSX usage:

```typescript
// REMOVE:
import { ApiKeysForm } from '@/components/settings/api-keys-form'

interface SettingsContentProps {
  user: ...
  isProPlan: boolean  // REMOVE THIS LINE
  subscriptionStatus: string
  subscriptionSnapshot: ...
}

// In JSX, REMOVE:
<ApiKeysForm isProPlan={isProPlan} />
```

- [ ] **Step 2: Update settings page**

In the settings page (`src/app/settings/page.tsx`), remove subscription and `isProPlan` fetching. Simplify to just pass `user`:

```typescript
// REMOVE subscription fetching and isProPlan. Keep only:
const { data: { user } } = await supabase.auth.getUser();
// Pass only what SettingsContent still needs (user, subscriptionStatus for billing display if kept)
```

Note: If subscription info is still needed for billing/Stripe management UI, keep those props but remove `isProPlan` specifically.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1 | grep "settings" | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/settings-content.tsx src/app/settings/page.tsx
git commit -m "refactor: remove ApiKeysForm and isProPlan from settings page"
```

---

## Task 12: Delete old files and clean up Pro tier references

**Files:**
- Delete: `src/hooks/use-api-keys.ts`
- Delete: `src/components/settings/api-keys-form.tsx`

- [ ] **Step 1: Remove `useApiKeys` from `use-api-keys.ts`, keep `useDefaultModel`**

Open `src/hooks/use-api-keys.ts`. Delete the entire `useApiKeys` function and its associated store/listener code. Keep `useDefaultModel` and its localStorage logic (`resumelm-default-model` key) intact. The file shrinks to just the model preference hook.

- [ ] **Step 2: Delete old settings form**

```bash
rm src/components/settings/api-keys-form.tsx
```

- [ ] **Step 3: Find any remaining references to deleted exports**

```bash
grep -rn "useApiKeys\|resumelm-api-keys\|api-keys-form\|ApiKeysForm" src/ --include="*.tsx" --include="*.ts"
```

Expected: no results. If any remain, remove those import lines and usages.

- [ ] **Step 3: Find and remove remaining Pro tier references**

```bash
grep -rn "isProPlan\|isPro\b\|DEFAULT_MODELS\." src/ --include="*.tsx" --include="*.ts"
```

For each result, remove or update as appropriate:
- `isProPlan` props → remove
- `isPro` in non-subscription contexts → remove
- `DEFAULT_MODELS.PRO_USER` / `DEFAULT_MODELS.FREE_USER` → replace with `DEFAULT_MODEL`

- [ ] **Step 4: Final TypeScript compile check**

```bash
cd /Users/saivivekv/poc/resume-lm && npx tsc --noEmit 2>&1
```

Expected: only the pre-existing errors documented in project memory (Stripe API version mismatch, implicit `any` types in middleware).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete localStorage API key hook and old settings form, clean up Pro tier references"
```

---

## Task 13: Environment variable and documentation

**Files:**
- Modify: `.env.example` (or `.env.local.example` / `README.md` — wherever env vars are documented)

- [ ] **Step 1: Find existing env var documentation**

```bash
ls /Users/saivivekv/poc/resume-lm/.env* 2>/dev/null
```

- [ ] **Step 2: Add the new env var to the example file**

Add to `.env.example` (or equivalent):
```
# BYOK encryption secret — generate with: openssl rand -hex 32
# NEVER rotate this after first use (existing encrypted keys become unreadable)
API_KEY_ENCRYPTION_SECRET=
```

Remove the provider key env vars if they are documented there (since they're no longer used server-side):
```
# REMOVE (no longer needed server-side):
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# OPENROUTER_API_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add API_KEY_ENCRYPTION_SECRET env var, remove server-side provider key vars"
```

---

## Task 14: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/saivivekv/poc/resume-lm && npm run dev
```

- [ ] **Step 2: Verify API Keys tab in profile**

1. Navigate to `/profile`
2. Click the "API Keys" tab
3. Verify three provider rows appear: OpenAI, Anthropic, OpenRouter
4. Each shows empty input (no keys saved yet)

- [ ] **Step 3: Save an API key and verify masking**

1. Type an API key value into the OpenRouter field
2. Click Save
3. Verify: success toast appears, input clears, "● Key saved" label appears
4. Refresh the page → input should show masked placeholder `••••••••••••••••` (not empty)
5. Verify: the actual key is not visible anywhere in the page source or network tab

- [ ] **Step 4: Remove a key**

1. Click the Remove button next to a saved key
2. Verify: success toast, "● Key saved" label disappears, input returns to empty

- [ ] **Step 5: Trigger an AI action with a key present**

1. Add an OpenRouter API key
2. Go to the resume editor, open the AI chatbot
3. Send a message
4. Verify: AI responds successfully

- [ ] **Step 6: Trigger an AI action with no key**

1. Remove all API keys
2. Try to use an AI feature (chatbot or resume import)
3. Verify: error message appears saying "Add your [Provider] API key in Profile settings" with a link to `/profile`

- [ ] **Step 7: Verify DB is encrypted**

In Supabase Studio → Table Editor → `user_api_keys`:
- Confirm `encrypted_key` column shows ciphertext (e.g., `a1b2c3...:d4e5f6...:...`), NOT raw API key

- [ ] **Step 8: Verify model selector**

1. Open ModelSelector in any resume editor
2. Models for providers without keys should show as unavailable
3. Clicking an unavailable model shows "Add API key in Profile settings" with link, NOT "Upgrade to Pro"

- [ ] **Step 9: Run lint**

```bash
cd /Users/saivivekv/poc/resume-lm && npm run lint
```

Expected: no new lint errors.

---

## Summary of Key Changes

| Area | Before | After |
|------|--------|-------|
| API key storage | `localStorage` (free) / env vars (Pro) | DB `user_api_keys` table, AES-256-GCM encrypted |
| Pro tier | Exists, uses server env keys | Removed entirely |
| `initializeAIClient` | Sync, accepts `isPro` + `apiKeys` | Async, fetches from DB internally |
| `AIConfig` | Includes `apiKeys: ApiKey[]` | Only `model: string` + optional `customPrompts` |
| Model availability | Gated by `isPro` or localStorage keys | Gated only by which provider keys user has saved |
| Pro CTA in UI | "Upgrade to Pro" | "Add API key in Profile settings" |
| Default model | `gpt-5.2` (Pro) / `deepseek/...` (Free) | `deepseek/deepseek-v3.2:nitro` for all |
| Model preference | localStorage via `useApiKeys` hook | localStorage via `useDefaultModel` hook (kept) |
