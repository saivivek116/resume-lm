'use server';

import { generateObject, generateText, LanguageModelV1, tool } from 'ai';
import { z } from 'zod';
import {
  interviewCategoryPlanSchema,
  categoryQuestionsSchema,
  companyResearchSchema,
  interviewExperiencesSchema,
} from '@/lib/zod-schemas';
import type {
  CompanyResearch,
  InterviewExperiencesResult,
  InterviewQuestion,
  InterviewQuestionCategory,
  Resume,
} from '@/lib/types';
import { AIConfig, initializeAIClient } from '@/utils/ai-tools';

// Build model candidates list - prioritize user's selected model if provided.
// Mirrors getModelCandidates in src/utils/actions/jobs/ai.ts.
function getModelCandidates(config?: AIConfig): AIConfig[] {
  const fallbackModels: AIConfig[] = [
    { model: 'openai/gpt-5-nano' },
    { model: 'openai/gpt-oss-120b' },
    { model: 'deepseek/deepseek-v3.2:nitro' },
  ];

  return config?.model ? [{ model: config.model }, ...fallbackModels] : fallbackModels;
}

// Curated resume subset used for prompting, matching the app-questions route.
function resumeSubset(resume: Resume) {
  return {
    name: `${resume.first_name} ${resume.last_name}`,
    target_role: resume.target_role,
    professional_summary: resume.professional_summary,
    work_experience: resume.work_experience,
    education: resume.education,
    skills: resume.skills,
    projects: resume.projects,
    certifications: resume.certifications,
  };
}

const CATEGORY_LABELS: Record<InterviewQuestionCategory, string> = {
  screening: 'Screening / Fit (e.g. "Tell me about yourself", "Why this company?", "Why this role?")',
  behavioral: 'Behavioral (STAR questions about teamwork, conflict, leadership, failure)',
  technical: 'Technical (role-specific questions from the job description keywords and resume skills)',
  system_design: 'System Design (for senior or higher engineering roles) greater than 5 years of experience',
  dsa: 'DSA / Coding (for software roles that mention algorithms or data structures)',
  culture_fit: 'Culture Fit (working style, values alignment, collaboration)',
};

const STYLE_RULES = `Style rules you MUST follow:
- Use only facts from the candidate's resume for personal claims. Never invent experiences, employers, metrics, or achievements.
- Every STAR result must use a quantifiable outcome that appears in the resume. If no metric exists for a story, describe the concrete outcome without inventing numbers.
- Write complete, natural sentences in the first person.
- Do NOT use em dashes.
- Do NOT use semicolons.
- Do NOT use filler phrases like "I am passionate about", "leverage synergies", "dynamic environment", or "excited to contribute".
- Do NOT use square brackets or placeholders.`;

interface PlanCategoriesInput {
  jobDescription: string;
  resume: Resume;
  config?: AIConfig;
}

