import { JobListingsCard } from '@/components/jobs/job-listings-card';

export default function JobsPage() {
  return (
    <main className="min-h-screen relative sm:pb-12 pb-40">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-sky-50 to-violet-50" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:14px_24px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-teal-200/30 to-cyan-200/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-purple-200/30 to-indigo-200/30 rounded-full blur-3xl animate-float-slower" />
      </div>
      <div className="relative z-10 container max-w-7xl mx-auto px-4 md:px-8 py-8">
        <JobListingsCard />
      </div>
    </main>
  );
}
