import {
  Paragraph,
  TextRun,
  ExternalHyperlink,
  AlignmentType,
  BorderStyle,
} from "docx";
import { Resume } from "@/lib/types";

// docx measurement helpers.
// react-pdf/document settings are expressed in points (1pt).
export const ptToHalfPoints = (pt: number) => Math.round(pt * 2); // docx font sizes are in half-points
export const ptToTwip = (pt: number) => Math.round(pt * 20); // 1pt = 20 twips
// docx line spacing uses 240ths (240 = single line).
export const lineHeightToSpacing = (lineHeight: number) => Math.round(lineHeight * 240);

const LINK_COLOR = "2563EB";
const SEPARATOR_COLOR = "4B5563";
const TEXT_COLOR = "111827";

export function normalizeUrl(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

/**
 * Split text on **bold** markers (mirrors the PDF useTextProcessor) into docx TextRuns.
 * When ignoreMarkdown is true, returns the inner content of the first bold marker
 * (or the plain text) as a single run.
 */
export function markdownBoldToRuns(
  text: string,
  opts: { sizeHalfPoints: number; ignoreMarkdown?: boolean; bold?: boolean } = { sizeHalfPoints: 20 }
): TextRun[] {
  const { sizeHalfPoints, ignoreMarkdown = false, bold = false } = opts;

  if (ignoreMarkdown) {
    const content = text.match(/\*\*(.*?)\*\*/)?.[1] ?? text;
    return [new TextRun({ text: content, bold, size: sizeHalfPoints, color: TEXT_COLOR })];
  }

  const parts = text.split(/(\*\*.*?\*\*)/g).filter((p) => p !== "");
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return new TextRun({ text: part.slice(2, -2), bold: true, size: sizeHalfPoints, color: TEXT_COLOR });
    }
    return new TextRun({ text: part, bold, size: sizeHalfPoints, color: TEXT_COLOR });
  });
}

function linkRun(label: string, url: string, sizeHalfPoints: number): ExternalHyperlink {
  return new ExternalHyperlink({
    link: normalizeUrl(url),
    children: [
      new TextRun({ text: label, color: LINK_COLOR, size: sizeHalfPoints }),
    ],
  });
}

/**
 * Centered name heading paragraph, shared by resume and cover letter.
 */
export function nameParagraph(resume: Resume, nameSizePt: number, spacingAfterPt: number): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: ptToTwip(spacingAfterPt) },
    children: [
      new TextRun({
        text: `${resume.first_name} ${resume.last_name}`.trim(),
        bold: true,
        size: ptToHalfPoints(nameSizePt),
        color: TEXT_COLOR,
      }),
    ],
  });
}

/**
 * Centered contact line: location • email • phone • Website • LinkedIn • GitHub.
 * Links are rendered as ExternalHyperlinks; plain fields as text runs.
 */
export function contactParagraph(resume: Resume, fontSizePt: number, spacingAfterPt = 0): Paragraph {
  const size = ptToHalfPoints(fontSizePt);
  const parts: (TextRun | ExternalHyperlink)[] = [];

  const push = (item: TextRun | ExternalHyperlink) => {
    if (parts.length > 0) {
      parts.push(new TextRun({ text: " •  ", color: SEPARATOR_COLOR, size }));
    }
    parts.push(item);
  };

  if (resume.location) push(new TextRun({ text: resume.location, size, color: TEXT_COLOR }));
  if (resume.email) push(linkRun(resume.email, `mailto:${resume.email}`, size));
  if (resume.phone_number) push(new TextRun({ text: resume.phone_number, size, color: TEXT_COLOR }));
  if (resume.website) push(linkRun("Website", resume.website, size));
  if (resume.linkedin_url) push(linkRun("LinkedIn", resume.linkedin_url, size));
  if (resume.github_url) push(linkRun("GitHub", resume.github_url, size));

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: ptToTwip(spacingAfterPt) },
    children: parts,
  });
}

/**
 * Uppercase, bold section title with a bottom border (mirrors the PDF sectionTitle).
 */
export function sectionTitleParagraph(title: string, fontSizePt: number): Paragraph {
  return new Paragraph({
    spacing: { before: ptToTwip(6), after: ptToTwip(2) },
    border: {
      bottom: { color: "374151", style: BorderStyle.SINGLE, size: 4, space: 1 },
    },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: ptToHalfPoints(fontSizePt),
        color: TEXT_COLOR,
      }),
    ],
  });
}

export { TEXT_COLOR, LINK_COLOR, SEPARATOR_COLOR };
