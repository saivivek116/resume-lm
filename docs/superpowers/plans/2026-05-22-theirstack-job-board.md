# TheirStack Job Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a per-user webhook endpoint that receives TheirStack `job.new` events, verifies HMAC-SHA256 signatures using a per-user secret, and upserts jobs into the existing `jobs` table so they immediately integrate with the resume tailoring flow.

**Architecture:** TheirStack posts signed payloads to `/api/webhooks/theirstack/[userId]`. The handler looks up the user's `theirstack_webhook_secret` from the `profiles` table via the Supabase service client, verifies the `X-TheirStack-Signature-256` header, then upserts the job into the `jobs` table with `source = 'theirstack'`. The `jobs` table already has RLS enforcing `user_id = auth.uid()`, so each user's ingested jobs are automatically isolated. A new settings section lets users generate their secret and copy their webhook URL.

**Tech Stack:** Next.js 15 App Router, Supabase (service client for webhook, user client for settings), Node.js `crypto` module for HMAC-SHA256

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `schema.sql` | Add 3 columns to `jobs`, 1 column to `profiles`, unique constraint |
| Modify | `src/lib/types.ts` | Add `TheirStackMetadata` interface, extend `Job` type |
| Create | `src/utils/actions/jobs/theirstack.ts` | Server actions: generate secret, get webhook URL |
| Create | `src/app/api/webhooks/theirstack/[userId]/route.ts` | POST handler: verify HMAC, upsert job |
| Create | `src/components/settings/theirstack-webhook-section.tsx` | Settings card: show URL, secret, regenerate button |
| Modify | `src/components/settings/settings-content.tsx` | Add TheirStack section to sidebar nav + content area |
| Modify | `src/app/(dashboard)/settings/page.tsx` | Fetch `theirstack_webhook_secret` from profiles, pass to content |

---

## Task 1: Database Schema Migration

**Files:**
- Modify: `schema.sql`

Add 3 columns to the `jobs` table, a unique constraint for deduplication, and 1 column to the `profiles` table. These need to be applied to your live Supabase database via the SQL editor in the Supabase dashboard.

- [ ] **Step 1: Add migration SQL to schema.sql**

Append the following block to the end of `schema.sql`:

```sql
-- TheirStack Job Board
-- Add source tracking and TheirStack-specific fields to jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS theirstack_id bigint,
  ADD COLUMN IF NOT EXISTS theirstack_metadata jsonb;

-- Unique constraint prevents duplicate pushes for the same TheirStack job per user
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_user_theirstack_unique;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_user_theirstack_unique UNIQUE (user_id, theirstack_id);

-- Per-user secret for verifying TheirStack HMAC-SHA256 webhook signatures
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theirstack_webhook_secret text;
```

- [ ] **Step 2: Apply the migration in Supabase**

Open your Supabase project dashboard → SQL Editor → paste and run the SQL block from Step 1.

Expected result: No errors. Verify with:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name IN ('source', 'theirstack_id', 'theirstack_metadata');
-- Should return 3 rows

SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'theirstack_webhook_secret';
-- Should return 1 row
```

- [ ] **Step 3: Commit the schema file**

```bash
git add schema.sql
git commit -m "feat: add theirstack columns to jobs and profiles schema"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add `TheirStackMetadata` interface and extend `Job`**

In `src/lib/types.ts`, find the `Job` interface (line ~82) and add the `TheirStackMetadata` interface just before it, then add the new optional fields to `Job`:

```typescript
export interface TheirStackMetadata {
  seniority: string | null;
  company_domain: string | null;
  company_logo: string | null;
  company_industry: string | null;
  company_linkedin_url: string | null;
  technology_slugs: string[];
  date_posted: string | null;
  discovered_at: string | null;
  closed_at: string | null;
  min_annual_salary_usd: number | null;
  max_annual_salary_usd: number | null;
  avg_annual_salary_usd: number | null;
  country_code: string | null;
  easy_apply: boolean | null;
  reposted: boolean;
  latitude: number | null;
  longitude: number | null;
}
```

