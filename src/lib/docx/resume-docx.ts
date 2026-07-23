import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  TabStopType,
  TabStopPosition,
  Tab,
  convertInchesToTwip,
} from "docx";
import {
  Resume,
  DEFAULT_SECTION_ORDER,
  DEFAULT_DOCUMENT_SETTINGS,
  getSectionTitle,
  ResumeSectionId,
} from "@/lib/types";
import { getDocxFontName } from "@/lib/fonts/resume-fonts";
import {
  ptToHalfPoints,
  ptToTwip,
  lineHeightToSpacing,
  markdownBoldToRuns,
  normalizeUrl,
  nameParagraph,
  contactParagraph,
  sectionTitleParagraph,
  TEXT_COLOR,
  LINK_COLOR,
} from "./docx-shared";

const RIGHT_TAB = [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }];

function bulletParagraph(text: string, size: number): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: ptToTwip(2) },
    children: markdownBoldToRuns(text, { sizeHalfPoints: size }),
  });
}

function summarySection(summary: string | null | undefined, title: string, size: number): Paragraph[] {
  if (!summary || !summary.trim()) return [];
  return [
    sectionTitleParagraph(title, size / 2),
    new Paragraph({
      spacing: { after: ptToTwip(2) },
      children: [new TextRun({ text: summary, size, color: TEXT_COLOR })],
    }),
  ];
}

function skillsSection(skills: Resume["skills"], title: string, size: number): Paragraph[] {
  if (!skills?.length) return [];
  return [
    sectionTitleParagraph(title, size / 2),
    ...skills.map(
      (cat) =>
        new Paragraph({
          spacing: { after: ptToTwip(2) },
          children: [
            new TextRun({ text: `${cat.category}: `, bold: true, size, color: TEXT_COLOR }),
            new TextRun({ text: cat.items.join(", "), size, color: TEXT_COLOR }),
          ],
        })
    ),
  ];
}

function experienceSection(experiences: Resume["work_experience"], title: string, size: number): Paragraph[] {
  if (!experiences?.length) return [];
  const paras: Paragraph[] = [sectionTitleParagraph(title, size / 2)];
  experiences.forEach((exp) => {
    paras.push(
      new Paragraph({
        tabStops: RIGHT_TAB,
        children: [
          ...markdownBoldToRuns(exp.position, { sizeHalfPoints: size, ignoreMarkdown: true, bold: true }),
          new TextRun({ children: [new Tab(), exp.date ?? ""], size, color: TEXT_COLOR }),
        ],
      })
    );
    const companyLine = exp.location ? `${exp.company}  •  ${exp.location}` : exp.company;
    paras.push(
      new Paragraph({
        spacing: { after: ptToTwip(2) },
        children: markdownBoldToRuns(companyLine, { sizeHalfPoints: size, ignoreMarkdown: true }),
      })
    );
    exp.description.forEach((bullet) => paras.push(bulletParagraph(bullet, size)));
  });
  return paras;
}

function projectsSection(projects: Resume["projects"], title: string, size: number): Paragraph[] {
  if (!projects?.length) return [];
  const paras: Paragraph[] = [sectionTitleParagraph(title, size / 2)];
  projects.forEach((project) => {
    paras.push(
      new Paragraph({
        tabStops: RIGHT_TAB,
        children: [
          ...markdownBoldToRuns(project.name, { sizeHalfPoints: size, ignoreMarkdown: true, bold: true }),
          ...(project.date ? [new TextRun({ children: [new Tab(), project.date], size, color: TEXT_COLOR })] : []),
        ],
      })
    );
    if (project.url || project.github_url) {
      const linkChildren: (TextRun | ExternalHyperlink)[] = [];
      if (project.url) {
        linkChildren.push(
          new ExternalHyperlink({
            link: normalizeUrl(project.url),
            children: [new TextRun({ text: project.url, color: LINK_COLOR, size })],
          })
        );
      }
      if (project.url && project.github_url) {
        linkChildren.push(new TextRun({ text: "  |  ", size, color: TEXT_COLOR }));
      }
      if (project.github_url) {
        linkChildren.push(
          new ExternalHyperlink({
            link: normalizeUrl(project.github_url),
            children: [new TextRun({ text: project.github_url, color: LINK_COLOR, size })],
          })
        );
      }
      paras.push(new Paragraph({ children: linkChildren }));
    }
    if (project.technologies?.length) {
      paras.push(
        new Paragraph({
          spacing: { after: ptToTwip(2) },
          children: [
            new TextRun({
              text: project.technologies.map((t) => t.replace(/\*\*/g, "")).join(", "),
              bold: true,
              size,
              color: TEXT_COLOR,
            }),
          ],
        })
      );
    }
    project.description.forEach((bullet) => paras.push(bulletParagraph(bullet, size)));
  });
  return paras;
}

