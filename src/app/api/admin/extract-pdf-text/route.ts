import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { extractTextFromPdf } from '@/lib/processing/behaviours/pdfProcessor';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File | null;
    const excelFile = formData.get('excel') as File | null;

    if (!pdfFile && !excelFile) {
      return NextResponse.json(
        { error: 'At least one file (PDF or Excel) must be provided' },
        { status: 400 }
      );
    }

    const result: {
      pdfText?: string;
      pdfPages?: string[];
      excelData?: {
        headers: string[];
        rows: Record<string, unknown>[];
        preview: string;
      };
    } = {};

    // Process PDF if provided
    if (pdfFile) {
      if (pdfFile.type !== 'application/pdf') {
        return NextResponse.json(
          { error: 'PDF file must be a PDF' },
          { status: 400 }
        );
      }

      const bytes = await pdfFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const tempDir = tmpdir();
      const tempPath = join(tempDir, `onboarding-pdf-${Date.now()}-${Math.random().toString(36).substring(7)}-${pdfFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
      
      await writeFile(tempPath, buffer);

      try {
        const pagesText = await extractTextFromPdf(tempPath, 500);
        const fullText = pagesText.join('\n\n');
        result.pdfText = fullText;
        result.pdfPages = pagesText;
        await unlink(tempPath);
      } catch (error) {
        try {
          await unlink(tempPath);
        } catch {}
        throw error;
      }
    }

    // Process Excel if provided
    if (excelFile) {
      const isExcel = excelFile.type === 'application/vnd.ms-excel' || 
                     excelFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     excelFile.name.toLowerCase().endsWith('.xls') ||
                     excelFile.name.toLowerCase().endsWith('.xlsx');

      if (!isExcel) {
        return NextResponse.json(
          { error: 'Excel file must be an XLS or XLSX file' },
          { status: 400 }
        );
      }

      const bytes = await excelFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

      // Read the first sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON with header row 8 (0-indexed row 7) - same as excelProcessor
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      range.s.r = 7; // Start from row 8 (0-indexed)

      const data = XLSX.utils.sheet_to_json(sheet, {
        range,
        defval: '',
      }) as Record<string, unknown>[];

      const headers = Object.keys(data[0] || {});
      
      // Filter out "Struck Out" incidents
      const filteredData = data.filter(
        (row) => row['Incident Status'] !== 'Struck Out'
      );

      // Create preview text (first few rows)
      const previewRows = filteredData.slice(0, 5);
      const preview = [
        headers.join(' | '),
        ...previewRows.map(row => 
          headers.map(h => String(row[h] || '')).join(' | ')
        )
      ].join('\n');

      result.excelData = {
        headers,
        rows: filteredData,
        preview,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error extracting file content:', error);
    return NextResponse.json(
      { error: 'Failed to extract file content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

