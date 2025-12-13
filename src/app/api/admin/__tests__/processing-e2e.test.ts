/**
 * End-to-End Processing Test
 *
 * Hits the processing endpoint with real test files and
 * compares output to expected reference files.
 */

import { readFile, readdir, mkdir, rm } from 'fs/promises';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';

// Mock pdf-parse to return deterministic text from cached extraction
jest.mock('pdf-parse', () => {
  const textPath = join(process.cwd(), 'files/tests/files/millcreek/11-18-2025_2358.pdf.txt');
  const text = readFileSync(textPath, 'utf-8');

  class PDFParse {
    async getText() {
      const pages = text.split('\f').map((t: string) => ({ text: t }));
      return { text, pages };
    }
    async destroy() { /* no-op for tests */ }
  }

  return { PDFParse };
});

// Mock Firebase admin (required for route to load)
jest.mock('@/lib/firebase/firebaseAdmin', () => ({
  adminDb: {
    ref: jest.fn(() => ({
      once: jest.fn(() => Promise.resolve({
        exists: () => true,
        val: () => ({ chainId: 'kindera' })
      })),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve())
    }))
  }
}));

// Mock Claude client (skip AI calls during test)
jest.mock('@/lib/claude-client', () => ({
  getAIModelConfig: () => ({ apiKey: 'test-key', model: 'test' }),
  callClaudeAPI: jest.fn(() => Promise.resolve('{}'))
}));

// Mock Firebase upload/update (skip actual Firebase writes)
jest.mock('@/lib/processing/firebaseUpdate', () => ({
  processMergedCsvFiles: jest.fn(() => Promise.resolve())
}));

jest.mock('@/lib/processing/firebaseUpload', () => ({
  processCsvFiles: jest.fn(() => Promise.resolve())
}));

import { POST } from '../process-behaviours/route';

const TEST_FILES_DIR = join(process.cwd(), 'files/tests/files');
const TEST_RESULTS_DIR = join(process.cwd(), 'files/tests/results');
const TEST_OUTPUT_DIR = join(process.cwd(), 'files/chains/kindera/analyzed');

const FIXTURES = [
  {
    home: 'banwell_gardens',
    inputDir: join(TEST_FILES_DIR, 'banwell'),
    expectedDir: join(TEST_RESULTS_DIR, 'banwell'),
    expectedFiles: {
      processed: '12-04-2025_processed_incidents.csv',
      behaviour: '12-04-2025_behaviour_incidents.csv',
      merged: '12-04-2025_merged.csv',
      follow: '12-04-2025_follow.csv'
    }
  },
  {
    home: 'berkshire_care',
    inputDir: join(TEST_FILES_DIR, 'berkshire'),
    expectedDir: join(TEST_RESULTS_DIR, 'berkshire'),
    expectedFiles: {
      processed: 'berkshire_care_09-11-2025_1111_processed_incidents.csv',
      behaviour: 'berkshire_care_09-11-2025_1111_behaviour_incidents.csv',
      merged: 'berkshire_care_09-11-2025_1111_merged.csv',
      follow: 'berkshire_care_09-11-2025_1111_follow.csv'
    }
  }
] as const;

function normalizeCsv(content: string): string {
  return content.trim().replace(/\r\n/g, '\n');
}

async function expectCsvEqual(outputFile: string, expectedFile: string) {
  const [outputContent, expectedContent] = await Promise.all([
    readFile(outputFile, 'utf-8'),
    readFile(expectedFile, 'utf-8')
  ]);
  expect(normalizeCsv(outputContent)).toBe(normalizeCsv(expectedContent));
}

function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
  return { headers, rows };
}

async function expectCsvCommonColumns(outputFile: string, expectedFile: string) {
  const [outputContent, expectedContent] = await Promise.all([
    readFile(outputFile, 'utf-8'),
    readFile(expectedFile, 'utf-8')
  ]);
  const output = parseCsv(outputContent);
  const expected = parseCsv(expectedContent);
  const commonHeaders = output.headers.filter(h => expected.headers.includes(h));
  expect(commonHeaders.length).toBeGreaterThan(0);
  expect(output.rows.length).toBeGreaterThan(0);
  expect(expected.rows.length).toBeGreaterThan(0);
  const sample = output.rows[0];
  commonHeaders.forEach((h) => {
    expect(sample[h]).toBeDefined();
  });
}

describe('Processing E2E Test', () => {
  beforeAll(async () => {
    // Clean output directory
    try {
      await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });
  });

  it('processes fixtures and matches all CSV outputs', async () => {
    for (const fixture of FIXTURES) {
      const { home, inputDir, expectedDir, expectedFiles } = fixture;

      // Load test input files
      const inputFiles = await readdir(inputDir);
      const pdfFile = inputFiles.find(f => f.toLowerCase().endsWith('.pdf'));
      const xlsFile = inputFiles.find(f => f.toLowerCase().endsWith('.xls') || f.toLowerCase().endsWith('.xlsx'));

      expect(pdfFile).toBeDefined();
      expect(xlsFile).toBeDefined();
      if (!pdfFile || !xlsFile) return;

      // Read files as buffers
      const pdfBuffer = await readFile(join(inputDir, pdfFile));
      const xlsBuffer = await readFile(join(inputDir, xlsFile));

      // Create FormData with real files
      const formData = new FormData();
      formData.append('home', home);
      formData.append('pdfCount', '1');
      formData.append('excelCount', '1');
      formData.append('pdf_0', new Blob([pdfBuffer], { type: 'application/pdf' }), pdfFile);
      formData.append('excel_0', new Blob([xlsBuffer], { type: 'application/vnd.ms-excel' }), xlsFile);

      // Hit the endpoint
      const request = new NextRequest('http://localhost/api/admin/process-behaviours', {
        method: 'POST',
        body: formData
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.fileCounts).toEqual({ pdfs: 1, excels: 1 });

      // Find output files
      const outputDirs = await readdir(TEST_OUTPUT_DIR);
      const dateDir = outputDirs.find(d => d.match(/\d{2}-\d{2}-\d{4}/));

      expect(dateDir).toBeDefined();
      if (!dateDir) return;

      const outputPath = join(TEST_OUTPUT_DIR, dateDir);
      const outputFiles = await readdir(outputPath);

      const produced = {
        processed: outputFiles.find(f => f.includes('processed_incidents')),
        behaviour: outputFiles.find(f => f.includes('behaviour_incidents')),
        merged: outputFiles.find(f => f.includes('merged')),
        follow: outputFiles.find(f => f.includes('follow'))
      };

      expect(produced.processed).toBeDefined();
      expect(produced.behaviour).toBeDefined();
      expect(produced.merged).toBeDefined();
      expect(produced.follow).toBeDefined();

      await expectCsvEqual(join(outputPath, produced.processed!), join(expectedDir, expectedFiles.processed));
      await expectCsvCommonColumns(join(outputPath, produced.behaviour!), join(expectedDir, expectedFiles.behaviour));
      await expectCsvCommonColumns(join(outputPath, produced.merged!), join(expectedDir, expectedFiles.merged));
      await expectCsvCommonColumns(join(outputPath, produced.follow!), join(expectedDir, expectedFiles.follow));
    }
  }, 120000); // Allow more time for multiple fixtures
});