function educationSection(education: Resume["education"], title: string, size: number): Paragraph[] {
  if (!education?.length) return [];
  const paras: Paragraph[] = [sectionTitleParagraph(title, size / 2)];
  education.forEach((edu) => {
    paras.push(
      new Paragraph({
        tabStops: RIGHT_TAB,
        children: [
          ...markdownBoldToRuns(edu.school, { sizeHalfPoints: size, ignoreMarkdown: true, bold: true }),
          new TextRun({ children: [new Tab(), edu.date ?? ""], size, color: TEXT_COLOR }),
        ],
      })
    );
    paras.push(
      new Paragraph({
        spacing: { after: ptToTwip(2) },
        children: markdownBoldToRuns(`${edu.degree} ${edu.field}`.trim(), { sizeHalfPoints: size }),
      })
    );
    (edu.achievements ?? []).forEach((a) => paras.push(bulletParagraph(a, size)));
  });
  return paras;
}

function certificationsSection(certifications: Resume["certifications"], title: string, size: number): Paragraph[] {
  if (!certifications?.length) return [];
  const paras: Paragraph[] = [sectionTitleParagraph(title, size / 2)];
  certifications.forEach((cert) => {
    paras.push(
      new Paragraph({
        spacing: { after: ptToTwip(2) },
        children: [
          cert.url
            ? new ExternalHyperlink({
                link: normalizeUrl(cert.url),
                children: [new TextRun({ text: cert.name, bold: true, color: LINK_COLOR, size })],
              })
            : new TextRun({ text: cert.name, bold: true, size, color: TEXT_COLOR }),
        ],
      })
    );
  });
  return paras;
}

/**
 * Generate an editable Word (.docx) version of a resume, mirroring the
 * structure, section order and content of ResumePDFDocument.
 */
export async function generateResumeDocx(resume: Resume): Promise<Blob> {
  const settings = { ...DEFAULT_DOCUMENT_SETTINGS, ...resume.document_settings };
  const fontSizePt = settings.document_font_size;
  const size = ptToHalfPoints(fontSizePt);

  const children: Paragraph[] = [
    nameParagraph(resume, settings.header_name_size, 0),
    contactParagraph(resume, fontSizePt, 6),
  ];

  const rawOrder = resume.section_order ?? DEFAULT_SECTION_ORDER;
  const order: ResumeSectionId[] = rawOrder.includes("professional_summary")
    ? rawOrder
    : ["professional_summary", ...rawOrder];

  order.forEach((id) => {
    const title = getSectionTitle(resume.section_configs, id);
    switch (id) {
      case "professional_summary":
        children.push(...summarySection(resume.professional_summary, title, size));
        break;
      case "skills":
        children.push(...skillsSection(resume.skills, title, size));
        break;
      case "work_experience":
        children.push(...experienceSection(resume.work_experience, title, size));
        break;
      case "projects":
        children.push(...projectsSection(resume.projects, title, size));
        break;
      case "education":
        children.push(...educationSection(resume.education, title, size));
        break;
      case "certifications":
        children.push(...certificationsSection(resume.certifications, title, size));
        break;
    }
  });

  const doc = new Document({
    creator: `${resume.first_name} ${resume.last_name}`.trim(),
    title: `${resume.first_name} ${resume.last_name} - Resume`,
    styles: {
      default: {
        document: {
          run: { font: getDocxFontName(settings.document_font_family), size, color: TEXT_COLOR },
          paragraph: { spacing: { line: lineHeightToSpacing(settings.document_line_height) } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
            margin: {
              top: ptToTwip(settings.document_margin_vertical),
              bottom: ptToTwip(settings.document_margin_vertical),
              left: ptToTwip(settings.document_margin_horizontal),
              right: ptToTwip(settings.document_margin_horizontal),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
