// TypeScript port of getPdfInfo.py - PDF processing and extraction

import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import { PDFParse } from "pdf-parse";
import { callClaudeAPI } from "@/lib/claude-client";
import {
  ChainExtractionConfig,
  BehaviourEntry,
  INJURY_TYPES_GROUP1,
  INJURY_TYPES_GROUP2,
  ALL_INJURY_TYPES,
} from "./types";

import { LoadParameters } from "pdf-parse";
import { extractDateFromFilename, CHAIN_EXTRACTION_CONFIGS } from "@/lib/utils/configUtils";

export async function extractTextFromPdf(
  pdfPath: string,
  maxPages: number = 500,
): Promise<string[]> {
  try {
    const dataBuffer = await readFile(pdfPath);

    const parameters: LoadParameters = {
      data: dataBuffer,
    };

    const parser = new PDFParse(parameters);
    const result = await parser.getText();
    await parser.destroy();

    const text = result.text;
    await writeFile(pdfPath + ".txt", text, "utf-8");
    return result.pages.map((page) => page.text);
  } catch (error) {
    console.error(`Error extracting text from PDF: ${error}`);
    return [];
  }
}

export function getResidentNameFromHeader(pageText: string): string {
  // const nameMatch = pageText.match(/Resident Name\s*:\s*([^\n\r]+)/i);

  const nameMatch = pageText.match(/Resident Name\s*:\s*([^0-9]+?)\d/);
  if (!nameMatch) return "Unknown";

  let name = nameMatch[1].trim();

  // Trim off other header fields that may live on the same line
  name = name.replace(
    /\s+(Location|Admission|Date Range|Community|Author|Department|Resident Name)\b.*$/i,
    "",
  );

  // Remove chain codes that trail the name (e.g. "(SL16-2019)" or partial "(SL")
  name = name.replace(/\s*\(SL[^)]*\)?$/i, "").trim();
  name = name
    .replace(/\s*\([A-Z]{1,4}\d{1,4}(?:-[0-9]{2,4})?\)\s*$/i, "")
    .trim();

  name = name.replace(/\s*\(+\s*$/, "").trim();

  return name || "Unknown";
}

export function findPosition(
  pagesText: string[],
  targetP: number,
): { pageIndex: number; relPos: number; pageStart: number } {
  let currentPosition = 0;
  for (let i = 0; i < pagesText.length; i++) {
    const pageLength = pagesText[i].length + 2; // +2 for '\n\n'
    if (currentPosition <= targetP && targetP < currentPosition + pageLength) {
      return {
        pageIndex: i,
        relPos: targetP - currentPosition,
        pageStart: currentPosition,
      };
    }
    currentPosition += pageLength;
  }
  return { pageIndex: -1, relPos: -1, pageStart: -1 };
}

export function findEffectiveDates(allText: string): number[] {
  const positions: number[] = [];
  const regex = /Effective Date:/g;
  let match;
  while ((match = regex.exec(allText)) !== null) {
    positions.push(match.index);
  }
  return positions;
}

/**
 * Get all behaviour note info from PDF pages using chain-specific configuration
 * If homeId is provided, uses that chain's note types; otherwise, uses all known types
 */
