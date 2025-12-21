import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import {
  processFiles,
  type FileInput,
} from '@/lib/processing/hydration';

// Configure runtime and body size limit for large file uploads
export const runtime = 'nodejs';
// export const maxDuration = 300; // 5 minutes for processing large files

/**
 * Convert date from MM/DD/YYYY to YYYY-MM-DD format
 */
function convertDateToStandard(dateStr: string): string {
  const [month, day, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Sanitize resident name for use as Firebase key
 */
function sanitizeResidentName(name: string): string {
  return name.replace(/[.#$[\]]/g, '_');
}

export async function POST(request: NextRequest) {
  console.log('🚀 [HYDRATION API] Starting hydration file processing...');

  try {
    const formData = await request.formData();
    const homeId = formData.get('homeId') as string;
    const carePlanCount = parseInt(formData.get('carePlanCount') as string) || 0;
    const hydrationDataCount = parseInt(formData.get('hydrationDataCount') as string) || 0;
    const ipcDataCount = parseInt(formData.get('ipcDataCount') as string) || 0;

    console.log('📊 [HYDRATION API] Request parameters:', {
      homeId,
      carePlanCount,
      hydrationDataCount,
      ipcDataCount,
    });

    if (!homeId) {
      return NextResponse.json(
        { error: 'Home ID is required' },
        { status: 400 }
      );
    }

    if (carePlanCount === 0 || hydrationDataCount === 0) {
      return NextResponse.json(
        { error: 'At least one care plan file and one hydration data file are required' },
        { status: 400 }
      );
    }

    // Verify home exists
    const homeRef = adminDb.ref(`/${homeId}`);
    const homeSnapshot = await homeRef.once('value');

    if (!homeSnapshot.exists()) {
      return NextResponse.json(
        { error: 'Home not found' },
        { status: 404 }
      );
    }

    // Extract care plan files
    const carePlanFiles: FileInput[] = [];
    for (let i = 0; i < carePlanCount; i++) {
      const file = formData.get(`carePlan_${i}`) as File;
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        carePlanFiles.push({
          fileName: file.name,
          buffer: Buffer.from(bytes),
        });
        console.log(`📄 [HYDRATION API] Extracted care plan file ${i}: ${file.name} (${file.size} bytes)`);
      }
    }

    // Extract hydration data files
    const hydrationDataFiles: FileInput[] = [];
    for (let i = 0; i < hydrationDataCount; i++) {
      const file = formData.get(`hydrationData_${i}`) as File;
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        hydrationDataFiles.push({
          fileName: file.name,
          buffer: Buffer.from(bytes),
        });
        console.log(`💧 [HYDRATION API] Extracted hydration data file ${i}: ${file.name} (${file.size} bytes)`);
      }
    }

    // Extract IPC data files
    const ipcDataFiles: FileInput[] = [];
    for (let i = 0; i < ipcDataCount; i++) {
      const file = formData.get(`ipcData_${i}`) as File;
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        ipcDataFiles.push({
          fileName: file.name,
          buffer: Buffer.from(bytes),
        });
        console.log(`📋 [HYDRATION API] Extracted IPC data file ${i}: ${file.name} (${file.size} bytes)`);
      }
    }

    console.log(
      `📦 [HYDRATION API] Total files extracted: ${carePlanFiles.length} care plans, ${hydrationDataFiles.length} hydration data files, ${ipcDataFiles.length} IPC files`
    );

    // Process files using TypeScript pipeline
    console.log('[HYDRATION API] Starting TypeScript processing pipeline...');

    const logger = {
      info: (msg: string) => console.log(`[HYDRATION API] ${msg}`),
      warn: (msg: string) => console.warn(`[HYDRATION API] ${msg}`),
      error: (msg: string) => console.error(`[HYDRATION API] ${msg}`),
    };

    const result = await processFiles(
      carePlanFiles,
      hydrationDataFiles,
      ipcDataFiles,
      logger
    );

    console.log('[HYDRATION API] Processing complete!');
    console.log(`[HYDRATION API] Residents: ${result.residents.length}`);
    console.log(`[HYDRATION API] Dashboard files: ${result.dashboardData.length}`);
    console.log(`[HYDRATION API] Errors: ${result.errors.length}`);
    console.log(`[HYDRATION API] Warnings: ${result.warnings.length}`);

    if (result.errors.length > 0) {
      console.error('[HYDRATION API] Processing errors:', result.errors);
    }

    // Group dashboard data by date and write to Firebase
    console.log('[HYDRATION API] Writing data to Firebase Realtime Database...');

    for (const dashboard of result.dashboardData) {
      const standardDate = convertDateToStandard(dashboard.dateDisplay);
      const [year, month, day] = standardDate.split('-');

      // Get all residents for this date
      const residentsForDate = dashboard.residents.map((r) => {
        // Find the full resident data
        const fullResident = result.residents.find((res) => res.name === r.name);
        return {
          name: r.name,
          intake: r.data,
          goal: r.goal,
          source: r.source,
          missed3Days: r.missed3Days,
          hasFeedingTube: fullResident?.hasFeedingTube || false,
          ipc_found: r.ipc_found,
          infection: r.infection,
          infection_type: r.infection_type,
        };
      });

      // Write to Firebase at /{homeId}/hydration/{year}/{month}/{day}/{residentName}
      const hydrationRef = adminDb.ref(`/${homeId}/hydration/${year}/${month}/${day}`);

      const updates: Record<string, {
        name: string;
        intake: number;
        goal: number;
        source: string;
        missed3Days: string;
        hasFeedingTube: boolean;
        ipc_found: string;
        infection: string;
        infection_type: string;
        updatedAt: string;
      }> = {};

      for (const resident of residentsForDate) {
        if (!resident.name) {
          continue;
        }

        const sanitizedName = sanitizeResidentName(resident.name);

        updates[sanitizedName] = {
          name: resident.name,
          intake: resident.intake || 0,
          goal: resident.goal || 0,
          source: resident.source || '',
          missed3Days: resident.missed3Days || 'no',
          hasFeedingTube: resident.hasFeedingTube || false,
          ipc_found: resident.ipc_found || 'no',
          infection: resident.infection || '-',
          infection_type: resident.infection_type || '-',
          updatedAt: new Date().toISOString(),
        };
      }

      await hydrationRef.update(updates);
      console.log(`✅ [HYDRATION API] Saved ${Object.keys(updates).length} resident records for ${standardDate}`);
    }

    console.log('[HYDRATION API] Firebase upload completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Files processed successfully',
      residentsCount: result.residents.length,
      datesProcessed: result.dashboardData.length,
      errors: result.errors,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('[HYDRATION API] Error processing files:', error);
    return NextResponse.json(
      {
        error: 'Failed to process files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

