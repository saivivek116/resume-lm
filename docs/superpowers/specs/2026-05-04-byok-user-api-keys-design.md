# BYOK — Bring Your Own API Keys

**Date:** 2026-05-04  
**Status:** Approved

## Context

ResumeLM is being deployed publicly. The owner does not want to absorb AI provider costs for all users. The current architecture splits API key access between:
- **Pro users** — server-side environment variables
- **Free users** — localStorage in the browser

Both approaches are being replaced. The Pro tier is removed entirely. All users must supply their own API keys for the providers they want to use. Keys are stored encrypted in the database and used server-side — never exposed back to the client after saving.

---

## Goals

- Users provide their own OpenAI, Anthropic, and/or OpenRouter API keys
- Keys stored encrypted (AES-256-GCM) in a dedicated database table
- Keys are never shown in plaintext after initial entry
- Profile page gains an "API Keys" tab for managing keys
- Pro tier and all subscription-based AI feature gates are removed
- localStorage key storage is removed entirely

---

## Database

### New table: `user_api_keys`

```sql
CREATE TABLE user_api_keys (
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text NOT NULL,  -- 'openai' | 'anthropic' | 'openrouter'
  encrypted_key text NOT NULL,  -- AES-256-GCM: "iv:ciphertext" (hex)
  updated_at    timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own keys" ON user_api_keys
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Encryption

- **Algorithm:** AES-256-GCM via Node.js `crypto` module
- **Secret:** New env var `API_KEY_ENCRYPTION_SECRET` (32-byte hex string, never changes after initial setup)
- **Storage format:** `<iv_hex>:<ciphertext_hex>` stored as a single text column
- **Key never leaves server:** Decryption only happens inside server actions/server components

---

## Server Actions

**File:** `src/utils/actions/api-keys/actions.ts`

| Action | Description |
|--------|-------------|
| `upsertApiKey(provider, rawKey)` | Encrypts key and upserts into `user_api_keys`. Never returns the key. |
| `deleteApiKey(provider)` | Deletes the row for that provider. |
| `hasApiKey(provider)` | Returns `boolean`. Used by UI to determine masked vs empty input. |
| `getDecryptedApiKey(provider)` | Server-only. Decrypts and returns raw key for use in AI calls. |

---

## AI Call Flow

1. User triggers an AI action
2. Server action determines required provider for the selected model
3. Calls `getDecryptedApiKey(provider)`
4. **No key found** → returns structured error: `{ error: "Add your [Provider] API key in Profile settings", link: "/profile" }`
5. **Key found** → passes decrypted key to `initializeAIClient()` → AI call proceeds

### Updated `initializeAIClient()` in `src/utils/ai-tools.ts`

- Remove `process.env[provider.envKey]` reads
- Call `getDecryptedApiKey(provider)` instead
- If null → throw with user-facing message and profile link

---

## Profile UI

### New tab in `ProfileEditForm`

**File:** `src/components/profile/profile-edit-form.tsx`  
Add "API Keys" as a new tab alongside existing tabs.

### New component: `src/components/profile/profile-api-keys-form.tsx`

Three rows — one per provider (OpenAI, Anthropic, OpenRouter):

- **Key exists in DB:** `<input type="password">` shows masked placeholder (`••••••••••••••••`). User types to overwrite.
- **No key:** Input is empty.
- **Save button** (per provider): calls `upsertApiKey(provider, value)`
- **Remove button** (shown only when key exists): calls `deleteApiKey(provider)`
- No reveal/show button — keys are write-only after saving
- Initial state comes from props: the parent profile page (server component) calls `hasApiKey(provider)` for all three providers and passes `{ openai: boolean, anthropic: boolean, openrouter: boolean }` as props — no client-side fetch on mount

---

## Model Availability — Simplified

**File:** `src/lib/ai-models.ts` — `isModelAvailable()`

Remove `isPro` parameter entirely. New logic:
- Model available if user has a key for its provider
- OpenRouter models need an `openrouter` key
- Free/no-key models (e.g., some DeepSeek via OpenRouter) remain accessible without a key

**Model selector UI:** Replace "Upgrade to Pro" CTA with "Add API key in Profile settings".

---

## Cleanup — Files to Delete / Modify

| File | Action |
|------|--------|
| `src/hooks/use-api-keys.ts` | Delete |
| `src/components/settings/api-keys-form.tsx` | Delete |
| All `localStorage.getItem('resumelm-api-keys')` references | Remove |
| `isProPlan` prop and Pro-tier AI feature gates | Remove |
| `isPro` check in `isModelAvailable()` | Remove |
| Stripe subscription checks for AI model access | Remove (billing infra can remain for other features) |
| `DEFAULT_MODELS.PRO_USER` / `DEFAULT_MODELS.FREE_USER` in `src/lib/ai-models.ts` | Collapse to single `DEFAULT_MODEL` (e.g., `deepseek/deepseek-v3.2:nitro`) |

---

## New Environment Variable

```
API_KEY_ENCRYPTION_SECRET=<32-byte hex string>
```

Generate with: `openssl rand -hex 32`

Must be set in production before deployment. Never rotate after initial setup (existing encrypted keys become unreadable).

---

## Verification

1. Add an API key in Profile → API Keys tab → confirm input shows masked after save
2. Remove a key → confirm input returns to empty
3. Trigger an AI action with a key present → confirm it succeeds
4. Trigger an AI action with no key → confirm blocked with message + profile link
5. Confirm no keys appear in browser localStorage or network responses
6. Confirm `user_api_keys` table rows are encrypted (ciphertext visible in DB, not raw key)
7. Confirm model selector no longer shows "Upgrade to Pro" — shows "Add API key" instead
