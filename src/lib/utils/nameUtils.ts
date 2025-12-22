/**
 * Name normalization and matching utilities.
 * Used for matching resident names across different data sources.
 */

import type { NameToIndexMap } from "@/types/hydrationProcessingTypes";

/**
 * Common name prefixes that may appear in compound surnames.
 */
const NAME_PREFIXES = new Set([
  "DE",
  "VAN",
  "VON",
  "LE",
  "LA",
  "EL",
  "DA",
  "DOS",
  "DAS",
  "DI",
  "DEL",
  "DU",
  "MAC",
  "MC",
  "O'",
  "O`",
  "SAINT",
  "ST",
]);

/**
 * Clean a name by normalizing Unicode whitespace.
 *
 * @param name - Name to clean
 * @returns Cleaned name
 */
export function cleanName(name: string): string {
  let cleaned = "";
  for (const char of name) {
    if (char === " " || !/[\u00A0\u2000-\u200B\u2028\u2029\u3000]/.test(char)) {
      cleaned += char;
    } else {
      cleaned += " ";
    }
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * Normalize a name to uppercase with single spaces.
 *
 * @param name - Name to normalize
 * @returns Normalized name in uppercase
 */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Normalize a name to "Last, First" format, removing middle names.
 *
 * @param name - Name to normalize
 * @returns Name in "Last, First" format
 */
export function normalizeToLastFirst(name: string): string {
  let cleaned = cleanName(name);
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (cleaned.includes(",")) {
    const parts = cleaned.split(",", 2);
    if (parts.length === 2) {
      const lastName = parts[0].trim();
      const firstParts = parts[1].trim().split(" ");
      if (firstParts.length > 0) {
        const firstName = firstParts[0];
        return `${lastName}, ${firstName}`;
      }
    }
  }

  return cleaned;
}

/**
 * Convert a name from "FIRST LAST" format to "LAST, FIRST" format.
 *
 * @param name - Name in "FIRST LAST" format
 * @returns Name in "LAST, FIRST" format
 */
export function convertToLastFirst(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1];
    const firstName = parts.slice(0, -1).join(" ");
    return `${lastName}, ${firstName}`;
  }
  return name;
}

/**
 * Normalize a name for token-based matching.
 * Removes punctuation and returns set of tokens.
 *
 * @param name - Name to normalize
 * @returns Set of name tokens
 */
export function normalizeNameForMatching(name: string): Set<string> {
  if (!name) return new Set();

  let normalized = name.toLowerCase();
  normalized = normalized.replace(/[^\w\s]/g, " ");

  let tokens = normalized.split(/[\s,]+/).filter((t) => t.trim().length > 0);

  if (tokens.length > 1) {
    tokens = tokens.filter((t) => t.length > 1);
  }

  tokens = tokens.filter((t) => t !== "no" && t !== "middle" && t !== "name");

  return new Set(tokens);
}

/**
 * Check if two names match based on token overlap.
 *
 * @param name1 - First name
 * @param name2 - Second name
 * @returns True if names match
 */
export function namesMatch(name1: string, name2: string): boolean {
  const tokens1 = normalizeNameForMatching(name1);
  const tokens2 = normalizeNameForMatching(name2);

  if (tokens1.size === 0 || tokens2.size === 0) {
    return false;
  }

  const isSubset = (smaller: Set<string>, larger: Set<string>): boolean => {
    for (const token of smaller) {
      if (!larger.has(token)) return false;
    }
    return true;
  };

  if (isSubset(tokens1, tokens2) || isSubset(tokens2, tokens1)) {
    return true;
  }

  const shorter = tokens1.size <= tokens2.size ? tokens1 : tokens2;
  const longer = tokens1.size <= tokens2.size ? tokens2 : tokens1;

  return isSubset(shorter, longer);
}

/**
 * Find a matching resident from a name-to-index map.
 * Handles various name format variations and fuzzy matching.
 *
 * @param name - Name to find
 * @param nameToIdx - Map of normalized names to indices
 * @returns Index of matching resident, or null if not found
 */
