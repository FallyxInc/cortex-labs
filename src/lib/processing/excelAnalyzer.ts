/**
 * Excel Analyzer - AI-powered Excel field mapping helper
 *
 * Uses Claude to look at Excel headers/rows and suggest the correct
 * incident columns plus the injury column window used during processing.
 */

import { getAIModel, getClaudeClient } from '@/lib/claude-client';
import {
  ExcelExtractionConfig,
  ExcelFieldMapping,
  ExcelIncidentColumns,
} from './types';
import {
  DEFAULT_EXCEL_INCIDENT_COLUMNS,
} from '@/lib/chainConfig';

type ExcelPreviewRow = Record<string, unknown>;

export interface ExcelAnalysisResult {
  excelFieldMappings: Record<string, ExcelFieldMapping>;
  excelIncidentColumns: ExcelIncidentColumns;
  injuryColumns?: {
    start: number;
    end: number;
    confidence?: number;
    reasoning?: string;
  };
  notes?: string;
}

const INCIDENT_FIELD_KEYS: Array<keyof ExcelIncidentColumns> = [
  'incident_number',
  'name',
  'date_time',
  'incident_location',
  'room',
  'incident_type',
];

function buildSamplePreview(
  headers: string[],
  rows: ExcelPreviewRow[],
  maxRows: number = 10,
): string {
  const limitedRows = rows.slice(0, maxRows);
  const formattedRows = limitedRows.map((row) => {
    const formatted: Record<string, unknown> = {};
    headers.forEach((header) => {
      const value = row[header];
      if (typeof value === 'string' && value.length > 120) {
        formatted[header] = `${value.slice(0, 117)}...`;
      } else if (value instanceof Date) {
        formatted[header] = value.toISOString();
      } else {
        formatted[header] = value ?? '';
      }
    });
    return formatted;
  });

  return JSON.stringify(formattedRows, null, 2);
}

function formatCurrentConfig(config?: ExcelExtractionConfig): string {
  if (!config) return 'None provided.';
  const incidentEntries = Object.entries(config.incidentColumns || {});
  const incidentText =
    incidentEntries.length === 0
      ? 'None'
      : incidentEntries.map(([k, v]) => `- ${k}: ${v}`).join('\n');

  const injury = config.injuryColumns
    ? `start=${config.injuryColumns.start}, end=${config.injuryColumns.end}`
    : 'not set';

  return `Existing incident column mapping:
${incidentText}

Existing injury column window: ${injury}`;
}

function buildExcelPrompt(excelData: {
  headers: string[];
  rows: ExcelPreviewRow[];
  preview?: string;
  currentConfig?: ExcelExtractionConfig;
}): string {
  const headerList = excelData.headers
    .map((header, idx) => `${idx}: ${header}`)
    .join('\n');
  const sampleRows =
    excelData.preview ||
    buildSamplePreview(excelData.headers, excelData.rows || []);
  const currentConfigText = formatCurrentConfig(excelData.currentConfig);

  return `You are given an exported incident Excel sheet.

Map the columns to the required fields and identify the injury indicator columns.

Target fields (use exact header text):
- incident_number: unique incident id
- name: resident name
- date_time: date/time column (may be Excel date)
- incident_location: where the incident occurred
- room: room/bed reference
- incident_type: incident category/type

Injury columns: there is usually a contiguous block of columns that list many injury types with "Y" if present. Identify the start and end column indices (0-based, inclusive) for that block.

Existing config (use as hints; keep if correct, replace if better):
${currentConfigText}

Headers with indices:
${headerList}

Sample rows (truncated):
${sampleRows}

Return ONLY JSON, no code fences:
{
  "excelIncidentColumns": {
    "incident_number": "Incident #",
    "name": "Resident Name",
    "date_time": "Incident Date/Time",
    "incident_location": "Incident Location",
    "room": "Resident Room Number",
    "incident_type": "Incident Type"
  },
  "excelFieldMappings": {
    "incident_number": {
      "excelColumn": "Incident #",
      "confidence": 0.9,
      "reasoning": "Header explicitly matches",
      "dataSource": "EXCEL"
    }
  },
  "injuryColumns": {
    "start": 13,
    "end": 37,
    "confidence": 0.7,
    "reasoning": "Injury headers start at column 13"
  },
  "notes": "Optional short notes"
}`;
}

