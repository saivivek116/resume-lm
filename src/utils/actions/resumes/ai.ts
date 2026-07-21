'use server';

// import { RESUME_IMPORTER_SYSTEM_MESSAGE, } from "@/lib/prompts";
import { Profile, Resume } from "@/lib/types";
import { bulletImpactSortSchema, textImportSchema, workExperienceBulletPointsSchema } from "@/lib/zod-schemas";
import { generateObject, generateText, type LanguageModelV1 } from "ai";
import { z } from "zod";
import { initializeAIClient, type AIConfig } from '@/utils/ai-tools';
import { getDefaultModel } from "@/lib/ai-models";
import { BULLET_IMPACT_SORTER_MESSAGE, PROFESSIONAL_SUMMARY_GENERATOR_MESSAGE, PROJECT_GENERATOR_MESSAGE, PROJECT_IMPROVER_MESSAGE, TEXT_ANALYZER_SYSTEM_MESSAGE, WORK_EXPERIENCE_GENERATOR_MESSAGE, WORK_EXPERIENCE_IMPROVER_MESSAGE } from "@/lib/prompts";
import { projectAnalysisSchema, workExperienceItemsSchema } from "@/lib/zod-schemas";
import { normalizeDescriptions } from "@/lib/resume-normalization";
import { WorkExperience } from "@/lib/types";





