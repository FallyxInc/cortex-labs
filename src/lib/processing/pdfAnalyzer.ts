/**
 * PDF Analyzer - AI-powered PDF field extraction configuration
 * 
 * Uses Claude to analyze PDF text and suggest extraction configurations
 * that align with the ChainExtractionConfig format used in processing.
 */

import { getClaudeClient, getAIModel } from '@/lib/claude-client';
import {
  ExtractionType,
  FieldExtractionConfig,
  NoteTypeExtractionConfig,
} from './types';

// PDF fields that can be extracted from behaviour notes
export const PDF_EXTRACTION_FIELDS: ExtractionType[] = [
  ExtractionType.behaviour_type,
  ExtractionType.triggers,
  ExtractionType.description,
  ExtractionType.consequences,
  ExtractionType.interventions,
  ExtractionType.medication_changes,
  ExtractionType.risks,
  ExtractionType.outcome,
  ExtractionType.poa_notified,
  ExtractionType.time_frequency,
  ExtractionType.evaluation,
];

export interface AISuggestedField {
  fieldKey: ExtractionType;
  fieldName: string | string[];
  endMarkers: string[];
  confidence: number;
  reasoning: string;
}

export interface AISuggestedNoteType {
  noteType: string;
  isFollowUp: boolean;
  confidence: number;
  reasoning: string;
}

export interface AISuggestedNoteTypeExtractionConfig {
  noteType: string;
  isFollowUp: boolean;
  extractionMarkers: Partial<Record<ExtractionType, AISuggestedField>>;
  hasTimeFrequency: boolean;
  hasEvaluation: boolean;
}

export interface AISuggestedJunkMarker {
  text: string;
  confidence: number;
  reasoning: string;
}

export interface PdfAnalysisResult {
  behaviourNoteTypes: AISuggestedNoteType[];
  followUpNoteTypes: AISuggestedNoteType[];
  junkMarkers: AISuggestedJunkMarker[];
  fieldExtractionMarkers: Partial<Record<ExtractionType, AISuggestedField>>;
  noteTypeExtraction: AISuggestedNoteTypeExtractionConfig[];
  behaviourNoteConfigs: Record<string, AISuggestedNoteTypeExtractionConfig>;
  followUpNoteConfigs: Record<string, AISuggestedNoteTypeExtractionConfig>;
  hasTimeFrequency: boolean;
  hasEvaluation: boolean;
}

const SYSTEM_PROMPT = `You are an expert at analyzing healthcare documentation and extracting structured data.

Your task is to analyze a PDF document containing behavior incident notes and identify:
1. Note types - Labels that identify different types of notes (behaviour notes vs follow-up notes)
2. Junk markers - Repetitive text that should be filtered out (headers, footers, page numbers, etc.)
3. Field extraction markers - Text labels that mark the start of data fields
4. End markers - Text that indicates where each field ends

CRITICAL RULES:
- Be precise and provide EXACT text matches from the document including colons, spaces, and capitalization or other symbols.
- It is important that the fields must match EXACTLY, without causing false positives with other text in the document.
- Do NOT infer or generalize - only return text that exists verbatim in the PDF.
- Return ONLY valid JSON - no prose, no markdown, no explanations outside the JSON structure.`;

