import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Target output fields that we need to extract from PDF
const TARGET_OUTPUT_FIELDS = [
  'behaviour_type',
  'triggers',
  'interventions',
  'poa_notified',
  'time_frequency', // optional, chain-specific
  'evaluation', // optional, chain-specific
];

// Excel fields that come from Excel files
const EXCEL_FIELDS = [
  'incident_number', // Maps to "Incident ID" column
  'name', // Maps to "Resident name" column
  'date', // Maps to "Incident date" column
  'time', // Maps to "Incident time" column
  'incident_location', // Maps to "Where it happened" column
  'room', // Maps to "Resident room number" column
  'injuries', // From checkbox columns (can be overwritten by PDF)
  'incident_type', // Maps to "Type of incident" column
];

// Note: Excel is always the source of truth for Excel fields (name, date, time, injuries, etc.)
// PDF fields are additional data that gets merged with Excel records

interface AISuggestedField {
  fieldKey: string;
  fieldName: string; // The label/text in the PDF
  endMarkers: string[]; // Text that marks the end of this field
  confidence: number; // 0-1 confidence score
  reasoning: string; // Why this field was suggested
  dataSource: 'PDF' | 'EXCEL';
}

interface AISuggestedExcelField {
  fieldKey: string;
  excelColumn: string; // The exact column name/header in Excel
  confidence: number; // 0-1 confidence score
  reasoning: string; // Why this column maps to this field
  dataSource: 'EXCEL';
}

interface AISuggestedNoteType {
  noteType: string; // The exact text that appears in the PDF
  isFollowUp: boolean;
  confidence: number;
  reasoning: string;
}

interface AISuggestions {
  behaviourNoteTypes: AISuggestedNoteType[];
  followUpNoteTypes: AISuggestedNoteType[];
  fieldExtractionMarkers: Record<string, AISuggestedField>;
  excelFieldMappings: Record<string, AISuggestedExcelField>;
}

