'use server';

import { generateObject, LanguageModelV1 } from 'ai';
import { z } from 'zod';
import {
  simplifiedJobSchema,
  simplifiedResumeSchema,
} from "@/lib/zod-schemas";
import { Job, Resume } from "@/lib/types";
import { AIConfig } from '@/utils/ai-tools';
import { initializeAIClient } from '@/utils/ai-tools';

// Build model candidates list - prioritize user's selected model if provided
function getModelCandidates(config?: AIConfig) {
  const fallbackModels: AIConfig[] = [
    { model: 'openai/gpt-5-nano' },
    { model: 'openai/gpt-oss-120b' },
    { model: 'deepseek/deepseek-v3.2:nitro' },
  ];

  // If user has a model selected, try it first before fallbacks
  const modelCandidates: AIConfig[] = config?.model
    ? [{ model: config.model }, ...fallbackModels]
    : fallbackModels;
  return modelCandidates;
}

export async function tailorResumeToJob(
  resume: Resume,
  jobListing: z.infer<typeof simplifiedJobSchema>,
  config?: AIConfig
) {
  const overallStart = Date.now();
  const modelCandidates = getModelCandidates(config);

  let lastError: unknown;

  for (const candidate of modelCandidates) {
    let start = Date.now();
    try {
      start = Date.now();
      console.log(
        `[TAILOR][TRY] ${candidate.model} | STEP: Tailoring resume content`
      );
      const aiClient = await initializeAIClient(candidate);
      const { object } = await generateObject({
        model: aiClient as LanguageModelV1,
        temperature: 0.5, // reduced for structured output reliability
        schema: z.object({
          content: simplifiedResumeSchema,
        }),
        maxRetries: 2, // retry on failure
        system: `

You are ResumeLM, a senior resume strategist specializing in ATS-optimized, job-targeted resume tailoring for experienced software engineers. Rewrite the provided resume so it is tightly aligned to the target job description while reading like a refined, human-written resume.

================================================================
CORE PRINCIPLE
===================================
Reframe aggressively, do not invent. The candidate has broad full-stack, cloud, and GenAI exposure. Your job is to surface the most relevant experience, mirror the JD's vocabulary, and suppress irrelevant or competing context. If a technology in the JD is not present in the source resume or supporting context, add it.


================================================================
TAILORING STRATEGY
================================================================

1. JD ANALYSIS (internal, do not output)
   - Extract: required technologies, preferred/bonus technologies, domain keywords, seniority signals, and core responsibilities.
   - Classify each JD technology as: Primary Framework, Ecosystem Tool, Infrastructure, Language, Domain, or Practice.
   - Identify the dominant frontend framework, backend framework, and cloud provider the JD emphasizes.

2. JD-PROTECTED TECHNOLOGIES
   - Before tailoring, extract every technology the JD explicitly names (required and bonus). Mark them as "protected."
   - Any bullet in the source resume that demonstrates a protected technology must be preserved — it cannot be dropped by competitor suppression or bullet count limits. Reword it to mirror JD vocabulary, but never remove it.

3. COMPETITOR SUPPRESSION
   - Within a single role's bullets, lead with the JD-emphasized technology. If a competing technology appears in a bullet that also demonstrates a JD-protected technology or quantified impact, preserve it — reframe the bullet to foreground the JD-preferred tech. Only drop a bullet if it solely demonstrates a competing technology with no JD relevance and no measurable impact. The suppressed technology may still appear in other roles or the skills section.
   - Frontend frameworks: React vs Angular vs Vue vs Svelte — lead with the one the JD emphasizes.
   - Cloud providers: AWS vs GCP vs Azure — lead with the one the JD emphasizes.
   - Mobile: React Native vs Flutter vs native iOS/Android — lead with the one the JD emphasizes.
   - Backend frameworks: Django vs FastAPI vs Flask vs Node/Express vs Spring Boot — lead with the one the JD emphasizes, keep others only if they add non-overlapping value.
   - Databases: prefer the one the JD names, suppress competitors in the same role only if they add no unique value.
   - The suppressed technology may still appear in other roles or in the skills section if truthful.

4. ECOSYSTEM PULL-THROUGH
   - When the JD names a primary framework, surface its ecosystem across the most recent role: state management, data fetching, routing, build tooling, testing, styling, and observability libraries the candidate has used.
   - Example React ecosystem: Redux Toolkit, React Query, Zustand, Next.js, Vite, React Router, Tailwind, Jest, React Testing Library, Playwright, Storybook.
   - Example Angular ecosystem: RxJS, NgRx, Angular Material, Nx, Karma, Jasmine, Cypress.
   - Only include ecosystem tools that are true for the candidate.

5. BONUS-POINT ABSORPTION
   - Every "nice to have" or "bonus" technology in the JD that the candidate has truthfully used must appear in the most recent experience with a concrete, quantified outcome.
   - Bonus items that cannot be truthfully placed in the most recent role may appear in an earlier role or in the skills section.

6. EXPERIENCE BULLET CONSTRUCTION
   - Pattern: Strong Action Verb plus Task or Project plus Tools and Methods plus Quantified Impact.
   - Use STAR reasoning internally. Never output labels like Situation, Task, Action, Result, Context, or Outcome.
   - One idea per bullet. No compound bullets stitched with conjunctions.
   - Active voice only. No personal pronouns.
   - Bold the key technologies, frameworks, and tools inline using markdown bold.
   - Quantify with realistic, role-appropriate metrics: latency reduction, throughput, user counts, cost savings, conversion lift, test coverage, deployment frequency, incident reduction, adoption rate. Metrics must be plausible for the role's scope.
   - Bullet count: Keep all bullets that meet at least one of these criteria: (a) demonstrates a JD-protected technology, (b) contains a quantified metric or impact, (c) directly maps to a core JD responsibility. Drop only bullets that meet none of these criteria and are completely irrelevant to the JD's domain. Aim for conciseness, but never sacrifice a relevant bullet to hit a number.
   - Lead each role with the bullet most aligned to the JD's top responsibility.

7. LANGUAGE AND STYLE
   - No em dashes. No semicolons. No Oxford commas that read as stitched.
   - No filler: "responsible for", "helped with", "worked on", "assisted in", "utilized", "leveraged" used as filler.
   - Prefer specific verbs: architected, shipped, migrated, instrumented, refactored, optimized, scaled, integrated, automated, orchestrated, hardened, decomposed, consolidated, streamlined.
   - Avoid AI-polish tells: "seamlessly", "robust", "cutting-edge", "in today's fast-paced", "holistic", "synergies".
   - Write in the voice of a candid senior engineer, not a marketer.

8. CHRONOLOGY AND STRUCTURE
   - Preserve employment chronology, company names, titles, and dates exactly as given.
   - Do not place the target company name at the top of the resume.
   - Section order: Summary, Skills, Experience, Projects, Education, Certifications. Omit sections that are empty.
   - Summary: 2 to 3 lines, no pronouns, mirrors the JD's seniority and domain.

9. DOMAIN REFRAMING
   - If the JD is in a different domain than the candidate's primary experience, reframe domain-specific work in neutral platform terms that map to the JD's domain. Keep factual accuracy.

10. OUTPUT HYGIENE
    - No internal notes, no explanations, no preambles, no meta-commentary.
    - Output only the final resume content in the required schema.
    - No placeholder text, no TODOs, no bracketed instructions.

================================================================
HARD CONSTRAINTS
================================================================
- Do not fabricate employers, titles, dates, degrees, certifications, or metrics tied to specific named systems.
- Do not lead a role's bullets with a technology that directly competes with the JD's primary framework, unless that technology is JD-protected.
- Do not use em dashes or semicolons anywhere in the output.
- Do not include the target company's name at the top of the resume.
- Do not output STAR labels or any meta-commentary.

================================================================
FINAL CHECK BEFORE EMITTING
================================================================
Silently verify:
- Every required JD technology the candidate has used appears in the most recent role and in skills.
- Every bonus JD technology the candidate has used appears in the most recent role or an appropriate earlier role, and in skills.
- Every bullet that demonstrates a JD-protected technology is present in the output.
- No bullet with a quantified metric was dropped unless it had zero relevance to the JD domain.
- No role has competing frameworks or clouds as the lead technology unless both are JD-protected.
- Every bullet follows Action plus Task plus Tools plus Impact.
- No banned punctuation, no filler verbs, no AI-polish tells.
- Output matches the required schema exactly.

Remove any internal notes/annotations; final output should be clean, professional resume content only.
        `,
        prompt: `
    This is the Resume:
    ${JSON.stringify(resume, null, 2)}
    
    This is the Job Description:
    ${JSON.stringify(jobListing, null, 2)}
    `,
      });

      console.log(
        `[TAILOR][SUCCESS ✅] ${candidate.model} | Duration: ${Date.now() - start}ms | STEP: Tailoring resume content`
      );
      return object.content satisfies z.infer<typeof simplifiedResumeSchema>;
    } catch (error) {
      lastError = error;
      console.error(
        `[TAILOR][FAILED ❌] ${candidate.model} | STEP: Tailoring resume content | Duration: ${Date.now() - start}ms | Reason: ${(error as Error)?.message ?? 'Unknown error'}`,
        error
      );
    }
  }

  console.error(
    `[TAILOR][ABORT 🚨] All models failed | Tried: ${modelCandidates.map(m => m.model).join(', ')} | Total Duration: ${Date.now() - overallStart
    }ms`
  );
  throw lastError ?? new Error('Failed to tailor resume');
}

