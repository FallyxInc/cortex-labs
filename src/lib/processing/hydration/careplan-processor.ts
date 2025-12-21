/**
 * Care Plan PDF processor.
 * Extracts resident names, mL goals, and feeding tube information from care plan PDFs.
 * Ported from Python careplan.py.
 */

import { extractPdfPages } from "./pdf-utils";
import { cleanName, titleCase } from "./name-utils";
import type { CarePlanResident, FileInput, ProcessingLogger } from "./types";

/**
 * Words to skip when extracting resident names.
 */
const SKIP_WORDS = [
  "Admission Date",
  "Facility",
  "Location",
  "Print Date",
  "Admissiondate",
  "Delusional",
  "Disorder",
];

/**
 * Feeding tube related patterns to detect.
 */
const FEEDING_TUBE_PATTERNS = [
  /feeding\s+tube/i,
  /g\s*tube/i,
  /gastrostomy/i,
  /peg\s*tube/i,
  /jejunostomy/i,
  /j\s*tube/i,
  /nasogastric/i,
  /ng\s*tube/i,
  /enteral\s+nutrition/i,
  /tube\s+feeding/i,
  /gastric\s+tube/i,
  /feeding\s+tube\s+managed/i,
  /feeding\s+tube\s+management/i,
  /via\s+feeding\s+tube/i,
];

/**
 * Extract resident names from text.
 * Looks for patterns like "LASTNAME, FIRSTNAME (ID)".
 * Ported from Python extract_resident_names().
 *
 * @param text - Text to search
 * @returns Array of extracted names in "Last, First" format
 */
export function extractResidentNames(text: string): string[] {
  const names: string[] = [];

  // Pattern 1: Standard format "LASTNAME, FIRSTNAME (ID)" - flexible ID length (4+ digits)
  const pattern1 = /\b([A-Z][A-Za-z\s'-]+,\s+[A-Z][A-Za-z\s'-]+)\s*\(\d{4,}\)/g;

  // Pattern 2: Alternative format with different spacing
  const pattern2 = /\b([A-Z][A-Za-z\s'-]+,\s*[A-Z][A-Za-z\s'-]+)\s*\(\d{4,}\)/g;

  // Pattern 3: Names with multiple parts
  const pattern3 =
    /\b([A-Z][A-Za-z\s'-]+,?\s+[A-Z][A-Za-z\s'-]+)\s*\(\d{4,}\)/g;

  // Pattern 4: ID with dash format (000-00)
  const pattern4 =
    /\b([A-Z][A-Za-z\s'-]+,\s*[A-Z][A-Za-z\s'-]+)\s*\(\d{3}-\d{2}\)/g;

  // Pattern 5: ID with shorter dash format (00-00)
  const pattern5 =
    /\b([A-Z][A-Za-z\s'-]+,\s*[A-Z][A-Za-z\s'-]+)\s*\(\d{2}-\d{2}\)/g;

  const patterns = [pattern1, pattern2, pattern3, pattern4, pattern5];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let name = match[1].trim();
      name = titleCase(name);
      name = cleanName(name);

      // Skip if name contains any skip words
      const nameLower = name.toLowerCase();
      const shouldSkip = SKIP_WORDS.some((skipWord) =>
        nameLower.includes(skipWord.toLowerCase())
      );

      if (!shouldSkip) {
        names.push(name);
      }
    }
  }

  // Remove duplicates while preserving order
  const seen = new Set<string>();
  const uniqueNames: string[] = [];
  for (const name of names) {
    if (!seen.has(name)) {
      seen.add(name);
      uniqueNames.push(name);
    }
  }

  return uniqueNames;
}

/**
 * Extract fluid target values (mL) from text.
 * Looks for patterns like "FLUID TARGET: ... 1500ml".
 * Ported from Python extract_fluid_targets_ml().
 *
 * @param text - Text to search
 * @returns Array of mL values found
 */
export function extractFluidTargetsMl(text: string): number[] {
  const targets: number[] = [];

  // Pattern 1: FLUID TARGET followed by any text and then number with ml/mL
  const pattern1 = /FLUID\s*TARGET[^0-9]*?(\d{3,})\s*(mL|ml)/gi;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    const num = parseInt(match[1].replace(",", ""), 10);
    if (!isNaN(num)) {
      targets.push(num);
    }
  }

  // Pattern 2: Look for lines containing "FLUID TARGET" and extract numbers with ml/mL
  const lines = text.split("\n");
  for (const line of lines) {
    if (/FLUID\s*TARGET/i.test(line)) {
      const numberPattern = /(\d{3,})\s*(mL|ml)/gi;
      while ((match = numberPattern.exec(line)) !== null) {
        const num = parseInt(match[1].replace(",", ""), 10);
        if (!isNaN(num)) {
          targets.push(num);
        }
      }
    }
  }

  // Remove duplicates while preserving order
  const seen = new Set<number>();
  const uniqueTargets: number[] = [];
  for (const target of targets) {
    if (!seen.has(target)) {
      seen.add(target);
      uniqueTargets.push(target);
    }
  }

  return uniqueTargets;
}

/**
 * Check if text contains feeding tube information.
 * Ported from Python extract_feeding_tube_info().
 *
 * @param text - Text to search
 * @returns True if feeding tube mentioned
 */
