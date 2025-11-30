import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { extractTextFromPdf } from '@/lib/processing/pdfProcessor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No PDF file provided' },
        { status: 400 }
      );
    }

    // Save file temporarily using OS temp directory
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempDir = tmpdir();
    const tempPath = join(tempDir, `onboarding-${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
    
    await writeFile(tempPath, buffer);

    try {
      // Extract text from PDF
      const pagesText = await extractTextFromPdf(tempPath, 500);
      const fullText = pagesText.join('\n\n');

      // Clean up temp file
      await unlink(tempPath);

      return NextResponse.json({
        text: fullText,
        pages: pagesText,
      });
    } catch (error) {
      // Clean up temp file on error
      try {
        await unlink(tempPath);
      } catch {}
      
      throw error;
    }
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return NextResponse.json(
      { error: 'Failed to extract text from PDF' },
      { status: 500 }
    );
  }
}