Then in the `Job` interface, add after `application_questions`:
```typescript
  source?: 'manual' | 'theirstack';
  theirstack_id?: number | null;
  theirstack_metadata?: TheirStackMetadata | null;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TheirStackMetadata interface and extend Job type"
```

---

## Task 3: Webhook Secret Server Actions

**Files:**
- Create: `src/utils/actions/jobs/theirstack.ts`

- [ ] **Step 1: Create the server actions file**

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function generateTheirStackSecret(): Promise<string> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const secret = crypto.randomBytes(32).toString('hex');

  const { error } = await supabase
    .from('profiles')
    .update({ theirstack_webhook_secret: secret })
    .eq('user_id', user.id);

  if (error) throw error;

  return secret;
}

```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep theirstack
```

Expected: No output (no errors related to the new file).

- [ ] **Step 3: Commit**

```bash
git add src/utils/actions/jobs/theirstack.ts
git commit -m "feat: add generateTheirStackSecret and getTheirStackConfig server actions"
```

---

## Task 4: Webhook Endpoint

**Files:**
- Create: `src/app/api/webhooks/theirstack/[userId]/route.ts`

- [ ] **Step 1: Create the webhook handler**

```typescript
import { headers } from 'next/headers';
import { createServiceClient } from '@/utils/supabase/server';
import crypto from 'crypto';
import type { TheirStackMetadata } from '@/lib/types';

interface TheirStackCompanyObject {
  logo?: string | null;
  industry?: string | null;
  domain?: string | null;
  linkedin_url?: string | null;
}

interface TheirStackJobPayload {
  id: number;
  job_title: string;
  url: string;
  date_posted?: string | null;
  company: string;
  short_location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  remote?: boolean;
  hybrid?: boolean;
  salary_string?: string | null;
  min_annual_salary_usd?: number | null;
  max_annual_salary_usd?: number | null;
  avg_annual_salary_usd?: number | null;
  country_code?: string | null;
  seniority?: string | null;
  discovered_at?: string | null;
  closed_at?: string | null;
  company_domain?: string | null;
  employment_statuses?: string[];
  easy_apply?: boolean | null;
  technology_slugs?: string[];
  keyword_slugs?: string[];
  description?: string | null;
  reposted?: boolean;
  company_object?: TheirStackCompanyObject | null;
}

interface TheirStackWebhookEvent {
  id: number;
  type: string;
  payload: TheirStackJobPayload;
}

function verifySignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

function mapWorkLocation(remote?: boolean, hybrid?: boolean): 'remote' | 'hybrid' | 'in_person' {
  if (remote) return 'remote';
  if (hybrid) return 'hybrid';
  return 'in_person';
}

function mapEmploymentType(statuses?: string[]): 'full_time' | 'part_time' | 'co_op' | 'internship' | 'contract' {
  const first = statuses?.[0];
  if (first === 'full_time') return 'full_time';
  if (first === 'part_time') return 'part_time';
  if (first === 'internship') return 'internship';
  if (first === 'contract') return 'contract';
  return 'full_time';
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const rawBody = await req.text();
  const headersList = await headers();
  const signatureHeader = headersList.get('X-TheirStack-Signature-256');

  const supabase = await createServiceClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('theirstack_webhook_secret')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError || !profile) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  if (!profile.theirstack_webhook_secret) {
    return Response.json({ error: 'Webhook not configured for this user' }, { status: 403 });
  }

  if (!signatureHeader) {
    return Response.json({ error: 'Missing X-TheirStack-Signature-256 header' }, { status: 401 });
  }

  if (!verifySignature(rawBody, signatureHeader, profile.theirstack_webhook_secret)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: TheirStackWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (event.type !== 'job.new') {
    return Response.json({ received: true, processed: false, reason: `Unhandled event type: ${event.type}` }, { status: 200 });
  }

  const p = event.payload;

  const metadata: TheirStackMetadata = {
    seniority: p.seniority ?? null,
    company_domain: p.company_domain ?? p.company_object?.domain ?? null,
    company_logo: p.company_object?.logo ?? null,
    company_industry: p.company_object?.industry ?? null,
    company_linkedin_url: p.company_object?.linkedin_url ?? null,
    technology_slugs: p.technology_slugs ?? [],
    date_posted: p.date_posted ?? null,
    discovered_at: p.discovered_at ?? null,
    closed_at: p.closed_at ?? null,
    min_annual_salary_usd: p.min_annual_salary_usd ?? null,
    max_annual_salary_usd: p.max_annual_salary_usd ?? null,
    avg_annual_salary_usd: p.avg_annual_salary_usd ?? null,
    country_code: p.country_code ?? null,
    easy_apply: p.easy_apply ?? null,
    reposted: p.reposted ?? false,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
  };

  const jobRow = {
    user_id: userId,
    company_name: p.company,
    position_title: p.job_title,
    job_url: p.url,
    description: p.description ?? null,
    location: p.short_location ?? null,
    salary_range: p.salary_string ?? null,
    keywords: p.keyword_slugs ?? [],
    work_location: mapWorkLocation(p.remote, p.hybrid),
    employment_type: mapEmploymentType(p.employment_statuses),
    is_active: true,
    source: 'theirstack' as const,
    theirstack_id: p.id,
    theirstack_metadata: metadata,
  };

  const { error: upsertError } = await supabase
    .from('jobs')
    .upsert(jobRow, {
      onConflict: 'user_id,theirstack_id',
      ignoreDuplicates: true,
    });

  if (upsertError) {
    console.error('[theirstack-webhook] upsert error:', upsertError);
    return Response.json({ error: 'Failed to save job' }, { status: 500 });
  }

  return Response.json({ received: true }, { status: 200 });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "theirstack|error"
```

