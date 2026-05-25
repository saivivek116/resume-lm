export interface WorkExperience {
  company: string;
  position: string;
  location?: string;
  date: string;
  description: string[];
  technologies?: string[];
}

export interface Education {
  school: string;
  degree: string;
  field: string;
  location?: string;
  date: string;
  gpa?: number | string;
  achievements?: string[];
}

export interface Project {
  name: string;
  description: string[];
  date?: string;
  technologies?: string[];
  url?: string;
  github_url?: string;
}

export interface Skill {
  category: string;
  items: string[];
}

export interface Certification {
  name: string;
  url: string;
}

export type ResumeSectionId =
  | 'skills'
  | 'work_experience'
  | 'projects'
  | 'education'
  | 'certifications';

export const DEFAULT_SECTION_ORDER: ResumeSectionId[] = [
  'skills',
  'work_experience',
  'projects',
  'education',
  'certifications',
];

export const SECTION_LABELS: Record<ResumeSectionId, string> = {
  skills: 'Skills',
  work_experience: 'Work Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
};

export interface CustomPrompts {
  aiAssistant?: string;
  workExperienceGenerator?: string;
  workExperienceImprover?: string;
  projectGenerator?: string;
  projectImprover?: string;
  textAnalyzer?: string;
  resumeFormatter?: string;
}