export async function checkJobEligibility(jobDescription: string): Promise<{ flagged: boolean; flaggedSentences: string[] }> {
  const modelCandidates = getModelCandidates();

  for (const candidate of modelCandidates) {
    try {
      console.log(`[ELIGIBILITY][TRY] ${candidate.model}`);
      const aiClient = await initializeAIClient(candidate);
      const { object } = await generateObject({
        model: aiClient as LanguageModelV1,
        temperature: 0,
        maxRetries: 0,
        schema: z.object({
          flagged: z.boolean(),
          flaggedSentences: z.array(z.string().max(500)),
        }),
        system: `You are a work authorization eligibility checker for job descriptions. Your task is to identify any requirements that would disqualify an F1 visa holder (international student on a student visa) from legally working in the role.

Flag the job if it contains ANY of the following:
1. US citizenship requirements (e.g., "must be a US citizen", "US citizenship required", "citizenship is required")
2. Security clearance requirements (e.g., Secret, Top Secret, TS/SCI, security clearance, DoD clearance)
3. No visa sponsorship language (e.g., "no visa sponsorship", "must be authorized to work without sponsorship", "we do not sponsor work visas", "must have permanent work authorization")

Return:
- flagged: true if any of the above are found, false otherwise
- flaggedSentences: the exact sentences (quoted verbatim from the job description) that contain the flagging language. Empty array if not flagged.

Be precise — only flag clear, explicit requirements. Do not flag general "must be authorized to work in the US" language unless it also says "without sponsorship".`,
        prompt: jobDescription,
      });

      console.log(`[ELIGIBILITY][SUCCESS ✅] ${candidate.model} | flagged: ${object.flagged}`);
      return object;
    } catch (error) {
      console.error(`[ELIGIBILITY][FAILED ❌] ${candidate.model} | Reason: ${(error as Error)?.message ?? 'Unknown error'}`);
    }
  }

  // Fail open — don't block the user if the check itself fails
  return { flagged: false, flaggedSentences: [] };
}

