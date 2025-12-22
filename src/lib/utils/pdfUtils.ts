/**
 * PDF text extraction utilities.
 * Uses pdf-parse library to extract text from PDF buffers.
 */

import {PDFParse} from "pdf-parse";

export interface LoadParameters {
  data: Buffer;
  max?: number;
  version?: string;
  pagerender?: (pageData: {
    getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
  }) => Promise<string>;
}

/**
 * Options for PDF parsing.
 */
export interface PdfParseOptions {
  /** Maximum number of pages to parse (0 = all) */
  maxPages?: number;
}

/**
 * Result of parsing a PDF.
 */
export interface PdfParseResult {
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
    const parser = new PDFParse({
      data: buffer,
    });
    const result = await parser.getText();
    await parser.destroy();

    const pages = splitIntoPages(result.text);

    return {
      text: result.text,
      numPages: result.pages.length,
      pages: pages.length > 0 ? pages : [result.text],
    };
  } catch (error) {
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`
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
    const pages: string[] = [];

    const renderPage = (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) => {
      return pageData.getTextContent().then((textContent) => {
        const pageText = textContent.items
          .map((item) => item.str)
          .join(' ');
        pages.push(pageText);
        return pageText;
      });
    };

    const parser = new PDFParse({
      data: buffer,
    });
    const result = await parser.getText();
    await parser.destroy();

    return result.pages.map((page) => page.text);
  } catch {
    return [];
  }
}

/**
 * Split PDF text into pages using common page separators.
 *
 * @param text - Full PDF text
 * @returns Array of page texts
 */
function splitIntoPages(text: string): string[] {
  if (text.includes("\f")) {
    return text
      .split("\f")
      .map((page) => page.trim())
      .filter((page) => page.length > 0);
  }

  const pagePattern = /\n{3,}/g;
  const parts = text.split(pagePattern);

  if (parts.length > 1) {
    return parts.map((page) => page.trim()).filter((page) => page.length > 0);
  }

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
  return text
    .replace(/[\u00A0\u2000-\u200B\u2028\u2029\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
