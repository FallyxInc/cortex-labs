declare module 'pdf-parse' {
  interface PdfParseOptions {
    max?: number;
    version?: string;
    pagerender?: (pageData: {
      getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
    }) => Promise<string>;
  }

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    version: string;
    text: string;
  }

  export interface LoadParameters {
    data: Buffer;
    max?: number;
    version?: string;
    pagerender?: (pageData: {
      getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
    }) => Promise<string>;
  }

  export class PDFParse {
    constructor(parameters: LoadParameters);
    getText(): Promise<{
      text: string;
      pages: Array<{ text: string }>;
    }>;
    destroy(): Promise<void>;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;

  export = pdfParse;
}

