/**
 * Main processing pipeline orchestrator.
 * Chains all processors together to convert raw files to dashboard data.
 */

import { processCarePlans } from "./careplan-processor";
import { processHydrationPdfs } from "./hydration-processor";
import { processIpcData } from "./ipc-processor";
import {
  validateAndCleanData,
  generateDashboardData,
  generateCsvContent,
  generateJsFileContent,
  saveDashboardToFiles,
  getHomeIdentifier,
} from "./dashboard-generator";
import type {
  FileInput,
  ProcessingResult,
  ProcessingLogger,
  DashboardData,
} from "./types";

// Re-export types for external use
export type {
  FileInput,
  ProcessingResult,
  ProcessingLogger,
  CarePlanResident,
  HydrationRecord,
  ResidentWithIPC,
  DashboardResident,
  DashboardData,
} from "./types";

// Re-export utility functions
export {
  generateJsFileContent,
  normalizeDateForFilename,
  saveDashboardToFiles,
  getHomeIdentifier,
} from "./dashboard-generator";

/**
 * Default console logger.
 */
const defaultLogger: ProcessingLogger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warn: (message: string) => console.log(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

/**
 * Process all files through the complete pipeline.
 *
 * This is the main entry point for the TypeScript processing pipeline.
 * It chains all processors together:
 * 1. Care Plan PDFs -> Residents with names and goals
 * 2. Hydration PDFs -> Add daily consumption data
 * 3. IPC CSVs -> Add infection data
 * 4. Dashboard Generation -> Validate, clean, and format output
 *
 * @param carePlanFiles - Care plan PDF files
 * @param hydrationFiles - Hydration data PDF files
 * @param ipcFiles - IPC CSV files
 * @param logger - Optional custom logger
 * @returns Complete processing result
 */
export async function processFiles(
  carePlanFiles: FileInput[],
  hydrationFiles: FileInput[],
  ipcFiles: FileInput[],
  logger: ProcessingLogger = defaultLogger
): Promise<ProcessingResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Create a logger that collects errors and warnings
  const collectingLogger: ProcessingLogger = {
    info: logger.info,
    warn: (message: string) => {
      warnings.push(message);
      logger.warn(message);
    },
    error: (message: string) => {
      errors.push(message);
      logger.error(message);
    },
  };

  logger.info("=".repeat(60));
  logger.info("Starting TypeScript processing pipeline");
  logger.info("=".repeat(60));

  // Step 1: Process care plans
  logger.info("");
  logger.info("Step 1: Processing care plan PDFs...");
  logger.info(`  ${carePlanFiles.length} care plan file(s) to process`);

  const carePlanResidents = await processCarePlans(
    carePlanFiles,
    collectingLogger
  );

  logger.info(
    `  Extracted ${carePlanResidents.length} residents from care plans`
  );

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

  // Step 2: Process hydration data
  logger.info("");
  logger.info("Step 2: Processing hydration data PDFs...");
  logger.info(`  ${hydrationFiles.length} hydration file(s) to process`);

  const hydrationRecords = await processHydrationPdfs(
    hydrationFiles,
    carePlanResidents,
    collectingLogger
  );

  logger.info(
    `  Processed ${hydrationRecords.length} residents with hydration data`
  );

  // Step 3: Process IPC data
  logger.info("");
  logger.info("Step 3: Processing IPC CSV files...");
  logger.info(`  ${ipcFiles.length} IPC file(s) to process`);

  const residentsWithIpc = processIpcData(
    hydrationRecords,
    ipcFiles,
    collectingLogger
  );

  logger.info(`  Processed ${residentsWithIpc.length} residents with IPC data`);

  // Step 4: Validate and clean data
  logger.info("");
  logger.info("Step 4: Validating and cleaning data...");

  const cleanedResidents = validateAndCleanData(
    residentsWithIpc,
    collectingLogger
  );

  logger.info(`  ${cleanedResidents.length} residents after cleaning`);

  // Step 5: Generate dashboard data
  logger.info("");
  logger.info("Step 5: Generating dashboard data...");

  const dashboardData = generateDashboardData(
    cleanedResidents,
    collectingLogger
  );

  logger.info(`  Generated ${dashboardData.length} dashboard file(s)`);

  // Step 6: Generate CSV for backwards compatibility
  logger.info("");
  logger.info("Step 6: Generating CSV for Firestore...");

  const csvData = generateCsvContent(cleanedResidents);

  logger.info(`  CSV generated (${csvData.length} characters)`);

  // Summary
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("Processing complete!");
  logger.info(`  Residents: ${cleanedResidents.length}`);
  logger.info(`  Dashboard files: ${dashboardData.length}`);
  logger.info(`  Errors: ${errors.length}`);
  logger.info(`  Warnings: ${warnings.length}`);
  logger.info("=".repeat(60));

  return {
    residents: cleanedResidents,
    dashboardData,
    csvData,
    errors,
    warnings,
  };
}

/**
 * Convert dashboard data to the format expected by Firebase upload.
 *
 * @param dashboardData - Array of dashboard data
 * @returns Array of { fileName, data } objects
 */
export function convertDashboardDataForUpload(
  dashboardData: DashboardData[]
): { fileName: string; data: string }[] {
  return dashboardData.map((d) => ({
    fileName: `dashboard_${d.dateKey}.js`,
    data: generateJsFileContent(d),
  }));
}

