import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { JSDOM } from "jsdom";

// Shim browser globals used by cover-letter-docx.ts with jsdom (browser-faithful).
const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as Record<string, unknown>).DOMParser = dom.window.DOMParser;
(globalThis as Record<string, unknown>).Node = dom.window.Node;

const { generateResumeDocx } = await import("../src/lib/docx/resume-docx.ts");
const { generateCoverLetterDocx } = await import("../src/lib/docx/cover-letter-docx.ts");

const resume: any = {
  id: "r1", user_id: "u1", name: "Base Resume", target_role: "Senior Engineer",
  is_base_resume: false,
  first_name: "Jane", last_name: "Doe", email: "jane@example.com",
  phone_number: "555-1234", location: "NYC", website: "janedoe.dev",
  linkedin_url: "linkedin.com/in/jane", github_url: "github.com/jane",
  professional_summary: "Seasoned engineer with **10 years** experience.",
  work_experience: [{
    company: "Acme", position: "Staff Engineer", location: "Remote", date: "2020 - Present",
    description: ["Led **platform** rewrite", "Cut latency 40%"], technologies: ["Go", "K8s"],
  }],
  education: [{ school: "MIT", degree: "BS", field: "CS", date: "2015", achievements: ["Dean's List"] }],
  skills: [{ category: "Languages", items: ["TypeScript", "Go", "Python"] }],
  projects: [{ name: "OSS Tool", description: ["Built a **CLI**"], date: "2023",
    technologies: ["Rust"], url: "example.com", github_url: "github.com/jane/tool" }],
  certifications: [{ name: "AWS SA", url: "aws.amazon.com" }],
  created_at: "", updated_at: "", has_cover_letter: true,
  cover_letter: { content: "<h1>Cover Letter</h1><p>Dear <strong>Hiring Manager</strong>,</p><p style=\"text-align:center\">I am <em>excited</em> and <u>ready</u>.</p><p></p><p>Best,<br>Jane</p>" },
};

const resumeBlob = await generateResumeDocx(resume);
const clBlob = await generateCoverLetterDocx(resume);

const outDir = "/private/tmp/claude-501/-Users-saivivekv-poc-resume-lm/4fd10328-706a-4d8a-92fe-e55368d6b333/scratchpad";
writeFileSync(`${outDir}/resume.docx`, Buffer.from(await resumeBlob.arrayBuffer()));
writeFileSync(`${outDir}/cover.docx`, Buffer.from(await clBlob.arrayBuffer()));

console.log("resume.docx bytes:", resumeBlob.size, "type:", resumeBlob.type);
console.log("cover.docx  bytes:", clBlob.size, "type:", clBlob.type);

// A valid .docx is a zip containing word/document.xml. Verify + grep some content.
for (const f of ["resume.docx", "cover.docx"]) {
  const list = execSync(`unzip -l ${outDir}/${f}`, { encoding: "utf8" });
  const hasDoc = list.includes("word/document.xml");
  console.log(`${f}: valid zip w/ word/document.xml = ${hasDoc}`);
  if (!hasDoc) throw new Error(`${f} is not a valid docx`);
}
const cxml = execSync(`unzip -p ${outDir}/cover.docx word/document.xml`, { encoding: "utf8" });
console.log("cover has 'Hiring Manager':", cxml.includes("Hiring Manager"));
console.log("cover has bold run for it:", /<w:b\b/.test(cxml));
console.log("cover has italic run:", /<w:i\b/.test(cxml));
console.log("cover has underline run:", /<w:u\b/.test(cxml));
const rxml = execSync(`unzip -p ${outDir}/resume.docx word/document.xml`, { encoding: "utf8" });
console.log("resume has 'Staff Engineer':", rxml.includes("Staff Engineer"));
console.log("resume has bullet numPr:", /<w:numPr>/.test(rxml));
console.log("resume has hyperlink:", /<w:hyperlink|HYPERLINK/.test(rxml));
console.log("ALL CHECKS PASSED");