// Planner agent: decides which categories apply and how many questions each.
export async function planInterviewCategories(
  input: PlanCategoriesInput
): Promise<z.infer<typeof interviewCategoryPlanSchema>['categories']> {
  const { jobDescription, resume, config } = input;
  const modelCandidates = getModelCandidates(config);
  let lastError: unknown;

  const system = `You are an interview strategist. Given a job description and a candidate resume, decide which categories of interview questions this candidate is likely to face and how many questions to prepare for each.

Available categories:
${Object.values(CATEGORY_LABELS).map((l) => `- ${l}`).join('\n')}

Rules:
- Choose categories based on the role and seniority described in the job description. Only include a category if it genuinely applies (e.g. no DSA or System Design for non-engineering roles).
- Include System Design only for senior or higher engineering roles.
- Include DSA / Coding only for software engineering roles that involve algorithms or data structures.
- Each category you include must have at least 2 questions.
- The total number of questions across all categories must be at least 5 and at most 20.
- Screening / Fit and Culture Fit apply to almost every role.`;

  const prompt = `Job Description:
${jobDescription || 'Not provided'}

Candidate Resume:
${JSON.stringify(resumeSubset(resume), null, 2)}

Decide the applicable categories and question counts.`;

  for (const candidate of modelCandidates) {
    const start = Date.now();
    try {
      console.log(`[INTERVIEW_PLAN][TRY] ${candidate.model}`);
      const aiClient = await initializeAIClient(candidate);
      const { object } = await generateObject({
        model: aiClient as LanguageModelV1,
        temperature: 0.4,
        maxRetries: 2,
        schema: interviewCategoryPlanSchema,
        system,
        prompt,
      });
      console.log(
        `[INTERVIEW_PLAN][SUCCESS ✅] ${candidate.model} | Duration: ${Date.now() - start}ms | Categories: ${object.categories.map((c) => `${c.category}:${c.count}`).join(', ')}`
      );
      return clampPlan(object.categories);
    } catch (error) {
      lastError = error;
      console.error(
        `[INTERVIEW_PLAN][FAILED ❌] ${candidate.model} | Duration: ${Date.now() - start}ms | Reason: ${(error as Error)?.message ?? 'Unknown error'}`
      );
    }
  }

  console.error('[INTERVIEW_PLAN][ABORT 🚨] All models failed');
  throw lastError ?? new Error('Failed to plan interview categories');
}

// Enforce the min-5 / max-20 total and >=2 per-category rules defensively,
// in case the model ignores them.
function clampPlan(
  categories: z.infer<typeof interviewCategoryPlanSchema>['categories']
): z.infer<typeof interviewCategoryPlanSchema>['categories'] {
  // De-duplicate categories, keeping the first count, and floor each at 2.
  const seen = new Map<InterviewQuestionCategory, number>();
  for (const c of categories) {
    if (!seen.has(c.category)) {
      seen.set(c.category, Math.max(2, Math.min(6, c.count)));
    }
  }

  let result = Array.from(seen.entries()).map(([category, count]) => ({ category, count }));

  // Ensure at least one category and a minimum of 5 total questions.
  if (result.length === 0) {
    result = [
      { category: 'screening', count: 3 },
      { category: 'behavioral', count: 2 },
    ];
  }

  const total = () => result.reduce((sum, c) => sum + c.count, 0);

  // Bump counts (up to 6 each) until we reach at least 5 total.
  let i = 0;
  while (total() < 5) {
    const c = result[i % result.length];
    if (c.count < 6) c.count += 1;
    i += 1;
    if (i > 100) break;
  }

  // Trim counts down until we are at or below 20 total.
  i = 0;
  while (total() > 20) {
    const c = result[i % result.length];
    if (c.count > 2) c.count -= 1;
    i += 1;
    if (i > 100) break;
  }

  return result;
}

interface GenerateCategoryInput {
  category: InterviewQuestionCategory;
  count: number;
  jobDescription: string;
  resume: Resume;
  companySummary: string;
  config?: AIConfig;
}

