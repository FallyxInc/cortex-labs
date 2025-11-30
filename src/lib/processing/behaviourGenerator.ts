// TypeScript port of getBe.py - Behaviour data generation and merging
// Extensible system supporting multiple chains with different extraction formats

import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import OpenAI from "openai";
import {
  BehaviourEntry,
  DEFAULT_NO_PROGRESS_TEXT,
  DEFAULT_NO_PROGRESS_TEXT_SHORT,
  ChainExtractionConfig,
  ExtractedBehaviourFields,
  FieldExtractionConfig,
} from "./types";
import { CHAIN_EXTRACTION_CONFIGS } from "./homesDb";

let openaiClient: OpenAI | null = null;

function initOpenAI(apiKey: string) {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function cleanName(name: string | null | undefined): string {
  if (!name) return "";
  const cleaned = String(name).trim();
  if (cleaned.includes(",")) {
    const [last, first] = cleaned.split(",", 2);
    return `${last.trim()}, ${first.trim()}`;
  }
  return cleaned;
}

/**
 * Extract a single field from behaviour note data using chain-specific markers
 * Supports multiple field names to handle different note formats
 */
function extractField(
  text: string,
  fieldName: string | string[],
  endMarkers: string[],
): string {
  try {
    // Convert single fieldName to array for unified processing
    const fieldNames = Array.isArray(fieldName) ? fieldName : [fieldName];

    // Try each field name until we find one that exists in the text
    for (const name of fieldNames) {
      const startIdx = text.indexOf(name);
      if (startIdx !== -1) {
        const actualStart = startIdx + name.length;

        if (endMarkers.length === 0) {
          const result = text.substring(actualStart).trim();
          return result || DEFAULT_NO_PROGRESS_TEXT;
        }

        let endIdx = text.length;
        for (const marker of endMarkers) {
          const pos = text.indexOf(marker, actualStart);
          if (pos !== -1 && pos < endIdx) {
            endIdx = pos;
          }
        }

        const result = text.substring(actualStart, endIdx).trim();
        return result || DEFAULT_NO_PROGRESS_TEXT;
      }
    }

    // None of the field names were found
    return DEFAULT_NO_PROGRESS_TEXT;
  } catch {
    return DEFAULT_NO_PROGRESS_TEXT;
  }
}

/**
 * Get extraction config for a specific note type
 * Returns note-type-specific config if available, otherwise returns default config
 */
function getExtractionConfigForNoteType(
  noteType: string,
  chainConfig: ChainExtractionConfig,
  isFollowUpNote: boolean = false,
): {
  markers: Record<string, FieldExtractionConfig>;
  hasTimeFrequency: boolean;
  hasEvaluation: boolean;
} {
  // Check for note-type-specific config
  const specificConfigs = isFollowUpNote
    ? chainConfig.followUpNoteConfigs
    : chainConfig.behaviourNoteConfigs;

  if (specificConfigs && specificConfigs[noteType]) {
    const specificConfig = specificConfigs[noteType];
    return {
      markers: specificConfig.extractionMarkers,
      hasTimeFrequency: specificConfig.hasTimeFrequency ?? false,
      hasEvaluation: specificConfig.hasEvaluation ?? false,
    };
  }

  // Fall back to default config
  return {
    markers: chainConfig.fieldExtractionMarkers,
    hasTimeFrequency: chainConfig.hasTimeFrequency ?? false,
    hasEvaluation: chainConfig.hasEvaluation ?? false,
  };
}

/**
 * Extract all fields from behaviour note data using note-type-specific or default configuration
 */
function extractAllFields(
  data: string,
  noteType: string,
  chainConfig: ChainExtractionConfig,
  isFollowUpNote: boolean = false,
): ExtractedBehaviourFields {
  const fields: ExtractedBehaviourFields = {};

  // Get the appropriate extraction config for this note type
  const { markers } = getExtractionConfigForNoteType(
    noteType,
    chainConfig,
    isFollowUpNote,
  );

  for (const [fieldKey, fieldConfig] of Object.entries(markers)) {
    fields[fieldKey as keyof ExtractedBehaviourFields] = extractField(
      data,
      fieldConfig.fieldName,
      fieldConfig.endMarkers,
    );
  }

  return fields;
}

interface BehaviourIncident {
  name: string;
  datetime: Date;
  date: string;
  time: string;
  behaviour_type: string;
  triggers?: string;
  description: string;
  consequences?: string;
  interventions: string;
  medication_changes?: string;
  risks?: string;
  outcome: string;
  poa_notified: string;
  injuries: string;
  time_frequency?: string;
  evaluation?: string;
}

interface MergedRow extends Record<string, unknown> {
  datetime: Date;
  date?: string;
  time?: string;
  name?: string;
  incident_number?: string;
  incident_location?: string;
  room?: string;
  injuries?: string;
  incident_type?: string;
  behaviour_type: string;
  triggers: string;
  description: string;
  consequences: string;
  interventions: string;
  medication_changes: string;
  risks: string;
  outcome: string;
  poa_notified: string;
  who_affected?: string;
  code_white?: string;
  prn?: string;
  other_notes?: string;
  summary?: string;
  CI?: string;
  time_frequency?: string;
  evaluation?: string;
}

/**
 * Process behaviour notes using chain-specific extraction configuration
 */
function processBehaviourNotes(
  notes: BehaviourEntry[],
  config: ChainExtractionConfig,
): BehaviourIncident[] {
  const incidents: BehaviourIncident[] = [];

  for (const row of notes) {
    // Check if this note type should be processed for this chain
    if (config.behaviourNoteTypes.includes(row.Type)) {
      const data = row.Data;
      const datetime = new Date(row["Effective Date"]);

      // Extract all fields using note-type-specific or default configuration
      const extractedFields = extractAllFields(data, row.Type, config, false);

      // Get the config for this specific note type to check flags
      const noteTypeConfig = getExtractionConfigForNoteType(
        row.Type,
        config,
        false,
      );

      // Build incident with extracted fields
      const incident: BehaviourIncident = {
        name: cleanName(row["Resident Name"]),
        datetime,
        date: datetime.toISOString().split("T")[0],
        time: datetime.toTimeString().split(" ")[0],
        behaviour_type:
          extractedFields.behaviour_type || DEFAULT_NO_PROGRESS_TEXT,
        description:
          extractedFields.description || DEFAULT_NO_PROGRESS_TEXT_SHORT,
        interventions:
          extractedFields.interventions || DEFAULT_NO_PROGRESS_TEXT_SHORT,
        outcome: extractedFields.outcome || DEFAULT_NO_PROGRESS_TEXT_SHORT,
        poa_notified:
          extractedFields.poa_notified || DEFAULT_NO_PROGRESS_TEXT_SHORT,
        injuries: row.Injuries || "No Injury",
      };

      // Add optional fields based on note-type-specific or default configuration
      if (noteTypeConfig.hasTimeFrequency && extractedFields.time_frequency) {
        incident.time_frequency = extractedFields.time_frequency;
      }
      if (noteTypeConfig.hasEvaluation && extractedFields.evaluation) {
        incident.evaluation = extractedFields.evaluation;
      }
      if (extractedFields.triggers !== undefined) {
        incident.triggers = extractedFields.triggers;
      }
      if (extractedFields.consequences !== undefined) {
        incident.consequences = extractedFields.consequences;
      }
      if (extractedFields.medication_changes !== undefined) {
        incident.medication_changes = extractedFields.medication_changes;
      }
      if (extractedFields.risks !== undefined) {
        incident.risks = extractedFields.risks;
      }

      incidents.push(incident);
    }
  }

  return incidents;
}

async function gptDetermineWhoAffected(
  row: Record<string, unknown>,
  apiKey: string,
): Promise<string> {
  const client = initOpenAI(apiKey);

  const prompt = `
Based on the following incident information, classify who was affected. Choose ALL that apply from the following categories and answer with a comma-separated list:
- Resident Initiated
- Resident Received
- Staff Received

Incident Type: ${row.incident_type || ""}
Behaviour Type: ${row.behaviour_type || ""}
Description: ${row.description || ""}
Consequences: ${row.consequences || ""}
Interventions: ${row.interventions || ""}

Answer with a comma-separated list of the categories above. If unclear, answer with the most likely categories.
`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a healthcare analyst classifying who was affected in a behaviour incident. Answer with a comma-separated list of the four categories, choosing all that apply.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
      max_tokens: 20,
    });

    const result = response.choices[0].message.content?.trim() || "";
    const validCategories = [
      "Resident Initiated",
      "Resident Received",
      "Staff Received",
      "Staff Initiated",
    ];
    const selected = result
      .split(",")
      .map((cat) => cat.trim())
      .filter((cat) => validCategories.includes(cat));

    return selected.length > 0 ? selected.join(", ") : "Resident Initiated";
  } catch (error) {
    console.error(`Error getting who_affected from OpenAI: ${error}`);
    return "Resident Initiated";
  }
}