// Base Resume Creation
// TEXT CONTENT -> RESUME
export async function convertTextToResume(prompt: string, existingResume: Resume, targetRole: string, config?: AIConfig) {
  const fallbackModel = getDefaultModel();
  const resolvedConfig: AIConfig = {
    model: config?.model || fallbackModel,
    ...(config?.customPrompts ? { customPrompts: config.customPrompts } : {})
  };

  let aiClient: LanguageModelV1;
  try {
    aiClient = await initializeAIClient(resolvedConfig);
  } catch (error) {
    if (resolvedConfig.model !== fallbackModel) {
      console.warn(`Falling back to default model (${fallbackModel}) after failing to init ${resolvedConfig.model}:`, error);
      aiClient = await initializeAIClient(
        { ...resolvedConfig, model: fallbackModel }
      );
    } else {
      throw error;
    }
  }
  
  const { object } = await generateObject({
    model: aiClient,
    schema: z.object({
      content: textImportSchema
    }),
    system: `You are ResumeFormatter, an expert system specialized in analyzing complete resumes and converting them into a structured JSON object tailored for targeted job applications.

        Your task is to transform the complete resume text into a JSON object according to the provided schema. You will identify and extract the most relevant experiences, skills, projects, and educational background based on the target role. While doing so, you are allowed to make minimal formatting changes only to enhance clarity and highlight relevance—**do not reword, summarize, or alter the core details of any content.**

        CRITICAL DIRECTIVES:
        1. **Analysis & Selection:**
          - Analyze the full resume text that includes all user experiences, skills, projects, and education.
          - Identify the items that best match the target role: ${targetRole}.
          - Always include the education section:
            - If only one educational entry exists, include it.
            - If multiple entries exist, select the one(s) most relevant to the target role.

        2. **Formatting & Emphasis:**
          - Transform the resume into a JSON object following the schema, with sections such as basic information, professional experience, projects, skills, and education.
          - Preserve all original details, dates, and descriptions. Only modify the text for formatting purposes.
          - **Enhance relevance by marking keywords** within work experience descriptions, project details, achievements, and education details with bold formatting (i.e., wrap them with two asterisks like **this**). Apply this only to keywords or phrases that are highly relevant to the target role.
          - Do not add any formatting to section titles or headers.
          - Use empty arrays ([]) for any sections that do not contain relevant items.

        3. **Description Fields Must Be Arrays:**
          - Every 'description' field in work_experience, projects, and education MUST be a JSON array of strings, never a single string.
          - If there is only one sentence or bullet for a section, still wrap it as an array with one element, e.g. ["Single bullet here."].
          - Education example: "description": ["Computer Science & Engineering (Data Science)"].

        4. **Output Requirements:**
          - The final output must be a valid JSON object that adheres to the specified schema.
          - Include only the most relevant items, optimized for the target role.
          - Do not add any new information or rephrase the provided content—only apply minor formatting (like bolding) to emphasize key points.
        `,
    prompt: `INPUT:
    Extract and transform the resume information from the following text:
    ${prompt}
    Now, format this information into the JSON object according to the schema, ensuring it is optimized for the target role: ${targetRole}.`,
  });

  const normalizedContent = normalizeDescriptions(object.content);

  const updatedResume = {
    ...existingResume,
    ...(normalizedContent.first_name && { first_name: normalizedContent.first_name }),
    ...(normalizedContent.last_name && { last_name: normalizedContent.last_name }),
    ...(normalizedContent.email && { email: normalizedContent.email }),
    ...(normalizedContent.phone_number && { phone_number: normalizedContent.phone_number }),
    ...(normalizedContent.location && { location: normalizedContent.location }),
    ...(normalizedContent.website && { website: normalizedContent.website }),
    ...(normalizedContent.linkedin_url && { linkedin_url: normalizedContent.linkedin_url }),
    ...(normalizedContent.github_url && { github_url: normalizedContent.github_url }),
    
    work_experience: [...existingResume.work_experience, ...(normalizedContent.work_experience || [])],
    education: [...existingResume.education, ...(normalizedContent.education || [])],
    skills: [...existingResume.skills, ...(normalizedContent.skills || [])],
    projects: [...existingResume.projects, ...(normalizedContent.projects || [])],
  };

  
  return updatedResume;
}



    // NEW WORK EXPERIENCE BULLET POINTS
    export async function generateWorkExperiencePoints(
      position: string,
      company: string,
      technologies: string[],
      targetRole: string,
      numPoints: number = 3,
      customPrompt: string = '',
      config?: AIConfig
    ) {
      const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });
  
      // Use custom prompt if provided in config, otherwise fall back to default
      const systemPrompt = config?.customPrompts?.workExperienceGenerator 
        ?? (WORK_EXPERIENCE_GENERATOR_MESSAGE.content as string);

      const { object } = await generateObject({
        model: aiClient,
        schema: z.object({
          content: workExperienceBulletPointsSchema
        }),
      prompt: `Position: ${position}
      Company: ${company}
      Technologies: ${technologies.join(', ')}
      Target Role: ${targetRole}
      Number of Points: ${numPoints}${customPrompt ? `\nCustom Focus: ${customPrompt}` : ''}`,
        system: systemPrompt,
      });

      return object.content;
      }
    
      // WORK EXPERIENCE BULLET POINTS IMPROVEMENT
      export async function improveWorkExperience(point: string, customPrompt?: string, config?: AIConfig) {
          const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });
          
          // Use custom prompt if provided in config, otherwise fall back to default
          const systemPrompt = config?.customPrompts?.workExperienceImprover 
            ?? (WORK_EXPERIENCE_IMPROVER_MESSAGE.content as string);

          const { object } = await generateObject({
          model: aiClient,
          
          schema: z.object({
              content: z.string().describe("The improved work experience bullet point")
          }),
          prompt: `Please improve this work experience bullet point while maintaining its core message and truthfulness${customPrompt ? `. Additional requirements: ${customPrompt}` : ''}:\n\n"${point}"`,
          system: systemPrompt,
          });
      

          return object.content;
      }
    
      // PROJECT BULLET POINTS IMPROVEMENT
      export async function improveProject(point: string, customPrompt?: string, config?: AIConfig) {
          const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });

          // Use custom prompt if provided in config, otherwise fall back to default
          const systemPrompt = config?.customPrompts?.projectImprover 
            ?? (PROJECT_IMPROVER_MESSAGE.content as string);
  
          const { object } = await generateObject({
          model: aiClient,
          schema: z.object({
              content: z.string().describe("The improved project bullet point")
          }),
          prompt: `Please improve this project bullet point while maintaining its core message and truthfulness${customPrompt ? `. Additional requirements: ${customPrompt}` : ''}:\n\n"${point}"`,
          system: systemPrompt,
          });
      
          return object.content;
      }
      
      // NEW PROJECT BULLET POINTS
      export async function generateProjectPoints(
          projectName: string,
          technologies: string[],
          targetRole: string,
          numPoints: number = 3,
          customPrompt: string = '',
          config?: AIConfig
      ) {
          const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });

          // Use custom prompt if provided in config, otherwise fall back to default
          const systemPrompt = config?.customPrompts?.projectGenerator 
            ?? (PROJECT_GENERATOR_MESSAGE.content as string);

          const { object } = await generateObject({
          model: aiClient,
          schema: z.object({
              content: projectAnalysisSchema
          }),
          prompt: `Project Name: ${projectName}
      Technologies: ${technologies.join(', ')}
      Target Role: ${targetRole}
      Number of Points: ${numPoints}${customPrompt ? `\nCustom Focus: ${customPrompt}` : ''}`,
          system: systemPrompt,
          });
      
          return object.content;
      }
      
      // Text Import for profile
      export async function processTextImport(text: string, config?: AIConfig) {
          const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });
          
          // Use custom prompt if provided in config, otherwise fall back to default
          const systemPrompt = config?.customPrompts?.textAnalyzer 
            ?? (TEXT_ANALYZER_SYSTEM_MESSAGE.content as string);

          const { object } = await generateObject({
          model: aiClient,
          schema: z.object({
              content: textImportSchema
          }),
          prompt: text,
          system: systemPrompt,
          });

      
          return normalizeDescriptions(object.content);
      }
      
      // WORK EXPERIENCE MODIFICATION
      export async function modifyWorkExperience(
          experience: WorkExperience[],
          prompt: string,
          config?: AIConfig
      ) {
          const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });

          const { object } = await generateObject({
          model: aiClient,
          schema: z.object({
              content: workExperienceItemsSchema
          }),
          prompt: `Please modify this work experience entry according to these instructions: ${prompt}\n\nCurrent work experience:\n${JSON.stringify(experience, null, 2)}`,
          system: `You are a professional resume writer. Modify the given work experience based on the user's instructions. 
          Maintain professionalism and accuracy while implementing the requested changes. 
          Keep the same company and dates, but modify other fields as requested.
          Use strong action verbs and quantifiable achievements where possible.`,
          });
      
          return object.content;
      }
      
      // ADDING TEXT CONTENT TO RESUME
      export async function addTextToResume(prompt: string, existingResume: Resume, config?: AIConfig) {
          const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });

          // Use custom prompt if provided in config, otherwise fall back to default
          const systemPrompt = config?.customPrompts?.textAnalyzer 
            ?? (TEXT_ANALYZER_SYSTEM_MESSAGE.content as string);
          
          const { object } = await generateObject({
          model: aiClient,
          schema: z.object({
              content: textImportSchema
          }),
          prompt: `Extract relevant resume information from the following text, including basic information (name, contact details, etc) and professional experience. Format them according to the schema:\n\n${prompt}`,
          system: systemPrompt,
          });

          const normalizedAddContent = normalizeDescriptions(object.content);

          // Merge the AI-generated content with existing resume data
          const updatedResume = {
          ...existingResume,
          ...(normalizedAddContent.first_name && { first_name: normalizedAddContent.first_name }),
          ...(normalizedAddContent.last_name && { last_name: normalizedAddContent.last_name }),
          ...(normalizedAddContent.email && { email: normalizedAddContent.email }),
          ...(normalizedAddContent.phone_number && { phone_number: normalizedAddContent.phone_number }),
          ...(normalizedAddContent.location && { location: normalizedAddContent.location }),
          ...(normalizedAddContent.website && { website: normalizedAddContent.website }),
          ...(normalizedAddContent.linkedin_url && { linkedin_url: normalizedAddContent.linkedin_url }),
          ...(normalizedAddContent.github_url && { github_url: normalizedAddContent.github_url }),
          
          work_experience: [...existingResume.work_experience, ...(normalizedAddContent.work_experience || [])],
          education: [...existingResume.education, ...(normalizedAddContent.education || [])],
          skills: [...existingResume.skills, ...(normalizedAddContent.skills || [])],
          projects: [...existingResume.projects, ...(normalizedAddContent.projects || [])],
          };

          return updatedResume;
      }