// Per-category agent: generates STAR-format questions for a single category.
export async function generateCategoryQuestions(
  input: GenerateCategoryInput
): Promise<InterviewQuestion[]> {
  const { category, count, jobDescription, resume, companySummary, config } = input;
  const modelCandidates = getModelCandidates(config);
  const today = new Date().toISOString().split('T')[0];
  let lastError: unknown;

  const system = `You are an interview coach preparing a candidate for the "${CATEGORY_LABELS[category]}" portion of an interview.

Generate exactly ${count} likely interview questions for this category, each with a model answer.

For each question provide:
- question: the interview question the candidate is likely to be asked.
- star: a model answer in STAR format grounded in the candidate's resume:
  - situation: the context from a real resume experience.
  - task: what needed to be done.
  - action: the specific actions the candidate took (resume facts only).
  - result: the quantifiable outcome from the resume.
- whatYouLearned: a short paragraph on what the candidate learned from that experience, what skills it developed, or how it shaped their professional approach.
- tips: optional, at most 2 short bullets of strategic advice for answering this specific question.

Adapt the tone to the seniority of the role in the job description: executive roles get confident, strategic language; entry-level roles get enthusiastic, growth-oriented language.

Today's date is ${today}. Use it for any years-of-experience or time-based calculations.

${STYLE_RULES}`;

  const prompt = `Company culture and values summary:
${companySummary || 'Not available'}

Job Description:
${jobDescription || 'Not provided'}

Candidate Resume:
${JSON.stringify(resumeSubset(resume), null, 2)}

Generate ${count} "${category}" interview questions with STAR-format model answers grounded only in this resume.`;

  for (const candidate of modelCandidates) {
    const start = Date.now();
    try {
      console.log(`[INTERVIEW_${category.toUpperCase()}][TRY] ${candidate.model}`);
      const aiClient = await initializeAIClient(candidate);
      const { object } = await generateObject({
        model: aiClient as LanguageModelV1,
        temperature: 0.6,
        maxRetries: 2,
        schema: categoryQuestionsSchema,
        system,
        prompt,
      });
      console.log(
        `[INTERVIEW_${category.toUpperCase()}][SUCCESS ✅] ${candidate.model} | Duration: ${Date.now() - start}ms | Questions: ${object.questions.length}`
      );
      return object.questions.map((q) => ({
        ...q,
        id: crypto.randomUUID(),
        category,
      }));
    } catch (error) {
      lastError = error;
      console.error(
        `[INTERVIEW_${category.toUpperCase()}][FAILED ❌] ${candidate.model} | Duration: ${Date.now() - start}ms | Reason: ${(error as Error)?.message ?? 'Unknown error'}`
      );
    }
  }

  console.error(`[INTERVIEW_${category.toUpperCase()}][ABORT 🚨] All models failed`);
  throw lastError ?? new Error(`Failed to generate ${category} questions`);
}

// ============================================================
// Company research
// ============================================================

// Tavily web search + current-date tools used to ground company research.
const researchTools = {
  getCurrentDate: tool({
    description:
      "Returns today's date. Use when reasoning about recent company news or timelines.",
    parameters: z.object({}),
    execute: async () => new Date().toISOString().split('T')[0],
  }),
  searchWeb: tool({
    description:
      'Search the web for information about the company. Use to learn about their official website, culture, values, mission, products, and services.',
    parameters: z.object({
      query: z
        .string()
        .describe('Search query, e.g. "Acme Corp official website products and services"'),
    }),
    execute: async ({ query }: { query: string }) => {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) return 'Web search unavailable.';

      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: 4,
            search_depth: 'basic',
          }),
        });
        const data = await response.json();
        const snippets = (data.results ?? [])
          .map(
            (r: { title: string; url: string; content: string }) =>
              `${r.title} (${r.url}): ${r.content}`
          )
          .join('\n\n');
        return snippets || 'No results found.';
      } catch {
        return 'Web search failed.';
      }
    },
  }),
};

interface ResearchCompanyInput {
  companyName: string;
  jobDescription?: string;
  jobUrl?: string | null;
  config?: AIConfig;
}

const RESEARCH_STYLE_RULES = `Style rules you MUST follow:
- Ground every claim in what the search results actually say.
- Write in the third person about the company. Do not address the candidate.
- Do NOT use em dashes.
- Do NOT use semicolons.
- Do NOT use filler phrases like "dynamic environment", "fast-paced", "leverage synergies", "cutting-edge", or "passionate".
- Do NOT use square brackets or placeholders.`;

const RESEARCH_FALLBACK: CompanyResearch = {
  websiteUrl: null,
  cultureAndValues:
    'Company research could not be completed. You can still generate interview questions from the job description and resume.',
  productsAndServices: [],
};

