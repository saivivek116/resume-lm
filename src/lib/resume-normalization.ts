import type { TextImport } from '@/lib/zod-schemas';

/**
 * Normalizes description fields that weaker models may return as a single string
 * instead of a string array. Mutates and returns the parsed object.
 */
export function normalizeDescriptions(content: TextImport): TextImport {
  if (content.work_experience) {
    content.work_experience = content.work_experience.map((item) => ({
      ...item,
      description: Array.isArray(item.description)
        ? item.description
        : typeof item.description === 'string'
          ? [item.description]
          : [],
      technologies: item.technologies ?? [],
      location: item.location ?? '',
    }));
  }
  if (content.projects) {
    content.projects = content.projects.map((item) => ({
      ...item,
      description: Array.isArray(item.description)
        ? item.description
        : typeof item.description === 'string'
          ? [item.description]
          : [],
      technologies: item.technologies ?? [],
      date: item.date ?? '',
      url: item.url ?? '',
      github_url: item.github_url ?? '',
    }));
  }
  if (content.education) {
    content.education = content.education.map((item) => ({
      ...item,
      description: Array.isArray(item.description)
        ? item.description
        : typeof item.description === 'string'
          ? [item.description]
          : [],
      field: item.field ?? '',
      date: item.date ?? '',
      gpa: item.gpa ?? null,
      location: item.location ?? '',
      achievements: item.achievements ?? [],
    }));
  }
  return content;
}