function checkCodeWhite(row: Record<string, unknown>): string {
  const fieldsToCheck = [
    "description",
    "consequences",
    "interventions",
    "behaviour_type",
  ];

  for (const field of fieldsToCheck) {
    const text = String(row[field] || "")
      .toLowerCase()
      .replace(/-/g, " ")
      .replace(/_/g, " ");
    if (text.includes("code white")) {
      return "yes";
    }
  }

  return "no";
}

function checkPrn(row: Record<string, unknown>): string {
  const fieldsToCheck = [
    "description",
    "consequences",
    "interventions",
    "medication_changes",
    "outcome",
  ];

  for (const field of fieldsToCheck) {
    const text = String(row[field] || "").toLowerCase();
    if (text.includes("prn")) {
      return "yes";
    }
  }

  return "no";
}

/**
 * Collect other notes (follow-ups, family notes, physician notes) using chain-specific configuration
 */
function collectOtherNotes(
  row: Record<string, unknown>,
  notes: BehaviourEntry[],
  config: ChainExtractionConfig,
): string {
  const collectedNotes: string[] = [];
  const rowDatetime = new Date(row.datetime as string | Date);

  for (const note of notes) {
    if (
      config.followUpNoteTypes.includes(note.Type) &&
      note["Resident Name"] === (row.name as string)
    ) {
      const noteDatetime = new Date(note["Effective Date"]);
      const timeDiff = Math.abs(noteDatetime.getTime() - rowDatetime.getTime());

      if (timeDiff <= 48 * 60 * 60 * 1000) {
        // 48 hours in milliseconds
        const noteDate = noteDatetime
          .toISOString()
          .replace("T", " ")
          .split(".")[0];
        let data = note.Data;

        // Clean data - remove junk markers
        const junkMarkers = ["Facility #", "Effective Date Range"];
        for (const marker of junkMarkers) {
          if (data.includes(marker)) {
            const markerIndex = data.indexOf(marker);
            const headers = ["Data :", "Action :", "Response :", "Note Text :"];
            let nextHeaderIndex = data.length;

            for (const header of headers) {
              const headerIndex = data.indexOf(header, markerIndex);
              if (headerIndex !== -1 && headerIndex < nextHeaderIndex) {
                nextHeaderIndex = headerIndex;
              }
            }

            data =
              data.substring(0, markerIndex) + data.substring(nextHeaderIndex);
          }
        }

        collectedNotes.push(`${note.Type} (${noteDate}): ${data}`);
      }
    }
  }

  return collectedNotes.length > 0
    ? collectedNotes.join("<br>")
    : "No other notes";
}

