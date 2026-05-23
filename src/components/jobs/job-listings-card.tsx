'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Zap,
  CalendarDays,
} from 'lucide-react';
import { getJobListings, getJobResumeMap } from '@/utils/actions/jobs/actions';
import { TailorResumeDialog } from './tailor-resume-dialog';
import type { Job } from '@/lib/types';

type WorkLocationType = 'remote' | 'in_person' | 'hybrid';
type EmploymentType = 'full_time' | 'part_time' | 'co_op' | 'internship';
type DateRange = 'today' | '24h' | '3days' | 'week' | 'month' | 'all';
type SourceFilter = 'theirstack' | 'manual';

const PAGE_SIZE = 9;

function getDiscoveredAfter(range: DateRange): string | undefined {
  if (range === 'all') return undefined;
  const now = new Date();
  if (range === '24h') {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }
  if (range === '3days') {
    return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === 'week') start.setDate(start.getDate() - 7);
  if (range === 'month') start.setDate(start.getDate() - 30);
  return start.toISOString();
}


function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffDays = Math.round((date.getTime() - now) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > -7) return `${Math.abs(diffDays)} days ago`;
  if (diffDays > -30) return `${Math.floor(Math.abs(diffDays) / 7)} weeks ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWorkLocation(val: string | null): string {
  if (!val) return 'Not specified';
  return val.replace('_', ' ');
}

function formatSeniority(val: string | null): string {
  if (!val) return '';
  return val.replace(/_/g, ' ');
}

function JobCardSkeleton() {
  return (
    <Card className="p-5 space-y-4 animate-pulse bg-white/40 border-white/20 rounded-2xl">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-200/60 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200/60 rounded-full w-3/4" />
          <div className="h-3 bg-gray-200/60 rounded-full w-1/2" />
        </div>
      </div>
      <div className="h-5 bg-gray-200/60 rounded-full w-5/6" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200/60 rounded-full w-2/3" />
        <div className="h-3 bg-gray-200/60 rounded-full w-1/2" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-gray-200/60 rounded-full" />
        <div className="h-5 w-20 bg-gray-200/60 rounded-full" />
      </div>
    </Card>
  );
}

function EmptyState({ dateRange }: { dateRange: DateRange }) {
  const isToday = dateRange === 'today';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full flex flex-col items-center justify-center py-24 text-center gap-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-purple-100 flex items-center justify-center shadow-inner">
        <Briefcase className="w-7 h-7 text-teal-600" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-700">
          {isToday ? 'No new jobs today' : 'No jobs found'}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {isToday
            ? 'Check back later — or switch to This Week to see recent jobs.'
            : 'Try adjusting the date range or filters.'}
        </p>
      </div>
      <Button variant="outline" asChild className="mt-2 border-teal-200 text-teal-700 hover:bg-teal-50">
        <Link href="/settings">Configure Webhook</Link>
      </Button>
    </motion.div>
  );
}

interface JobCardProps {
  job: Job;
  resumeId: string | undefined;
  index: number;
}

function JobCard({ job, resumeId, index }: JobCardProps) {
  const meta = job.theirstack_metadata;
  const logo = meta?.company_logo;
  const seniority = formatSeniority(meta?.seniority ?? null);
  const techSlugs = meta?.technology_slugs?.slice(0, 4) ?? [];
  const extraTech = (meta?.technology_slugs?.length ?? 0) - 4;
  const displayDate = meta?.date_posted ?? job.created_at;
  const keywords = job.keywords ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
    >
      <Card className="group relative flex flex-col h-full p-5 gap-4 hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-white/85 to-white/65 hover:from-white/95 hover:to-white/75 border-white/40 hover:border-white/70 rounded-2xl overflow-hidden hover:-translate-y-1">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-purple-500/5 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {/* Header row: logo + company + badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {logo ? (
              <Image
                src={logo}
                alt={job.company_name ?? ''}
                width={36}
                height={36}
                className="rounded-lg object-contain border border-white/60 shadow-sm shrink-0 bg-white"
                unoptimized
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-100 to-purple-100 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-teal-600" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700 group-hover:text-purple-700 transition-colors line-clamp-1">
                {job.company_name}
              </p>
              {seniority && (
                <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full capitalize leading-none">
                  {seniority}
                </span>
              )}
            </div>
          </div>

          {/* Source + Applied badges */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {job.source === 'theirstack' && (
              <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[10px] px-1.5 py-0.5 gap-0.5 h-auto">
                <Zap className="w-2.5 h-2.5" />
                TheirStack
              </Badge>
            )}
            {resumeId && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0.5 gap-0.5 h-auto">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Applied
              </Badge>
            )}
          </div>
        </div>

        {/* Position title */}
        <h3 className="font-semibold text-base text-gray-800 group-hover:text-teal-700 transition-colors line-clamp-2 leading-snug -mt-1">
          {job.position_title}
        </h3>

        {/* Metadata */}
        <div className="space-y-1.5 text-xs text-gray-500">
          {job.location && (
            <div className="flex items-center gap-1.5 group-hover:text-teal-600 transition-colors">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="line-clamp-1">{job.location}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 group-hover:text-purple-600 transition-colors">
              <Briefcase className="w-3.5 h-3.5 shrink-0" />
              <span className="capitalize">{formatWorkLocation(job.work_location)}</span>
            </span>
            {job.salary_range && (
              <span className="flex items-center gap-1.5 group-hover:text-rose-600 transition-colors">
                <DollarSign className="w-3.5 h-3.5 shrink-0" />
                <span className="line-clamp-1">{job.salary_range}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{formatRelativeDate(displayDate)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200/60 to-transparent" />

        {/* Tech stack */}
        {techSlugs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {techSlugs.map((slug) => (
              <Badge
                key={slug}
                className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] px-1.5 py-0.5 h-auto font-normal"
              >
                {slug}
              </Badge>
            ))}
            {extraTech > 0 && (
              <Badge className="bg-indigo-50 text-indigo-400 border-indigo-100 text-[10px] px-1.5 py-0.5 h-auto font-normal">
                +{extraTech}
              </Badge>
            )}
          </div>
        )}

        {/* Keywords */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {keywords.slice(0, 3).map((kw) => (
              <Badge
                key={kw}
                className="bg-teal-50/60 text-teal-700 border-teal-100/40 text-[10px] px-1.5 py-0.5 h-auto font-normal"
              >
                {kw}
              </Badge>
            ))}
            {keywords.length > 3 && (
              <Badge className="bg-purple-50/60 text-purple-500 border-purple-100/40 text-[10px] px-1.5 py-0.5 h-auto font-normal">
                +{keywords.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pt-1">
          {resumeId ? (
            <Button
              size="sm"
              variant="outline"
              asChild
              className="w-full text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs h-8"
            >
              <Link href={`/resumes/${resumeId}`}>View Resume →</Link>
            </Button>
          ) : (
            <TailorResumeDialog job={job}>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-teal-700 border-teal-200 hover:bg-teal-50 text-xs h-8"
              >
                Tailor Resume →
              </Button>
            </TailorResumeDialog>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export function JobListingsCard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobResumeMap, setJobResumeMap] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [workLocation, setWorkLocation] = useState<WorkLocationType | undefined>();
  const [employmentType, setEmploymentType] = useState<EmploymentType | undefined>();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter | undefined>();
  const [dateRange, setDateRange] = useState<DateRange>('all');

  // Fetch job->resume map once on mount
  useEffect(() => {
    getJobResumeMap().then(setJobResumeMap);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getJobListings({
        page: currentPage,
        pageSize: PAGE_SIZE,
        filters: {
          workLocation,
          employmentType,
          discoveredAfter: getDiscoveredAfter(dateRange),
        },
      });
      setJobs(result.jobs ?? []);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, workLocation, employmentType, dateRange]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [workLocation, employmentType, sourceFilter, dateRange]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <div className="relative space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold bg-gradient-to-r from-teal-600 via-purple-600 to-rose-600 bg-clip-text text-transparent"
          >
            Job Board
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-muted-foreground mt-0.5"
          >
            {isLoading ? 'Loading…' : `${totalCount} job${totalCount !== 1 ? 's' : ''} found`}
          </motion.p>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap gap-2"
        >
          <Select
            value={dateRange}
            onValueChange={(v) => setDateRange(v as DateRange)}
          >
            <SelectTrigger className="w-[140px] bg-white/80 backdrop-blur-xl border-white/40 shadow-sm hover:border-rose-200 text-xs h-9">
              <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/40">
              <SelectItem value="today">📅 Today</SelectItem>
              <SelectItem value="24h">🕐 Last 24 hours</SelectItem>
              <SelectItem value="3days">📅 Last 3 days</SelectItem>
              <SelectItem value="week">🗓️ Past 7 days</SelectItem>
              <SelectItem value="month">📆 Past 30 days</SelectItem>
              <SelectItem value="all">🔍 All time</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sourceFilter ?? 'all'}
            onValueChange={(v) => setSourceFilter(v === 'all' ? undefined : v as SourceFilter)}
          >
            <SelectTrigger className="w-[140px] bg-white/80 backdrop-blur-xl border-white/40 shadow-sm hover:border-indigo-200 text-xs h-9">
              <Zap className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/40">
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="theirstack">⚡ TheirStack</SelectItem>
              <SelectItem value="manual">✏️ Manual</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={workLocation ?? 'all'}
            onValueChange={(v) => setWorkLocation(v === 'all' ? undefined : v as WorkLocationType)}
          >
            <SelectTrigger className="w-[140px] bg-white/80 backdrop-blur-xl border-white/40 shadow-sm hover:border-teal-200 text-xs h-9">
              <MapPin className="w-3.5 h-3.5 mr-1.5 text-teal-500" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/40">
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="remote">🌍 Remote</SelectItem>
              <SelectItem value="in_person">🏢 In Person</SelectItem>
              <SelectItem value="hybrid">🔄 Hybrid</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={employmentType ?? 'all'}
            onValueChange={(v) => setEmploymentType(v === 'all' ? undefined : v as EmploymentType)}
          >
            <SelectTrigger className="w-[140px] bg-white/80 backdrop-blur-xl border-white/40 shadow-sm hover:border-purple-200 text-xs h-9">
              <Briefcase className="w-3.5 h-3.5 mr-1.5 text-purple-500" />
              <SelectValue placeholder="Job Type" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/40">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="full_time">⭐ Full Time</SelectItem>
              <SelectItem value="part_time">⌛ Part Time</SelectItem>
              <SelectItem value="co_op">🤝 Co-op</SelectItem>
              <SelectItem value="internship">🎓 Internship</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence mode="wait">
          {isLoading ? (
            Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <JobCardSkeleton key={i} />
            ))
          ) : jobs.length === 0 ? (
            <EmptyState key="empty" dateRange={dateRange} />
          ) : (
            jobs.map((job, idx) => (
              <JobCard
                key={job.id}
                job={job}
                resumeId={jobResumeMap[job.id]}
                index={idx}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-3"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || isLoading}
            className="bg-white/70 border-white/40 hover:bg-white/80 hover:border-teal-200 disabled:opacity-40 gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || isLoading}
            className="bg-white/70 border-white/40 hover:bg-white/80 hover:border-purple-200 disabled:opacity-40 gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}