export function getAllFallNotesInfo(
  pagesText: string[],
  homeId: string,
  chainId: string,
  chainExtractionConfig?: ChainExtractionConfig | null,
): BehaviourEntry[] {
  const entries: BehaviourEntry[] = [];
  const allText = pagesText.join("\n\n");
  const effectiveDatePositions = findEffectiveDates(allText);

  const config =
    chainExtractionConfig ||
    CHAIN_EXTRACTION_CONFIGS[chainId] ||
    CHAIN_EXTRACTION_CONFIGS["responsive"];

  const allowedNoteTypes: string[] = [
    ...config.behaviourNoteTypes,
    ...config.followUpNoteTypes,
    ...(config.extraFollowUpNoteTypes || []),
  ];

  if (!allowedNoteTypes.length) {
    console.warn(
      `No note types configured for chain ${chainId}; skipping PDF extraction`,
    );
    return entries;
  }

  // Build regex pattern from allowed note types
  const noteTypePattern = allowedNoteTypes
    .map((type) => type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const typeRegex = new RegExp(`Type:\\s*(${noteTypePattern})`);

  for (let i = 0; i < effectiveDatePositions.length; i++) {
    const pos = effectiveDatePositions[i];
  const { pageIndex } = findPosition(pagesText, pos);
    if (pageIndex === -1) continue;

    const endOfNote =
      i < effectiveDatePositions.length - 1
        ? effectiveDatePositions[i + 1]
        : allText.length;
    const section = allText.substring(pos, endOfNote).trim();

    const dateMatch = section.match(
      /Effective Date:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/,
    );
    if (!dateMatch) {
      console.log("No date match found");
      continue;
    }
    const noteDate = dateMatch[1];

    const typeMatch = section.match(typeRegex);
    if (!typeMatch) {
      console.log("No type match found");
      continue;
    }

    // Skip false matches with multiple types
    const typeLineStart = typeMatch.index!;
    const typeLineEnd = section.indexOf("\n", typeLineStart);
    const typeLine = section
      .substring(
        typeLineStart,
        typeLineEnd === -1 ? section.length : typeLineEnd,
      )
      .trim();

    if (
      typeLine.includes(
        "Type: Behaviour - Follow up, Behaviour - Responsive Behaviour",
      ) ||
      typeLine.split(",").length > 1
    ) {
      continue;
    }

    const noteType = typeMatch[1];

    // Get resident name from current, next, or next-next page
    let residentName = getResidentNameFromHeader(pagesText[pageIndex]);
    if (residentName === "Unknown" && pageIndex + 1 < pagesText.length) {
      residentName = getResidentNameFromHeader(pagesText[pageIndex + 1]);
    }
    if (residentName === "Unknown" && pageIndex + 2 < pagesText.length) {
      residentName = getResidentNameFromHeader(pagesText[pageIndex + 2]);
    }

    // Extract note content
    const typeEnd = typeMatch.index! + typeMatch[0].length;
    let noteContent = section.substring(typeEnd).trim();

    // Clean headers/footers
    const noteContentParts = noteContent.split("\n\n");
    const cleanedParts = noteContentParts
      .map((part) => {
        const lines = part
          .split("\n")
          .filter(
            (line) =>
              !line
                .trim()
                .match(
                  /^(Facility #|Date:|Time:|Primary Physician:|User:|Progress Notes|Admission|Date of Birth|Gender|Allergies|Diagnoses|Location|Medical Record #|Physician|Pharmacy|Page \d+ of \d+|Author:|Signature:)/,
                ),
          );
        return lines.join(" ").trim();
      })
      .filter((part) => part);

    noteContent = cleanedParts.join(" ").replace(/\s+/g, " ").trim();

    // Only add if the note type is in our allowed list
    if (allowedNoteTypes.includes(noteType)) {
      entries.push({
        "Effective Date": noteDate,
        "Resident Name": residentName,
        Type: noteType,
        Data: noteContent,
      });
      console.log(
        `Found entry - Date: ${noteDate}, Resident: ${residentName}, Type: ${noteType}`,
      );
    }
  }

  return entries;
}

export async function detectInjuries(
  data: string,
  noteType: string,
  previousInjuries: string,
  _apiKey: string,
): Promise<string> {
  void _apiKey;
  if (previousInjuries !== "No Previous Injuries") {
    return previousInjuries;
  }

  if (!data) {
    return "No Injury";
  }

  try {
    const systemPrompt = "You are a medical assistant trained to detect specific injuries in medical notes.";

    const prompt1 = `
Carefully review the following medical note and determine which of these specific injuries are present:
${INJURY_TYPES_GROUP1.join(", ")}

Only list injuries that are actually present and current (not denied, not old injuries, not "no signs of").
E.X. do not list pain as an injury if the note states the resident denies pain or if there was no noted sign of pain
List ONLY the injury terms from the provided list, separated by commas. If none are present, respond with "None".

Note: ${data}
`;

    const response1Text = await callClaudeAPI(systemPrompt, prompt1, {
      maxTokens: 50,
      temperature: 0.1,
    });

    const prompt2 = `
Carefully review the following medical note and determine which of these specific injuries are present:
${INJURY_TYPES_GROUP2.join(", ")}

Only list injuries that are actually present and current (not denied, not old injuries, not "no signs of").
E.X. do not list pain as an injury if the note states the resident denies pain or if there was no noted sign of pain
List ONLY the injury terms from the provided list, separated by commas. If none are present, respond with "None".

Note: ${data}
`;

    const response2Text = await callClaudeAPI(systemPrompt, prompt2, {
      maxTokens: 50,
      temperature: 0.1,
    });

    const validateInjuries = (responseText: string): string[] => {
      if (responseText.toLowerCase() === "none") {
        return [];
      }
      const potentialInjuries = responseText
        .split(",")
        .map((term) => term.trim().toLowerCase());
      return potentialInjuries.filter((term) =>
        ALL_INJURY_TYPES.includes(term),
      );
    };

    const injuries1 = validateInjuries(response1Text.trim());
    const injuries2 = validateInjuries(response2Text.trim());

    const allInjuries = [...new Set([...injuries1, ...injuries2])].sort();

    return allInjuries.length > 0 ? allInjuries.join(", ") : "No Injury";
  } catch (error) {
    console.error(`Error in injury detection: ${error}`);
    return "No Injury";
  }
}

export async function checkForHeadInjury(
  note: string,
  previousInjuries: string,
  _apiKey: string,
): Promise<boolean> {
  void _apiKey;
  if (previousInjuries !== "No Previous Injuries") {
    return false;
  }

  try {
    const systemPrompt = "You are a medical assistant trained to detect head injuries in medical notes.";

    const prompt = `
Carefully review the following medical note and determine if there is any indication of a physical head injury.
Look for terms like head trauma, impact to head, head wound, scalp injury, etc. Any issues with cognition and imbalance and head nodding are not indications of head injury
Do not confuse occurances of "head injury routine" with a current head injury, they are not the same.
Analyze the note twice before giving an answer and don't confuse the fall note headings for head injury information.
Respond with ONLY 'Yes' or 'No'.

Note: ${note}

Are there any signs of a head injury in this note?
`;

    const response = await callClaudeAPI(systemPrompt, prompt, {
      maxTokens: 10,
      temperature: 0.2,
    });

    const responseText = response.toLowerCase().trim();
    return responseText.includes("yes");
  } catch (error) {
    console.error(`Error in head injury detection: ${error}`);
    return false;
  }
}

export async function saveToCsv(
  entries: BehaviourEntry[],
  outputFile: string,
): Promise<void> {
  if (entries.length === 0) {
    console.warn("No entries found to save");
    return;
  }

  const headers = Object.keys(entries[0]);
  const csvContent = [
    headers.join(","),
    ...entries.map((entry) =>
      headers
        .map((header) => {
          const value = entry[header as keyof BehaviourEntry] || "";
          // Escape quotes and wrap in quotes if contains comma or newline
          const escaped = String(value).replace(/"/g, '""');
          return escaped.includes(",") || escaped.includes("\n")
            ? `"${escaped}"`
            : escaped;
        })
        .join(","),
    ),
  ].join("\n");

  await writeFile(outputFile, csvContent, "utf-8");
  console.log(`Successfully saved ${entries.length} entries to ${outputFile}`);
}

/**
 * Process PDF files and extract behaviour incidents
 * Automatically detects home/chain from filename for chain-specific extraction
 */
export async function processPdfFiles(
  downloadsDir: string,
  analyzedDir: string,
  homeId: string,
  chainId: string,
  chainExtractionConfig?: ChainExtractionConfig | null,
): Promise<void> {
  const files = await readdir(downloadsDir);
  const pdfFiles = files.filter((f) => f.toLowerCase().endsWith(".pdf"));

  if (pdfFiles.length === 0) {
    console.error("No PDF files found in the downloads directory.");
    return;
  }

  for (const pdfFile of pdfFiles) {
    const pdfPath = join(downloadsDir, pdfFile);
    console.log(`Starting PDF parsing process for: ${pdfPath}`);

    const pagesText = await extractTextFromPdf(pdfPath);
    if (pagesText.length === 0) {
      console.error(`Failed to extract text from PDF: ${pdfPath}`);
      continue;
    }

    const entries = getAllFallNotesInfo(
      pagesText,
      homeId,
      chainId,
      chainExtractionConfig,
    );
    console.log(`Fall Notes Info Length: ${entries.length}`);

    let date = extractDateFromFilename(pdfFile);
    
    // Fallback to current date if no date found in filename
    if (!date) {
      console.warn(`⚠️ Date information not found in PDF file: ${pdfFile}. Using current date as fallback.`);
      const now = new Date();
      date = {
        month: String(now.getMonth() + 1).padStart(2, '0'),
        day: String(now.getDate()).padStart(2, '0'),
        year: String(now.getFullYear())
      };
    }
    
    const dateDir = join(
      analyzedDir,
      `${date.month}-${date.day}-${date.year}`,
    );

    // Create directory (Next.js fs/promises doesn't have mkdir with recursive option in some versions)
    const { mkdir: mkdirNode } = await import("fs/promises");
    await mkdirNode(dateDir, { recursive: true });

    const baseName = pdfFile.replace(/\.pdf$/i, "");
    const outputCsv = join(dateDir, `${date.month}-${date.day}-${date.year}_behaviour_incidents.csv`);

    await saveToCsv(entries, outputCsv);
  }

  console.log("PDF processing completed");
}