async function gptSummarizeIncident(row: Record<string, unknown>, apiKey: string): Promise<string> {
  const defaultIndicators = [
    "No Progress Note Found Within 24hrs of RIM",
    DEFAULT_NO_PROGRESS_TEXT_SHORT,
    DEFAULT_NO_PROGRESS_TEXT,
  ];

  const relevantFields = ["behaviour_type", "description", "outcome"];
  const allFieldsEmpty = relevantFields.every((field) =>
    defaultIndicators.some((indicator) =>
      String(row[field] || "").includes(indicator),
    ),
  );

  if (allFieldsEmpty) {
    return "No Progress within 24hrs of RIM";
  }

  const client = initOpenAI(apiKey);

  const prompt = `
Summarize the following incident in 1-2 sentences for a report, nothing more. Use the information provided:
Behaviour Type: ${row.behaviour_type || ""}
Description: ${row.description || ""}
Outcome: ${row.outcome || ""}
`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a healthcare analyst summarizing behaviour incidents for a report. Summarize the incident in 1-2 sentences, include details. Do not include any other text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.15,
      max_tokens: 60,
    });

    return (
      response.choices[0].message.content?.trim() ||
      "No Progress within 24hrs of RIM"
    );
  } catch (error) {
    console.error(`Error getting summary from OpenAI: ${error}`);
    return "No Progress within 24hrs of RIM";
  }
}

