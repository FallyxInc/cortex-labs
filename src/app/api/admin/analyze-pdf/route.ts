import { NextRequest, NextResponse } from 'next/server';
import { analyzePdfText, toFieldExtractionConfig, toNoteTypeExtractionConfig } from '@/lib/analysis/pdfAnalyzer';

export async function POST(request: NextRequest) {
  try {
    const { pdfText } = await request.json();

    if (!pdfText || typeof pdfText !== 'string') {
      return NextResponse.json(
        { error: 'PDF text is required' },
        { status: 400 }
      );
    }

    const analysis = await analyzePdfText(pdfText);

    const fieldExtractionMarkers = toFieldExtractionConfig(analysis.fieldExtractionMarkers);
    const behaviourNoteConfigs = toNoteTypeExtractionConfig(
      analysis.behaviourNoteConfigs,
    );
    const followUpNoteConfigs = toNoteTypeExtractionConfig(
      analysis.followUpNoteConfigs,
    );
    const hasTimeFrequency =
      analysis.hasTimeFrequency ||
      Object.values(behaviourNoteConfigs).some((cfg) => cfg.hasTimeFrequency) ||
      Object.values(followUpNoteConfigs).some((cfg) => cfg.hasTimeFrequency);
    const hasEvaluation =
      analysis.hasEvaluation ||
      Object.values(behaviourNoteConfigs).some((cfg) => cfg.hasEvaluation) ||
      Object.values(followUpNoteConfigs).some((cfg) => cfg.hasEvaluation);

    return NextResponse.json({
      success: true,
      suggestions: {
        behaviourNoteTypes: analysis.behaviourNoteTypes,
        followUpNoteTypes: analysis.followUpNoteTypes,
        junkMarkers: analysis.junkMarkers,
        fieldExtractionMarkers: analysis.fieldExtractionMarkers,
        noteTypeExtraction: analysis.noteTypeExtraction,
        behaviourNoteConfigs: analysis.behaviourNoteConfigs,
        followUpNoteConfigs: analysis.followUpNoteConfigs,
        hasTimeFrequency,
        hasEvaluation,
      },
      extractionConfig: {
        behaviourNoteTypes: analysis.behaviourNoteTypes.map(n => n.noteType),
        followUpNoteTypes: analysis.followUpNoteTypes.map(n => n.noteType),
        junkMarkers: analysis.junkMarkers.map(j => j.text),
        fieldExtractionMarkers,
        behaviourNoteConfigs,
        followUpNoteConfigs,
        hasTimeFrequency,
        hasEvaluation,
      },
    });
  } catch (error) {
    console.error('Error analyzing PDF:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isApiKeyError = message.includes('API key');
    
    return NextResponse.json(
      { 
        error: isApiKeyError 
          ? 'Claude API key not configured. Set CLAUDE_API_KEY or ANTHROPIC_API_KEY.' 
          : 'Failed to analyze PDF',
        details: message
      },
      { status: isApiKeyError ? 500 : 500 }
    );
  }
}