Expected: No TypeScript errors.

- [ ] **Step 3: Manual smoke test — missing signature**

Start the dev server (`pnpm dev` or `npm run dev`), then run:

```bash
curl -s -X POST http://localhost:3000/api/webhooks/theirstack/fake-user-id \
  -H "Content-Type: application/json" \
  -d '{"id":1,"type":"job.new","payload":{}}' | jq .
```

Expected response:
```json
{ "error": "User not found" }
```
(404 status — fake user doesn't exist in DB)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/theirstack/
git commit -m "feat: add TheirStack webhook endpoint with HMAC-SHA256 verification"
```

---

## Task 5: Settings UI Component

**Files:**
- Create: `src/components/settings/theirstack-webhook-section.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateTheirStackSecret } from '@/utils/actions/jobs/theirstack';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface TheirStackWebhookSectionProps {
  webhookUrl: string;
  hasSecret: boolean;
}

export function TheirStackWebhookSection({ webhookUrl, hasSecret: initialHasSecret }: TheirStackWebhookSectionProps) {
  const [hasSecret, setHasSecret] = useState(initialHasSecret);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerateSecret() {
    setIsGenerating(true);
    try {
      const secret = await generateTheirStackSecret();
      setRevealedSecret(secret);
      setShowSecret(true);
      setHasSecret(true);
      toast.success('New webhook secret generated. Copy it now — it will not be shown again.');
    } catch {
      toast.error('Failed to generate secret');
    } finally {
      setIsGenerating(false);
    }
  }

  function copyToClipboard(value: string, label: string) {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure this URL and secret in TheirStack under <strong>Webhooks → New Webhook</strong>. TheirStack will push new jobs matching your saved searches to this endpoint in real time.
      </p>

      <div className="space-y-2">
        <Label htmlFor="webhook-url">Your Webhook URL</Label>
        <div className="flex gap-2">
          <Input
            id="webhook-url"
            value={webhookUrl}
            readOnly
            className="font-mono text-xs"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Signing Secret</Label>
        {revealedSecret ? (
          <div className="flex gap-2">
            <Input
              value={showSecret ? revealedSecret : '•'.repeat(64)}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSecret(v => !v)}
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(revealedSecret, 'Secret')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {hasSecret ? 'A secret is configured. Generate a new one to replace it.' : 'No secret configured yet.'}
          </p>
        )}
      </div>

      <Button
        variant="outline"
        onClick={handleGenerateSecret}
        disabled={isGenerating}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
        {hasSecret ? 'Regenerate Secret' : 'Generate Secret'}
      </Button>

      {hasSecret && !revealedSecret && (
        <p className="text-xs text-amber-600">
          Regenerating will invalidate your current secret. Update it in TheirStack immediately after.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep theirstack
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/theirstack-webhook-section.tsx
git commit -m "feat: add TheirStack webhook settings section component"
```

---

## Task 6: Wire Up Settings Page

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/components/settings/settings-content.tsx`

- [ ] **Step 1: Fetch TheirStack config in the settings page**

In `src/app/(dashboard)/settings/page.tsx`, add the TheirStack config fetch and pass it to `SettingsContent`:

Replace the current `SettingsPage` function with:

```typescript
// src/app/settings/page.tsx

"use server"

import { SettingsContent } from '@/components/settings/settings-content'
import { createClient } from '@/utils/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: subscription } = user
    ? await supabase
        .from('subscriptions')
        .select('subscription_plan, subscription_status, current_period_end, trial_end, stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('theirstack_webhook_secret')
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const subscriptionStatus = subscription?.subscription_status ?? '';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const theirStackWebhookUrl = user ? `${baseUrl}/api/webhooks/theirstack/${user.id}` : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <main className="pt-4 pb-16 px-4 md:px-8 max-w-7xl mx-auto">
        <SettingsContent
          user={user}
          subscriptionStatus={subscriptionStatus}
          subscriptionSnapshot={subscription}
          theirStackWebhookUrl={theirStackWebhookUrl}
          theirStackHasSecret={!!profile?.theirstack_webhook_secret}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Add TheirStack section to settings-content.tsx**

In `src/components/settings/settings-content.tsx`:

1. Add `theirstack-webhook` to the `sections` array:

```typescript
const sections = [
  { id: "security", title: "Security", description: "Manage your email and password settings", icon: "🔒" },
  { id: "subscription", title: "Subscription", description: "Manage your subscription and billing settings", icon: "💳" },
  { id: "ai-prompts", title: "AI Prompts", description: "Customize AI system prompts for different actions", icon: "🤖" },
  { id: "theirstack-webhook", title: "TheirStack", description: "Configure TheirStack job board webhook", icon: "🔗" },
  { id: "danger-zone", title: "Danger Zone", description: "Irreversible and destructive actions", icon: "⚠️" },
]
```

2. Add the two new props to `SettingsContentProps`:

```typescript
interface SettingsContentProps {
  user: User | null;
  subscriptionStatus: string;
  subscriptionSnapshot: SubscriptionSnapshot | null;
  theirStackWebhookUrl: string;
  theirStackHasSecret: boolean;
}
```

3. Update the function signature to destructure the new props:

```typescript
export function SettingsContent({ user, subscriptionStatus, subscriptionSnapshot, theirStackWebhookUrl, theirStackHasSecret }: SettingsContentProps) {
```

4. Add the import at the top of the file:

```typescript
import { TheirStackWebhookSection } from "./theirstack-webhook-section"
```

5. Add the new Card section between the AI Prompts card and the Danger Zone card:

```typescript
{/* TheirStack Webhook */}
<Card id="theirstack-webhook" className="border-white/40 shadow-xl shadow-black/5 bg-white/80 backdrop-blur-xl">
  <CardHeader>
    <CardTitle className="text-xl">TheirStack Webhook</CardTitle>
    <CardDescription>Configure TheirStack job board webhook to auto-ingest job listings</CardDescription>
  </CardHeader>
  <CardContent>
    <TheirStackWebhookSection
      webhookUrl={theirStackWebhookUrl}
      hasSecret={theirStackHasSecret}
    />
  </CardContent>
</Card>
```

- [ ] **Step 3: Add `NEXT_PUBLIC_APP_URL` to your `.env.local`**

```bash
# Add this line to .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production, set this to your deployed URL (e.g. `https://resumelm.vercel.app`).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/settings/page.tsx src/components/settings/settings-content.tsx
git commit -m "feat: wire up TheirStack webhook section in settings page"
```

---

## Task 7: End-to-End Verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open http://localhost:3000/settings — you should see a "TheirStack" entry in the left nav and a card with the webhook URL and a "Generate Secret" button.

- [ ] **Step 2: Generate a secret**

Click "Generate Secret". The secret should appear (64 hex chars). Copy it.

- [ ] **Step 3: Test a valid signed webhook**

Replace `YOUR_USER_ID` with your actual Supabase user UUID (visible in the webhook URL on the settings page). Replace `YOUR_SECRET` with the secret you just generated.

```bash
SECRET="YOUR_SECRET"
USER_ID="YOUR_USER_ID"
BODY='{"id":1,"type":"job.new","payload":{"id":691448473,"job_title":"Senior Software Engineer","url":"https://example.com/jobs/123","date_posted":"2026-05-22","company":"Acme Corp","source_url":"https://example.com/jobs/123","short_location":"San Francisco, CA","remote":true,"hybrid":false,"salary_string":"$150k - $200k","min_annual_salary_usd":150000,"max_annual_salary_usd":200000,"avg_annual_salary_usd":175000,"salary_currency":"USD","seniority":"senior","discovered_at":"2026-05-22T12:00:00.000000Z","closed_at":null,"company_domain":"acme.com","employment_statuses":["full_time"],"easy_apply":false,"technology_slugs":["react","typescript","node"],"keyword_slugs":["full-stack","remote","startup"],"description":"We are looking for a Senior Software Engineer to join our team.","reposted":false,"company_object":{"logo":"https://example.com/logo.png","industry":"Software","domain":"acme.com","linkedin_url":"https://linkedin.com/company/acme"}}}'

SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -s -X POST "http://localhost:3000/api/webhooks/theirstack/$USER_ID" \
  -H "Content-Type: application/json" \
  -H "X-TheirStack-Signature-256: $SIG" \
  -d "$BODY" | jq .
```

Expected response:
```json
{ "received": true }
```

- [ ] **Step 4: Verify job appears in the database**

In Supabase SQL Editor:
```sql
SELECT id, company_name, position_title, source, theirstack_id, location
FROM jobs
WHERE source = 'theirstack'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: 1 row with `company_name = 'Acme Corp'`, `source = 'theirstack'`, `theirstack_id = 691448473`.

- [ ] **Step 5: Test deduplication**

Run the exact same `curl` command from Step 3 again.

Expected response: `{ "received": true }` (still 200, no error)

Run the SQL query again — still exactly 1 row (not 2).

- [ ] **Step 6: Test bad signature**

```bash
curl -s -X POST "http://localhost:3000/api/webhooks/theirstack/$USER_ID" \
  -H "Content-Type: application/json" \
  -H "X-TheirStack-Signature-256: sha256=invalidsignature" \
  -d "$BODY" | jq .
```

Expected:
```json
{ "error": "Invalid signature" }
```
(401 status)

- [ ] **Step 7: Verify tailoring integration**

Navigate to your job listings page in the app. The ingested "Senior Software Engineer" job should appear. Click to create a tailored resume from it — the flow should work identically to a manually-added job.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: complete TheirStack job board webhook integration"
```