async function gptDetermineIntent(
  summary: string,
  apiKey: string,
): Promise<string> {
  const client = initOpenAI(apiKey);

  const prompt = `
Based on the following incident summary, determine if the resident's actions were intentional.
The resident's actions are considered intentional if they are goal-oriented, premeditated, or if the resident is cognitively aware and directing their actions towards a specific person or object.
Actions that are unintentional may be described as random, purposeless, a result of confusion, or without a clear target.

Summary: "${summary}"

Based on this, was the action intentional? Answer only with 'yes' or 'no'.
`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a healthcare analyst determining intent in a resident's actions. Answer only with 'yes' or 'no'.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
      max_tokens: 5,
    });

    const result =
      response.choices[0].message.content?.toLowerCase().trim() || "";
    return result.includes("yes") ? "yes" : "no";
  } catch (error) {
    console.error(`Error getting intent from OpenAI: ${error}`);
    return "no";
  }
}

async function determineCiStatus(row: Record<string, unknown>, apiKey: string): Promise<string> {
  const incidentType = String(row.incident_type || "").toLowerCase();
  const whoAffected = String(row.who_affected || "").toLowerCase();
  const summary = String(row.summary || "");

  const cond1 = incidentType.includes("physical aggression initiated");
  const cond2 =
    whoAffected.includes("resident initiated") &&
    whoAffected.includes("resident received");

  if (cond1 && cond2) {
    if (summary && !summary.toLowerCase().includes("no progress")) {
      const intent = await gptDetermineIntent(summary, apiKey);
      if (intent === "yes") {
        return "yes";
      }
    }
  }

  return "no";
}

/**
 * Merge behaviour data with processed incidents using chain-specific extraction
 */