// Grounded company research: a two-step pass because the AI SDK v4 structured
// helpers cannot run the multi-step search-tool loop. Step 1 gathers a grounded
// brief with the Tavily tools; step 2 structures it into a CompanyResearch object.
export async function researchCompany(
  input: ResearchCompanyInput
): Promise<CompanyResearch> {
  const { companyName, jobDescription, jobUrl, config } = input;
  const modelCandidates = getModelCandidates(config);

  const briefSystem = `You are an interview preparation researcher. Research a company so a candidate can prepare for an interview.

Rules you MUST follow:
- Call the searchWeb tool with the company name to learn about their official website, mission, products, services, culture, and values before writing.
- Find the company's OFFICIAL website homepage URL (for example https://www.petsmart.com), not a job board, news article, or social media page.
- Summarize the company's culture and values in 3 to 5 short sentences.
- Identify the company's main products and services.
- If research is unavailable, write a brief neutral summary based only on the job description and say the details could not be verified.

${RESEARCH_STYLE_RULES}`;

  const briefPrompt = `Company: ${companyName}
${jobUrl ? `Job posting URL: ${jobUrl}` : ''}

Job Description:
${jobDescription ?? 'Not provided'}

Research this company. Report: (1) the official company website homepage URL, (2) a culture and values summary, and (3) the main products and services.`;

  for (const candidate of modelCandidates) {
    const start = Date.now();
    try {
      console.log(`[INTERVIEW_RESEARCH][TRY] ${candidate.model}`);
      const aiClient = await initializeAIClient(candidate);

      // Step 1: grounded brief.
      const { text: brief } = await generateText({
        model: aiClient as LanguageModelV1,
        maxRetries: 2,
        system: briefSystem,
        prompt: briefPrompt,
        tools: researchTools,
        maxSteps: 4,
      });

      // Step 2: structure the brief.
      const { object } = await generateObject({
        model: aiClient as LanguageModelV1,
        maxRetries: 2,
        schema: companyResearchSchema,
        system: `Convert the research brief into structured data.
- websiteUrl: the company's official homepage URL only (e.g. https://www.petsmart.com). Use null if no official website was found. Never use a job board, article, or social media URL.
- cultureAndValues: the culture and values summary, 3 to 5 sentences.
- productsAndServices: 3 to 6 concise items, each with a short name and a one-sentence description. Empty array if unknown.

${RESEARCH_STYLE_RULES}`,
        prompt: `Company: ${companyName}

Research brief:
${brief}`,
      });

      const websiteUrl =
        object.websiteUrl && object.websiteUrl.startsWith('http')
          ? object.websiteUrl
          : null;

      console.log(
        `[INTERVIEW_RESEARCH][SUCCESS ✅] ${candidate.model} | Duration: ${Date.now() - start}ms | website: ${websiteUrl ?? 'none'} | products: ${object.productsAndServices.length}`
      );

      return {
        websiteUrl,
        cultureAndValues: object.cultureAndValues,
        productsAndServices: object.productsAndServices,
      };
    } catch (error) {
      console.error(
        `[INTERVIEW_RESEARCH][FAILED ❌] ${candidate.model} | Duration: ${Date.now() - start}ms | Reason: ${(error as Error)?.message ?? 'Unknown error'}`
      );
    }
  }

  console.error('[INTERVIEW_RESEARCH][ABORT 🚨] All models failed');
  return RESEARCH_FALLBACK;
}

// ============================================================
// Web-sourced interview experiences
// ============================================================

interface ResearchExperiencesInput {
  jobTitle?: string;
  companyName?: string;
  targetRole?: string;
  jobDescription?: string;
  config?: AIConfig;
}

// Empty items is a valid result (renders an empty state), not an error.
const EXPERIENCES_FALLBACK: InterviewExperiencesResult = { items: [] };

const EXPERIENCES_STYLE_RULES = `Style rules you MUST follow:
- Only report questions and experiences that actually appear in the search results. Never invent questions, experiences, or outcomes.
- Always keep the exact source URL for every item so the candidate can read the original post.
- Report the content faithfully. Quote or closely paraphrase the questions candidates said they were asked.
- Do NOT use em dashes.
- Do NOT use semicolons.
- Do NOT use square brackets or placeholders.`;