function normalizeExcelFieldMappings(
  raw: unknown,
): Record<string, ExcelFieldMapping> {
  const mappings: Record<string, ExcelFieldMapping> = {};

  if (!raw || typeof raw !== 'object') {
    return mappings;
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;

    const mapping = value as Partial<ExcelFieldMapping>;
    if (!mapping.excelColumn) continue;

    mappings[key] = {
      excelColumn: String(mapping.excelColumn),
      confidence: mapping.confidence ?? 0.7,
      reasoning: mapping.reasoning || '',
      dataSource: 'EXCEL',
    };
  }

  return mappings;
}

function parseExcelAnalysisResponse(text: string): ExcelAnalysisResult {
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonText);
  const excelFieldMappings = normalizeExcelFieldMappings(
    parsed.excelFieldMappings,
  );

  const incidentColumns: ExcelIncidentColumns = {
    ...DEFAULT_EXCEL_INCIDENT_COLUMNS,
    ...(parsed.excelIncidentColumns || {}),
  };

  const injuryColumns = parsed.injuryColumns
    ? {
        start: Number(parsed.injuryColumns.start ?? parsed.injuryColumns.begin ?? 13),
        end: Number(parsed.injuryColumns.end ?? parsed.injuryColumns.stop ?? 37),
        confidence: parsed.injuryColumns.confidence,
        reasoning: parsed.injuryColumns.reasoning,
      }
    : undefined;

  return {
    excelFieldMappings,
    excelIncidentColumns: incidentColumns,
    injuryColumns,
    notes: parsed.notes,
  };
}

function deriveIncidentColumnsFromMappings(
  mappings: Record<string, ExcelFieldMapping>,
): ExcelIncidentColumns {
  const columns: ExcelIncidentColumns = { ...DEFAULT_EXCEL_INCIDENT_COLUMNS };

  INCIDENT_FIELD_KEYS.forEach((key) => {
    const mapping = mappings[key];
    if (mapping?.excelColumn) {
      columns[key] = mapping.excelColumn;
    }
  });

  return columns;
}

export function toExcelExtractionConfig(
  analysis: ExcelAnalysisResult,
  excelHeaders?: string[],
): ExcelExtractionConfig {
  const incidentColumns =
    analysis.excelIncidentColumns ||
    deriveIncidentColumnsFromMappings(analysis.excelFieldMappings);

  const injuryColumns =
    analysis.injuryColumns?.start !== undefined &&
    analysis.injuryColumns?.end !== undefined
      ? {
          start: Number(analysis.injuryColumns.start),
          end: Number(analysis.injuryColumns.end),
        }
      : detectInjuryColumnsFromExcelMapping(
          analysis.excelFieldMappings,
          excelHeaders,
        );

  return {
    injuryColumns,
    incidentColumns,
  };
}

/**
 * Analyze Excel headers & sample rows with Claude to propose mappings.
 */
export async function analyzeExcelData(excelData: {
  headers: string[];
  rows: ExcelPreviewRow[];
  preview?: string;
  currentConfig?: ExcelExtractionConfig;
}): Promise<ExcelAnalysisResult> {
  const client = getClaudeClient();
  const prompt = buildExcelPrompt(excelData);

  const response = await client.messages.create({
    model: getAIModel(),
    max_tokens: 2000,
    system:
      'You are an expert data analyst who maps Excel sheets to structured fields. Always return clean JSON.',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response from Claude while analyzing Excel.');
  }

  return parseExcelAnalysisResponse(content.text);
}


/**
 * Manually detect injury columns from Excel field mappings
 */
export function detectInjuryColumnsFromExcelMapping(
  excelFieldMappings?: Record<string, unknown>,
  excelHeaders?: string[]
): { start: number; end: number } {
  // Default fallback
  const defaultColumns = { start: 13, end: 37 };

  if (!excelHeaders || excelHeaders.length === 0) {
    return defaultColumns;
  }

  // Common injury-related keywords
  const injuryKeywords = [
    'abrasion', 'bleeding', 'broken skin', 'bruise', 'burn',
    'dislocation', 'fracture', 'frostbite', 'hematoma',
    'hypoglycemia', 'incision', 'laceration', 'pain',
    'redness', 'scratches', 'skin tear', 'sprain', 'strain',
    'swelling', 'unconscious', 'contusion', 'head injury',
    'soft tissue', 'external rotation', 'suspected fracture',
    'possible fracture', 'sutures', 'unable to determine'
  ];

  const injuryIndices: number[] = [];

  excelHeaders.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    if (injuryKeywords.some(keyword => normalizedHeader.includes(keyword.toLowerCase()))) {
      injuryIndices.push(index);
    }
  });

  if (injuryIndices.length === 0) {
    return defaultColumns;
  }

  return {
    start: Math.min(...injuryIndices),
    end: Math.max(...injuryIndices)
  };
}