export async function mergeBehaviourData(
  processedCsvPath: string,
  behaviourCsvPath: string,
  outputFile: string,
  apiKey: string,
  homeId: string,
  config: ChainExtractionConfig,
): Promise<void> {
  if (!config) {
    config = CHAIN_EXTRACTION_CONFIGS["responsive"];
    console.log("FALLING BACK TO RESPONSIVE CHAIN EXTRACTION CONFIG");
  }

  console.log(
    `Using extraction config for chain with ${config.behaviourNoteTypes.length} note types`,
  );

  // Read CSVs
  const processedContent = await readFile(processedCsvPath, "utf-8");
  const behaviourContent = await readFile(behaviourCsvPath, "utf-8");

  const processedRows = parseCsv(processedContent);
  const behaviourRows = parseCsv(behaviourContent) as unknown as BehaviourEntry[];

  // Process behaviour notes with chain-specific extraction
  const behaviourProcessed = processBehaviourNotes(behaviourRows, config);
  console.log(`Processed ${behaviourProcessed.length} behaviour incidents`);

  // Merge data
  const merged: MergedRow[] = [];

  for (const procRow of processedRows) {
    const datetime = new Date(`${procRow.date} ${procRow.time}`);

    const mergedRow: MergedRow = {
      ...procRow,
      datetime,
      behaviour_type: DEFAULT_NO_PROGRESS_TEXT,
      triggers: DEFAULT_NO_PROGRESS_TEXT,
      description: DEFAULT_NO_PROGRESS_TEXT_SHORT,
      consequences: DEFAULT_NO_PROGRESS_TEXT_SHORT,
      interventions: DEFAULT_NO_PROGRESS_TEXT_SHORT,
      medication_changes: DEFAULT_NO_PROGRESS_TEXT_SHORT,
      risks: DEFAULT_NO_PROGRESS_TEXT_SHORT,
      outcome: DEFAULT_NO_PROGRESS_TEXT_SHORT,
      poa_notified: DEFAULT_NO_PROGRESS_TEXT_SHORT,
    };

    // Find matching behaviour note within 24 hours (kindera uses 24, responsive uses 20)
    const matching = behaviourProcessed.find((beh) => {
      if (beh.name !== cleanName(procRow.name as string)) return false;
      const timeDiff = Math.abs(beh.datetime.getTime() - datetime.getTime());
      return timeDiff <= 24 * 60 * 60 * 1000;
    });

    if (matching) {
      // Exclude datetime/date/time/name from behaviour note (keep incident report values)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { datetime: _dt, date: _d, time: _t, name: _n, ...behaviorFields } = matching;
      Object.assign(mergedRow, behaviorFields);
      console.log(
        `Found matching behaviour note for ${procRow.name} at ${datetime}`,
      );
    }

    // Add computed fields
    mergedRow.who_affected = await gptDetermineWhoAffected(mergedRow, apiKey);
    mergedRow.code_white = checkCodeWhite(mergedRow);
    mergedRow.prn = checkPrn(mergedRow);
    mergedRow.other_notes = collectOtherNotes(mergedRow, behaviourRows, config);
    mergedRow.summary = await gptSummarizeIncident(mergedRow, apiKey);
    mergedRow.CI = await determineCiStatus(mergedRow, apiKey);

    merged.push(mergedRow);
  }

  // Format final data
  const finalData = merged.map((row, index) => {
    // Fix day of week calculation - use local date to avoid timezone issues
    const dateStr = (row.date as string) || "";
    const [year, month, day] = dateStr.split('-').map(Number);
    const dt = new Date(year, month - 1, day); // month is 0-indexed
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const baseData: Record<string, unknown> = {
      id: index,
      date: row.date,
      time: row.time,
      "Day of the Week": daysOfWeek[dt.getDay()],
      incident_number: row.incident_number,
      name: row.name,
      incident_location: row.incident_location,
      room: row.room,
      injuries: row.injuries,
      incident_type: row.incident_type,
      behaviour_type: row.behaviour_type,
      triggers: row.triggers,
      interventions: row.interventions,
      poa_notified: row.poa_notified,
    };

    // Add chain-specific fields BEFORE who_affected to match Python column order
    if (config?.hasTimeFrequency) {
      baseData.time_frequency = row.time_frequency || DEFAULT_NO_PROGRESS_TEXT_SHORT;
    }
    if (config?.hasEvaluation) {
      baseData.evaluation = row.evaluation || DEFAULT_NO_PROGRESS_TEXT_SHORT;
    }

    // Add remaining fields
    baseData.who_affected = row.who_affected;
    baseData.code_white = row.code_white;
    baseData.prn = row.prn;
    baseData.other_notes = row.other_notes;
    baseData.summary = row.summary;
    baseData.CI = row.CI;

    return baseData;
  });

  // Sort by date and time descending
  finalData.sort((a, b) => {
    const dateA = (a.date as string) || "";
    const dateB = (b.date as string) || "";
    const timeA = (a.time as string) || "";
    const timeB = (b.time as string) || "";
    const dateCompare = dateB.localeCompare(dateA);
    if (dateCompare !== 0) return dateCompare;
    return timeB.localeCompare(timeA);
  });

  // Write to CSV
  await writeCsv(outputFile, finalData);
  console.log(`Successfully merged data and saved to ${outputFile}`);
}