// Grounded, web-sourced interview experiences. Two-step pass like
// researchCompany (AI SDK v4 structured helpers cannot run the multi-step
// search-tool loop): step 1 searches with the Tavily tools for real
// experiences specific to this role at this company; step 2 structures the
// brief into a single flat list of items.
export async function researchInterviewExperiences(
  input: ResearchExperiencesInput
): Promise<InterviewExperiencesResult> {
  const { jobTitle, companyName, targetRole, jobDescription, config } = input;
  const modelCandidates = getModelCandidates(config);

  const role = jobTitle || targetRole || 'this role';
  const company = companyName || 'this company';

  // Without a company we cannot honor the "role + company only" rule, so skip.
  if (!companyName) {
    console.log('[INTERVIEW_EXPERIENCES][SKIP] No company name provided');
    return EXPERIENCES_FALLBACK;
  }

  const briefSystem = `You are an interview preparation researcher. Find real interview questions and candidate interview experiences that other people have shared online.

Rules you MUST follow:
- Use the searchWeb tool to find interview questions and experiences SPECIFICALLY for the "${role}" role at "${company}". Search sites like Glassdoor, Reddit, Blind, LeetCode Discuss, Ambitionbox, and similar.
- Search ONLY for this exact role at this exact company. Do NOT broaden to a role-only search across other companies. If you find nothing specific to "${role}" at "${company}", report that no relevant experiences were found and stop.
- Collect the specific interview questions candidates said they were asked, and short narratives of their interview experience (round structure, difficulty, outcome) when available.
- For every item, keep the source website name and the exact source URL.

${EXPERIENCES_STYLE_RULES}`;

  const briefPrompt = `Role: ${role}
Company: ${company}

${jobDescription ? `Job Description (for context on the role):\n${jobDescription}\n` : ''}
Search the web for real interview questions and candidate interview experiences for the "${role}" role at "${company}". Report each item with its source website and exact URL. If nothing specific to this role at this company is found, say so.`;

  for (const candidate of modelCandidates) {
    const start = Date.now();
    try {
      console.log(`[INTERVIEW_EXPERIENCES][TRY] ${candidate.model}`);
      const aiClient = await initializeAIClient(candidate);

      // Step 1: grounded brief from web search.
      const { text: brief } = await generateText({
        model: aiClient as LanguageModelV1,
        maxRetries: 2,
        system: briefSystem,
        prompt: briefPrompt,
        tools: researchTools,
        maxSteps: 5,
      });

      // Step 2: structure the brief into a single flat list.
      const { object } = await generateObject({
        model: aiClient as LanguageModelV1,
        maxRetries: 2,
        schema: interviewExperiencesSchema,
        system: `Convert the research brief into structured data.
- items: one entry per distinct interview question or shared experience found in the brief.
  - source: the website name where it was found (e.g. "Glassdoor", "Reddit").
  - sourceUrl: the exact URL of the original post. Required.
  - roleContext: optional short context (e.g. "Backend Engineer, onsite, 2024").
  - content: the interview question(s) and/or the experience narrative, reported faithfully.
- If the brief found nothing specific to this role at this company, return an empty items array.

${EXPERIENCES_STYLE_RULES}`,
        prompt: `Role: ${role}
Company: ${company}

Research brief:
${brief}`,
      });

      // Drop items without a usable http(s) source URL.
      const items = object.items.filter(
        (i) => typeof i.sourceUrl === 'string' && i.sourceUrl.startsWith('http')
      );

      console.log(
        `[INTERVIEW_EXPERIENCES][SUCCESS ✅] ${candidate.model} | Duration: ${Date.now() - start}ms | Items: ${items.length}`
      );

      return { items };
    } catch (error) {
      console.error(
        `[INTERVIEW_EXPERIENCES][FAILED ❌] ${candidate.model} | Duration: ${Date.now() - start}ms | Reason: ${(error as Error)?.message ?? 'Unknown error'}`
      );
    }
  }

  console.error('[INTERVIEW_EXPERIENCES][ABORT 🚨] All models failed');
  return EXPERIENCES_FALLBACK;
}
