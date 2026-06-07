# TheirStack Job Board — Design Spec

**Date:** 2026-05-22
**Status:** Approved

## Context

ResumeLM users currently add jobs manually to trigger resume tailoring. This feature integrates TheirStack.com's webhook push API so that jobs matching a user's saved search filters are automatically ingested into their personal job board. Each user configures their own webhook URL in TheirStack, and jobs are pushed in real time. Since the existing `jobs` table already enforces per-user RLS, incoming jobs are automatically isolated — each user sees only their own.

## Architecture

**Webhook endpoint:** `POST /api/webhooks/theirstack/[userId]`

Request flow:
1. TheirStack sends a signed POST to `https://<domain>/api/webhooks/theirstack/{user_id}`
2. Server looks up the user's `theirstack_webhook_secret` from the `profiles` table
3. Verifies `X-TheirStack-Signature-256` header using HMAC-SHA256
4. Rejects with 401 if signature is invalid, 404 if user not found
5. Parses `job.new` event payload, maps fields to `jobs` table columns
6. Upserts the job (unique constraint on `(user_id, theirstack_id)` prevents duplicates)
7. Returns 200 for all valid requests (idempotent)

Job isolation is enforced at the database level: every row has `user_id`, and RLS ensures `user_id = auth.uid()` for all reads.

## Database Schema Changes

### `profiles` table — add one column
```sql
ALTER TABLE public.profiles
  ADD COLUMN theirstack_webhook_secret text;
```
Stores the user-specific HMAC secret. Generated on first visit to settings or on explicit "Regenerate" action. Null means webhook is not configured.

### `jobs` table — add three columns + unique constraint
```sql
ALTER TABLE public.jobs
  ADD COLUMN source text NOT NULL DEFAULT 'manual',
  ADD COLUMN theirstack_id bigint,
  ADD COLUMN theirstack_metadata jsonb;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_user_theirstack_unique UNIQUE (user_id, theirstack_id);
```

`source` values: `'manual'` (existing jobs), `'theirstack'` (webhook-ingested).

### Field mapping: TheirStack payload → `jobs` columns

| TheirStack `payload` field | `jobs` column |
|---|---|
| `job_title` | `position_title` |
| `company` | `company_name` |
| `url` | `job_url` |
| `description` | `description` |
| `short_location` | `location` |
| `salary_string` | `salary_range` |
| `remote` / `hybrid` | `work_location` (`remote` / `hybrid` / `in_person`) |
| `employment_statuses[0]` | `employment_type` |
| `keyword_slugs` | `keywords` (jsonb array) |
| `id` | `theirstack_id` |
| `'theirstack'` | `source` |

### `theirstack_metadata` JSONB structure
```json
{
  "seniority": "mid_level",
  "company_domain": "example.com",
  "company_logo": "https://media.theirstack.com/...",
  "company_industry": "Hospitals and Health Care",
  "company_linkedin_url": "https://www.linkedin.com/company/...",
  "technology_slugs": ["react", "typescript"],
  "date_posted": "2026-05-23",
  "discovered_at": "2026-05-23T00:29:36.893000Z",
  "closed_at": null,
  "min_annual_salary_usd": null,
  "max_annual_salary_usd": null,
  "avg_annual_salary_usd": null,
  "country_code": "US",
  "easy_apply": null,
  "reposted": false,
  "latitude": 39.71282,
  "longitude": -88.99702
}
```

## New Files

### `src/app/api/webhooks/theirstack/[userId]/route.ts`
Webhook handler. Responsibilities:
- Read raw body as text (required for HMAC verification)
- Fetch `profiles.theirstack_webhook_secret` for the userId using the Supabase service client
- Compute `HMAC-SHA256(secret, rawBody)` and compare with `X-TheirStack-Signature-256` header
- Parse JSON body, validate `type === 'job.new'`
- Map payload fields to `jobs` row
- Upsert with `onConflict: 'user_id,theirstack_id'` (ignore duplicate)
- Return `{ received: true }` with status 200

### `src/utils/actions/jobs/theirstack.ts`
Server action for settings management:
- `generateTheirStackSecret(userId)` — generates a cryptographically random secret (e.g. `crypto.randomBytes(32).toString('hex')`), stores it **plaintext** in `profiles.theirstack_webhook_secret` (needed as-is to verify HMAC), returns it for the user to copy into TheirStack
- `getTheirStackWebhookUrl(userId)` — returns the full webhook URL for display

## Modified Files

### `src/lib/types.ts`
- Add `source?: 'manual' | 'theirstack'` and `theirstack_id?: number` to the `Job` interface
- Add `theirstack_metadata?: TheirStackMetadata` interface

### `src/app/(dashboard)/settings/page.tsx` (or the settings component)
- Add **TheirStack Webhook** section:
  - Webhook URL (read-only, copyable): `https://<domain>/api/webhooks/theirstack/{user_id}`
  - Secret field (masked, copyable) — shown only when set
  - "Generate Secret" / "Regenerate Secret" button
  - Setup instructions: "Paste the URL and secret into TheirStack → Webhooks → New Webhook"

## Integration with Existing Tailoring Flow

No changes needed. The tailoring flow reads from the `jobs` table and uses `position_title`, `company_name`, `description`, `keywords`, etc. — all of which are populated by the webhook handler. TheirStack jobs will appear in the existing job listings view (`/jobs`) and behave identically to manual jobs for the purpose of creating tailored resumes.

Optionally, the job card UI can show a TheirStack badge when `source === 'theirstack'` and display company logo from `theirstack_metadata.company_logo`.

## Verification Plan

1. **Auth rejection** — POST with wrong or missing secret → expect 401
2. **User not found** — POST to unknown userId → expect 404
3. **Happy path** — POST a valid HMAC-signed `job.new` payload → job row appears in `jobs` with `source = 'theirstack'`, all fields mapped correctly
4. **Deduplication** — POST identical payload twice → only one row in DB (upsert idempotency)
5. **Tailoring integration** — from the job listings page, select an ingested TheirStack job → "Create Tailored Resume" works with no errors
6. **Settings UI** — generate a secret, copy the webhook URL → configure in TheirStack sandbox, trigger a test push → job appears in app