// CSV parsing/writing helpers
function parseCsv(content: string): Record<string, unknown>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }

  return rows;
}

async function writeCsv(
  filePath: string,
  data: Record<string, unknown>[],
): Promise<void> {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] !== undefined && row[header] !== null ? row[header] : "";
          const escaped = String(value).replace(/"/g, '""');
          return escaped.includes(",") ||
            escaped.includes("\n") ||
            escaped.includes('"')
            ? `"${escaped}"`
            : escaped;
        })
        .join(","),
    ),
  ].join("\n");

  await writeFile(filePath, csvContent, "utf-8");
}

/**
 * Save all follow-up type notes from the original notes into a separate CSV file
 */
export async function saveFollowupNotesCsv(
  behaviourCsvPath: string,
  outputFile: string,
  config: ChainExtractionConfig,
): Promise<string | null> {
  console.log(`\nExtracting follow-up notes for ${outputFile}...`);

  const followupRecords: Array<{
    id: string;
    resident_name: string;
    date: string;
    time: string;
    other_notes: string;
    summary_of_behaviour: string;
  }> = [];

  // Use config-defined follow-up note types
  const targetTypes = new Set(config.followUpNoteTypes);
  const extraTargetTypes = new Set(
    config.extraFollowUpNoteTypes || [
      "Family/Resident Involvment",
      "Physician Note",
    ],
  );

  // Read the behaviour CSV
  const behaviourContent = await readFile(behaviourCsvPath, "utf-8");
  const notes = parseCsv(behaviourContent) as unknown as BehaviourEntry[];

  // Find follow-up notes
  for (const note of notes) {
    if (!note || !note.Type || !note["Effective Date"] || !note.Data) {
      continue;
    }
    if (targetTypes.has(note.Type)) {
      const noteDate = new Date(note["Effective Date"]);

      // Clean data similar to collectOtherNotes
      let dataText = String(note.Data || "").trim();
      const junkMarkers = ["Facility #", "Effective Date Range"];

      for (const marker of junkMarkers) {
        if (dataText.includes(marker)) {
          const markerIndex = dataText.indexOf(marker);
          let nextHeaderIndex = dataText.length;

          for (const header of [
            "Data :",
            "Action :",
            "Response :",
            "Note Text :",
          ]) {
            const headerIndex = dataText.indexOf(header, markerIndex);
            if (headerIndex !== -1 && headerIndex < nextHeaderIndex) {
              nextHeaderIndex = headerIndex;
            }
          }
          dataText =
            dataText.substring(0, markerIndex) +
            dataText.substring(nextHeaderIndex);
        }
      }

      // Extract summary from "Note Text :" field
      let summaryText = dataText;
      if (dataText.includes("Note Text :")) {
        summaryText = dataText.split("Note Text :")[1].trim();
      }

      // Only add if dataText is not empty
      if (dataText && dataText !== "" && dataText !== ",") {
        followupRecords.push({
          id: "",
          resident_name: cleanName(note["Resident Name"]),
          date: noteDate.toISOString().split("T")[0],
          time: noteDate.toTimeString().split(" ")[0],
          other_notes: "",
          summary_of_behaviour: summaryText,
        });
      }
    }
  }

  // Build quick index for closest-match lookups by resident
  if (followupRecords.length > 0) {
    const recordDatetimes = followupRecords.map(
      (r) => new Date(`${r.date} ${r.time}`),
    );
    const nameToIndices: Record<string, number[]> = {};

    for (let i = 0; i < followupRecords.length; i++) {
      const resident = followupRecords[i].resident_name;
      if (!nameToIndices[resident]) {
        nameToIndices[resident] = [];
      }
      nameToIndices[resident].push(i);
    }

    // For each extra note, find closest prior Behaviour - Follow up for same resident
    console.log("Finding matching follow-up notes for extra notes...");

    for (const famNote of notes) {
      if (!famNote || !famNote.Type || !famNote["Effective Date"] || !famNote.Data || !famNote["Resident Name"]) {
        continue;
      }
      if (extraTargetTypes.has(famNote.Type)) {
        const resident = cleanName(famNote["Resident Name"]);
        if (!nameToIndices[resident]) continue;

        const famDate = new Date(famNote["Effective Date"]);

        // Clean data similar to above
        let famText = String(famNote.Data || "").trim();
        const junkMarkers = ["Facility #", "Effective Date Range"];

        for (const marker of junkMarkers) {
          if (famText.includes(marker)) {
            const markerIndex = famText.indexOf(marker);
            let nextHeaderIndex = famText.length;

            for (const header of [
              "Data :",
              "Action :",
              "Response :",
              "Note Text :",
            ]) {
              const headerIndex = famText.indexOf(header, markerIndex);
              if (headerIndex !== -1 && headerIndex < nextHeaderIndex) {
                nextHeaderIndex = headerIndex;
              }
            }
            famText =
              famText.substring(0, markerIndex) +
              famText.substring(nextHeaderIndex);
          }
        }

        // Choose closest follow-up record that occurred BEFORE the extra note
        const candidateIndices = nameToIndices[resident];
        const candidateIndicesPre = candidateIndices.filter(
          (i) => recordDatetimes[i] <= famDate,
        );

        if (candidateIndicesPre.length === 0) continue;

        // Among prior follow-ups, choose the one with the smallest positive time difference
        const closestIdx = candidateIndicesPre.reduce((minIdx, currIdx) =>
          famDate.getTime() - recordDatetimes[currIdx].getTime() <
          famDate.getTime() - recordDatetimes[minIdx].getTime()
            ? currIdx
            : minIdx,
        );

        const appendText = `${famNote.Type}: ${famText}`;
        if (followupRecords[closestIdx].other_notes) {
          followupRecords[closestIdx].other_notes += "<br>" + appendText;
        } else {
          followupRecords[closestIdx].other_notes = appendText;
        }

        console.log(
          `Added follow-up note for ${resident} at ${famDate} to ${followupRecords[closestIdx].date} ${followupRecords[closestIdx].time}`,
        );
      }
    }
  }

  if (followupRecords.length > 0) {
    await writeCsv(outputFile, followupRecords as Record<string, unknown>[]);
    console.log(`Successfully saved followup notes to ${outputFile}`);
    return outputFile;
  }

  return null;
}

