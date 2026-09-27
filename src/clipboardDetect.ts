/**
 * clipboardDetect.ts — Logic for detecting format and cleaning pasted content.
 * Framework-agnostic; unit testable in Node.js.
 */

export interface ClipboardPayload {
  html?: string | null;
  text?: string | null;
}

export interface DetectedInput {
  format: 'html' | 'markdown';
  content: string;
  sourceDescription: string;
}

/**
 * Checks if an HTML string from the clipboard has meaningful markup
 * beyond just a bare wrapper (like <div>plain</div> or <meta charset="...">).
 */
export function hasMeaningfulHtml(rawHtml: string): boolean {
  if (!rawHtml || !rawHtml.trim()) {
    return false;
  }

  // Remove comments and meta tags
  let cleaned = rawHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<meta[^>]*>/gi, '')
    .trim();

  if (!cleaned) {
    return false;
  }

  // Tags indicating structured rich text
  const richTagsRegex = /<\s*\/?\s*(table|thead|tbody|tfoot|tr|th|td|b|strong|i|em|u|s|strike|del|h[1-6]|ul|ol|li|blockquote|pre|code|a|p|br|img|hr|sup|sub|span\s+style)\b/i;

  if (richTagsRegex.test(cleaned)) {
    return true;
  }

  // Check if it's just a single outer container like <div>text</div>, <html><body>text</body></html>, etc.
  // Strip all HTML tags and compare text
  const strippedText = cleaned.replace(/<[^>]+>/g, '').trim();
  // Strip wrapping tags like <div>, <span> without style, <p>, <body>, <html>
  const wrapperTagsRemoved = cleaned.replace(/<\/?(html|body|div|span|section|main|article)[^>]*>/gi, '').trim();

  // If after removing standard container tags there are still angle brackets, there is markup
  if (/<[a-z][\s\S]*>/i.test(wrapperTagsRemoved)) {
    return true;
  }

  // If strippedText is identical to wrapperTagsRemoved (meaning only wrapper tags existed),
  // then there's no rich formatting.
  return false;
}

/**
 * Given raw clipboardData (html & text), determines the best format and content to convert.
 */
export function detectPastedFormat(payload: ClipboardPayload): DetectedInput {
  const rawHtml = payload.html?.trim() || '';
  const rawText = payload.text || '';

  if (rawHtml && hasMeaningfulHtml(rawHtml)) {
    return {
      format: 'html',
      content: rawHtml,
      sourceDescription: 'pasted HTML',
    };
  }

  return {
    format: 'markdown',
    content: rawText,
    sourceDescription: 'pasted plain text',
  };
}
