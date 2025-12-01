import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Target output fields that we need to extract
const TARGET_OUTPUT_FIELDS = [
  'behaviour_type',
  'triggers',
  'description',
  'consequences',
  'interventions',
  'medication_changes',
  'risks',
  'outcome',
  'poa_notified',
  'time_frequency', // optional
  'evaluation', // optional
];

interface AISuggestedField {
  fieldKey: string;
  fieldName: string; // The label/text in the PDF
  endMarkers: string[]; // Text that marks the end of this field
  confidence: number; // 0-1 confidence score
  reasoning: string; // Why this field was suggested
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
}

export async function POST(request: NextRequest) {
  try {
    const { pdfText } = await request.json();

    if (!pdfText || typeof pdfText !== 'string') {
      return NextResponse.json(
        { error: 'PDF text is required' },
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
    const truncatedText = pdfText.length > maxTextLength 
      ? pdfText.substring(0, maxTextLength) + '\n\n[... text truncated ...]'
      : pdfText;

    const systemPrompt = `You are an expert at analyzing healthcare documentation and extracting structured data. 
Your task is to analyze a PDF document containing behavior incident notes and identify:
1. Note types (behaviour notes and follow-up notes)
2. Field labels and their locations
3. End markers that indicate where each field ends

Be precise and provide exact text matches from the document.`;

    const userPrompt = `Analyze the following PDF text from a behavior incident documentation system.

TARGET OUTPUT FIELDS we need to extract:
${TARGET_OUTPUT_FIELDS.map(f => `- ${f}`).join('\n')}

For each target field, identify:
1. The exact field label/text that appears in the PDF (e.g., "Type of Behaviour :", "Interventions :")
2. What text marks the end of that field (e.g., "Antecedent/Triggers", "Page", "Change in medication")
3. Your confidence level (0-1) and reasoning

Also identify:
- Note type labels (e.g., "Behaviour - Responsive Behaviour", "Behaviour - Follow up")
- Whether each note type is a behaviour note or follow-up note

PDF TEXT:
${truncatedText}

Respond with JSON in this exact format:
{
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
      "reasoning": "why this field maps to behaviour_type"
    },
    "triggers": {
      "fieldName": "exact label text from PDF",
      "endMarkers": ["end marker 1"],
      "confidence": 0.8,
      "reasoning": "why this field maps to triggers"
    }
    // ... include all target fields you can identify
  }
}

IMPORTANT:
- Use EXACT text from the PDF (including colons, spaces, capitalization)
- Only include fields you can confidently identify
- For endMarkers, look for text that appears after the field content
- If a field is not found, omit it from the response
- Provide confidence scores based on how certain you are`;

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

    const suggestions: AISuggestions = JSON.parse(jsonText);

    return NextResponse.json({
      success: true,
      suggestions,
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

