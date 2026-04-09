import { Text, View } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { ReactNode } from 'react';

interface ParserStyles {
  paragraph: Style;
  bold: Style;
  italic: Style;
  underline: Style;
  strikethrough: Style;
  spacer: Style;
}

/**
 * Parse inline HTML tags (bold, italic, underline, strikethrough) into react-pdf Text elements.
 */
function parseInlineContent(html: string, styles: ParserStyles, keyPrefix: string): ReactNode[] {
  const elements: ReactNode[] = [];
  // Match inline tags: <strong>, <b>, <em>, <i>, <u>, <s>
  const inlineRegex = /<(strong|b|em|i|u|s)>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = inlineRegex.exec(html)) !== null) {
    // Add text before this tag
    if (match.index > lastIndex) {
      const textBefore = html.slice(lastIndex, match.index);
      if (textBefore) {
        elements.push(<Text key={`${keyPrefix}-t${idx++}`}>{decodeHtmlEntities(textBefore)}</Text>);
      }
    }

    const tag = match[1];
    const innerContent = match[2];
    let style: Style = {};

    switch (tag) {
      case 'strong':
      case 'b':
        style = styles.bold;
        break;
      case 'em':
      case 'i':
        style = styles.italic;
        break;
      case 'u':
        style = styles.underline;
        break;
      case 's':
        style = styles.strikethrough;
        break;
    }

    // Recursively parse inner content for nested inline tags
    const innerElements = parseInlineContent(innerContent, styles, `${keyPrefix}-${idx}`);
    elements.push(
      <Text key={`${keyPrefix}-s${idx++}`} style={style}>
        {innerElements}
      </Text>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < html.length) {
    const remaining = html.slice(lastIndex);
    if (remaining) {
      elements.push(<Text key={`${keyPrefix}-t${idx++}`}>{decodeHtmlEntities(remaining)}</Text>);
    }
  }

  return elements;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractTextAlign(tag: string): 'left' | 'center' | 'right' | 'justify' | undefined {
  const styleMatch = tag.match(/style="[^"]*text-align:\s*(left|center|right|justify)[^"]*"/);
  return styleMatch ? styleMatch[1] as 'left' | 'center' | 'right' | 'justify' : undefined;
}

/**
 * Parse TipTap HTML output into @react-pdf/renderer elements.
 * Handles: <p>, <h1>, <h2>, <br>, <strong>/<b>, <em>/<i>, <u>, <s>
 */
export function parseCoverLetterHtml(
  html: string,
  styles: ParserStyles
): ReactNode[] {
  if (!html) return [];

  const elements: ReactNode[] = [];
  // Split by block-level tags
  const blockRegex = /<(p|h1|h2)([^>]*)>([\s\S]*?)<\/\1>|<br\s*\/?>/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = blockRegex.exec(html)) !== null) {
    if (match[0].match(/^<br\s*\/?>$/)) {
      // Line break → spacer
      elements.push(<View key={`br-${idx++}`} style={styles.spacer} />);
      continue;
    }

    const tag = match[1]; // p, h1, h2
    const attrs = match[2]; // attributes string
    const innerHtml = match[3]; // inner content

    // Check for empty paragraph
    if (!innerHtml || innerHtml.trim() === '' || innerHtml.trim() === '<br>' || innerHtml.trim() === '<br/>') {
      elements.push(<View key={`empty-${idx++}`} style={styles.spacer} />);
      continue;
    }

    // Strip any remaining <br> tags from inner content
    const cleanedHtml = innerHtml.replace(/<br\s*\/?>/g, '');

    const textAlign = extractTextAlign(`<${tag}${attrs}>`);
    const blockStyle: Style = { ...styles.paragraph };
    if (textAlign) {
      blockStyle.textAlign = textAlign;
    }

    // Apply heading styles
    if (tag === 'h1') {
      blockStyle.fontSize = 18;
      blockStyle.fontFamily = 'Helvetica-Bold';
      blockStyle.marginBottom = 8;
    } else if (tag === 'h2') {
      blockStyle.fontSize = 14;
      blockStyle.fontFamily = 'Helvetica-Bold';
      blockStyle.marginBottom = 6;
    }

    const inlineElements = parseInlineContent(cleanedHtml, styles, `block-${idx}`);

    elements.push(
      <Text key={`block-${idx++}`} style={blockStyle}>
        {inlineElements}
      </Text>
    );
  }

  return elements;
}