// SORT BULLETS BY IMPACT
// Returns a permutation of original bullet indices, ordered from highest to
// lowest impact. The caller reorders the array client-side; bullet text is
// never modified by the model.
export async function sortBulletsByImpact(
  bullets: string[],
  context: { role?: string; targetRole?: string; company?: string; projectName?: string },
  config?: AIConfig
) {
  const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });

  const numbered = bullets.map((b, i) => `[${i}] ${b}`).join('\n');
  const ctxLine = [
    context.role && `Role: ${context.role}`,
    context.company && `Company: ${context.company}`,
    context.projectName && `Project: ${context.projectName}`,
    context.targetRole && `Target role: ${context.targetRole}`,
  ].filter(Boolean).join(' | ');

  const { object } = await generateObject({
    model: aiClient,
    schema: bulletImpactSortSchema,
    system: BULLET_IMPACT_SORTER_MESSAGE.content as string,
    prompt: `${ctxLine ? ctxLine + '\n\n' : ''}Bullets (do not modify text — return indices only):\n${numbered}`,
  });

  // Validate it's a true permutation; if the model returns a malformed list,
  // fall back to the original order so the UI never crashes or loses bullets.
  const n = bullets.length;
  const indices = object.sortedIndices ?? [];
  const valid =
    indices.length === n &&
    new Set(indices).size === n &&
    indices.every((i) => Number.isInteger(i) && i >= 0 && i < n);

  return {
    sortedIndices: valid ? indices : bullets.map((_, i) => i),
    reasoning: object.reasoning,
  };
}

