import { tool as createTool } from 'ai';
import { z } from 'zod';
import { bulletList, intOr, optionalOf, optionalText, stringList, textOrEmpty } from './tool-coercion';

export const suggestWorkExperienceTool = createTool({
  description:
    'Suggest changes to the bullet points of ONE work experience entry. Emit ONLY the bullets you are changing — never repeat unchanged bullets. For important keywords, format them as bold, like this: **keyword**. Put two asterisks around the keyword or phrase. Always bold quantifiable metrics (numbers, percentages, revenue/cost figures, counts of systems/microservices/components, etc.) so they stand out to recruiters.',
  parameters: z.object({
    index: intOr(0).describe('Index of the work experience entry to edit'),
    bullet_operations: z.array(z.object({
      operation: z.enum(['replace', 'add', 'remove']).catch('add'),
      index: intOr(-1).describe(
        'For "replace"/"remove": the 0-based position of the existing bullet in the CURRENT description array. For "add": -1, since added bullets are appended at the end.'
      ),
      text: textOrEmpty.describe(
        'For "replace"/"add": the new bullet text (use **keyword** for emphasis). For "remove": an empty string.'
      ),
    })).catch([]).describe('Sparse list of bullet changes. Include only bullets that change.'),
    technologies: stringList.describe(
      'Technologies to ADD to this experience, as an array of strings, e.g. ["React","Node.js"]. Return an empty array [] when there are no new technologies to add. Never list technologies the entry already has.'
    ),
  }),
});

export const suggestProjectTool = createTool({
  description: 'Suggest improvements for a specific project entry',
  parameters: z.object({
    index: intOr(0).describe('Index of the project entry to improve'),
    improved_project: z.object({
      name: textOrEmpty,
      description: bulletList,
      date: textOrEmpty,
      technologies: stringList,
      url: textOrEmpty,
      github_url: textOrEmpty,
    }).describe('Improved version of the project entry. For important keywords, format them as bold, like this: **keyword**. Put two asterisks around the keyword or phrase. Always bold quantifiable metrics (numbers, percentages, revenue/cost figures, counts of systems/microservices/components, etc.) so they stand out to recruiters.'),
  }),
});

export const suggestSkillTool = createTool({
  description: 'Suggest improvements for a specific skill category',
  parameters: z.object({
    index: intOr(0).describe(
      'Index of the skill category to improve. To ADD a brand-new category, pass an index equal to the current number of skill categories (one past the last index).'
    ),
    improved_skill: z.object({
      category: textOrEmpty,
      items: stringList,
    }).describe('The full desired state of this skill category (whether improving an existing category or adding a new one). Do not repeat items into a new category that already exist in another category.'),
  }),
});

export const suggestEducationTool = createTool({
  description: 'Suggest improvements for a specific education entry',
  parameters: z.object({
    index: intOr(0).describe('Index of the education entry to improve'),
    improved_education: z.object({
      school: textOrEmpty,
      degree: textOrEmpty,
      field: textOrEmpty,
      location: textOrEmpty,
      date: textOrEmpty,
      gpa: textOrEmpty,
      achievements: bulletList,
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
  description: 'Modify multiple sections of the resume at once. For important keywords, format them as bold, like this: **keyword**. Put two asterisks around the keyword or phrase. Always bold quantifiable metrics (numbers, percentages, revenue/cost figures, counts of systems/microservices/components, etc.) so they stand out to recruiters.',
  parameters: z.object({
    // Every section is "omit to leave unchanged" — a section that is absent (or
    // that the model mangles) must never overwrite what the resume already has.
    basic_info: optionalOf(z.object({
      first_name: optionalText,
      last_name: optionalText,
      email: optionalText,
      phone_number: optionalText,
      location: optionalText,
      website: optionalText,
      linkedin_url: optionalText,
      github_url: optionalText,
    })),
    work_experience: optionalOf(z.array(z.object({
      company: textOrEmpty,
      position: textOrEmpty,
      location: optionalText,
      date: textOrEmpty,
      description: bulletList,
      technologies: stringList,
    }))),
    education: optionalOf(z.array(z.object({
      school: textOrEmpty,
      degree: textOrEmpty,
      field: textOrEmpty,
      location: optionalText,
      date: textOrEmpty,
      gpa: optionalText,
      achievements: bulletList,
    }))),
    skills: optionalOf(z.array(z.object({
      category: textOrEmpty,
      items: stringList,
    }))),
    projects: optionalOf(z.array(z.object({
      name: textOrEmpty,
      description: bulletList,
      date: optionalText,
      technologies: stringList,
      url: optionalText,
      github_url: optionalText,
    }))),
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