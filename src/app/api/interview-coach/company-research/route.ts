import { LanguageModel, streamText, tool } from 'ai';
import { z } from 'zod';
import { initializeAIClient, type AIConfig } from '@/utils/ai-tools';
import { getDefaultModel } from '@/lib/ai-models';

interface CompanyResearchRequest {
  companyName: string;
  jobDescription?: string;
  jobUrl?: string | null;
  config?: AIConfig;
}

const SYSTEM_PROMPT = `You are an interview preparation researcher. Your task is to write a concise, factual profile of a company's culture and values to help a candidate prepare for an interview.

Rules you MUST follow:
- Call the searchWeb tool with the company name to learn about their mission, products, culture, values, and how they describe their work environment before writing.
- Write 3 to 5 short sentences summarizing the company's culture, values, and what they appear to care about in the people they hire.
- Ground every claim in what the search results actually say. If research is unavailable, write a brief neutral summary based only on the job description and say the culture details could not be verified.
- Write in the third person about the company. Do not address the candidate.
- Do NOT use em dashes.
- Do NOT use semicolons.
- Do NOT use filler phrases like "dynamic environment", "fast-paced", "leverage synergies", "cutting-edge", or "passionate".
- Do NOT use square brackets or placeholders.
- Output ONLY the summary text. No preamble, no headings, no "Summary:", no quotes.`;

export async function POST(req: Request) {
  try {
    const { companyName, jobDescription, jobUrl, config }: CompanyResearchRequest =
      await req.json();

    if (!companyName) {
      return new Response(JSON.stringify({ error: 'companyName is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });

    const prompt = `Company: ${companyName}
${jobUrl ? `Job posting URL: ${jobUrl}` : ''}

Job Description:
${jobDescription ?? 'Not provided'}

Research this company and write a concise culture and values summary for interview preparation. No em dashes. No semicolons.`;

    const result = streamText({
      model: aiClient as LanguageModel,
      system: SYSTEM_PROMPT,
      prompt,
      tools: {
        getCurrentDate: tool({
          description: 'Returns today\'s date. Use when reasoning about recent company news or timelines.',
          parameters: z.object({}),
          execute: async () => {
            return new Date().toISOString().split('T')[0];
          },
        }),
        searchWeb: tool({
          description: 'Search the web for information about the company. Use to learn about their culture, values, mission, products, and work environment.',
          parameters: z.object({
            query: z.string().describe('Search query, e.g. "Acme Corp company culture and values"'),
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
        console.log('----------Interview Coach Company Research Usage:----------', usage);
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Error researching company:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
