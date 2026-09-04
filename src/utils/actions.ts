'use server'

import { createClient } from "@/utils/supabase/server";
import { getAuthenticatedUser } from "@/utils/auth";
import { Profile, ResumeSummary, DEFAULT_DOCUMENT_SETTINGS } from "@/lib/types";

const RESUME_SUMMARY_COLUMNS =
  'id, user_id, name, target_role, is_base_resume, job_id, created_at, updated_at';

// Maps the UI sort options onto real columns. Sorting has to happen in SQL: the dashboard
// only fetches one page, so anything sorted client-side would only order that page.
const SORT_COLUMNS = {
  createdAt: 'created_at',
  name: 'name',
  jobTitle: 'target_role',
} as const;

type ResumeSortOption = keyof typeof SORT_COLUMNS;
type ResumeSortDirection = 'asc' | 'desc';
type ResumeCollection = 'base' | 'tailored' | 'all';

interface ResumePageOptions {
  type: ResumeCollection;
  page?: number;
  pageSize?: number;
  sort?: ResumeSortOption;
  direction?: ResumeSortDirection;
  search?: string;
}

interface ResumePageResult {
  resumes: ResumeSummary[];
  total: number;
  /** The page actually served. May be lower than the one asked for; see the clamp below. */
  page: number;
}

const MAX_PAGE_SIZE = 50;
const BASE_RESUME_OPTIONS_LIMIT = 100;

// Every export in a 'use server' module is a POST endpoint a client can call with
// arbitrary arguments, so the TypeScript types below are documentation, not validation.
function toSortColumn(sort: unknown): string {
  return SORT_COLUMNS[sort as ResumeSortOption] ?? SORT_COLUMNS.createdAt;
}

function toCollection(type: unknown): ResumeCollection {
  return type === 'base' || type === 'tailored' ? type : 'all';
}

/**
 * Neutralises the LIKE metacharacters in a user's query so `50%` matches a literal
 * `50%` instead of everything. `*` is dropped rather than escaped: PostgREST rewrites
 * it to `%` on its way to Postgres, so it cannot be escaped on this side.
 */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`).replace(/\*/g, '');
}

function sanitizeResumes(resumes: ResumeSummary[] | null): ResumeSummary[] {
  return resumes?.map((resume) => ({
    ...resume,
    target_role: resume.target_role || '',
  })) ?? [];
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // If profile doesn't exist, create one
  if (profileError?.code === 'PGRST116') {
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert([{
        user_id: user.id,
        first_name: null,
        last_name: null,
        email: user.email,
        phone_number: null,
        location: null,
        website: null,
        linkedin_url: null,
        github_url: null,
        work_experience: [],
        education: [],
        skills: [],
        projects: [],
        document_settings: DEFAULT_DOCUMENT_SETTINGS,
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      throw new Error('Error creating user profile');
    }

    return newProfile;
  }

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    throw new Error('Error fetching dashboard data');
  }

  return data;
}

/**
 * Fetches a single page of resumes, ordered, filtered and counted in the database.
 *
 * Everything here is deliberately server-side. Fetching the whole `resumes` table and
 * paging in the browser leaves the response at the mercy of PostgREST's `max-rows` cap,
 * and without an ORDER BY the rows it drops are arbitrary — which silently hides the
 * newest resumes.
 */
export async function getResumePage(options: ResumePageOptions): Promise<ResumePageResult> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();

  const {
    type,
    page = 1,
    pageSize = 8,
    sort = 'createdAt',
    direction = 'desc',
    search = '',
  } = options;

  const collection = toCollection(type);
  const sortColumn = toSortColumn(sort);
  const ascending = direction === 'asc';
  const safePageSize = Math.min(Math.max(1, Math.floor(Number(pageSize) || 8)), MAX_PAGE_SIZE);
  const requestedPage = Math.max(1, Math.floor(Number(page) || 1));
  const trimmedSearch = typeof search === 'string' ? search.trim() : '';

  // Supabase query builders can't be reused once executed, so rebuild the filters.
  const buildQuery = (select: string, options?: { head?: boolean; count?: 'exact' }) => {
    let query = supabase
      .from('resumes')
      .select(select, options)
      .eq('user_id', user.id);

    // `is_base_resume` is nullable with a `false` default, so `.eq(false)` would silently
    // drop legacy rows that were written before the column had a value.
    if (collection === 'base') {
      query = query.eq('is_base_resume', true);
    } else if (collection === 'tailored') {
      query = query.or('is_base_resume.eq.false,is_base_resume.is.null');
    }

    if (trimmedSearch) {
      query = query.ilike('name', `%${escapeLikePattern(trimmedSearch)}%`);
    }

    return query;
  };

  const fetchPage = (pageNumber: number) => {
    const from = (pageNumber - 1) * safePageSize;
    // `count: 'exact'` rides along in the Content-Range header, so the total costs no
    // extra round-trip.
    return buildQuery(RESUME_SUMMARY_COLUMNS, { count: 'exact' })
      .order(sortColumn, { ascending, nullsFirst: false })
      // Stable tiebreaker: without it, rows sharing a sort value can shift between pages,
      // so the same resume shows twice while another never appears.
      .order('id', { ascending: true })
      .range(from, from + safePageSize - 1);
  };

  let servedPage = requestedPage;
  let { data, count, error } = await fetchPage(servedPage);

  // A stale `?page=5` — bookmarked, or left behind after deleting rows — asks for a range
  // past the last row. PostgREST answers either with a 416 (PGRST103) or with an empty
  // 200 that still carries the real total, so clamp on both and re-fetch the last page.
  const rangePastEnd = error?.code === 'PGRST103';
  const emptyPastEnd = !error && (data?.length ?? 0) === 0 && (count ?? 0) > 0;

  if (servedPage > 1 && (rangePastEnd || emptyPastEnd)) {
    let total = count ?? 0;

    if (rangePastEnd) {
      // The 416 carries no usable body, so the total has to be asked for separately.
      const { count: exactTotal, error: countError } = await buildQuery('id', { head: true, count: 'exact' });

      if (countError) {
        console.error('Error counting resumes:', countError);
        throw new Error('Error fetching resumes');
      }

      total = exactTotal ?? 0;
    }

    servedPage = Math.max(1, Math.ceil(total / safePageSize));
    ({ data, count, error } = await fetchPage(servedPage));
  }

  if (error) {
    console.error('Error fetching resumes:', error);
    throw new Error('Error fetching resumes');
  }

  return {
    // The dynamic `select` widens the row type, so re-assert the columns listed above.
    resumes: sanitizeResumes(data as unknown as ResumeSummary[] | null),
    total: count ?? 0,
    page: servedPage,
  };
}

/**
 * Base resumes for pickers (tailor / regenerate dialogs). Bounded and newest-first.
 */
export async function getBaseResumeOptions(): Promise<ResumeSummary[]> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('resumes')
    .select(RESUME_SUMMARY_COLUMNS)
    .eq('user_id', user.id)
    .eq('is_base_resume', true)
    .order('created_at', { ascending: false })
    .limit(BASE_RESUME_OPTIONS_LIMIT);

  if (error) {
    console.error('Error fetching base resumes:', error);
    throw new Error('Error fetching base resumes');
  }

  return sanitizeResumes(data as ResumeSummary[] | null);
}
