import dynamic from 'next/dynamic';
import React from 'react';
import type { ComponentType } from 'react';
import { LoadingFallback } from './shared/LoadingFallback';
import type { Education, Skill, DocumentSettings, Certification, ResumeSectionId, Profile, Resume } from '@/lib/types';

interface WorkExperienceFormProps {
  profile: Profile;
  targetRole?: string;
}

interface ProjectsFormProps {
  profile: Profile;
}

interface EducationFormProps {
  education: Education[];
  onChange: (education: Education[]) => void;
  profile: { education: Education[] };
}



interface SkillsFormProps {
  skills: Skill[];
  onChange: (skills: Skill[]) => void;
  profile: { skills: Skill[] };
}

interface CertificationsFormProps {
  certifications: Certification[];
  onChange: (certifications: Certification[]) => void;
  profile: Profile;
}

export const WorkExperienceForm = dynamic(
  () => import('./forms/work-experience-form').then(mod => ({ default: mod.WorkExperienceForm })) as Promise<ComponentType<WorkExperienceFormProps>>,
  {
    loading: () => <LoadingFallback lines={2} />,
    ssr: false
  }
);

export const EducationForm = dynamic(
  () => import('./forms/education-form').then(mod => ({ default: mod.EducationForm })) as Promise<ComponentType<EducationFormProps>>,
  {
    loading: () => <LoadingFallback lines={1} />,
    ssr: false
  }
);

export const SkillsForm = dynamic(
  () => import('./forms/skills-form').then(mod => ({ default: mod.SkillsForm })) as Promise<ComponentType<SkillsFormProps>>,
  {
    loading: () => <LoadingFallback lines={1} />,
    ssr: false
  }
);

export const ProjectsForm = dynamic(
  () => import('./forms/projects-form').then(mod => ({ default: mod.ProjectsForm })) as Promise<ComponentType<ProjectsFormProps>>,
  {
    loading: () => <LoadingFallback lines={1} />,
    ssr: false
  }
);


export const CertificationsForm = dynamic(
  () => import('./forms/certifications-form').then(mod => ({ default: mod.CertificationsForm })) as Promise<ComponentType<CertificationsFormProps>>,
  {
    loading: () => <LoadingFallback lines={1} />,
    ssr: false
  }
);

export const DocumentSettingsForm = dynamic(
  () => import('./forms/document-settings-form').then(mod => ({
    default: mod.DocumentSettingsForm
  })) as Promise<ComponentType<{
    documentSettings: DocumentSettings;
    onChange: (field: 'document_settings', value: DocumentSettings) => void;
    profileDefaults?: DocumentSettings;
    showSavedStyles?: boolean;
    sectionOrder?: ResumeSectionId[];
    onSectionOrderChange?: (order: ResumeSectionId[]) => void;
    profileSectionOrderDefault?: ResumeSectionId[];
    sectionConfigs?: Resume['section_configs'];
    onSectionTitleChange?: (id: ResumeSectionId, title: string) => void;
  }>>,
  {
    loading: () => <LoadingFallback lines={1} />,
    ssr: false
  }
);