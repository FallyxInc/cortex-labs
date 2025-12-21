/**
 * PDF text extraction utilities.
 * Uses pdf-parse library to extract text from PDF buffers.
 */

import pdfParse from 'pdf-parse';

/**
 * Options for PDF parsing.
 */
interface PdfParseOptions {
  /** Maximum number of pages to parse (0 = all) */
  maxPages?: number;
}

/**
 * Result of parsing a PDF.
 */
interface PdfParseResult {
  /** Full text content of the PDF */
  text: string;
  /** Number of pages in the PDF */
  numPages: number;
  /** Text content per page (if available) */
  pages: string[];
}

/**
 * Extract text from a PDF buffer.
 *
 * @param buffer - PDF file buffer
 * @param options - Optional parsing options
 * @returns Parsed PDF result with text and page info
 */
export async function extractPdfText(
  buffer: Buffer,
  options: PdfParseOptions = {}
): Promise<PdfParseResult> {
  try {
    const data = await pdfParse(buffer, {
      max: options.maxPages || 0,
    });

    // pdf-parse returns all text as a single string
    // We'll try to split by form feed characters if present
    const pages = splitIntoPages(data.text);

    return {
      text: data.text,
      numPages: data.numpages,
      pages: pages.length > 0 ? pages : [data.text],
    };
  } catch (error) {
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract text from each page of a PDF separately.
 * This provides better page-level granularity for processing.
 *
 * @param buffer - PDF file buffer
 * @returns Array of text content, one per page
 */
export async function extractPdfPages(buffer: Buffer): Promise<string[]> {
  try {
    // pdf-parse with custom page render function to capture per-page text
    const pages: string[] = [];

    // Custom render function that captures page text
    const renderPage = (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) => {
      return pageData.getTextContent().then((textContent) => {
        const pageText = textContent.items
          .map((item) => item.str)
          .join(' ');
        pages.push(pageText);
        return pageText;
      });
    };

    await pdfParse(buffer, {
      pagerender: renderPage,
    });

    // If custom render didn't work, fall back to splitting by form feed
    if (pages.length === 0) {
      const result = await extractPdfText(buffer);
      return result.pages;
    }

    return pages;
  } catch {
    // Fall back to basic extraction if custom render fails
    const result = await extractPdfText(buffer);
    return result.pages;
  }
}

/**
 * Split PDF text into pages using common page separators.
 *
 * @param text - Full PDF text
 * @returns Array of page texts
 */
function splitIntoPages(text: string): string[] {
  // Try form feed character first (common PDF page separator)
  if (text.includes('\f')) {
    return text.split('\f').map((page) => page.trim()).filter((page) => page.length > 0);
  }

  // Try double newlines with page-like patterns
  const pagePattern = /\n{3,}/g;
  const parts = text.split(pagePattern);

  if (parts.length > 1) {
    return parts.map((page) => page.trim()).filter((page) => page.length > 0);
  }

  // Return as single page if no clear separators
  return [text.trim()];
}

/**
 * Check if text contains any content (not just whitespace).
 *
 * @param text - Text to check
 * @returns True if text has meaningful content
 */
export function hasContent(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * Normalize whitespace in extracted PDF text.
 * Handles various whitespace characters that PDFs may contain.
 *
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeWhitespace(text: string): string {
  // Replace various Unicode whitespace with regular spaces
  return text
    .replace(/[\u00A0\u2000-\u200B\u2028\u2029\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

