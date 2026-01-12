/**
 * Hydration Data PDF processor.
 * Extracts daily hydration totals from hydration data PDFs.
 */

import { extractPdfPages } from "@/lib/utils/pdfUtils";
import {
  cleanName,
  convertToLastFirst,
  findMatchingResident,
  createNameToIndexMap,
} from "@/lib/utils/nameUtils";
import type {
  CarePlanResident,
  HydrationRecord,
  FileInput,
  ProcessingLogger,
} from "@/types/hydrationProcessingTypes";

/**
 * Extract the resident name from hydration PDF text.
 * Ported from Python extract_resident_name().
 *
 * @param text - Text to search
 * @returns Extracted name in "LAST, FIRST" format, or null
 */
export function extractResidentName(text: string): string | null {
  // Pattern 1: Look for "Resident Name:" format in hydration-data PDFs
  if (text.includes('Resident Name:')) {
    const parts = text.split('Resident Name:');
    if (parts.length > 1) {
      const afterName = parts[1];
      if (afterName.includes('Resident Location:')) {
        const namePart = afterName.split('Resident Location:')[0];
        let name = namePart.trim().toUpperCase();
        name = cleanName(name);

        // Remove trailing non-letter characters (keep apostrophe variants and hyphens)
        name = name.replace(/[^A-Z\s'`''-]+$/, '').trim();

        // Remove trailing 'R' if it's clearly a trailing character
        if (name.endsWith('R') && name.length > 1) {
          const secondLastChar = name[name.length - 2];
          if (!/[A-Z]/.test(secondLastChar) || name.length === 2) {
            name = name.slice(0, -1);
          }
        }

        // Convert to "LAST, FIRST" format
        return convertToLastFirst(name);
      }
    }
  }

  // Pattern 2: Look for "LAST, FIRST (ID)" format
  const pattern2 = /([A-Z][A-Z\s'`''-]+),\s*([A-Z][A-Z\s'`''-]+)\s*\(\d+\)/;
  const match2 = text.match(pattern2);
  if (match2) {
    const lastName = cleanName(match2[1].trim());
    const firstName = cleanName(match2[2].trim());
    return `${lastName}, ${firstName}`;
  }

  // Pattern 3: Look for standalone "LAST, FIRST" pattern
  const pattern3 = /([A-Z][A-Z\s'`''-]+),\s*([A-Z][A-Z\s'`''-]+)(?=\s*\(|\s*$|\s*\d)/;
  const match3 = text.match(pattern3);
  if (match3) {
    const lastName = cleanName(match3[1].trim());
    const firstName = cleanName(match3[2].trim());
    return `${lastName}, ${firstName}`;
  }

  return null;
}

/**
 * Extract "Total By Day" values from hydration PDF text.
 * Ported from Python extract_total_by_day().
 *
 * @param text - Text to search
 * @returns Array of daily total values
 */
export function extractTotalByDay(text: string): number[] {
  let totals: number[] = [];

  // Pattern 1: Concatenated format like "Total By Day2200.02250.01275.0"
  const pattern1 = /Total\s*By\s*Day((?:\d{3,4}\.0)+)/i;
  const match1 = text.match(pattern1);
  if (match1) {
    const values = match1[1].match(/(\d{3,4})\.0/g);
    if (values) {
      totals = values.map(v => parseFloat(v));
    }
  }

  // Pattern 2: Space-separated format like "Total By Day 1775.0 1850.0 1750.0"
  if (totals.length === 0) {
    const pattern2 = /Total\s*By\s*Day\s+([\d\s.]+?)(?=Resident\s*Name:|$)/i;
    const match2 = text.match(pattern2);
    if (match2) {
      const numbers = match2[1].match(/(\d+(?:\.\d+)?)/g);
      if (numbers) {
        totals = numbers.map(n => parseFloat(n));
      }
    }
  }

  // Fallback: look for "Total By Day" in lines
  if (totals.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('Total By Day')) {
        const pattern = /Total\s*By\s*Day\s+([\d\s.]+?)(?=Resident\s*Name:|$)/i;
        const match = line.match(pattern);
        if (match) {
          const numbers = match[1].match(/(\d+(?:\.\d+)?)/g);
          if (numbers && numbers.length >= 1) {
            totals = numbers.map(n => parseFloat(n.replace(',', '')));
          }
        }
        break;
      }
    }
  }

  return totals;
}

/**
 * Extract the start date from hydration PDF text.
 * Ported from Python extract_start_date().
 *
 * @param text - Text to search
 * @returns Parsed Date object, or null
 */
export function extractStartDate(text: string): Date | null {
  const pattern = /Start\s*Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i;
  const match = text.match(pattern);
  if (match) {
    const month = parseInt(match[1], 10) - 1; // JS months are 0-indexed
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    return new Date(year, month, day);
  }
  return null;
}

/**
 * Calculate date column names based on start date and number of days.
 * Ported from Python calculate_date_columns().
 *
 * @param startDate - Start date
 * @param numDays - Number of days
 * @returns Array of date strings in MM/DD/YYYY format
 */
export function calculateDateColumns(startDate: Date, numDays: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < numDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    dates.push(`${month}/${day}/${year}`);
  }
  return dates;
}

/**
 * Calculate "Missed 3 Days" status for a resident.
 * Checks if there are any 3 consecutive days below goal.
 * Ported from Python calculate_missed_3_days().
 *
 * @param goal - mL goal
 * @param dateData - Record of date -> mL consumed
 * @returns True if missed goal for 3 consecutive days
 */
export function calculateMissed3Days(
  goal: number | null,
  dateData: Record<string, number>
): boolean {
  if (goal === null || goal <= 0) {
    return false;
  }

  // Get all dates and sort them
  const dateEntries: { date: Date; dateStr: string; value: number }[] = [];
  for (const [dateStr, value] of Object.entries(dateData)) {
    try {
      const [month, day, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      dateEntries.push({ date, dateStr, value });
    } catch {
      continue;
    }
  }

  dateEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (dateEntries.length < 3) {
    return false;
  }

  // Check all possible 3 consecutive day windows
  for (let i = 0; i < dateEntries.length - 2; i++) {
    const date1 = dateEntries[i];
    const date2 = dateEntries[i + 1];
    const date3 = dateEntries[i + 2];

    // Check if dates are consecutive
    const diff1 = (date2.date.getTime() - date1.date.getTime()) / (1000 * 60 * 60 * 24);
    const diff2 = (date3.date.getTime() - date2.date.getTime()) / (1000 * 60 * 60 * 24);

    if (diff1 === 1 && diff2 === 1) {
      const val1 = date1.value;
      const val2 = date2.value;
      const val3 = date3.value;

      // Check if all three days are 0 OR all three are below goal
      if ((val1 === 0 && val2 === 0 && val3 === 0) ||
          (val1 < goal && val2 < goal && val3 < goal)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Process a single hydration PDF and update resident records.
 * Ported from Python process_dat_pdf().
 *
 * @param buffer - PDF file buffer
 * @param fileName - Original filename
 * @param residents - Current resident records to update
 * @param isExtra - Whether this is an "extra" file (add to existing values)
 * @param logger - Optional logger
 * @returns Updated residents and set of all date columns
 */
export async function processHydrationPdf(
  buffer: Buffer,
  fileName: string,
  residents: HydrationRecord[],
  isExtra: boolean,
  logger?: ProcessingLogger
): Promise<{ residents: HydrationRecord[]; dateColumns: Set<string> }> {
  const pages = await extractPdfPages(buffer);
  const nameToIdx = createNameToIndexMap(residents);
  const allDateColumns = new Set<string>();

  // First pass: find most common start date as fallback
  const startDateCounts = new Map<string, number>();
  for (const pageText of pages) {
    const startDate = extractStartDate(pageText);
    if (startDate) {
      const dateStr = formatDate(startDate);
      startDateCounts.set(dateStr, (startDateCounts.get(dateStr) || 0) + 1);
    }
  }

  let defaultStartDate: Date | null = null;
  if (startDateCounts.size > 0) {
    let maxCount = 0;
    let mostCommonDateStr = '';
    for (const [dateStr, count] of startDateCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonDateStr = dateStr;
      }
    }
    if (mostCommonDateStr) {
      const [month, day, year] = mostCommonDateStr.split('/').map(Number);
      defaultStartDate = new Date(year, month - 1, day);
    }
  }

  // If no start dates found, use yesterday minus 2 days
  if (!defaultStartDate) {
    defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 2);
    logger?.warn(`No start dates found in ${fileName}, using default: ${formatDate(defaultStartDate)}`);
  }

  // Second pass: process all pages
  for (let pageNum = 0; pageNum < pages.length; pageNum++) {
    const pageText = pages[pageNum];
    const resName = extractResidentName(pageText);
    const totals = extractTotalByDay(pageText);
    let startDate = extractStartDate(pageText);

    if (!resName || totals.length === 0) {
      continue;
    }

    // Use default start date if not found
    if (!startDate) {
      startDate = defaultStartDate;
      logger?.warn(`No start date found for ${resName} on page ${pageNum + 1}, using default`);
    }

    // Calculate date columns
    const dateColumns = calculateDateColumns(startDate, totals.length);
    for (const col of dateColumns) {
      allDateColumns.add(col);
    }

    // Find matching resident
    const idx = findMatchingResident(resName, nameToIdx);
    if (idx === null) {
      logger?.warn(`Skipping ${resName} - not found in existing residents`);
      continue;
    }

    if (isExtra) {
      // Extra hydration - ADD to existing values
      for (let i = 0; i < dateColumns.length && i < totals.length; i++) {
        const dateCol = dateColumns[i];
        const dayValue = totals[i];
        const existingValue = residents[idx].dateData[dateCol] || 0;
        residents[idx].dateData[dateCol] = existingValue + dayValue;
      }
      logger?.info(`Processing EXTRA ${resName}: ${totals.join(', ')}`);
    } else {
      // Regular hydration - set values
      logger?.info(`Processing ${resName}: ${totals.join(', ')} (dates: ${dateColumns.join(', ')})`);

      if (!residents[idx].sourceFile) {
        residents[idx].sourceFile = `${fileName} - Page ${pageNum + 1}`;
      }

      for (let i = 0; i < dateColumns.length && i < totals.length; i++) {
        residents[idx].dateData[dateColumns[i]] = totals[i];
      }
    }
  }

  return { residents, dateColumns: allDateColumns };
}

/**
 * Format a date as MM/DD/YYYY.
 */
function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Process multiple hydration PDFs.
 *
 * @param files - Array of file inputs
 * @param carePlanResidents - Residents from care plan processing
 * @param logger - Optional logger
 * @returns Array of hydration records with date data
 */
export async function processHydrationPdfs(
  files: FileInput[],
  carePlanResidents: CarePlanResident[],
  logger?: ProcessingLogger
): Promise<HydrationRecord[]> {
  // Convert CarePlanResidents to HydrationRecords
  let residents: HydrationRecord[] = carePlanResidents.map(r => ({
    ...r,
    dateData: {},
    missed3Days: false,
  }));

  // Separate regular and extra files
  const regularFiles: FileInput[] = [];
  const extraFiles: FileInput[] = [];

  for (const file of files) {
    if (file.fileName.toLowerCase().includes('extra')) {
      extraFiles.push(file);
    } else {
      regularFiles.push(file);
    }
  }

  // Sort files for consistent processing
  regularFiles.sort((a, b) => a.fileName.localeCompare(b.fileName));
  extraFiles.sort((a, b) => a.fileName.localeCompare(b.fileName));

  logger?.info(`Found ${regularFiles.length} regular PDFs and ${extraFiles.length} extra PDFs`);

  // Process regular files first
  for (const file of regularFiles) {
    try {
      const result = await processHydrationPdf(
        file.buffer,
        file.fileName,
        residents,
        false,
        logger
      );
      residents = result.residents;
    } catch (error) {
      logger?.error(`Error processing ${file.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Then process extra files (add to existing values)
  for (const file of extraFiles) {
    try {
      const result = await processHydrationPdf(
        file.buffer,
        file.fileName,
        residents,
        true,
        logger
      );
      residents = result.residents;
    } catch (error) {
      logger?.error(`Error processing ${file.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Calculate "Missed 3 Days" status for all residents
  logger?.info('Calculating "Missed 3 Days" status...');
  for (const resident of residents) {
    resident.missed3Days = calculateMissed3Days(resident.mlGoal, resident.dateData);
  }

  return residents;
}

