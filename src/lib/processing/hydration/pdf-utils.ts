/**
 * PDF text extraction utilities.
 * Uses pdf-parse library to extract text from PDF buffers.
 */

// Use the same import pattern as pdfProcessor.ts which works
import { PDFParse } from 'pdf-parse';
import type { LoadParameters } from 'pdf-parse';

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
    // Use the same pattern as pdfProcessor.ts
    const parameters: LoadParameters = {
      data: buffer,
      max: options.maxPages || 0,
    };

    const parser = new PDFParse(parameters);
    const result = await parser.getText();
    await parser.destroy();

    // pdf-parse returns all text as a single string
    // We'll try to split by form feed characters if present
    const pages = splitIntoPages(result.text);

    return {
      text: result.text,
      numPages: result.pages.length,
      pages: pages.length > 0 ? pages : [result.text],
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
    // Use the same pattern as pdfProcessor.ts
    const parameters: LoadParameters = {
      data: buffer,
    };

    const parser = new PDFParse(parameters);
    const result = await parser.getText();
    await parser.destroy();

    // Extract pages from the result
    return result.pages.map((page: { text: string }) => page.text);
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

