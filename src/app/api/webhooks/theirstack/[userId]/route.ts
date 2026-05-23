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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  console.log('[theirstack-webhook] GET reachability check for userId:', userId);
  return Response.json({ ok: true, userId }, { status: 200 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  console.log('[theirstack-webhook] POST received for userId:', userId);

  const rawBody = await req.text();
  const headersList = await headers();
  const signatureHeader = headersList.get('X-TheirStack-Signature-256');

  console.log('[theirstack-webhook] headers:', {
    signature: signatureHeader ? `${signatureHeader.slice(0, 20)}...` : 'MISSING',
    contentType: headersList.get('content-type'),
    bodyLength: rawBody.length,
  });

  const supabase = await createServiceClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('theirstack_webhook_secret')
    .eq('user_id', userId)
    .maybeSingle();

  console.log('[theirstack-webhook] profile lookup:', {
    found: !!profile,
    hasSecret: !!profile?.theirstack_webhook_secret,
    error: profileError?.message ?? null,
  });

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
    return Response.json(
      { received: true, processed: false, reason: `Unhandled event type: ${event.type}` },
      { status: 200 }
    );
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

  const { data: existing } = await supabase
    .from('jobs')
    .select('id')
    .eq('user_id', userId)
    .eq('theirstack_id', p.id)
    .maybeSingle();

  if (existing) {
    return Response.json({ received: true, skipped: true }, { status: 200 });
  }

  const { error: insertError } = await supabase
    .from('jobs')
    .insert(jobRow);

  if (insertError) {
    console.error('[theirstack-webhook] insert error:', insertError);
    return Response.json({ error: 'Failed to save job' }, { status: 500 });
  }

  return Response.json({ received: true }, { status: 200 });
}
