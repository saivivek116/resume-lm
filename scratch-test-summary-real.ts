import fs from 'node:fs';
for (const line of fs.readFileSync('.env', 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { PROFESSIONAL_SUMMARY_GENERATOR_MESSAGE } from './src/lib/prompts';

const aiClient = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' })('deepseek/deepseek-v3.2:nitro');

async function run(label: string, work_experience: any[]) {
  const profile = {
    work_experience,
    skills: [{ category: 'Languages', skills: ['TypeScript', 'React', 'Node.js'] }],
    projects: [],
    certifications: [],
  };

  const job = {
    position_title: 'Software Engineer',
    company_name: 'Beta Inc',
    description: 'Looking for a software engineer to join our team.',
    keywords: ['TypeScript', 'React'],
  };

  const profileBlob = JSON.stringify(profile, null, 2);
  const jobBlob = `Position: ${job.position_title}\nCompany: ${job.company_name}\nKeywords: ${job.keywords.join(', ')}\nDescription:\n${job.description}`;

  const { text } = await generateText({
    model: aiClient,
    system: PROFESSIONAL_SUMMARY_GENERATOR_MESSAGE.content as string,
    prompt: `CANDIDATE PROFILE (source of truth — only reference skills/experience present here):
${profileBlob}

TARGET JOB:
${jobBlob}

Call getCurrentDate first, then compute the candidate's real years of experience and the seniority-adjusted opener title per your instructions. Write the professional summary paragraph now. 3-4 sentences, 60-90 words, plain text only.`,
    tools: {
      getCurrentDate: tool({
        description:
          'Returns today\'s real-world date. Call this before computing years of experience or resolving "Present" in work_experience date ranges, since your training data may be outdated.',
        parameters: z.object({}),
        execute: async () => new Date().toISOString().split('T')[0],
      }),
    },
    maxSteps: 3,
  });

  console.log(`\n=== ${label} ===`);
  console.log('SUMMARY:', text.trim());
}

async function main() {
  await run('Real resume (expect 5+ years)', [
    { company: 'Acuity Health', position: 'Software Engineer II', location: 'Spring Hill, TN', date: 'Jul 2024 - Present', description: ['Led development of admin portal'], technologies: ['Next.js', 'React'] },
    { company: 'George Mason University', position: 'Software Engineer', location: 'Fairfax, VA', date: 'Feb 2024 - Dec 2024', description: ['Built geospatial workflow tool'], technologies: ['React', 'D3.js'] },
    { company: 'Phenom', position: 'Software Development Engineer', location: 'Hyderabad, India', date: 'Sep 2020 - Dec 2022', description: ['Built no-code form builder'], technologies: ['React', 'TypeScript'] },
    { company: 'Carelon Global Solutions', position: 'Associate Software Engineer', location: 'Hyderabad, India', date: 'Jun 2020 - Aug 2020', description: ['Built LMS'], technologies: ['Angular'] },
  ]);

  await run('Overlap only, no gap (expect 3+ years, not 6+)', [
    { company: 'A', position: 'Engineer', location: 'X', date: 'Jan 2023 - Present', description: ['x'], technologies: [] },
    { company: 'B', position: 'Consultant', location: 'X', date: 'Jun 2023 - Dec 2024', description: ['x'], technologies: [] },
  ]);

  await run('Gap only, no overlap (expect 4+ years, not 5+)', [
    { company: 'A', position: 'Engineer', location: 'X', date: 'Jan 2020 - Dec 2021', description: ['x'], technologies: [] },
    { company: 'B', position: 'Engineer', location: 'X', date: 'Jan 2023 - Dec 2024', description: ['x'], technologies: [] },
  ]);
}

main().catch((e) => { console.error(e); process.exit(1); });