export interface ApplicationQuestion {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export interface TheirStackMetadata {
  seniority: string | null;
  company_domain: string | null;
  company_logo: string | null;
  company_industry: string | null;
  company_linkedin_url: string | null;
  technology_slugs: string[];
  date_posted: string | null;
  discovered_at: string | null;
  closed_at: string | null;
  min_annual_salary_usd: number | null;
  max_annual_salary_usd: number | null;
  avg_annual_salary_usd: number | null;
  country_code: string | null;
  easy_apply: boolean | null;
  reposted: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface Job {
  id: string;
  user_id: string;
  company_name: string;
  position_title: string;
  job_url: string | null;
  description: string | null;
  location: string | null;
  salary_range: string | null;
  keywords: string[];
  work_location: 'remote' | 'in_person' | 'hybrid' | null;
  employment_type: 'full_time' | 'part_time' | 'co_op' | 'internship' | 'contract' | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  application_questions: ApplicationQuestion[];
  source?: 'manual' | 'theirstack';
  theirstack_id?: number | null;
  theirstack_metadata?: TheirStackMetadata | null;
}

export interface SectionConfig {
  visible: boolean;
  max_items?: number | null;
  style?: 'grouped' | 'list' | 'grid';
}

export interface Resume {
  id: string;
  user_id: string;
  job_id?: string | null;
  name: string;
  target_role: string;
  is_base_resume: boolean;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  location?: string;
  website?: string;
  linkedin_url?: string;
  github_url?: string;
  work_experience: WorkExperience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
  certifications: Certification[];
  created_at: string;
  updated_at: string;
  document_settings?: DocumentSettings;
  section_order?: ResumeSectionId[];
  section_configs?: {
    [key: string]: { visible: boolean };
  };
  has_cover_letter: boolean;
  cover_letter?: CoverLetterData | null;
}

export interface ResumeSummary {
  id: string;
  user_id: string;
  job_id?: string | null;
  name: string;
  target_role: string;
  is_base_resume: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentSettings {
  // Global Settings
  document_font_size: number;
  document_line_height: number;
  document_margin_vertical: number;
  document_margin_horizontal: number;

  // Header Settings
  header_name_size: number;
  header_name_bottom_spacing: number;

  // Skills Section
  skills_margin_top: number;
  skills_margin_bottom: number;
  skills_margin_horizontal: number;
  skills_item_spacing: number;

  // Experience Section
  experience_margin_top: number;
  experience_margin_bottom: number;
  experience_margin_horizontal: number;
  experience_item_spacing: number;

  // Projects Section
  projects_margin_top: number;
  projects_margin_bottom: number;
  projects_margin_horizontal: number;
  projects_item_spacing: number;

  // Education Section
  education_margin_top: number;
  education_margin_bottom: number;
  education_margin_horizontal: number;
  education_item_spacing: number;

  show_ubc_footer?: boolean;
  footer_width?: number; // Percentage width of the footer
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  document_font_size: 10,
  document_line_height: 1.5,
  document_margin_vertical: 36,
  document_margin_horizontal: 36,
  header_name_size: 24,
  header_name_bottom_spacing: 24,
  skills_margin_top: 2,
  skills_margin_bottom: 2,
  skills_margin_horizontal: 0,
  skills_item_spacing: 2,
  experience_margin_top: 2,
  experience_margin_bottom: 2,
  experience_margin_horizontal: 0,
  experience_item_spacing: 4,
  projects_margin_top: 2,
  projects_margin_bottom: 2,
  projects_margin_horizontal: 0,
  projects_item_spacing: 4,
  education_margin_top: 2,
  education_margin_bottom: 2,
  education_margin_horizontal: 0,
  education_item_spacing: 4,
};

export const COMPACT_DOCUMENT_SETTINGS: DocumentSettings = {
  footer_width: 0,
  show_ubc_footer: false,
  header_name_size: 24,
  skills_margin_top: 0,
  document_font_size: 10,
  projects_margin_top: 0,
  skills_item_spacing: 0,
  document_line_height: 1.2,
  education_margin_top: 0,
  skills_margin_bottom: 2,
  experience_margin_top: 2,
  projects_item_spacing: 0,
  education_item_spacing: 0,
  projects_margin_bottom: 0,
  education_margin_bottom: 0,
  experience_item_spacing: 1,
  document_margin_vertical: 20,
  experience_margin_bottom: 0,
  skills_margin_horizontal: 0,
  document_margin_horizontal: 28,
  header_name_bottom_spacing: 16,
  projects_margin_horizontal: 0,
  education_margin_horizontal: 0,
  experience_margin_horizontal: 0,
};

export interface CoverLetterDocumentSettings {
  font_size: number;           // default 11, range 9-13
  line_height: number;         // default 1.4, range 1-2
  margin_vertical: number;     // default 72 (1in), range 36-108
  margin_horizontal: number;   // default 72 (1in), range 36-108
  header_name_size: number;    // default 24, range 14-36
  paragraph_spacing: number;   // default 12, range 4-24
}

export interface CoverLetterData {
  content: string;
  lastUpdated?: string;
  document_settings?: CoverLetterDocumentSettings;
}

export const DEFAULT_COVER_LETTER_SETTINGS: CoverLetterDocumentSettings = {
  font_size: 11,
  line_height: 1.4,
  margin_vertical: 72,
  margin_horizontal: 72,
  header_name_size: 24,
  paragraph_spacing: 12,
};

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  location: string | null;
  website: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  is_admin?: boolean | null;
  work_experience: WorkExperience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
  certifications: Certification[];
  document_settings?: DocumentSettings | null;
  cover_letter_document_settings?: CoverLetterDocumentSettings | null;
  section_order?: ResumeSectionId[] | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan: 'free' | 'pro';
  subscription_status: 'active' | 'canceled';
  current_period_end: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}

export const AI_PROVIDERS = {
  OPENAI: 'openai',
  // AZURE: 'azure',
  ANTHROPIC: 'anthropic',
  // BEDROCK: 'bedrock',
  // GOOGLE: 'google',
  // VERTEX: 'vertex',
  // MISTRAL: 'mistral',
  // XAI: 'xai',
  // TOGETHER: 'together',
  // COHERE: 'cohere',
  // FIREWORKS: 'fireworks',
  // DEEPINFRA: 'deepinfra',
  // GROQ: 'groq'
  DEEPSEEK: 'deepseek',
} as const;

export type AIProviderOld = typeof AI_PROVIDERS[keyof typeof AI_PROVIDERS];

// ServiceName is used across the app for API key management
export type ServiceName = 
  | 'openai'
  // | 'azure'
  | 'anthropic'
  | 'openrouter';
  // | 'bedrock'
  // | 'google'
  // | 'vertex'
  // | 'mistral'
  // | 'xai'
  // | 'together'
  // | 'cohere'
  // | 'fireworks'
  // | 'deepinfra'
  // | 'groq'
  // | 'deepseek';

// Re-export AI model types from centralized location (except AIProvider to avoid conflict)
export type { AIModel, ApiKey, AIConfig } from './ai-models';

export type SortDirection = 'ascending' | 'descending';

export interface SortDescriptor<T> {
  column: T;
  direction: SortDirection;
}
