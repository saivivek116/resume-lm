import { z } from "zod";

// Base schemas for reusable components
export const workExperienceSchema = z.object({
  company: z.string(),
  position: z.string(),
  location: z.string(),
  date: z.string(),
  description: z.array(z.string()),
  technologies: z.array(z.string()),
});

export const educationSchema = z.object({
  school: z.string(),
  degree: z.string(),
  field: z.string(),
  location: z.string(),
  date: z.string(),
  gpa: z.string(),
  achievements: z.array(z.string()),
});

export const projectSchema = z.object({
  name: z.string(),
  description: z.array(z.string()),
  date: z.string(),
  technologies: z.array(z.string()),
  url: z.string(),
  github_url: z.string(),
});

export const skillSchema = z.object({
  category: z.string(),
  items: z.array(z.string()),
});


// Schema for text import functionality
export const textImportSchema = z.object({
  // Basic Information
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().nullable(),
  phone_number: z.string().nullable(),
  location: z.string().nullable(),
  website: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  github_url: z.string().nullable(),

  // Resume Sections
  work_experience: z.array(z.object({
    company: z.string(),
    position: z.string(),
    date: z.string(),
    description: z.array(z.string()),
    technologies: z.array(z.string()).nullable(),
    location: z.string().nullable(),
  })).nullable(),
  education: z.array(z.object({
    school: z.string(),
    degree: z.string(),
    field: z.string().nullable(),
    date: z.string().nullable(),
    description: z.array(z.string()).nullable(),
    gpa: z.string().nullable(),
    location: z.string().nullable(),
    achievements: z.array(z.string()).nullable(),
  })).nullable(),
  skills: z.array(z.object({
    category: z.string(),
    items: z.array(z.string()),
  })).nullable(),
  projects: z.array(z.object({
    name: z.string(),
    description: z.array(z.string()),
    technologies: z.array(z.string()).nullable(),
    date: z.string().nullable(),
    url: z.string().nullable(),
    github_url: z.string().nullable(),
  })).nullable(),
});

export const documentSettingsSchema = z.object({
  // Global Settings
  document_font_size: z.number(),
  document_line_height: z.number(),
  document_margin_vertical: z.number(),
  document_margin_horizontal: z.number(),

  // Header Settings
  header_name_size: z.number(),
  header_name_bottom_spacing: z.number(),

  // Skills Section
  skills_margin_top: z.number(),
  skills_margin_bottom: z.number(),
  skills_margin_horizontal: z.number(),
  skills_item_spacing: z.number(),

  // Experience Section
  experience_margin_top: z.number(),
  experience_margin_bottom: z.number(),
  experience_margin_horizontal: z.number(),
  experience_item_spacing: z.number(),

  // Projects Section
  projects_margin_top: z.number(),
  projects_margin_bottom: z.number(),
  projects_margin_horizontal: z.number(),
  projects_item_spacing: z.number(),

  // Education Section
  education_margin_top: z.number(),
  education_margin_bottom: z.number(),
  education_margin_horizontal: z.number(),
  education_item_spacing: z.number(),
});

export const coverLetterDocumentSettingsSchema = z.object({
  font_size: z.number(),
  line_height: z.number(),
  margin_vertical: z.number(),
  margin_horizontal: z.number(),
  header_name_size: z.number(),
  paragraph_spacing: z.number(),
});

export const coverLetterDataSchema = z.object({
  content: z.string(),
  lastUpdated: z.string().optional(),
  document_settings: coverLetterDocumentSettingsSchema.optional(),
});

export const sectionConfigSchema = z.object({
  visible: z.boolean(),
  max_items: z.number().nullable().optional(),
  style: z.enum(['grouped', 'list', 'grid']).optional(),
});

// Main Resume Schema
export const resumeSchema = z.object({
//   id: z.string().uuid(),
//   user_id: z.string().uuid(),
  name: z.string(),
  target_role: z.string(),
//   is_base_resume: z.boolean(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  phone_number: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url().optional(),
  linkedin_url: z.string().url().optional(),
  github_url: z.string().url().optional(),
  work_experience: z.array(workExperienceSchema).optional(),
  education: z.array(educationSchema).optional(),
  skills: z.array(skillSchema).optional(),
  projects: z.array(projectSchema).optional(),

//   created_at: z.string().datetime(),
//   updated_at: z.string().datetime(),
//   document_settings: documentSettingsSchema.optional(),
//   section_order: z.array(z.string()).optional(),
//   section_configs: z.record(sectionConfigSchema).optional(),
  has_cover_letter: z.boolean().default(false),
  cover_letter: coverLetterDataSchema.nullable().optional(),
});

// Type inference helpers
export type Resume = z.infer<typeof resumeSchema>;
export type WorkExperience = z.infer<typeof workExperienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type DocumentSettings = z.infer<typeof documentSettingsSchema>;
export type SectionConfig = z.infer<typeof sectionConfigSchema>;


// Jobs schema
export const jobSchema = z.object({
  id: z.string().uuid(),
  company_name: z.string().optional(),
  position_title: z.string().optional(),
  job_url: z.string().url().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  salary_range: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  keywords: z.array(z.string()).default([]),
  work_location: z.enum(['remote', 'in_person', 'hybrid']).nullable(),
  employment_type: z.preprocess(
    (val) => val === null || val === '' ? 'full_time' : val,
    z.enum(['full_time', 'part_time', 'co_op', 'internship', 'contract']).default('full_time')
  ).optional(),
  is_active: z.boolean().default(true),
});

