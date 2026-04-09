'use client';

import { Resume, CoverLetterDocumentSettings } from "@/lib/types";
import { Document as PDFDocument, Page as PDFPage, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import { memo, useMemo } from 'react';
import { parseCoverLetterHtml } from '@/lib/cover-letter-html-parser';

export const DEFAULT_COVER_LETTER_SETTINGS: CoverLetterDocumentSettings = {
  font_size: 11,
  line_height: 1.4,
  margin_vertical: 72,
  margin_horizontal: 72,
  header_name_size: 24,
  paragraph_spacing: 12,
};

const baseStyles = {
  link: {
    color: '#2563eb',
    textDecoration: 'none' as const,
  },
  bulletSeparator: {
    color: '#4b5563',
    marginHorizontal: 2,
  },
} as const;

function createCoverLetterStyles(settings: CoverLetterDocumentSettings = DEFAULT_COVER_LETTER_SETTINGS) {
  const {
    font_size = 11,
    line_height = 1.4,
    margin_vertical = 72,
    margin_horizontal = 72,
    header_name_size = 24,
    paragraph_spacing = 12,
  } = settings;

  return StyleSheet.create({
    ...baseStyles,
    page: {
      paddingTop: margin_vertical,
      paddingBottom: margin_vertical,
      paddingLeft: margin_horizontal,
      paddingRight: margin_horizontal,
      fontFamily: 'Helvetica',
      color: '#111827',
      fontSize: font_size,
      lineHeight: line_height,
    },
    header: {
      alignItems: 'center',
    },
    name: {
      fontSize: header_name_size,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 8,
      color: '#111827',
      textAlign: 'center',
    },
    contactInfo: {
      fontSize: font_size,
      color: '#374151',
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 4,
    },
    divider: {
      borderBottom: '0.5pt solid #e5e7eb',
      marginTop: 12,
      marginBottom: 16,
    },
    // Styles passed to the HTML parser
    paragraph: {
      fontSize: font_size,
      lineHeight: line_height,
      color: '#111827',
      marginBottom: paragraph_spacing,
    },
    bold: {
      fontFamily: 'Helvetica-Bold',
    },
    italic: {
      fontFamily: 'Helvetica-Oblique',
    },
    underline: {
      textDecoration: 'underline',
    },
    strikethrough: {
      textDecoration: 'line-through',
    },
    spacer: {
      height: paragraph_spacing / 2,
    },
  });
}

const HeaderSection = memo(function HeaderSection({
  resume,
  styles,
}: {
  resume: Resume;
  styles: ReturnType<typeof createCoverLetterStyles>;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.name}>{resume.first_name} {resume.last_name}</Text>
      <View style={styles.contactInfo}>
        {resume.location && (
          <>
            <Text>{resume.location}</Text>
            {(resume.email || resume.phone_number || resume.website || resume.linkedin_url || resume.github_url) && (
              <Text style={styles.bulletSeparator}>•</Text>
            )}
          </>
        )}
        {resume.email && (
          <>
            <Link src={`mailto:${resume.email}`}><Text style={styles.link}>{resume.email}</Text></Link>
            {(resume.phone_number || resume.website || resume.linkedin_url || resume.github_url) && (
              <Text style={styles.bulletSeparator}>•</Text>
            )}
          </>
        )}
        {resume.phone_number && (
          <>
            <Text>{resume.phone_number}</Text>
            {(resume.website || resume.linkedin_url || resume.github_url) && (
              <Text style={styles.bulletSeparator}>•</Text>
            )}
          </>
        )}
        {resume.website && (
          <>
            <Link src={resume.website.startsWith('http') ? resume.website : `https://${resume.website}`}>
              <Text style={styles.link}>{"Website"}</Text>
            </Link>
            {(resume.linkedin_url || resume.github_url) && (
              <Text style={styles.bulletSeparator}>•</Text>
            )}
          </>
        )}
        {resume.linkedin_url && (
          <>
            <Link src={resume.linkedin_url.startsWith('http') ? resume.linkedin_url : `https://${resume.linkedin_url}`}>
              <Text style={styles.link}>{"LinkedIn"}</Text>
            </Link>
            {resume.github_url && <Text style={styles.bulletSeparator}>•</Text>}
          </>
        )}
        {resume.github_url && (
          <Link src={resume.github_url.startsWith('http') ? resume.github_url : `https://${resume.github_url}`}>
            <Text style={styles.link}>{"GitHub"}</Text>
          </Link>
        )}
      </View>
    </View>
  );
});

interface CoverLetterPDFDocumentProps {
  resume: Resume;
}

export const CoverLetterPDFDocument = memo(function CoverLetterPDFDocument({ resume }: CoverLetterPDFDocumentProps) {
  const settings = resume.cover_letter?.document_settings ?? DEFAULT_COVER_LETTER_SETTINGS;
  const styles = useMemo(() => createCoverLetterStyles(settings), [settings]);

  const content = resume.cover_letter?.content || '';

  const bodyElements = useMemo(() => {
    return parseCoverLetterHtml(content, {
      paragraph: styles.paragraph,
      bold: styles.bold,
      italic: styles.italic,
      underline: styles.underline,
      strikethrough: styles.strikethrough,
      spacer: styles.spacer,
    });
  }, [content, styles]);

  return (
    <PDFDocument
      title={`${resume.first_name} ${resume.last_name} - Cover Letter`}
      author={`${resume.first_name} ${resume.last_name}`}
      subject="Cover Letter"
      creator={`${resume.first_name} ${resume.last_name}`}
      producer={`${resume.first_name} ${resume.last_name}`}
      language="en"
    >
      <PDFPage size="LETTER" style={styles.page}>
        <HeaderSection resume={resume} styles={styles} />
        <View style={styles.divider} />
        {bodyElements}
      </PDFPage>
    </PDFDocument>
  );
}, (prevProps, nextProps) => {
  return prevProps.resume === nextProps.resume;
});