function buildUserPrompt(pdfText: string): string {
  const fieldDescriptions: Record<ExtractionType, string> = {
    [ExtractionType.behaviour_type]: 'Type/category of the behaviour displayed',
    [ExtractionType.triggers]: 'Antecedents or triggers that led to the behaviour',
    [ExtractionType.description]: 'Description or data about the behaviour',
    [ExtractionType.consequences]: 'Consequences or disruptiveness of the behaviour',
    [ExtractionType.interventions]: 'Actions taken or interventions applied',
    [ExtractionType.medication_changes]: 'Any medication changes',
    [ExtractionType.risks]: 'Risks and causes identified',
    [ExtractionType.outcome]: 'Outcome or result of the intervention',
    [ExtractionType.poa_notified]: 'Whether POA/Substitute Decision Maker was notified',
    [ExtractionType.time_frequency]: 'Time, frequency, and staff involved (optional)',
    [ExtractionType.evaluation]: 'Evaluation of the intervention (optional)',
  };

  return `Analyze the following PDF text from a behavior incident documentation system and extract configuration for automated data processing.

=== TARGET FIELDS TO EXTRACT ===
${PDF_EXTRACTION_FIELDS.map((f) => `- ${f}: ${fieldDescriptions[f]}`).join('\n')}

=== TASK 1: IDENTIFY JUNK MARKERS ===
Identify repetitive text that appears throughout the document and should be filtered out during processing. Common patterns include:

Headers and footers:
- "Page 1 of 5"
- "Confidential - Do Not Distribute"
- "Printed on: 2024-01-15"
- Company/facility names that repeat
- Document titles that appear on every page

Page markers:
- "Page"
- "Pg."
- Page numbers and ranges

System metadata:
- "Effective Date Range:"
- "Facility #"
- "Report Generated:"
- Timestamps that don't relate to incidents

Layout markers:
- Horizontal lines or separators (e.g., "___________", "----------")
- Section dividers
- Repeated instructions or boilerplate text

Junk markets get removed from their first instance, to the next instance of a field marker or note type marker. 
It is VERY IMPORTANT that the data between the junk markers and the field markers or note type markers is not important data.
Junk markers should be removed only for explicitly unnecessary data. for incidents

For each junk marker found, provide:
- text: EXACT text as it appears (including spaces, punctuation)
- confidence: 0.0 to 1.0
- reasoning: Brief explanation of why this is junk (e.g., "repeats on every page", "footer text", "page numbering")

IMPORTANT: Only identify text that is truly repetitive/structural and NOT part of the actual incident data.

=== TASK 2: IDENTIFY NOTE TYPES ===
Find all note type labels in the PDF. Common patterns:

Behaviour notes (incident notes):
- "Behaviour - Responsive Behaviour"
- "Responsive Behaviour - Physical Aggression"
- "Responsive Behaviour - Verbal"
- "Responsive Behaviour - Wandering"

Follow-up notes:
- "Behaviour - Follow up"
- "Behaviour Note"
- "Family/Resident Involvement"
- "Physician Note"

For each note type found, provide:
- noteType: EXACT text as it appears (including spaces, punctuation, spelling (behaviour vs behavior))
- isFollowUp: true if it's a follow-up note, false if it's a behaviour/incident note
- confidence: 0.0 to 1.0
- reasoning: Brief explanation of why you identified this

=== TASK 3: IDENTIFY DEFAULT FIELD MARKERS ===
For each target field, identify the EXACT label text that precedes the field content across all notes.

Common field patterns (examples - use ACTUAL text from PDF):
- behaviour_type: "Type of Behaviour :", "Behaviour Displayed :"
- triggers: "Antecedent/Triggers :", "Antecedent :"
- description: "Describe the behaviour :", "Data :"
- consequences: "Disruptiveness (Data)/Consequences to the behaviour :"
- interventions: "Interventions :", "Intervention :", "Action :"
- medication_changes: "Change in medication :"
- risks: "What are the risks and causes :"
- outcome: "Outcome(s)(Result) :", "Response :", "Resident Response :"
- poa_notified: "Substitute Decision Maker notified :"
- time_frequency: "Time, Frequency and # of Staff :"
- evaluation: "Evaluation of Intervention :"

For each field found, provide:
1. fieldName: EXACT label text (can be array if multiple formats exist: ["Label 1:", "Label 2:"])
2. endMarkers: Text patterns that mark where the field content ENDS (look at what comes after)
   - Typically: next field label, "Page", "Facility #", "Effective Date Range"
3. confidence: 0.0 to 1.0
4. reasoning: Brief explanation

ONLY include fields you can confidently identify. If a field is not found in the PDF, omit it completely.

=== TASK 4: IDENTIFY NOTE-TYPE-SPECIFIC FIELD MARKERS ===
Some note types may use DIFFERENT field labels than others. For EACH note type you found in Task 1, analyze if it has its own unique field labels.

For example:
- "Behaviour - Responsive Behaviour" might use "Describe the behaviour :" for description
- "Behaviour - Follow up" might use "Note Text :" for description

For each note type with unique field labels, provide:
- noteType: exact note type name
- isFollowUp: true/false
- hasTimeFrequency: true only if "Time, Frequency and # of Staff" field exists for this note type
- hasEvaluation: true only if "Evaluation of Intervention" field exists for this note type
- extractionMarkers: field configurations specific to this note type (same format as Task 2)

If a note type uses the same labels as the default, you can omit it from noteTypeExtraction.

=== PDF TEXT ===
${pdfText}

=== OUTPUT FORMAT ===
Respond with ONLY this JSON structure (no markdown, no code blocks, just raw JSON):

{
  "junkMarkers": [
    {
      "text": "Facility #",
      "confidence": 0.95,
      "reasoning": "Page marker that appears throughout the document"
    },
    {
      "text": "Effective Date Range :",
      "confidence": 0.9,
      "reasoning": "System metadata field that repeats on every page"
    }
  ],
  "behaviourNoteTypes": [
    {
      "noteType": "Behaviour - Responsive Behaviour",
      "isFollowUp": false,
      "confidence": 0.95,
      "reasoning": "Found in PDF with 'Type:' prefix"
    }
  ],
  "followUpNoteTypes": [
    {
      "noteType": "Behaviour - Follow up",
      "isFollowUp": true,
      "confidence": 0.9,
      "reasoning": "Found as follow-up note type"
    }
  ],
  "fieldExtractionMarkers": {
    "behaviour_type": {
      "fieldName": "Type of Behaviour :",
      "endMarkers": ["Antecedent/Triggers", "Page"],
      "confidence": 0.95,
      "reasoning": "Consistent label across all behaviour notes"
    },
    "description": {
      "fieldName": ["Describe the behaviour :", "Data :"],
      "endMarkers": ["Disruptiveness (Data)/Consequences to the behaviour :", "Page"],
      "confidence": 0.9,
      "reasoning": "Two formats found in different note types"
    }
  },
  "noteTypeExtraction": [
    {
      "noteType": "Behaviour - Follow up",
      "isFollowUp": true,
      "hasTimeFrequency": false,
      "hasEvaluation": false,
      "extractionMarkers": {
        "description": {
          "fieldName": "Note Text :",
          "endMarkers": ["Page", "Facility #"],
          "confidence": 0.9,
          "reasoning": "Follow-up notes use different label"
        }
      }
    }
  ],
  "hasTimeFrequency": true,
  "hasEvaluation": false
}

=== CRITICAL REQUIREMENTS ===
1. Use EXACT text from the PDF (including colons, spaces, capitalization, symbols)
2. For junkMarkers, only identify text that is truly repetitive/structural (headers, footers, page numbers, metadata)
3. If multiple format variations exist for a field, provide array: ["Format 1:", "Format 2:"]
4. For endMarkers, identify text that appears AFTER the field content (next label, page markers, etc.)
5. Only include fields you can confidently identify - omit fields not found in the PDF
6. Set hasTimeFrequency/hasEvaluation to true ONLY if those specific fields exist
7. The noteTypeExtraction array should contain entries ONLY for note types with unique field labels
8. Ensure all text matches are EXACT to avoid false positives with similar text in the document
9. Return valid JSON only - no markdown code blocks, no explanations outside JSON`;
}

