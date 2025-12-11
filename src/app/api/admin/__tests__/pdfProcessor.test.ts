/**
 * Integration Tests for PDF Processing
 *
 * Tests the PDF processing logic using expected result data
 * and validates output structure and content.
 */

// Mock Firebase admin BEFORE any imports that might use it
jest.mock('@/lib/firebase/firebaseAdmin', () => ({
  adminDb: {
    ref: jest.fn(() => ({
      once: jest.fn(() => Promise.resolve({
        exists: jest.fn(() => false),
        val: jest.fn(() => null)
      })),
      set: jest.fn(() => Promise.resolve()),
      update: jest.fn(() => Promise.resolve())
    }))
  }
}));

import { readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import {
  getResidentNameFromHeader,
  findPosition,
  findEffectiveDates,
  getAllFallNotesInfo,
  saveToCsv,
} from '@/lib/processing/pdfProcessor';
import { CHAIN_EXTRACTION_CONFIGS } from '@/lib/utils/configUtils';
import { BehaviourEntry } from '@/lib/processing/types';

const TEST_RESULTS_DIR = join(process.cwd(), 'files/tests/results');
const TEST_OUTPUT_DIR = join(process.cwd(), 'files/tests/output');

interface CsvRow {
  'Effective Date': string;
  'Resident Name': string;
  Type: string;
  Data: string;
}

/**
 * Simple CSV parser - handles quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parse CSV file into array of objects
 */
async function parseCsvFile(filePath: string): Promise<CsvRow[]> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row as unknown as CsvRow);
  }

  return rows;
}

/**
 * Clean up test output directory
 */
