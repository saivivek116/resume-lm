import { LanguageModelV1, ToolInvocation, smoothStream, streamText } from 'ai';
import { Resume, Job } from '@/lib/types';
import { initializeAIClient, type AIConfig } from '@/utils/ai-tools';
import { tools } from '@/lib/tools';
import { AI_ASSISTANT_SYSTEM_MESSAGE } from '@/lib/prompts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolInvocation[];
}

interface ChatRequest {
  messages: Message[];
  resume: Resume;
  target_role: string;
  config?: AIConfig;
  job?: Job;
}

export async function POST(req: Request) {
  try {
    const requestBody = await req.json();
    const { messages, target_role, config, job, resume }: ChatRequest = requestBody;

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'AI configuration is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize the AI client using the provided config.
    const aiClient = await initializeAIClient(config);

    // Some models (e.g., GPT-5 family / GPT-5 Mini) only support the default temperature (1)
    const requiresDefaultTemp = ['gpt-5-mini-2025-08-07', 'gpt-5', 'gpt-5.2', 'gpt-5.2-pro'].includes(config?.model ?? '');
    
    // Gemini models support a thinking phase—explicitly disable it to avoid added latency/cost
    // For OpenRouter models, use the unified 'reasoning' parameter via providerOptions.openrouter
    const isGeminiModel = (config?.model ?? '').toLowerCase().includes('gemini-3');
    const isOpenRouterModel = (config?.model ?? '').includes('/');
    
    // Configure provider options based on model type
    type ProviderOptions = 
      | {
          openrouter: {
            reasoning: {
              exclude: boolean;
            };
          };
        }
      | {
          google: {
            thinkingConfig: {
              thinkingBudget: number;
              includeThoughts: boolean;
            };
          };
        }
      | undefined;
    
    let providerOptions: ProviderOptions = undefined;
    
    if (isGeminiModel) {
      if (isOpenRouterModel) {
        // OpenRouter models: use reasoning parameter via providerOptions.openrouter
        // Set exclude: true to disable reasoning tokens in response (model still thinks internally)
        providerOptions = {
          openrouter: {
            reasoning: {
              exclude: true,
            },
          },
        };
      } else {
        // Direct Google models: use provider-specific options
        providerOptions = {
          google: {
            thinkingConfig: {
              thinkingBudget: 0,
              includeThoughts: false,
            },
          },
        };
      }
    }

    // Use custom prompt if provided, otherwise fall back to default
    const baseSystemPrompt = config?.customPrompts?.aiAssistant 
      ?? (AI_ASSISTANT_SYSTEM_MESSAGE.content as string);
    
    // Append context-specific information to the system prompt
    const systemPrompt = `${baseSystemPrompt}

      TOOL USAGE INSTRUCTIONS:
      1. For work experience improvements:
         - Use 'suggest_work_experience_improvement' with 'index' and 'improved_experience' fields
         - Always include company, position, date, and description

      2. For project improvements:
         - Use 'suggest_project_improvement' with 'index' and 'improved_project' fields
         - Always include name and description

      3. For skill improvements:
         - Use 'suggest_skill_improvement' with 'index' and 'improved_skill' fields
         - Only use for adding new or removing existing skills
         - To add a brand-new skill category, pass index equal to the current number
           of skill categories (i.e. skills.length) — do NOT use 'modifyWholeResume' for this

      4. For education improvements:
         - Use 'suggest_education_improvement' with 'index' and 'improved_education' fields
         - Always include school, degree, field, and date

      5. For professional summary improvements:
         - Use 'suggest_professional_summary_improvement' with the 'improved_summary' field
         - Only when the user explicitly asks to change/write/improve the summary
         - Keep it a single plain-text paragraph (no markdown/bullets), 3-4 sentences, ~60-90 words

      6. For multiple section updates:
         - Use 'modifyWholeResume' when changing multiple sections at once

      IMPORTANT BEHAVIOR:
      - The user's full resume is provided below — never call a tool just to read it.
      - When improving multiple items (e.g. several work experiences or bullet points),
        emit all of the relevant suggestion tool calls together in a single response.
      - Do NOT restate the contents of a suggestion in prose; the UI already renders each
        suggestion as an interactive card. After proposing changes, stop and let the user review.

      The target role is ${target_role}. The job is ${job ? JSON.stringify(job) : 'No job specified'}.
      Current resume (JSON): ${resume ? JSON.stringify(resume) : 'No resume data'}.
      `;

    // Build and send the AI call.
    const result = streamText({
      model: aiClient as LanguageModelV1,
      ...(requiresDefaultTemp ? { temperature: 1 } : {}),
      ...(providerOptions ? { providerOptions } : {}),
      system: systemPrompt,
      messages,
      // Note: continuation/step-limiting is driven client-side by useChat's `maxSteps`
      // because these tools have no server-side `execute`. A server `maxSteps` here is a no-op.
      tools,
      experimental_transform: smoothStream({
        delayInMs: 20, // optional: defaults to 10ms
        chunking: 'word', // optional: defaults to 'word'
      }),
    });

    return result.toDataStreamResponse({
      sendUsage: false,
      getErrorMessage: error => {
        if (!error) return 'Unknown error occurred';
        if (error instanceof Error) return error.message;
        return JSON.stringify(error);
      },
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
