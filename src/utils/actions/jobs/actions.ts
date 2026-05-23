'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from 'next/cache';
import { simplifiedJobSchema } from "@/lib/zod-schemas";
import type { Job, ApplicationQuestion } from "@/lib/types";
import { z } from "zod";
import { JobListingParams } from "./schema";

export async function createJob(jobListing: z.infer<typeof simplifiedJobSchema>) {
  
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const jobData = {
    user_id: user.id,
    company_name: jobListing.company_name,
    position_title: jobListing.position_title,
    job_url: jobListing.job_url,
    description: jobListing.description,
    location: jobListing.location,
    salary_range: jobListing.salary_range,
    keywords: jobListing.keywords,
    work_location: jobListing.work_location || 'in_person', 
    employment_type: jobListing.employment_type || 'full_time', 
    is_active: true
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert([jobData])
    .select()
    .single();

  if (error) {
    console.error('[createJob] Error creating job:', error);
    throw error;
  }
  
  return data;
}

export async function deleteJob(jobId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('User not authenticated');
  }

  // First, get all resumes that reference this job
  const { data: affectedResumes } = await supabase
    .from('resumes')
    .select('id')
    .eq('job_id', jobId);

  // Delete the job
  const { error: deleteError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', jobId);

  if (deleteError) {
    console.error('Delete error:', deleteError);
    throw new Error('Failed to delete job');
  }

  // Revalidate all affected resume paths
  affectedResumes?.forEach(resume => {
    revalidatePath(`/resumes/${resume.id}`);
  });
  
  // Also revalidate the general paths
  revalidatePath('/', 'layout');
  revalidatePath('/resumes', 'layout');
}


export async function getJobListings({ 
  page = 1, 
  pageSize = 10, 
  filters 
}: JobListingParams) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Calculate offset
  const offset = (page - 1) * pageSize;

  // Start building the query — job board shows TheirStack jobs only
  let query = supabase
    .from('jobs')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('source', 'theirstack')
    .order('created_at', { ascending: false });

  // Apply filters if they exist
  if (filters) {
    if (filters.workLocation) {
      query = query.eq('work_location', filters.workLocation);
    }
    if (filters.employmentType) {
      query = query.eq('employment_type', filters.employmentType);
    }
    if (filters.keywords && filters.keywords.length > 0) {
      query = query.contains('keywords', filters.keywords);
    }
    if (filters.discoveredAfter) {
      query = query.gte('created_at', filters.discoveredAfter);
    }
  }

  // Add pagination
  const { data: jobs, error, count } = await query
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error('Error fetching jobs:', error);
    throw new Error('Failed to fetch job listings');
  }

  return {
    jobs,
    totalCount: count ?? 0,
    currentPage: page,
    totalPages: Math.ceil((count ?? 0) / pageSize)
  };
}

export async function deleteTailoredJob(jobId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('jobs')
    .update({ is_active: false })
    .eq('id', jobId);

  if (error) {
    throw new Error('Failed to delete job');
  }

  revalidatePath('/', 'layout');
}

export async function updateJobQuestions(
  jobId: string,
  questions: ApplicationQuestion[]
): Promise<void> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('jobs')
    .update({ application_questions: questions })
    .eq('id', jobId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[updateJobQuestions] Error:', error);
    throw new Error('Failed to save questions');
  }
}

export async function createEmptyJob(): Promise<Job> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const emptyJob: Partial<Job> = {
    user_id: user.id,
    company_name: 'New Company',
    position_title: 'New Position',
    job_url: null,
    description: null,
    location: null,
    salary_range: null,
    keywords: [],
    work_location: null,
    employment_type: null,
    is_active: true
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert([emptyJob])
    .select()
    .single();

  if (error) {
    console.error('Error creating job:', error);
    throw new Error('Failed to create job');
  }

  revalidatePath('/', 'layout');
  return data;
}

export async function getJobById(jobId: string): Promise<Job | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();
  return data;
}

export async function getAppliedJobIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return [];

  const { data } = await supabase
    .from('resumes')
    .select('job_id')
    .eq('user_id', user.id)
    .eq('is_base_resume', false)
    .not('job_id', 'is', null);

  return (data ?? []).map(r => r.job_id as string);
}

export async function getJobResumeMap(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return {};

  const { data } = await supabase
    .from('resumes')
    .select('id, job_id')
    .eq('user_id', user.id)
    .eq('is_base_resume', false)
    .not('job_id', 'is', null);

  return Object.fromEntries((data ?? []).map(r => [r.job_id as string, r.id as string]));
}