export function extractFeedingTubeInfo(text: string): boolean {
  for (const pattern of FEEDING_TUBE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Process a care plan PDF and extract resident data.
 * Ported from Python process_care_plan_comprehensive().
 *
 * @param buffer - PDF file buffer
 * @param fileName - Original filename for source tracking
 * @param logger - Optional logger for debug output
 * @returns Array of extracted residents
 */
export async function processCarePlan(
  buffer: Buffer,
  fileName: string,
  logger?: ProcessingLogger
): Promise<CarePlanResident[]> {
  const pages = await extractPdfPages(buffer);

  // Maps to track resident data across pages
  const residentTargets = new Map<string, number>();
  const residentFeedingTubes = new Map<string, boolean>();

  logger?.info(`Processing ${fileName} with ${pages.length} pages`);

  // First pass: Find pages with fluid targets and associate with residents
  for (let pageNum = 0; pageNum < pages.length; pageNum++) {
    const pageText = pages[pageNum];
    const names = extractResidentNames(pageText);
    const targets = extractFluidTargetsMl(pageText);
    const hasFeedingTube = extractFeedingTubeInfo(pageText);

    // If we found both names and targets on this page, associate them
    if (names.length > 0 && targets.length > 0) {
      const mainTarget = targets[0];
      for (const name of names) {
        if (!residentTargets.has(name)) {
          residentTargets.set(name, mainTarget);
        }
      }
    }

    // Track feeding tube info
    if (names.length > 0 && hasFeedingTube) {
      for (const name of names) {
        residentFeedingTubes.set(name, true);
      }
    }

    // For pages with names but no targets, look ONLY in forward pages.
    // Each resident's care plan spans multiple consecutive pages, with
    // the fluid target appearing on a later page within that section.
    // Looking backward would incorrectly find the previous resident's target.
    if (names.length > 0 && targets.length === 0) {
      // Look further forward - care plan sections can span 15-20 pages
      for (let offset = 1; offset <= 20; offset++) {
        const forwardIdx = pageNum + offset;
        if (forwardIdx < pages.length) {
          // Only use target if it's still within this resident's section
          // (i.e., the page still contains this resident's name)
          const forwardPage = pages[forwardIdx];
          const forwardNames = extractResidentNames(forwardPage);
          const forwardTargets = extractFluidTargetsMl(forwardPage);

          // Check if any of the current names are on the forward page
          const sameResident = names.some((name) =>
            forwardNames.includes(name)
          );

          if (forwardTargets.length > 0 && sameResident) {
            for (const name of names) {
              if (!residentTargets.has(name) && forwardNames.includes(name)) {
                residentTargets.set(name, forwardTargets[0]);
              }
            }
            break;
          }

          // Stop looking if we've moved to a different resident's section
          if (forwardNames.length > 0 && !sameResident) {
            break;
          }
        }
      }
    }
  }

  // Comprehensive search for residents still without targets
  for (const [name, target] of residentTargets.entries()) {
    if (target === undefined || target === null) {
      const nameParts = name.split(",");
      if (nameParts.length >= 2) {
        const lastName = nameParts[0].trim().toLowerCase();
        const firstName = nameParts[1].trim().toLowerCase();

        for (const pageText of pages) {
          const pageTextLower = pageText.toLowerCase();
          if (
            (pageTextLower.includes(lastName) &&
              pageTextLower.includes(firstName)) ||
            pageTextLower.includes(name.toLowerCase())
          ) {
            const searchTargets = extractFluidTargetsMl(pageText);
            if (searchTargets.length > 0) {
              residentTargets.set(name, searchTargets[0]);
              break;
            }
          }
        }
      }
    }
  }

  // Collect all unique residents
  const residents: CarePlanResident[] = [];
  const seenResidents = new Set<string>();

  for (let pageNum = 0; pageNum < pages.length; pageNum++) {
    const pageText = pages[pageNum];
    const names = extractResidentNames(pageText);

    for (const name of names) {
      if (!seenResidents.has(name)) {
        seenResidents.add(name);

        const targetMl = residentTargets.get(name) ?? null;
        const hasFeedingTube = residentFeedingTubes.get(name) ?? false;

        residents.push({
          name,
          mlGoal: targetMl,
          sourceFile: `${fileName} - Page ${pageNum + 1}`,
          hasFeedingTube,
        });

        if (targetMl === null) {
          logger?.warn(`No hydration target found for ${name}`);
        }
      }
    }
  }

  logger?.info(`Extracted ${residents.length} residents from ${fileName}`);

  return residents;
}

/**
 * Process multiple care plan PDFs.
 *
 * @param files - Array of file inputs
 * @param logger - Optional logger
 * @returns Combined array of all residents
 */
export async function processCarePlans(
  files: FileInput[],
  logger?: ProcessingLogger
): Promise<CarePlanResident[]> {
  const allResidents: CarePlanResident[] = [];

  for (const file of files) {
    try {
      const residents = await processCarePlan(
        file.buffer,
        file.fileName,
        logger
      );
      allResidents.push(...residents);
    } catch (error) {
      logger?.error(
        `Error processing ${file.fileName}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  return allResidents;
}

