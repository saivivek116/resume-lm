import { LanguageModel, streamText, tool } from 'ai';
import { z } from 'zod';
import { initializeAIClient, type AIConfig } from '@/utils/ai-tools';
import { getDefaultModel } from '@/lib/ai-models';
import type { Resume } from '@/lib/types';

interface GenerateAnswerRequest {
  question: string;
  companyName: string;
  jobDescription: string;
  resume: Resume;
  config?: AIConfig;
}

const SYSTEM_PROMPT = `You are an expert job application assistant. Your task is to write a short, natural, first-person answer to a single application questionnaire question.

Rules you MUST follow:
- Answer MUST be 400 characters or fewer (count carefully).
- Write in first person, natural and professional tone.
- Use only facts from the candidate's resume for personal claims. Never invent experience.
- Use the job description to align the answer to the role.
- Call the searchWeb tool with the company name to learn about the company's products, technologies, and mission before writing your answer.
- Call the getCurrentDate tool when the question involves years of experience or time calculations.
- Write complete sentences only.
- Do NOT use em dashes.
- Do NOT use semicolons.
- Do NOT use filler phrases like "I am passionate about", "leverage synergies", "dynamic environment", or "excited to contribute".
- Do NOT use square brackets or placeholders.
- Output ONLY the answer text. No preamble, no "Answer:", no quotes.`;

export async function POST(req: Request) {
  try {
    const { question, companyName, jobDescription, resume, config }: GenerateAnswerRequest =
      await req.json();

    if (!question || !resume) {
      return new Response(JSON.stringify({ error: 'question and resume are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });

    const prompt = `Company: ${companyName}

Job Description:
${jobDescription ?? 'Not provided'}

Candidate Resume:
${JSON.stringify({
  name: `${resume.first_name} ${resume.last_name}`,
  target_role: resume.target_role,
  work_experience: resume.work_experience,
  education: resume.education,
  skills: resume.skills,
  projects: resume.projects,
  certifications: resume.certifications,
}, null, 2)}

Application Question:
${question}

Write a natural, first-person answer in 400 characters or fewer. No em dashes. No semicolons.`;

    const result = streamText({
      model: aiClient as LanguageModel,
      system: SYSTEM_PROMPT,
      prompt,
      tools: {
        getCurrentDate: tool({
          description: 'Returns today\'s date. Use when the question involves years of experience or time-based calculations.',
          parameters: z.object({}),
          execute: async () => {
            return new Date().toISOString().split('T')[0];
          },
        }),
        searchWeb: tool({
          description: 'Search the web for information about the company. Use to learn about their products, technologies, and mission.',
          parameters: z.object({
            query: z.string().describe('Search query, e.g. "Acme Corp products and technology stack"'),
          }),
          execute: async ({ query }) => {
            const apiKey = process.env.TAVILY_API_KEY;
            if (!apiKey) return 'Web search unavailable.';

            try {
              const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  api_key: apiKey,
                  query,
                  max_results: 3,
                  search_depth: 'basic',
                }),
              });
              const data = await response.json();
              const snippets = (data.results ?? [])
                .map((r: { title: string; content: string }) => `${r.title}: ${r.content}`)
                .join('\n\n');
              return snippets || 'No results found.';
            } catch {
              return 'Web search failed.';
            }
          },
        }),
      },
      maxSteps: 3,
      onFinish: ({ usage }) => {
        console.log('----------App Questions Usage:----------', usage);
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Error generating answer:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