export async function processAllMergedFiles(
  analyzedDir: string,
  apiKey: string,
  homeId: string,
  chainId: string,
): Promise<void> {
  // Determine chain configuration
  let config: ChainExtractionConfig = CHAIN_EXTRACTION_CONFIGS[chainId];

  if (!config) {
    config = CHAIN_EXTRACTION_CONFIGS["responsive"];
    console.log("FALLING BACK TO RESPONSIVE CHAIN EXTRACTION CONFIG");
  }

  // Recursively process all directories
  async function walkDir(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walkDir(fullPath)));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  const allFiles = await walkDir(analyzedDir);

  for (const file of allFiles) {
    if (file.endsWith("processed_incidents.csv")) {
      const baseName = file.replace("processed_incidents.csv", "");
      const behaviourFile = `${baseName}behaviour_incidents.csv`;

      try {
        const outputFile = `${baseName}merged.csv`;
        console.log(`Merging: ${file} and ${behaviourFile}`);
        await mergeBehaviourData(
          file,
          behaviourFile,
          outputFile,
          apiKey,
          homeId,
          config,
        );
      } catch (error) {
        console.error(`Error merging ${file}: ${error}`);
      }
    }

    // Process follow-up notes
    if (file.endsWith("behaviour_incidents.csv")) {
      try {
        const outputFile = file.replace(
          "behaviour_incidents.csv",
          "follow.csv",
        );
        await saveFollowupNotesCsv(file, outputFile, config);
      } catch (error) {
        console.error(`Error creating followup notes for ${file}: ${error}`);
      }
    }
  }
}
