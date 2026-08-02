import fs from 'node:fs';
for (const line of fs.readFileSync('.env', 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
import { generateProfessionalSummary } from './src/utils/actions/resumes/ai';

async function main() {
  const profile = {
    work_experience: [
      {
        company: 'Acme Corp',
        position: 'Software Engineer',
        location: 'Remote',
        date: 'Jan 2019 - Present',
        description: ['Built scalable backend services', 'Led migration to microservices'],
        technologies: ['TypeScript', 'Node.js', 'AWS'],
      },
    ],
    skills: [{ category: 'Languages', skills: ['TypeScript', 'Python'] }],
    projects: [],
    education: [],
    certifications: [],
  } as any;

  const job = {
    position_title: 'Junior Software Engineer',
    company_name: 'Beta Inc',
    description: 'Looking for a junior software engineer to join our team.',
    keywords: ['TypeScript', 'React'],
  };

  const summary = await generateProfessionalSummary({ profile, job });
  console.log('SUMMARY:', summary);
}

main().catch((e) => { console.error(e); process.exit(1); });