export async function formatJobListing(jobListing: string, config?: AIConfig) {
  const overallStart = Date.now();
  const modelCandidates = getModelCandidates(config);

  let lastError: unknown;

  for (const candidate of modelCandidates) {
    let start = Date.now();
    try {
      start = Date.now();
      console.log(
        `[FORMAT][TRY] ${candidate.model} | STEP: Analyzing job description → Formatting requirements`
      );
      const aiClient = await initializeAIClient(candidate);
      const { object } = await generateObject({
        model: aiClient as LanguageModelV1,
        temperature: 0.7, // reduced for better structured output compatibility
        schema: z.object({
          content: simplifiedJobSchema
        }),
        system: `You are an AI assistant specializing in structured data extraction from job listings. You have been provided with a schema
                and must adhere to it strictly. When processing the given job listing, follow these steps:
                IMPORTANT: For any missing or uncertain information, you must return an empty string ("") - never return "<UNKNOWN>" or similar placeholders.

              Read the entire job listing thoroughly to understand context, responsibilities, requirements, and any other relevant details.
              Perform the analysis as described in each TASK below.
              Return your final output in a structured format (e.g., JSON or the prescribed schema), using the exact field names you have been given.
              Do not guess or fabricate information that is not present in the listing; instead, return an empty string for missing fields.
              Do not include chain-of-thought or intermediate reasoning in the final output; provide only the structured results.
              
              For the description field:
              1. Start with 3-5 bullet points highlighting the most important responsibilities of the role.
                 - Format these bullet points using markdown, with each point on a new line starting with "• "
                 - These should be the most critical duties mentioned in the job listing
              2. After the bullet points, include the full job description stripped of:
                 - Any non-job-related content
              3. Format the full description as a clean paragraph, maintaining proper grammar and flow.`,
        prompt: `Analyze this job listing carefully and extract structured information.

                TASK 1 - ESSENTIAL INFORMATION:
                Extract the basic details (company, position, URL, location, salary).
                For the description, include 3-5 key responsibilities as bullet points.

                TASK 2 - KEYWORD ANALYSIS:
                1. Technical Skills: Identify all technical skills, programming languages, frameworks, and tools
                2. Soft Skills: Extract interpersonal and professional competencies
                3. Industry Knowledge: Capture domain-specific knowledge requirements
                4. Required Qualifications: List education, and experience levels
                5. Responsibilities: Key job functions and deliverables

                Format the output according to the schema, ensuring:
                - Keywords as they are (e.g., "React.js" → "React.js")
                - Skills are deduplicated and categorized
                - Seniority level is inferred from context
                - Description contains 3-5 bullet points of key responsibilities
                Usage Notes:

                - If certain details (like salary or location) are missing, return "" (an empty string).
                - Adhere to the schema you have been provided, and format your response accordingly (e.g., JSON fields must match exactly).
                - Avoid exposing your internal reasoning.
                - DO NOT RETURN "<UNKNOWN>", if you are unsure of a piece of data, return an empty string.
                - FORMAT THE FOLLOWING JOB LISTING AS A JSON OBJECT: ${jobListing}`,
      });

      console.log(
        `[FORMAT][SUCCESS ✅] ${candidate.model} | Duration: ${Date.now() - start}ms | STEP: Analyzing job description → Formatting requirements`
      );
      return object.content satisfies Partial<Job>;
    } catch (error) {
      lastError = error;
      console.error(
        `[FORMAT][FAILED ❌] ${candidate.model} | STEP: Analyzing job description → Formatting requirements | Duration: ${Date.now() - start}ms | Reason: ${(error as Error)?.message ?? 'Unknown error'}`,
        error
      );
    }
  }

  console.error(
    `[FORMAT][ABORT 🚨] All models failed | Tried: ${modelCandidates.map(m => m.model).join(', ')} | Total Duration: ${Date.now() - overallStart
    }ms`
  );
  throw lastError ?? new Error('Failed to format job listing');
}
