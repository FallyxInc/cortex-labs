/**
 * PDF text extraction utilities.
 * Uses pdf-parse library to extract text from PDF buffers.
 */

// import { readFile, writeFile } from "fs/promises";
import {PDFParse} from "pdf-parse";

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


// export async function extractPdfFromPath(
//   pdfPath: string,
// ): Promise<string[]> {
//   try {
//     const dataBuffer = await readFile(pdfPath);
    
//     const text = await extractPdfPages(dataBuffer);
//     await writeFile(pdfPath + ".txt", text, "utf-8");
//     return text;
//   } catch (error) {
//     console.error(`Error extracting text from PDF: ${error}`);
//     return [];
//   }
// }
/**
 * Extract text from each page of a PDF separately.
 * This provides better page-level granularity for processing.
 *
 * @param buffer - PDF file buffer
 * @returns Array of text content, one per page
 */
export async function extractPdfPages(buffer: Buffer): Promise<string[]> {
  try {
    const parser = new PDFParse({
      data: buffer,
    });
    const result = await parser.getText();
    await parser.destroy();

    if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
      return result.pages.map((page) => {
        if (typeof page === 'string') {
          return page;
        }
        return page?.text || '';
      });
    }

    if (result.text) {
      return [result.text];
    }

    console.warn('PDFParse result has no pages or text');
    return [];
  } catch (error) {
    console.error(`Error extracting pages from PDF: ${error}`);
    return [];
  }
}