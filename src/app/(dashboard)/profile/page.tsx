import { redirect } from "next/navigation";
import { getProfile } from "@/utils/actions";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { Suspense } from "react";
import { hasApiKey } from "@/utils/actions/api-keys/actions";

// Force dynamic behavior and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditProfilePage() {
  // Fetch profile data and handle authentication
  let profile;
  try {
    profile = await getProfile();
  } catch (error: unknown) {
    void error
    redirect("/");
  }

  // Display a friendly message if no profile exists
  if (!profile) {
    redirect("/home");
  }

  const [hasOpenAI, hasAnthropic, hasOpenRouter] = await Promise.all([
    hasApiKey('openai'),
    hasApiKey('anthropic'),
    hasApiKey('openrouter'),
  ])
  const keyStatus = { openai: hasOpenAI, anthropic: hasAnthropic, openrouter: hasOpenRouter }

  return (
    <main className="min-h-screen relative">
      {/* Background Layer */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 via-sky-50/50 to-violet-50/50" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-r from-pink-200/20 to-violet-200/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-gradient-to-r from-blue-200/20 to-teal-200/20 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:14px_24px]" />
      </div>

      {/* Main Content Layer */}
      <div className="relative z-10">
        <Suspense fallback={<div>Loading...</div>}>
          <ProfileEditForm profile={profile} keyStatus={keyStatus} />
        </Suspense>
      </div>
    </main>
  );
} 