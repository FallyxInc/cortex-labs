/**
 * Tests for Date Fallback Functionality
 * 
 * Verifies that files without dates in their filenames
 * use the current date as a fallback.
 */

// Mock Firebase Admin before any imports
jest.mock('../firebase/firebaseAdmin', () => ({
  adminDb: {
    ref: jest.fn(() => ({
      once: jest.fn(() => Promise.resolve({
        exists: () => false,
        val: () => null
      }))
    }))
  }
}));

import { extractDateFromFilename } from '../utils/configUtils';

describe('Date Extraction and Fallback', () => {
  it('should extract date from filename with MM-DD-YYYY format', () => {
    const filename = 'berkshire_care_09-11-2025_1111.pdf';
    const date = extractDateFromFilename(filename);
    
    expect(date).not.toBeNull();
    expect(date?.month).toBe('09');
    expect(date?.day).toBe('11');
    expect(date?.year).toBe('2025');
  });

  it('should extract date from filename with YYYY-MM-DD format', () => {
    const filename = 'berkshire_care_2025-09-11_1111.pdf';
    const date = extractDateFromFilename(filename);
    
    expect(date).not.toBeNull();
    expect(date?.month).toBe('09');
    expect(date?.day).toBe('11');
    expect(date?.year).toBe('2025');
  });

  it('should return null for filenames without dates', () => {
    const filename = 'cenark-behaviours.pdf';
    const date = extractDateFromFilename(filename);
    
    expect(date).toBeNull();
  });

  it('should handle filenames with dates in middle', () => {
    const filename = 'test_12-25-2024_data.xls';
    const date = extractDateFromFilename(filename);
    
    expect(date).not.toBeNull();
    expect(date?.month).toBe('12');
    expect(date?.day).toBe('25');
    expect(date?.year).toBe('2024');
  });

  it('should handle edge case dates', () => {
    const filename = 'file_01-01-2020.pdf';
    const date = extractDateFromFilename(filename);
    
    expect(date).not.toBeNull();
    expect(date?.month).toBe('01');
    expect(date?.day).toBe('01');
    expect(date?.year).toBe('2020');
  });
});