async function cleanupOutputDir(): Promise<void> {
  try {
    await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
  await mkdir(TEST_OUTPUT_DIR, { recursive: true });
}

describe('PDF Processing Integration Tests', () => {
  beforeAll(async () => {
    await cleanupOutputDir();
  });

  afterAll(async () => {
    await cleanupOutputDir();
  });

  describe('getResidentNameFromHeader', () => {
    it('should extract resident name from standard header format', () => {
      const pageText = `Progress Notes
Resident Name : Smith, John 12345
Location : Room 101`;

      expect(getResidentNameFromHeader(pageText)).toBe('Smith, John');
    });

    it('should extract name with chain code and trim it', () => {
      const pageText = `Resident Name : Bernatchez, Fernand (922121005521)
Location : 3 606 B`;

      const result = getResidentNameFromHeader(pageText);
      expect(result).toBe('Bernatchez, Fernand');
    });

    it('should return Unknown when no name found', () => {
      const pageText = `Some random text without a resident name`;
      expect(getResidentNameFromHeader(pageText)).toBe('Unknown');
    });

    it('should handle complex header with admission info trailing', () => {
      const pageText = `Resident Name : Labruzzo, Margherita (922121005406) Location : 4 507 A Admission Date : 10/11/2023`;

      const result = getResidentNameFromHeader(pageText);
      expect(result).not.toContain('Location');
      expect(result).not.toContain('Admission');
    });
  });

  describe('findPosition', () => {
    it('should find position in first page', () => {
      const pagesText = ['Hello World', 'Second Page', 'Third Page'];
      const result = findPosition(pagesText, 5);

      expect(result.pageIndex).toBe(0);
      expect(result.relPos).toBe(5);
      expect(result.pageStart).toBe(0);
    });

    it('should find position in second page', () => {
      const pagesText = ['Hello World', 'Second Page', 'Third Page'];
      // First page: 11 chars + 2 ('\n\n') = 13
      const result = findPosition(pagesText, 15);

      expect(result.pageIndex).toBe(1);
    });

    it('should return -1 indices when position not found', () => {
      const pagesText = ['Hello World'];
      const result = findPosition(pagesText, 1000);

      expect(result.pageIndex).toBe(-1);
      expect(result.relPos).toBe(-1);
    });
  });

  describe('findEffectiveDates', () => {
    it('should find all Effective Date positions', () => {
      const allText = `Effective Date: 01/01/2025 10:00
Some content here
Effective Date: 01/02/2025 11:00
More content`;

      const positions = findEffectiveDates(allText);

      expect(positions.length).toBe(2);
      expect(positions[0]).toBe(0);
    });

    it('should return empty array when no Effective Date found', () => {
      const allText = 'No dates in this text';
      expect(findEffectiveDates(allText)).toEqual([]);
    });
  });

  describe('getAllFallNotesInfo', () => {
    it('should extract behaviour notes from kindera chain format', () => {
      const pagesText = [
        `Progress Notes
Resident Name : Smith, John 12345
Effective Date: 12/04/2025 20:06
Type: Behaviour Note
Behaviour Displayed : Resident had no behavioural issues this shift.
Intervention : Monitored closely.
Time, Frequency and # of Staff : 1 staff
Evaluation of Intervention : Effective
Resident Response : Calm and cooperative.`,
      ];

      const config = CHAIN_EXTRACTION_CONFIGS['kindera'];
      const entries = getAllFallNotesInfo(pagesText, 'testHome', 'kindera', config);

      expect(entries.length).toBe(1);
      expect(entries[0]['Effective Date']).toBe('12/04/2025 20:06');
      expect(entries[0]['Resident Name']).toBe('Smith, John');
      expect(entries[0]['Type']).toBe('Behaviour Note');
    });

    it('should extract responsive behaviour notes', () => {
      const pagesText = [
        `Progress Notes
Resident Name : Doe, Jane 67890
Effective Date: 12/05/2025 14:30
Type: Behaviour - Responsive Behaviour
Type of Behaviour : Physical aggression
Antecedent/Triggers : Unknown trigger
Describe the behaviour : Resident pushed staff
Interventions : Redirected
Outcome(s)(Result) : Settled after 10 minutes`,
      ];

      const config = CHAIN_EXTRACTION_CONFIGS['responsive'];
      const entries = getAllFallNotesInfo(pagesText, 'testHome', 'responsive', config);

      expect(entries.length).toBe(1);
      expect(entries[0]['Type']).toBe('Behaviour - Responsive Behaviour');
    });

    it('should skip notes with multiple types on same line', () => {
      const pagesText = [
        `Progress Notes
Resident Name : Test, User 11111
Effective Date: 12/01/2025 10:00
Type: Behaviour - Follow up, Behaviour - Responsive Behaviour
Data : This should be skipped`,
      ];

      const config = CHAIN_EXTRACTION_CONFIGS['kindera'];
      const entries = getAllFallNotesInfo(pagesText, 'testHome', 'kindera', config);

      expect(entries.length).toBe(0);
    });

    it('should handle multiple notes across pages', () => {
      const pagesText = [
        `Progress Notes
Resident Name : First, Patient 11111
Effective Date: 12/01/2025 10:00
Type: Behaviour Note
Behaviour Displayed : First note content`,
        `Progress Notes
Resident Name : Second, Patient 22222
Effective Date: 12/02/2025 11:00
Type: Behaviour Note
Behaviour Displayed : Second note content`,
      ];

      const config = CHAIN_EXTRACTION_CONFIGS['kindera'];
      const entries = getAllFallNotesInfo(pagesText, 'testHome', 'kindera', config);

      expect(entries.length).toBe(2);
    });
  });

  describe('CSV Output', () => {
    it('should save entries to CSV with correct format', async () => {
      const testEntries: BehaviourEntry[] = [
        {
          'Effective Date': '12/04/2025 20:06',
          'Resident Name': 'Smith, John',
          Type: 'Behaviour Note',
          Data: 'Test behaviour data',
        },
        {
          'Effective Date': '12/05/2025 10:00',
          'Resident Name': 'Doe, Jane',
          Type: 'Behaviour Note',
          Data: 'Another test entry',
        },
      ];

      const outputPath = join(TEST_OUTPUT_DIR, 'test_output.csv');
      await saveToCsv(testEntries, outputPath);

      const savedContent = await parseCsvFile(outputPath);

      expect(savedContent.length).toBe(2);
      expect(savedContent[0]['Resident Name']).toBe('Smith, John');
      expect(savedContent[1]['Resident Name']).toBe('Doe, Jane');
    });

    it('should handle special characters in CSV output', async () => {
      const testEntries: BehaviourEntry[] = [
        {
          'Effective Date': '12/04/2025 20:06',
          'Resident Name': "O'Brien, Mary",
          Type: 'Behaviour Note',
          Data: 'Data with "quotes" and, commas',
        },
      ];

      const outputPath = join(TEST_OUTPUT_DIR, 'special_chars.csv');
      await saveToCsv(testEntries, outputPath);

      const savedContent = await parseCsvFile(outputPath);

      expect(savedContent.length).toBe(1);
      expect(savedContent[0]['Resident Name']).toBe("O'Brien, Mary");
      expect(savedContent[0]['Data']).toContain('quotes');
    });
  });

  describe('Expected Results Validation', () => {
    const banwellResultsDir = join(TEST_RESULTS_DIR, 'banwell');

    it('should have valid structure in expected banwell results', async () => {
      const expectedFile = join(banwellResultsDir, '12-04-2025_behaviour_incidents.csv');
      const expectedEntries = await parseCsvFile(expectedFile);

      expect(expectedEntries.length).toBeGreaterThan(0);

      // Verify structure
      expectedEntries.forEach((entry) => {
        expect(entry['Effective Date']).toBeDefined();
        expect(entry['Resident Name']).toBeDefined();
        expect(entry['Type']).toBeDefined();
        expect(entry['Data']).toBeDefined();
      });
    });

    it('should have valid date format in expected results', async () => {
      const expectedFile = join(banwellResultsDir, '12-04-2025_behaviour_incidents.csv');
      const expectedEntries = await parseCsvFile(expectedFile);

      expectedEntries.forEach((entry) => {
        expect(entry['Effective Date']).toMatch(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/);
      });
    });

    it('should have valid note types in expected results', async () => {
      const expectedFile = join(banwellResultsDir, '12-04-2025_behaviour_incidents.csv');
      const expectedEntries = await parseCsvFile(expectedFile);

      const config = CHAIN_EXTRACTION_CONFIGS['kindera'];
      const validTypes = [
        ...config.behaviourNoteTypes,
        ...config.followUpNoteTypes,
        ...(config.extraFollowUpNoteTypes || []),
      ];

      expectedEntries.forEach((entry) => {
        expect(validTypes).toContain(entry['Type']);
      });
    });

    it('should have properly formatted resident names', async () => {
      const expectedFile = join(banwellResultsDir, '12-04-2025_behaviour_incidents.csv');
      const expectedEntries = await parseCsvFile(expectedFile);

      expectedEntries.forEach((entry) => {
        // Names should be "LastName, FirstName" format
        expect(entry['Resident Name']).toMatch(/^[A-Za-z' -]+,\s*[A-Za-z' -]+$/);
        // Names should not contain chain codes
        expect(entry['Resident Name']).not.toMatch(/\(\d+\)/);
      });
    });

    it('should extract unique residents from expected results', async () => {
      const expectedFile = join(banwellResultsDir, '12-04-2025_behaviour_incidents.csv');
      const expectedEntries = await parseCsvFile(expectedFile);

      const uniqueNames = new Set(expectedEntries.map((e) => e['Resident Name']));

      // Should have multiple unique residents
      expect(uniqueNames.size).toBeGreaterThan(5);
    });
  });

  describe('Parsing Logic with Real Data Patterns', () => {
    it('should correctly parse banwell-style page text', () => {
      // Simulated text based on expected banwell results format
      const pagesText = [
        `Banwell Gardens Care Centre
Facility Code: 92212
Progress Notes
Resident Name : Bernatchez, Fernand (922121005521)
Location : 3 606 B
Admission Date : 04/11/2025
Effective Date: 12/04/2025 20:06
Type: Behaviour Note
Behaviour Displayed : Resident seen by 6 hall exit door asking writer if he can go to his car.
Intervention : Resident was easily redirected from the door and back into his room.
Time, Frequency and # of Staff : 1900hrs
Evaluation of Intervention : Resident is forgetful.
Resident Response : Calm`,
      ];

      const config = CHAIN_EXTRACTION_CONFIGS['kindera'];
      const entries = getAllFallNotesInfo(pagesText, 'banwell', 'kindera', config);

      expect(entries.length).toBe(1);
      expect(entries[0]['Resident Name']).toBe('Bernatchez, Fernand');
      expect(entries[0]['Type']).toBe('Behaviour Note');
      expect(entries[0]['Effective Date']).toBe('12/04/2025 20:06');
    });

    it('should handle physical aggression note type', () => {
      const pagesText = [
        `Progress Notes
Resident Name : Karatzias, Peter (922121005487)
Location : 2 212 A
Effective Date: 12/01/2025 19:02
Type: Responsive Behaviour - Physical Agression
Data : Resident suddenly got up and slapped another resident.
Action : Residents were separated, safety checks initiated.
Response : Writer attempted to speak with resident.`,
      ];

      const config = CHAIN_EXTRACTION_CONFIGS['kindera'];
      const entries = getAllFallNotesInfo(pagesText, 'banwell', 'kindera', config);

      expect(entries.length).toBe(1);
      expect(entries[0]['Type']).toBe('Responsive Behaviour - Physical Agression');
    });
  });
});
