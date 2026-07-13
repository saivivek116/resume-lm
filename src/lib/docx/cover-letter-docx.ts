import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from "docx";
import { Resume, DEFAULT_COVER_LETTER_SETTINGS } from "@/lib/types";
import {
  ptToHalfPoints,
  ptToTwip,
  lineHeightToSpacing,
  nameParagraph,
  contactParagraph,
  TEXT_COLOR,
} from "./docx-shared";

interface InlineFormat {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
}

function alignmentFromNode(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const align = el.style.textAlign;
  switch (align) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    case "left":
      return AlignmentType.LEFT;
    default:
      return undefined;
  }
}

/**
 * Recursively walk inline DOM nodes, accumulating formatting into docx TextRuns.
 */
function collectRuns(node: Node, format: InlineFormat, size: number): TextRun[] {
  const runs: TextRun[] = [];

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text) {
        runs.push(
          new TextRun({
            text,
            size,
            color: TEXT_COLOR,
            bold: format.bold,
            italics: format.italics,
            strike: format.strike,
            // docx expects an object for underline (empty = single underline).
            underline: format.underline ? {} : undefined,
          })
        );
      }
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") {
      runs.push(new TextRun({ text: "", break: 1, size }));
      return;
    }
    const next: InlineFormat = { ...format };
    if (tag === "strong" || tag === "b") next.bold = true;
    if (tag === "em" || tag === "i") next.italics = true;
    if (tag === "u") next.underline = true;
    if (tag === "s" || tag === "strike" || tag === "del") next.strike = true;

    runs.push(...collectRuns(el, next, size));
  });

  return runs;
}

/**
 * Parse TipTap HTML output into docx paragraphs (mirrors parseCoverLetterHtml).
 * Handles <p>, <h1>, <h2>, <br> blocks and inline <strong>/<b>/<em>/<i>/<u>/<s>.
 */
function parseCoverLetterHtmlToDocx(html: string, size: number, paragraphSpacingPt: number): Paragraph[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const paragraphs: Paragraph[] = [];
  const spacingAfter = ptToTwip(paragraphSpacingPt);

  doc.body.childNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      // Stray top-level text node
      const text = node.textContent?.trim();
      if (text) {
        paragraphs.push(
          new Paragraph({
            spacing: { after: spacingAfter },
            children: [new TextRun({ text, size, color: TEXT_COLOR })],
          })
        );
      }
      return;
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      paragraphs.push(new Paragraph({ children: [] }));
      return;
    }

    // Empty paragraph → spacer
    if (!el.textContent || el.textContent.trim() === "") {
      paragraphs.push(new Paragraph({ children: [] }));
      return;
    }

    let runSize = size;
    let bold = false;
    if (tag === "h1") {
      runSize = ptToHalfPoints(18);
      bold = true;
    } else if (tag === "h2") {
      runSize = ptToHalfPoints(14);
      bold = true;
    }

    const runs = collectRuns(el, bold ? { bold: true } : {}, runSize);

    paragraphs.push(
      new Paragraph({
        alignment: alignmentFromNode(el),
        spacing: { after: spacingAfter },
        children: runs,
      })
    );
  });

  return paragraphs;
}

/**
 * Generate an editable Word (.docx) version of the cover letter, mirroring
 * CoverLetterPDFDocument (header + divider + parsed TipTap body).
 */
export async function generateCoverLetterDocx(resume: Resume): Promise<Blob> {
  const settings = { ...DEFAULT_COVER_LETTER_SETTINGS, ...resume.cover_letter?.document_settings };
  const fontSizePt = settings.font_size;
  const size = ptToHalfPoints(fontSizePt);

  const divider = new Paragraph({
    spacing: { after: ptToTwip(settings.paragraph_spacing) },
    border: {
      bottom: { color: "374151", style: BorderStyle.SINGLE, size: 4, space: 1 },
    },
    children: [],
  });

  const children: Paragraph[] = [
    nameParagraph(resume, settings.header_name_size, 4),
    contactParagraph(resume, fontSizePt, 4),
    divider,
    ...parseCoverLetterHtmlToDocx(resume.cover_letter?.content ?? "", size, settings.paragraph_spacing),
  ];

  const doc = new Document({
    creator: `${resume.first_name} ${resume.last_name}`.trim(),
    title: `${resume.first_name} ${resume.last_name} - Cover Letter`,
    styles: {
      default: {
        document: {
          run: { font: "Helvetica", size, color: TEXT_COLOR },
          paragraph: { spacing: { line: lineHeightToSpacing(settings.line_height) } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: ptToTwip(settings.margin_vertical),
              bottom: ptToTwip(settings.margin_vertical),
              left: ptToTwip(settings.margin_horizontal),
              right: ptToTwip(settings.margin_horizontal),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