function normalizeFieldSuggestions(
  raw: unknown,
): Partial<Record<ExtractionType, AISuggestedField>> {
  const markers: Partial<Record<ExtractionType, AISuggestedField>> = {};

  if (!raw || typeof raw !== 'object') {
    return markers;
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const fieldKey = key as ExtractionType;
    if (!PDF_EXTRACTION_FIELDS.includes(fieldKey) || !value) continue;

    const field = value as {
      fieldName?: string | string[];
      endMarkers?: string[];
      confidence?: number;
      reasoning?: string;
    };

    markers[fieldKey] = {
      fieldKey,
      fieldName: field.fieldName ?? '',
      endMarkers: field.endMarkers || [],
      confidence: field.confidence ?? 0.5,
      reasoning: field.reasoning || '',
    };
  }

  return markers;
}

function parseAIResponse(responseText: string): PdfAnalysisResult {
  let jsonText = responseText.trim();
  
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonText);

  const fieldExtractionMarkers = normalizeFieldSuggestions(
    parsed.fieldExtractionMarkers,
  );

  const noteTypeExtraction: AISuggestedNoteTypeExtractionConfig[] = [];
  const behaviourNoteConfigs: Record<string, AISuggestedNoteTypeExtractionConfig> =
    {};
  const followUpNoteConfigs: Record<string, AISuggestedNoteTypeExtractionConfig> =
    {};

  if (Array.isArray(parsed.noteTypeExtraction)) {
    for (const entry of parsed.noteTypeExtraction) {
      if (!entry || !entry.noteType) continue;
      const extractionMarkers = normalizeFieldSuggestions(
        entry.extractionMarkers || entry.fieldExtractionMarkers,
      );

      const suggestion: AISuggestedNoteTypeExtractionConfig = {
        noteType: entry.noteType,
        isFollowUp: !!entry.isFollowUp,
        extractionMarkers,
        hasTimeFrequency: entry.hasTimeFrequency ?? false,
        hasEvaluation: entry.hasEvaluation ?? false,
      };

      noteTypeExtraction.push(suggestion);

      if (suggestion.isFollowUp) {
        followUpNoteConfigs[suggestion.noteType] = suggestion;
      } else {
        behaviourNoteConfigs[suggestion.noteType] = suggestion;
      }
    }
  }

  const hasTimeFrequency =
    parsed.hasTimeFrequency ??
    noteTypeExtraction.some((c) => c.hasTimeFrequency);
  const hasEvaluation =
    parsed.hasEvaluation ?? noteTypeExtraction.some((c) => c.hasEvaluation);

  const junkMarkers: AISuggestedJunkMarker[] = [];
  if (Array.isArray(parsed.junkMarkers)) {
    for (const entry of parsed.junkMarkers) {
      if (entry && entry.text) {
        junkMarkers.push({
          text: entry.text,
          confidence: entry.confidence ?? 0.5,
          reasoning: entry.reasoning || '',
        });
      }
    }
  }

  return {
    behaviourNoteTypes: parsed.behaviourNoteTypes || [],
    followUpNoteTypes: parsed.followUpNoteTypes || [],
    junkMarkers,
    fieldExtractionMarkers,
    noteTypeExtraction,
    behaviourNoteConfigs,
    followUpNoteConfigs,
    hasTimeFrequency: !!hasTimeFrequency,
    hasEvaluation: !!hasEvaluation,
  };
}

