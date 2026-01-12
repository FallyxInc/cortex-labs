/**
 * IPC (Infection Prevention & Control) CSV processor.
 * Matches IPC data to residents and adds infection information.
 */

import { namesMatch, normalizeToLastFirst, cleanName } from "@/lib/utils/nameUtils";
import type {
  HydrationRecord,
  ResidentWithIPC,
  IpcRecord,
  FileInput,
  ProcessingLogger,
} from "@/types/hydrationProcessingTypes";

/**
 * Parse an IPC CSV file content.
 * Expects columns: Resident Name, Infection Type, Infection
 *
 * @param content - CSV file content as string
 * @returns Array of IPC records
 */
export function parseIpcCsv(content: string): IpcRecord[] {
  const records: IpcRecord[] = [];
  const lines = content.split('\n');

  if (lines.length < 2) {
    return records;
  }

  // Parse header
  const header = parseCSVLine(lines[0]);
  const nameIdx = header.findIndex(h => h.toLowerCase().includes('resident') && h.toLowerCase().includes('name'));
  const infectionTypeIdx = header.findIndex(h => h.toLowerCase().includes('infection') && h.toLowerCase().includes('type'));
  const infectionIdx = header.findIndex(h => h.toLowerCase() === 'infection' ||
    (h.toLowerCase().includes('infection') && !h.toLowerCase().includes('type')));

  if (nameIdx === -1) {
    return records;
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const residentName = values[nameIdx]?.trim() || '';
    let infectionType = infectionTypeIdx >= 0 ? values[infectionTypeIdx]?.trim() || '' : '';
    let infection = infectionIdx >= 0 ? values[infectionIdx]?.trim() || '' : '';

    if (!residentName) continue;

    // Treat "Empty" as empty string
    if (infectionType.toLowerCase() === 'empty') {
      infectionType = '';
    }
    if (infection.toLowerCase() === 'empty') {
      infection = '';
    }

    records.push({
      residentName,
      infectionType,
      infection,
    });
  }

  return records;
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Load IPC data from multiple CSV files.
 * Ported from Python load_ipc_data().
 *
 * @param files - Array of CSV file inputs
 * @param logger - Optional logger
 * @returns Map of resident name to IPC data (infection_type, infection)
 */
export function loadIpcData(
  files: FileInput[],
  logger?: ProcessingLogger
): Map<string, { infectionType: string; infection: string }> {
  const ipcData = new Map<string, { infectionType: string; infection: string }>();

  if (files.length === 0) {
    logger?.warn('No IPC CSV files provided');
    return ipcData;
  }

  logger?.info(`Processing ${files.length} IPC CSV file(s)`);

  for (const file of files) {
    try {
      const content = file.buffer.toString('utf-8');
      const records = parseIpcCsv(content);

      logger?.info(`Processing ${file.fileName}: found ${records.length} records`);

      for (const record of records) {
        // Normalize the name for consistent matching
        const normalizedName = normalizeToLastFirst(cleanName(record.residentName));
        
        // If we already have data for this resident, prefer non-empty values
        if (ipcData.has(normalizedName)) {
          const existing = ipcData.get(normalizedName)!;
          if (!existing.infectionType && record.infectionType) {
            existing.infectionType = record.infectionType;
          }
          if (!existing.infection && record.infection) {
            existing.infection = record.infection;
          }
        } else {
          ipcData.set(normalizedName, {
            infectionType: record.infectionType,
            infection: record.infection,
          });
        }
      }
    } catch (error) {
      logger?.error(`Error processing ${file.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  logger?.info(`Loaded IPC data for ${ipcData.size} unique residents`);
  return ipcData;
}

/**
 * Find matching IPC resident for a given resident name.
 * Ported from Python find_matching_ipc_resident().
 *
 * @param residentName - Name to match
 * @param ipcData - Map of IPC data
 * @returns Matched IPC data or null
 */
export function findMatchingIpcResident(
  residentName: string,
  ipcData: Map<string, { infectionType: string; infection: string }>
): { ipcName: string; infectionType: string; infection: string } | null {
  // First try exact match with normalized name
  const normalizedResidentName = normalizeToLastFirst(cleanName(residentName));
  if (ipcData.has(normalizedResidentName)) {
    const data = ipcData.get(normalizedResidentName)!;
    return {
      ipcName: normalizedResidentName,
      infectionType: data.infectionType,
      infection: data.infection,
    };
  }

  // Then try fuzzy matching
  for (const [ipcName, data] of ipcData.entries()) {
    if (namesMatch(residentName, ipcName)) {
      return {
        ipcName,
        infectionType: data.infectionType,
        infection: data.infection,
      };
    }
  }
  return null;
}

/**
 * Process IPC data and add to hydration records.
 * Ported from Python process_ipc_csv().
 *
 * @param hydrationRecords - Hydration records to update
 * @param ipcFiles - IPC CSV files
 * @param logger - Optional logger
 * @returns Residents with IPC data added
 */
export function processIpcData(
  hydrationRecords: HydrationRecord[],
  ipcFiles: FileInput[],
  logger?: ProcessingLogger
): ResidentWithIPC[] {
  // Load IPC data
  const ipcData = loadIpcData(ipcFiles, logger);

  if (ipcData.size === 0) {
    logger?.info('No IPC data found, marking all residents as no IPC');
    return hydrationRecords.map(r => ({
      ...r,
      ipcFound: false,
      infection: '-',
      infectionType: '-',
    }));
  }

  // Process each resident
  let matchesFound = 0;
  const results: ResidentWithIPC[] = [];

  for (const record of hydrationRecords) {
    const match = findMatchingIpcResident(record.name, ipcData);

    if (match) {
      matchesFound++;
      logger?.info(`Match: '${record.name}' -> '${match.ipcName}' (Infection: ${match.infection || '-'}, Type: ${match.infectionType || '-'})`);

      results.push({
        ...record,
        ipcFound: true,
        infection: match.infection || '-',
        infectionType: match.infectionType || '-',
      });
    } else {
      results.push({
        ...record,
        ipcFound: false,
        infection: '-',
        infectionType: '-',
      });
    }
  }

  logger?.info(`Found ${matchesFound} matches out of ${hydrationRecords.length} residents`);

  return results;
}