export async function POST(request: NextRequest) {
  try {
    const { pdfText, excelData } = await request.json();

    if (!pdfText && !excelData) {
      return NextResponse.json(
        { error: 'Either PDF text or Excel data is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Claude API key not configured' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Truncate PDF text if too long (Claude has token limits)
    const maxTextLength = 100000; // ~25k tokens
    const truncatedPdfText = pdfText && pdfText.length > maxTextLength 
      ? pdfText.substring(0, maxTextLength) + '\n\n[... text truncated ...]'
      : pdfText;

    // Prepare Excel preview (limit to avoid token limits)
    const excelPreview = excelData?.preview || '';
    const maxExcelPreviewLength = 50000;
    const truncatedExcelPreview = excelPreview.length > maxExcelPreviewLength
      ? excelPreview.substring(0, maxExcelPreviewLength) + '\n\n[... Excel data truncated ...]'
      : excelPreview;

    const systemPrompt = `You are an expert at analyzing healthcare documentation and extracting structured data. 
Your task is to analyze BOTH Excel and PDF documents containing behavior incident notes and identify:

FOR EXCEL FILES:
1. Map Excel column headers to target fields using these exact mappings:
   - incident_number → "Incident ID" column
   - name → "Resident name" column
   - date → "Incident date" column
   - time → "Incident time" column
   - incident_location → "Where it happened" column
   - room → "Resident room number" column
   - injuries → From checkbox columns (aggregated)
   - incident_type → "Type of incident" column

FOR PDF FILES:
1. Note types (behaviour notes and follow-up notes)
2. Field labels and their locations in the PDF for these fields ONLY:
   - behaviour_type
   - triggers (Antecedents/triggers)
   - interventions (Actions taken)
   - poa_notified (Power of Attorney notification)
   - time_frequency (optional, chain-specific)
   - evaluation (optional, chain-specific)

CRITICAL DATA SOURCE MAPPING:
- Excel files provide (8 columns): incident_number, name, date, time, incident_location, room, injuries, incident_type
- PDF files provide (6 columns): behaviour_type, triggers, interventions, poa_notified, time_frequency (optional), evaluation (optional)
- Excel is ALWAYS the source of truth for Excel fields (name, date, time, injuries, etc.)
- PDF fields are additional data that gets merged with Excel records

The final merged data combines Excel incident records (base) with PDF behaviour notes (matched by resident name and time window).

Be precise and provide exact text matches from the documents.`;

    let userPrompt = `Analyze the following documents from a behavior incident documentation system.

EXCEL FIELDS (8 columns - must come from Excel):
${EXCEL_FIELDS.map(f => {
  const mapping: Record<string, string> = {
    'incident_number': 'Maps to "Incident ID" column',
    'name': 'Maps to "Resident name" column',
    'date': 'Maps to "Incident date" column',
    'time': 'Maps to "Incident time" column',
    'incident_location': 'Maps to "Where it happened" column',
    'room': 'Maps to "Resident room number" column',
    'injuries': 'From checkbox columns (can be overwritten by PDF)',
    'incident_type': 'Maps to "Type of incident" column',
  };
  return `- ${f} (${mapping[f] || ''})`;
}).join('\n')}

PDF FIELDS (6 columns - must come from PDF):
${TARGET_OUTPUT_FIELDS.map(f => {
  const mapping: Record<string, string> = {
    'behaviour_type': 'Type of behavior',
    'triggers': 'Antecedents/triggers',
    'interventions': 'Actions taken',
    'poa_notified': 'Power of Attorney notification',
    'time_frequency': 'Optional, chain-specific',
    'evaluation': 'Optional, chain-specific',
  };
  return `- ${f} (${mapping[f] || ''})`;
}).join('\n')}

DATA SOURCE INFORMATION:
- Excel is ALWAYS the source of truth for Excel fields
- PDF provides additional behaviour note details that get merged with Excel records
- Excel files provide base incident data: ${EXCEL_FIELDS.join(', ')}
- PDF files provide behaviour note details: ${TARGET_OUTPUT_FIELDS.join(', ')}
- The system merges Excel incidents with PDF notes by matching resident name and time window (typically 24 hours)

`;

    if (truncatedExcelPreview && excelData?.headers) {
      userPrompt += `=== EXCEL DATA (CRITICAL - analyze this first) ===\n`;
      userPrompt += `Excel Headers: ${excelData.headers.join(', ')}\n\n`;
      userPrompt += `Excel Data Preview:\n${truncatedExcelPreview}\n\n`;
      userPrompt += `TASK 1: Map Excel columns to target fields. For each Excel field (${EXCEL_FIELDS.join(', ')}), identify:
1. Which Excel column header contains this data (e.g., "Incident #" maps to "incident_number", "Resident Name" maps to "name")
2. Your confidence level (0-1) and reasoning
3. Always mark dataSource as "EXCEL" (Excel is always the source of truth)

`;
    }

    if (truncatedPdfText) {
      userPrompt += `=== PDF TEXT (contains note types and field labels) ===\n${truncatedPdfText}\n\n`;
      userPrompt += `TASK 2: Analyze PDF for note types and field extraction markers. For each PDF field (${TARGET_OUTPUT_FIELDS.join(', ')}), identify:
1. The exact field label/text that appears in the PDF (e.g., "Type of Behaviour :", "Interventions :")
2. What text marks the end of that field (e.g., "Antecedent/Triggers", "Page", "Change in medication")
3. Your confidence level (0-1) and reasoning
4. Always mark dataSource as "PDF" (these are PDF-only fields that get merged with Excel records)

Also identify:
- Note type labels (e.g., "Behaviour - Responsive Behaviour", "Behaviour - Follow up")
- Whether each note type is a behaviour note or follow-up note

`;
    }

    userPrompt += `Respond with JSON in this exact format:
{
  "excelFieldMappings": {
    "incident_number": {
      "excelColumn": "exact column header from Excel (should be 'Incident ID' or similar)",
      "confidence": 0.9,
      "reasoning": "why this Excel column maps to incident_number",
      "dataSource": "EXCEL"
    },
    "name": {
      "excelColumn": "exact column header from Excel (should be 'Resident name' or similar)",
      "confidence": 0.9,
      "reasoning": "why this Excel column maps to name",
      "dataSource": "EXCEL"
    },
    "date": {
      "excelColumn": "exact column header from Excel (should be 'Incident date' or similar)",
      "confidence": 0.9,
      "reasoning": "why this Excel column maps to date",
      "dataSource": "EXCEL"
    },
    "time": {
      "excelColumn": "exact column header from Excel (should be 'Incident time' or similar)",
      "confidence": 0.9,
      "reasoning": "why this Excel column maps to time",
      "dataSource": "EXCEL"
    },
    "incident_location": {
      "excelColumn": "exact column header from Excel (should be 'Where it happened' or similar)",
      "confidence": 0.9,
      "reasoning": "why this Excel column maps to incident_location",
      "dataSource": "EXCEL"
    },
    "room": {
      "excelColumn": "exact column header from Excel (should be 'Resident room number' or similar)",
      "confidence": 0.9,
      "reasoning": "why this Excel column maps to room",
      "dataSource": "EXCEL"
    },
    "injuries": {
      "excelColumn": "checkbox columns aggregated (describe which columns)",
      "confidence": 0.9,
      "reasoning": "injuries come from checkbox columns in Excel",
      "dataSource": "EXCEL"
    },
    "incident_type": {
      "excelColumn": "exact column header from Excel (should be 'Type of incident' or similar)",
      "confidence": 0.9,
      "reasoning": "why this Excel column maps to incident_type",
      "dataSource": "EXCEL"
    }
  },
  "behaviourNoteTypes": [
    {
      "noteType": "exact text from PDF",
      "isFollowUp": false,
      "confidence": 0.9,
      "reasoning": "why this is a behaviour note type"
    }
  ],
  "followUpNoteTypes": [
    {
      "noteType": "exact text from PDF",
      "isFollowUp": true,
      "confidence": 0.9,
      "reasoning": "why this is a follow-up note type"
    }
  ],
  "fieldExtractionMarkers": {
    "behaviour_type": {
      "fieldName": "exact label text from PDF",
      "endMarkers": ["end marker 1", "end marker 2"],
      "confidence": 0.9,
      "reasoning": "why this field maps to behaviour_type",
      "dataSource": "PDF"
    },
    "triggers": {
      "fieldName": "exact label text from PDF",
      "endMarkers": ["end marker 1"],
      "confidence": 0.8,
      "reasoning": "why this field maps to triggers",
      "dataSource": "PDF"
    }
    // ... include all PDF fields you can identify: ${TARGET_OUTPUT_FIELDS.join(', ')}
  },
  "dataSourceMapping": {
    "excel": ${JSON.stringify(EXCEL_FIELDS)},
    "pdf": ${JSON.stringify(TARGET_OUTPUT_FIELDS)},
    "note": "Excel is always the source of truth. PDF fields are merged with Excel records."
  }
}

IMPORTANT:
- ANALYZE EXCEL FIRST - map all Excel columns to target fields
- Use EXACT text from both Excel headers and PDF (including colons, spaces, capitalization)
- Only include fields you can confidently identify
- For endMarkers, look for text that appears after the field content
- If a field is not found, omit it from the response
- Provide confidence scores based on how certain you are
- Always mark Excel fields as "EXCEL" and PDF fields as "PDF"
- Excel data is used as the base incident record and merged with PDF notes`;

    // Use Claude Sonnet 4.5 (recommended for best balance of intelligence, speed, and cost)
    // You can override via CLAUDE_MODEL environment variable if needed
    // Options: claude-sonnet-4-5, claude-haiku-4-5, claude-opus-4-5, claude-opus-4-1
    const modelName = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';
    
    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response (might have markdown code blocks)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsedResponse = JSON.parse(jsonText);
    const suggestions: AISuggestions = {
      behaviourNoteTypes: parsedResponse.behaviourNoteTypes || [],
      followUpNoteTypes: parsedResponse.followUpNoteTypes || [],
      fieldExtractionMarkers: parsedResponse.fieldExtractionMarkers || {},
      excelFieldMappings: parsedResponse.excelFieldMappings || {},
    };

    return NextResponse.json({
      success: true,
      suggestions,
      dataSourceMapping: parsedResponse.dataSourceMapping || {
        excel: EXCEL_FIELDS,
        pdf: TARGET_OUTPUT_FIELDS,
        note: 'Excel is always the source of truth. PDF fields are merged with Excel records.',
      },
    });
  } catch (error) {
    console.error('Error analyzing PDF with AI:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