/**
 * Convert AI suggestions to the FieldExtractionConfig format used in processing
 */
export function toFieldExtractionConfig(
  suggestions: Partial<Record<ExtractionType, AISuggestedField>>
): Partial<Record<ExtractionType, FieldExtractionConfig>> {
  const config: Partial<Record<ExtractionType, FieldExtractionConfig>> = {};
  
  for (const [key, suggestion] of Object.entries(suggestions)) {
    if (suggestion) {
      config[key as ExtractionType] = {
        fieldName: suggestion.fieldName,
        endMarkers: suggestion.endMarkers,
      };
    }
  }
  
  return config;
}

export function toNoteTypeExtractionConfig(
  noteTypeSuggestions?: Record<string, AISuggestedNoteTypeExtractionConfig>,
): Record<string, NoteTypeExtractionConfig> {
  const configs: Record<string, NoteTypeExtractionConfig> = {};
  if (!noteTypeSuggestions) return configs;

  for (const [noteType, suggestion] of Object.entries(noteTypeSuggestions)) {
    configs[noteType] = {
      extractionMarkers: toFieldExtractionConfig(
        suggestion.extractionMarkers || {},
      ),
      hasTimeFrequency: suggestion.hasTimeFrequency ?? false,
      hasEvaluation: suggestion.hasEvaluation ?? false,
    };
  }

  return configs;
}

/**
 * Analyze PDF text using Claude AI and extract field configuration suggestions
 */
export async function analyzePdfText(
  pdfText: string,
  maxTextLength: number = 100000
): Promise<PdfAnalysisResult> {
  const anthropic = getClaudeClient();
  
  // Truncate if too long
  const truncatedText = pdfText.length > maxTextLength
    ? pdfText.substring(0, maxTextLength) + '\n\n[... text truncated ...]'
    : pdfText;

  const response = await anthropic.messages.create({
    model: getAIModel(),
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(truncatedText),
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return parseAIResponse(content.text);
}

