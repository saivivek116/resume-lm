import { Font } from '@react-pdf/renderer';

/**
 * Curated, ATS-safe font options for resumes and cover letters.
 *
 * Helvetica is a built-in React-PDF "standard" font (no file needed). Calibri
 * and Garamond are proprietary, so we embed metric-compatible open-source
 * substitutes (Carlito / EB Garamond, both SIL OFL) that live in `public/fonts`.
 */
export type ResumeFontFamily = 'helvetica' | 'calibri' | 'garamond';

export const DEFAULT_RESUME_FONT: ResumeFontFamily = 'helvetica';

export interface ResumeFontOption {
  value: ResumeFontFamily;
  label: string;
  category: 'Sans-serif' | 'Serif';
  description: string;
}

export const RESUME_FONT_OPTIONS: ResumeFontOption[] = [
  {
    value: 'helvetica',
    label: 'Helvetica',
    category: 'Sans-serif',
    description: 'Clean, modern default. A safe pick for any industry.',
  },
  {
    value: 'calibri',
    label: 'Calibri',
    category: 'Sans-serif',
    description: 'The familiar Office default. Friendly and highly ATS-safe.',
  },
  {
    value: 'garamond',
    label: 'Garamond',
    category: 'Serif',
    description: 'Elegant serif for traditional fields — law, finance, academia.',
  },
];

/** PDF font-family names resolved per option, one per text weight/style. */
interface PdfFontSet {
  regular: string;
  bold: string;
  italic: string;
}

const PDF_FONT_SETS: Record<ResumeFontFamily, PdfFontSet> = {
  helvetica: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
  },
  calibri: {
    regular: 'Carlito',
    bold: 'Carlito-Bold',
    italic: 'Carlito-Italic',
  },
  garamond: {
    regular: 'EBGaramond',
    bold: 'EBGaramond-Bold',
    italic: 'EBGaramond-Italic',
  },
};

/** Real font names Word should request in DOCX exports (Word substitutes locally). */
const DOCX_FONT_NAMES: Record<ResumeFontFamily, string> = {
  helvetica: 'Helvetica',
  calibri: 'Calibri',
  garamond: 'Garamond',
};

function normalizeFont(key?: string | null): ResumeFontFamily {
  return key && key in PDF_FONT_SETS ? (key as ResumeFontFamily) : DEFAULT_RESUME_FONT;
}

/** Resolve the PDF family-name strings for a stored setting (falls back to Helvetica). */
export function getPdfFonts(key?: string | null): PdfFontSet {
  return PDF_FONT_SETS[normalizeFont(key)];
}

/** Resolve the DOCX font name for a stored setting (falls back to Helvetica). */
export function getDocxFontName(key?: string | null): string {
  return DOCX_FONT_NAMES[normalizeFont(key)];
}

let fontsRegistered = false;

/**
 * Register the embeddable (non-built-in) resume fonts with React-PDF. Each
 * weight/style is registered under its own family name so callers can select
 * it with a plain `fontFamily` string. Idempotent and safe to call repeatedly.
 */
export function registerResumeFonts(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;

  // Carlito (Calibri-compatible)
  Font.register({ family: 'Carlito', fonts: [{ src: '/fonts/Carlito-Regular.ttf' }] });
  Font.register({ family: 'Carlito-Bold', fonts: [{ src: '/fonts/Carlito-Bold.ttf' }] });
  Font.register({ family: 'Carlito-Italic', fonts: [{ src: '/fonts/Carlito-Italic.ttf' }] });

  // EB Garamond (Garamond serif)
  Font.register({ family: 'EBGaramond', fonts: [{ src: '/fonts/EBGaramond-Regular.ttf' }] });
  Font.register({ family: 'EBGaramond-Bold', fonts: [{ src: '/fonts/EBGaramond-Bold.ttf' }] });
  Font.register({ family: 'EBGaramond-Italic', fonts: [{ src: '/fonts/EBGaramond-Italic.ttf' }] });
}