// PROFESSIONAL SUMMARY GENERATION (used at tailored-resume creation)
// Returns a 3-4 sentence summary paragraph that opens with
// "<position_title> with 5+ years of experience" and is aligned to the JD.
export async function generateProfessionalSummary(
  params: {
    profile: Pick<
      Profile,
      'work_experience' | 'skills' | 'projects' | 'education' | 'certifications'
    >;
    job: {
      position_title: string;
      company_name?: string | null;
      description?: string | null;
      keywords?: string[] | null;
    };
  },
  config?: AIConfig
): Promise<string> {
  const aiClient = await initializeAIClient(config ?? { model: getDefaultModel() });

  const opener = `${params.job.position_title} with 5+ years of experience`;

  const profileBlob = JSON.stringify(
    {
      work_experience: params.profile.work_experience,
      skills: params.profile.skills,
      projects: params.profile.projects,
      certifications: params.profile.certifications,
    },
    null,
    2
  );

  const jobBlob = [
    `Position: ${params.job.position_title}`,
    params.job.company_name ? `Company: ${params.job.company_name}` : '',
    params.job.keywords && params.job.keywords.length
      ? `Keywords: ${params.job.keywords.join(', ')}`
      : '',
    params.job.description ? `Description:\n${params.job.description}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const { text } = await generateText({
    model: aiClient,
    system: PROFESSIONAL_SUMMARY_GENERATOR_MESSAGE.content as string,
    prompt: `REQUIRED OPENER (use VERBATIM as the start of the first sentence):
"${opener}"

CANDIDATE PROFILE (source of truth — only reference skills/experience present here):
${profileBlob}

TARGET JOB:
${jobBlob}

Write the professional summary paragraph now. 3-4 sentences, 60-90 words, plain text only.`,
  });

  return text.trim();
}
