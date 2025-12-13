import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeExcelData,
  toExcelExtractionConfig,
} from '@/lib/processing/excelAnalyzer';

export async function POST(request: NextRequest) {
  try {
    const { excelData, currentConfig } = await request.json();

    if (
      !excelData ||
      !Array.isArray(excelData.headers) ||
      !Array.isArray(excelData.rows)
    ) {
      return NextResponse.json(
        { error: 'excelData with headers and rows is required' },
        { status: 400 },
      );
    }

    // Keep payload manageable for the AI by sampling rows
    const sampleRows = excelData.rows.slice(0, 50);

    const analysis = await analyzeExcelData({
      headers: excelData.headers,
      rows: sampleRows,
      preview: excelData.preview,
      currentConfig,
    });

    const excelExtraction = toExcelExtractionConfig(
      analysis,
      excelData.headers,
    );

    return NextResponse.json({
      success: true,
      suggestions: {
        excelFieldMappings: analysis.excelFieldMappings,
        excelIncidentColumns: analysis.excelIncidentColumns,
        injuryColumns: analysis.injuryColumns,
        notes: analysis.notes,
      },
      extractionConfig: {
        excelExtraction,
      },
    });
  } catch (error) {
    console.error('Error analyzing Excel:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isApiKeyError = message.includes('API key');

    return NextResponse.json(
      {
        error: isApiKeyError
          ? 'Claude API key not configured. Set CLAUDE_API_KEY or ANTHROPIC_API_KEY.'
          : 'Failed to analyze Excel',
        details: message,
      },
      { status: 500 },
    );
  }
}


