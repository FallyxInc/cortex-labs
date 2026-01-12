import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { progressStore } from "../process-progress/route";
import { processCarePlans } from "@/lib/processing/hydration/careplanProcessor";
import { processHydrationPdfs } from "@/lib/processing/hydration/hydrationProcessor";
import { processIpcData } from "@/lib/processing/hydration/ipcProcessor";
import {
  validateAndCleanData,
  generateDashboardData,
  generateCsvContent,
  saveDashboardToFiles,
} from "@/lib/processing/hydration/dashboardGenerator";
import type {
  FileInput,
  ProcessingLogger,
  DashboardData,
  ResidentWithIPC,
} from "@/types/hydrationProcessingTypes";

export const runtime = "nodejs";

interface ProcessingResult {
  residents: ResidentWithIPC[];
  dashboardData: DashboardData[];
  csvData: string;
  errors: string[];
  warnings: string[];
}

/**
 * Update progress for job tracking
 */
function updateProgress(
  jobId: string,
  percentage: number,
  message: string,
  step: string
) {
  progressStore.set(jobId, { percentage, message, step });
  console.log(`[HYDRATION ${percentage}%] ${step}: ${message}`);
}

/**
 * Convert date from MM/DD/YYYY to YYYY-MM-DD format
 */
function convertDateToStandard(dateStr: string): string {
  const [month, day, year] = dateStr.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Sanitize resident name for use as Firebase key
 */
function sanitizeResidentName(name: string): string {
  return name.replace(/[.#$[\]]/g, "_");
}

/**
 * Process files through the complete hydration pipeline.
 */
async function processHydrationFiles(
  carePlanFiles: FileInput[],
  hydrationFiles: FileInput[],
  ipcFiles: FileInput[],
  jobId: string
): Promise<ProcessingResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const collectingLogger: ProcessingLogger = {
    info: (message: string) => console.log(`[HYDRATION] ${message}`),
    warn: (message: string) => {
      warnings.push(message);
      console.warn(`[HYDRATION] ${message}`);
    },
    error: (message: string) => {
      errors.push(message);
      console.error(`[HYDRATION] ${message}`);
    },
  };

  // Step 1: Process care plans (20-35%)
  updateProgress(jobId, 20, "Processing care plan PDFs...", "processing_careplans");
  console.log(`[HYDRATION] Processing ${carePlanFiles.length} care plan file(s)`);

  const carePlanResidents = await processCarePlans(carePlanFiles, collectingLogger);
  console.log(`[HYDRATION] Extracted ${carePlanResidents.length} residents from care plans`);

  if (carePlanResidents.length === 0) {
    errors.push("No residents extracted from care plans");
    return {
      residents: [],
      dashboardData: [],
      csvData: "",
      errors,
      warnings,
    };
  }

  updateProgress(
    jobId,
    35,
    `Extracted ${carePlanResidents.length} residents from care plans`,
    "careplans_complete"
  );

  // Step 2: Process hydration data (35-55%)
  updateProgress(jobId, 40, "Processing hydration data PDFs...", "processing_hydration");
  console.log(`[HYDRATION] Processing ${hydrationFiles.length} hydration file(s)`);

  const hydrationRecords = await processHydrationPdfs(
    hydrationFiles,
    carePlanResidents,
    collectingLogger
  );
  console.log(`[HYDRATION] Processed ${hydrationRecords.length} residents with hydration data`);

  updateProgress(
    jobId,
    55,
    `Processed ${hydrationRecords.length} residents with hydration data`,
    "hydration_complete"
  );

  // Step 3: Process IPC data (55-70%)
  updateProgress(jobId, 60, "Processing IPC CSV files...", "processing_ipc");
  console.log(`[HYDRATION] Processing ${ipcFiles.length} IPC file(s)`);

  const residentsWithIpc = processIpcData(hydrationRecords, ipcFiles, collectingLogger);
  console.log(`[HYDRATION] Processed ${residentsWithIpc.length} residents with IPC data`);

  updateProgress(
    jobId,
    70,
    `Processed ${residentsWithIpc.length} residents with IPC data`,
    "ipc_complete"
  );

  // Step 4: Validate and clean data (70-80%)
  updateProgress(jobId, 72, "Validating and cleaning data...", "validating");

  const cleanedResidents = validateAndCleanData(residentsWithIpc, collectingLogger);
  console.log(`[HYDRATION] ${cleanedResidents.length} residents after cleaning`);

  updateProgress(
    jobId,
    80,
    `${cleanedResidents.length} residents after validation`,
    "validation_complete"
  );

  // Step 5: Generate dashboard data (80-90%)
  updateProgress(jobId, 82, "Generating dashboard data...", "generating_dashboard");

  const dashboardData = generateDashboardData(cleanedResidents, collectingLogger);
  console.log(`[HYDRATION] Generated ${dashboardData.length} dashboard file(s)`);

  updateProgress(
    jobId,
    90,
    `Generated ${dashboardData.length} dashboard file(s)`,
    "dashboard_complete"
  );

  // Step 6: Generate CSV (90-95%)
  updateProgress(jobId, 92, "Generating CSV data...", "generating_csv");

  const csvData = generateCsvContent(cleanedResidents);
  console.log(`[HYDRATION] CSV generated (${csvData.length} characters)`);

  updateProgress(jobId, 95, "Processing complete", "processing_complete");

  return {
    residents: cleanedResidents,
    dashboardData,
    csvData,
    errors,
    warnings,
  };
}

export async function POST(request: NextRequest) {
  const jobId = `hydration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[HYDRATION API] Starting hydration file processing... Job ID: ${jobId}`);

  updateProgress(jobId, 0, "Initializing file processing...", "initializing");

  try {
    const formData = await request.formData();
    const homeId = formData.get("homeId") as string;
    const carePlanCount = parseInt(formData.get("carePlanCount") as string) || 0;
    const hydrationDataCount = parseInt(formData.get("hydrationDataCount") as string) || 0;
    const ipcDataCount = parseInt(formData.get("ipcDataCount") as string) || 0;

    console.log("[HYDRATION API] Request parameters:", {
      homeId,
      carePlanCount,
      hydrationDataCount,
      ipcDataCount,
    });

    if (!homeId) {
      updateProgress(jobId, 0, "Error: Home ID is required", "error");
      return NextResponse.json(
        { error: "Home ID is required", jobId },
        { status: 400 }
      );
    }

    if (carePlanCount === 0 || hydrationDataCount === 0) {
      updateProgress(
        jobId,
        0,
        "Error: At least one care plan and hydration file required",
        "error"
      );
      return NextResponse.json(
        {
          error: "At least one care plan file and one hydration data file are required",
          jobId,
        },
        { status: 400 }
      );
    }

    updateProgress(jobId, 2, "Validating home configuration...", "validating");

    // Verify home exists
    const homeRef = adminDb.ref(`/${homeId}`);
    const homeSnapshot = await homeRef.once("value");

    if (!homeSnapshot.exists()) {
      updateProgress(jobId, 0, "Error: Home not found", "error");
      return NextResponse.json(
        { error: "Home not found", jobId },
        { status: 404 }
      );
    }

    updateProgress(jobId, 5, "Extracting uploaded files...", "extracting_files");

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
        console.log(
          `[HYDRATION API] Extracted care plan file ${i}: ${file.name} (${file.size} bytes)`
        );
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
        console.log(
          `[HYDRATION API] Extracted hydration data file ${i}: ${file.name} (${file.size} bytes)`
        );
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
        console.log(
          `[HYDRATION API] Extracted IPC data file ${i}: ${file.name} (${file.size} bytes)`
        );
      }
    }

    console.log(
      `[HYDRATION API] Total files: ${carePlanFiles.length} care plans, ${hydrationDataFiles.length} hydration, ${ipcDataFiles.length} IPC`
    );

    updateProgress(
      jobId,
      10,
      `Extracted ${carePlanFiles.length + hydrationDataFiles.length + ipcDataFiles.length} files`,
      "files_extracted"
    );

    // Process files using the hydration pipeline
    const result = await processHydrationFiles(
      carePlanFiles,
      hydrationDataFiles,
      ipcDataFiles,
      jobId
    );

    console.log("[HYDRATION API] Processing complete!");
    console.log(`[HYDRATION API] Residents: ${result.residents.length}`);
    console.log(`[HYDRATION API] Dashboard files: ${result.dashboardData.length}`);
    console.log(`[HYDRATION API] Errors: ${result.errors.length}`);
    console.log(`[HYDRATION API] Warnings: ${result.warnings.length}`);

    // Save dashboard data to files
    const savedFiles = saveDashboardToFiles(
      result.dashboardData,
      result.residents,
      homeId,
      process.cwd(),
      {
        info: (msg) => console.log(`[HYDRATION API] ${msg}`),
        warn: (msg) => console.warn(`[HYDRATION API] ${msg}`),
        error: (msg) => console.error(`[HYDRATION API] ${msg}`),
      }
    );
    console.log(`[HYDRATION API] Saved ${savedFiles.files.length} files to ${savedFiles.directory}`);

    if (result.errors.length > 0) {
      console.error("[HYDRATION API] Processing errors:", result.errors);
    }

    // Upload to Firebase (95-100%)
    updateProgress(jobId, 96, "Uploading data to Firebase...", "uploading");

    for (const dashboard of result.dashboardData) {
      const standardDate = convertDateToStandard(dashboard.dateDisplay);
      const [year, month, day] = standardDate.split("-");

      const residentsForDate = dashboard.residents.map((r) => {
        const fullResident = result.residents.find((res) => res.name === r.name);
        return {
          name: r.name,
          intake: r.data,
          goal: r.goal,
          maximum: r.maximum,
          source: r.source,
          missed3Days: r.missed3Days,
          hasFeedingTube: fullResident?.hasFeedingTube || false,
          ipc_found: r.ipc_found,
          infection: r.infection,
          infection_type: r.infection_type,
        };
      });

      const hydrationRef = adminDb.ref(`/${homeId}/hydration/${year}/${month}/${day}`);

      const updates: Record<
        string,
        {
          name: string;
          intake: number;
          goal: number;
          maximum: number;
          source: string;
          missed3Days: string;
          hasFeedingTube: boolean;
          ipc_found: string;
          infection: string;
          infection_type: string;
          updatedAt: string;
        }
      > = {};

      for (const resident of residentsForDate) {
        if (!resident.name) continue;

        const sanitizedName = sanitizeResidentName(resident.name);
        updates[sanitizedName] = {
          name: resident.name,
          intake: resident.intake || 0,
          goal: resident.goal || 0,
          maximum: resident.maximum || 0,
          source: resident.source || "",
          missed3Days: resident.missed3Days || "no",
          hasFeedingTube: resident.hasFeedingTube || false,
          ipc_found: resident.ipc_found || "no",
          infection: resident.infection || "-",
          infection_type: resident.infection_type || "-",
          updatedAt: new Date().toISOString(),
        };
      }

      await hydrationRef.update(updates);
      console.log(
        `[HYDRATION API] Saved ${Object.keys(updates).length} resident records for ${standardDate}`
      );
    }

    updateProgress(jobId, 100, "Processing complete!", "complete");
    console.log("[HYDRATION API] Firebase upload completed successfully");

    return NextResponse.json({
      success: true,
      message: "Files processed successfully",
      residentsCount: result.residents.length,
      datesProcessed: result.dashboardData.length,
      errors: result.errors,
      warnings: result.warnings,
      jobId,
    });
  } catch (error) {
    console.error("[HYDRATION API] Error processing files:", error);
    updateProgress(
      jobId,
      0,
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "error"
    );
    return NextResponse.json(
      {
        error: "Failed to process files",
        details: error instanceof Error ? error.message : "Unknown error",
        jobId,
      },
      { status: 500 }
    );
  }
}