export const simplifiedJobSchema = z.object({
    company_name: z.string(),
    position_title: z.string(),
    job_url: z.string().nullable(),
    description: z.string().nullable(),
    location: z.string().nullable(),
    salary_range: z.string().nullable(),
    keywords: z.array(z.string()),
    work_location: z.enum(['remote', 'in_person', 'hybrid']).nullable(),
    employment_type: z.enum(['full_time', 'part_time', 'co_op', 'internship', 'contract']),
    is_active: z.boolean(),
  });
  
export const simplifiedResumeSchema = z.object({
    work_experience: z.array(workExperienceSchema),
    education: z.array(educationSchema),
    skills: z.array(skillSchema),
    projects: z.array(projectSchema),
    target_role: z.string()
  });

// Add type inference helper
export type Job = {
  id?: string;
  company_name?: string;
  position_title?: string;
  job_url?: string | null;
  description?: string | null;
  location?: string | null;
  salary_range?: string | null;
  created_at?: string;
  updated_at?: string;
  keywords?: string[];
  work_location?: 'remote' | 'in_person' | 'hybrid' | null;
  employment_type?: 'full_time' | 'part_time' | 'co_op' | 'internship' | 'contract';
  is_active?: boolean;
};
export type SalaryRange = string | null;

// Work Experience Bullet Points Analysis Schema
export const workExperienceBulletPointsSchema = z.object({
  points: z.array(z.string().describe("A bullet point describing a work achievement or responsibility")),
  analysis: z.object({
    impact_score: z.number().min(1).max(10).describe("Score indicating the overall impact of these achievements (1-10)"),
    improvement_suggestions: z.array(z.string().describe("A suggestion for improvement"))
  }).optional()
});

// Project Analysis Schema
export const projectAnalysisSchema = z.object({
  points: z.array(z.string().describe("A bullet point describing a project achievement or feature")),
  analysis: z.object({
    impact_score: z.number().min(1).max(10).describe("Score indicating the overall impact of these achievements (1-10)"),
    improvement_suggestions: z.array(z.string().describe("A suggestion for improvement"))
  }).optional()
});

// Work Experience Items Schema
export const workExperienceItemsSchema = z.object({
  work_experience_items: z.array(z.object({
    company: z.string().describe("The name of the company where the work experience took place"),
    position: z.string().describe("The job title or position held during the work experience"),
    location: z.string().describe("The location of the company"),
    date: z.string().describe("The date or period during which the work experience occurred"),
    description: z.array(z.string()).describe("A list of responsibilities and achievements during the work experience"),
    technologies: z.array(z.string()).describe("A list of technologies used during the work experience")
  }))
});

// Add type inference helpers for new schemas
export type WorkExperienceBulletPoints = z.infer<typeof workExperienceBulletPointsSchema>;
export type ProjectAnalysis = z.infer<typeof projectAnalysisSchema>;
export type WorkExperienceItems = z.infer<typeof workExperienceItemsSchema>;

// Add to existing zod schemas in this file
export const resumeScoreSchema = z.object({
  overallScore: z.object({
    score: z.number().min(0).max(100),
    reason: z.string()
  }),
  completeness: z.object({
    contactInformation: z.object({
      score: z.number().min(0).max(100),
      reason: z.string()
    }),
    detailLevel: z.object({
      score: z.number().min(0).max(100),
      reason: z.string()
    })
  }),
  impactScore: z.object({
    activeVoiceUsage: z.object({
      score: z.number().min(0).max(100),
      reason: z.string()
    }),
    quantifiedAchievements: z.object({
      score: z.number().min(0).max(100),
      reason: z.string()
    })
  }),
  roleMatch: z.object({
    skillsRelevance: z.object({
      score: z.number().min(0).max(100),
      reason: z.string()
    }),
    experienceAlignment: z.object({
      score: z.number().min(0).max(100),
      reason: z.string()
    }),
    educationFit: z.object({
      score: z.number().min(0).max(100),
      reason: z.string()
    })
  }),
  // Job-specific scoring for tailored resumes
  jobAlignment: z.object({
    keywordMatch: z.object({
      score: z.number().min(0).max(100),
      reason: z.string(),
      matchedKeywords: z.array(z.string()),
      missingKeywords: z.array(z.string())
    }),
    requirementsMatch: z.object({
      score: z.number().min(0).max(100),
      reason: z.string(),
      matchedRequirements: z.array(z.string()),
      gapAnalysis: z.array(z.string())
    }),
    companyFit: z.object({
      score: z.number().min(0).max(100),
      reason: z.string(),
      suggestions: z.array(z.string())
    })
  }).nullable(),
  miscellaneous: z.record(
    z.union([z.number(), z.object({
      score: z.number().min(0).max(100),
      reason: z.string()
    })])
  ).nullable(),
  overallImprovements: z.array(z.string()),
  // Job-specific improvements for tailored resumes
  jobSpecificImprovements: z.array(z.string()),
  isTailoredResume: z.boolean()
});

export type ResumeScoreMetrics = z.infer<typeof resumeScoreSchema>; 