export function findMatchingResident(
  name: string,
  nameToIdx: NameToIndexMap
): number | null {
  const normalized = normalizeName(name);

  // Try exact match first
  if (nameToIdx.has(normalized)) {
    return nameToIdx.get(normalized)!;
  }

  // Try different name order variations
  if (!normalized.includes(",") && normalized.includes(" ")) {
    const parts = normalized.split(" ");
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstNames = parts.slice(0, -1).join(" ");
      const reversedName = `${lastName}, ${firstNames}`;
      if (nameToIdx.has(reversedName)) {
        return nameToIdx.get(reversedName)!;
      }

      if (parts.length >= 3) {
        const firstName = parts[0];
        const lastNames = parts.slice(1).join(" ");
        const altName = `${lastNames}, ${firstName}`;
        if (nameToIdx.has(altName)) {
          return nameToIdx.get(altName)!;
        }
      }
    }
  }

  // Try without common prefixes
  for (const prefix of NAME_PREFIXES) {
    const prefixWithSpace = prefix + " ";
    if (normalized.startsWith(prefixWithSpace)) {
      const withoutPrefix = normalized.substring(prefixWithSpace.length).trim();
      if (nameToIdx.has(withoutPrefix)) {
        return nameToIdx.get(withoutPrefix)!;
      }
    }
  }

  // Try fuzzy matching
  const nameParts = new Set(
    normalized
      .replace(",", "")
      .split(" ")
      .filter((p: string) => p.length > 0)
  );

  if (nameParts.size >= 2) {
    let bestMatch: number | null = null;
    let bestMatchCount = 0;

    for (const [existingName, idx] of nameToIdx.entries()) {
      const existingParts = new Set(
        existingName
          .replace(",", "")
          .split(" ")
          .filter((p) => p.length > 0)
      );

      const extractedLast = normalized.includes(",")
        ? normalized.split(",")[0].trim()
        : normalized.split(" ").pop() || "";

      const csvLast = existingName.includes(",")
        ? existingName.split(",")[0].trim()
        : existingName.split(" ").pop() || "";

      let lastNamesMatch = extractedLast === csvLast;

      if (!lastNamesMatch) {
        for (const prefix of NAME_PREFIXES) {
          const prefixWithSpace = prefix + " ";
          const extractedWithout = extractedLast.startsWith(prefixWithSpace)
            ? extractedLast.substring(prefixWithSpace.length)
            : extractedLast;
          const csvWithout = csvLast.startsWith(prefixWithSpace)
            ? csvLast.substring(prefixWithSpace.length)
            : csvLast;

          if (
            extractedWithout === csvWithout ||
            extractedWithout === csvLast ||
            extractedLast === csvWithout
          ) {
            lastNamesMatch = true;
            break;
          }
        }

        if (!lastNamesMatch) {
          const extractedWords = new Set(extractedLast.split(" "));
          const csvWords = new Set(csvLast.split(" "));

          if (extractedWords.size > 1 && csvWords.size > 1) {
            let allMatch = true;
            for (const word of extractedWords) {
              if (!csvWords.has(word)) {
                allMatch = false;
                break;
              }
            }
            if (allMatch) lastNamesMatch = true;
          }

          if (
            !lastNamesMatch &&
            (extractedWords.size > 1 || csvWords.size > 1)
          ) {
            for (const word of extractedWords) {
              if (csvWords.has(word)) {
                lastNamesMatch = true;
                break;
              }
            }
          }
        }
      }

      if (!lastNamesMatch) continue;

      let matchCount = 0;
      for (const part of nameParts) {
        if (existingParts.has(part)) matchCount++;
      }

      if (
        matchCount > bestMatchCount &&
        matchCount >= Math.min(2, nameParts.size)
      ) {
        bestMatch = idx;
        bestMatchCount = matchCount;
      }
    }

    if (bestMatch !== null) {
      return bestMatch;
    }
  }

  return null;
}

/**
 * Create a name-to-index map from an array of residents.
 *
 * @param residents - Array of objects with name property
 * @returns Map of normalized names to indices
 */
export function createNameToIndexMap<T extends { name: string }>(
  residents: T[]
): NameToIndexMap {
  const map: NameToIndexMap = new Map();
  for (let i = 0; i < residents.length; i++) {
    const name = normalizeName(residents[i].name);
    if (name) {
      map.set(name, i);
    }
  }
  return map;
}

/**
 * Title case a name (capitalize first letter of each word).
 *
 * @param name - Name to title case
 * @returns Title cased name
 */
export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
