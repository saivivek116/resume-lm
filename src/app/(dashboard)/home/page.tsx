/**
 * Home Page Component
 * 
 * This is the main dashboard page of the Resume AI application. It displays:
 * - User profile information
 * - Quick stats (profile score, resume counts, job postings)
 * - Base resume management
 * - Tailored resume management
 * 
 * The page implements a soft gradient minimalism design with floating orbs
 * and mesh overlay for visual interest.
 */

import { redirect } from "next/navigation";
import {User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProfileRow } from "@/components/dashboard/profile-row";
import { WelcomeDialog } from "@/components/dashboard/welcome-dialog";
import { getGreeting } from "@/lib/utils";
import { ApiKeyAlert } from "@/components/dashboard/api-key-alert";
import { type SortOption, type SortDirection } from "@/components/resume/management/resume-sort-controls";
import { ResumesSection } from "@/components/dashboard/resumes-section";
import { getProfile, getResumePage } from "@/utils/actions";

// Rows fetched per section per request. The dashboard never loads the whole table.
// Seven, not eight: the grid is four columns and the create-resume card takes the first
// cell, so 7 + 1 fills exactly two rows.
const RESUMES_PER_PAGE = 7;

/** A repeated query param (`?basePage=1&basePage=2`) arrives as an array. */
function first(param: string | string[] | undefined): string {
  return (Array.isArray(param) ? param[0] : param) ?? '';
}





export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Check if user is coming from confirmation
  const params = await searchParams;
  const isNewSignup = first(params?.type) === 'signup' && Boolean(params?.token_hash);

  // Per-section list state, all driven by the URL so each section pages independently.
  const baseSort = (first(params.baseSort) as SortOption) || 'createdAt';
  const baseDirection = (first(params.baseDirection) as SortDirection) || 'desc';
  const basePage = Number(first(params.basePage)) || 1;
  const baseSearch = first(params.baseSearch);

  const tailoredSort = (first(params.tailoredSort) as SortOption) || 'createdAt';
  const tailoredDirection = (first(params.tailoredDirection) as SortDirection) || 'desc';
  const tailoredPage = Number(first(params.tailoredPage)) || 1;
  const tailoredSearch = first(params.tailoredSearch);

  // Fetch dashboard data and handle authentication
  let profile;
  let basePageResult;
  let tailoredPageResult;
  try {
    [profile, basePageResult, tailoredPageResult] = await Promise.all([
      getProfile(),
      getResumePage({
        type: 'base',
        page: basePage,
        pageSize: RESUMES_PER_PAGE,
        sort: baseSort,
        direction: baseDirection,
        search: baseSearch,
      }),
      getResumePage({
        type: 'tailored',
        page: tailoredPage,
        pageSize: RESUMES_PER_PAGE,
        sort: tailoredSort,
        direction: tailoredDirection,
        search: tailoredSearch,
      }),
    ]);
    if (!profile) {
      redirect("/");
    }
  } catch {
    // Redirect to login if error occurs
    redirect("/");
  }


  // Display a friendly message if no profile exists
  if (!profile) {
    return (
      <main className="min-h-screen p-6 md:p-8 lg:p-10 relative flex items-center justify-center">
        <Card className="max-w-md w-full p-8 bg-white/80 backdrop-blur-xl border-white/40 shadow-2xl">
          <div className="text-center space-y-4">
            <User className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-semibold text-gray-800">Profile Not Found</h2>
            <p className="text-muted-foreground">
              We couldn&apos;t find your profile information. Please contact support for assistance.
            </p>
            <Button className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
              Contact Support
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative sm:pb-12 pb-40">

      {/* Welcome Dialog for New Signups */}
      <WelcomeDialog isOpen={!!isNewSignup} />
      
      {/* Gradient Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-sky-50 to-violet-50" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:14px_24px]" />
        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-teal-200/30 to-cyan-200/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-purple-200/30 to-indigo-200/30 rounded-full blur-3xl animate-float-slower" />
      </div>

      {/* Content */}
      <div className="relative z-10">
      {/* Profile Row Component */}
      <ProfileRow profile={profile} />
        
        <div className="pl-2 sm:pl-0 sm:container sm:max-none  max-w-7xl mx-auto  lg:px-8 md:px-8 sm:px-6 pt-4 ">  
          {/* Profile Overview */}
          <div className="mb-6 space-y-4">
            {/* API Key Alert (self-hides once the user has configured a provider key) */}
            <ApiKeyAlert variant="upgrade" />
            
            {/* Greeting & Edit Button */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  {getGreeting()}, {profile.first_name}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Welcome to your resume dashboard
                </p>
              </div>
            </div>

            

            {/* Resume Bookshelf */}
            <div className="">


              {/* Base Resumes Section */}
              <ResumesSection
                type="base"
                resumes={basePageResult.resumes}
                profile={profile}
                sortParam="baseSort"
                directionParam="baseDirection"
                currentSort={baseSort}
                currentDirection={baseDirection}
                pageParam="basePage"
                searchParam="baseSearch"
                currentPage={basePageResult.page}
                pageSize={RESUMES_PER_PAGE}
                totalCount={basePageResult.total}
              />

              {/* Thin Divider */}
              <div className="relative py-2">
                <div className="h-px bg-gradient-to-r from-transparent via-purple-300/50 to-transparent" />
              </div>

              {/* Tailored Resumes Section */}
              <ResumesSection
                type="tailored"
                resumes={tailoredPageResult.resumes}
                profile={profile}
                sortParam="tailoredSort"
                directionParam="tailoredDirection"
                currentSort={tailoredSort}
                currentDirection={tailoredDirection}
                pageParam="tailoredPage"
                searchParam="tailoredSearch"
                currentPage={tailoredPageResult.page}
                pageSize={RESUMES_PER_PAGE}
                totalCount={tailoredPageResult.total}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
