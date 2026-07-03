import { tool as createTool } from 'ai';
import { z } from 'zod';

export const suggestWorkExperienceTool = createTool({
  description:
    'Suggest changes to the bullet points of ONE work experience entry. Emit ONLY the bullets you are changing — never repeat unchanged bullets. For important keywords, format them as bold, like this: **keyword**. Put two asterisks around the keyword or phrase.',
  parameters: z.object({
    index: z.number().describe('Index of the work experience entry to edit'),
    bullet_operations: z.array(z.object({
      operation: z.enum(['replace', 'add', 'remove']),
      index: z.number().nullable().describe(
        'For replace/remove: the 0-based index of the existing bullet in the CURRENT description array. null for add.'
      ),
      text: z.string().nullable().describe(
        'For replace/add: the new bullet text (use **keyword** for emphasis). null for remove.'
      ),
    })).describe('Sparse list of bullet changes. Include only bullets that change.'),
    technologies: z.array(z.string()).nullable().describe(
      'Provide the full technologies list ONLY when it changes; otherwise null.'
    ),
  }),
});

export const suggestProjectTool = createTool({
  description: 'Suggest improvements for a specific project entry',
  parameters: z.object({
    index: z.number().describe('Index of the project entry to improve'),
    improved_project: z.object({
      name: z.string(),
      description: z.array(z.string()),
      date: z.string().nullable(),
      technologies: z.array(z.string()),
      url: z.string().nullable(),
      github_url: z.string().nullable(),
    }).describe('Improved version of the project entry. For important keywords, format them as bold, like this: **keyword**. Put two asterisks around the keyword or phrase.'),
  }),
});

export const suggestSkillTool = createTool({
  description: 'Suggest improvements for a specific skill category',
  parameters: z.object({
    index: z.number().describe('Index of the skill category to improve'),
    improved_skill: z.object({
      category: z.string(),
      items: z.array(z.string()),
    }).describe('Improved version of the skill category. ONLY use this tool to add NEW skills or REMOVE existing skills, DO NOT ADD IN EXISTING SKILLS IN ANY WAY.'),
  }),
});

export const suggestEducationTool = createTool({
  description: 'Suggest improvements for a specific education entry',
  parameters: z.object({
    index: z.number().describe('Index of the education entry to improve'),
    improved_education: z.object({
      school: z.string(),
      degree: z.string(),
      field: z.string(),
      location: z.string().nullable(),
      date: z.string(),
      gpa: z.string().nullable(),
      achievements: z.array(z.string()),
    }).describe('Improved version of the education entry. For important keywords, format them as bold, like this: **keyword**. Put two asterisks around the keyword or phrase.'),
  }),
});

export const suggestProfessionalSummaryTool = createTool({
  description: 'Suggest an improved professional summary based on the user\'s request. Only use this when the user explicitly asks to change, write, or improve their professional summary.',
  parameters: z.object({
    improved_summary: z.string().describe(
      'Improved professional summary as a single plain-text paragraph (no markdown, no bullet points, no headings, no bold). 3 to 4 sentences, target 60 to 90 words.'
    ),
  }),
});

export const modifyWholeResumeTool = createTool({
  description: 'Modify multiple sections of the resume at once. For important keywords, format them as bold, like this: **keyword**. Put two asterisks around the keyword or phrase.',
  parameters: z.object({
    basic_info: z.object({
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
      email: z.string().nullable(),
      phone_number: z.string().nullable(),
      location: z.string().nullable(),
      website: z.string().nullable(),
      linkedin_url: z.string().nullable(),
      github_url: z.string().nullable(),
    }).nullable(),
    work_experience: z.array(z.object({
      company: z.string(),
      position: z.string(),
      location: z.string().nullable(),
      date: z.string(),
      description: z.array(z.string()),
      technologies: z.array(z.string()),
    })).nullable(),
    education: z.array(z.object({
      school: z.string(),
      degree: z.string(),
      field: z.string(),
      location: z.string().nullable(),
      date: z.string(),
      gpa: z.string().nullable(),
      achievements: z.array(z.string()),
    })).nullable(),
    skills: z.array(z.object({
      category: z.string(),
      items: z.array(z.string()),
    })).nullable(),
    projects: z.array(z.object({
      name: z.string(),
      description: z.array(z.string()),
      date: z.string().nullable(),
      technologies: z.array(z.string()),
      url: z.string().nullable(),
      github_url: z.string().nullable(),
    })).nullable(),
  }),
});



  

// Export all tools in a single object for convenience
export const tools = {
  suggest_work_experience_improvement: suggestWorkExperienceTool,
  suggest_project_improvement: suggestProjectTool,
  suggest_skill_improvement: suggestSkillTool,
  suggest_education_improvement: suggestEducationTool,
  suggest_professional_summary_improvement: suggestProfessionalSummaryTool,
  modifyWholeResume: modifyWholeResumeTool,

}; 