/**
 * TypeScript types for the hydration data processing pipeline.
 * These types replace the intermediate CSV files used in the Python version.
 */

// ============================================================================
// Care Plan Processing Types
// ============================================================================

/**
 * Raw resident data extracted from care plan PDFs.
 * This is the output of the care plan processor.
 */
export interface CarePlanResident {
  /** Resident name in "Last, First" format */
  name: string;
  /** mL goal from FLUID TARGET, null if not found */
  mlGoal: number | null;
  /** mL maximum goal, null if not found */
  mlMaximum: number | null;
  /** Source file and page info, e.g., "careplan.pdf - Page 1" */
  sourceFile: string;
  /** Whether resident has a feeding tube */
  hasFeedingTube: boolean;
}

// ============================================================================
// Hydration Data Processing Types
// ============================================================================

/**
 * Resident data after hydration PDF processing.
 * Extends CarePlanResident with daily hydration consumption data.
 */
export interface HydrationRecord extends CarePlanResident {
  /** Daily hydration data: { "MM/DD/YYYY": mL_value } */
  dateData: Record<string, number>;
  /** Whether resident missed goal for 3 consecutive days */
  missed3Days: boolean;
}

/**
 * Data extracted from a single page of a hydration PDF.
 */
export interface HydrationPageData {
  /** Resident name extracted from the page */
  residentName: string | null;
  /** Daily total values extracted */
  totals: number[];
  /** Start date for the data */
  startDate: Date | null;
}

// ============================================================================
// IPC (Infection Prevention & Control) Processing Types
// ============================================================================

/**
 * IPC data from CSV files.
 */
export interface IpcRecord {
  /** Resident name from IPC CSV */
  residentName: string;
  /** Type of infection */
  infectionType: string;
  /** Specific infection */
  infection: string;
}

/**
 * Resident data after IPC processing.
 * Extends HydrationRecord with IPC information.
 */
export interface ResidentWithIPC extends HydrationRecord {
  /** Whether IPC data was found for this resident */
  ipcFound: boolean;
  /** Infection name, "-" if none */
  infection: string;
  /** Infection type, "-" if none */
  infectionType: string;
}

// ============================================================================
// Dashboard Generation Types
// ============================================================================

/**
 * Final dashboard data for a single resident on a specific date.
 * This matches the structure expected by the frontend.
 */
export interface DashboardResident {
  /** Resident name in "Last, First" format */
  name: string;
  /** mL goal */
  goal: number;
  /** mL maximum goal */
  maximum: number;
  /** Source file info */
  source: string;
  /** Whether resident missed goal for 3 consecutive days */
  missed3Days: "yes" | "no";
  /** mL value consumed on this specific date */
  data: number;
  /** Whether IPC data was found */
  ipc_found: "yes" | "no";
  /** Infection name, "-" if none */
  infection: string;
  /** Infection type, "-" if none */
  infection_type: string;
}

/**
 * Dashboard data grouped by date.
 */
export interface DashboardData {
  /** Date string in MM_DD_YYYY format (for filename/doc ID) */
  dateKey: string;
  /** Date string in MM/DD/YYYY format (for display) */
  dateDisplay: string;
  /** Residents data for this date */
  residents: DashboardResident[];
}

// ============================================================================
// Processing Pipeline Types
// ============================================================================

/**
 * Input file with buffer for processing.
 */
export interface FileInput {
  /** Original filename */
  fileName: string;
  /** File content as Buffer */
  buffer: Buffer;
}

/**
 * Result of the complete processing pipeline.
 */
export interface ProcessingResult {
  /** All processed residents with full data */
  residents: ResidentWithIPC[];
  /** Dashboard data grouped by date */
  dashboardData: DashboardData[];
  /** CSV string for backwards compatibility with Firestore */
  csvData: string;
  /** Processing errors */
  errors: string[];
  /** Processing warnings */
  warnings: string[];
}

/**
 * Logging interface for processing operations.
 */
export interface ProcessingLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

// ============================================================================
// Internal Processing Types
// ============================================================================

/**
 * Name-to-index mapping for resident lookup.
 */
export type NameToIndexMap = Map<string, number>;

/**
 * Date column information.
 */
export interface DateColumn {
  /** Date in MM/DD/YYYY format */
  dateString: string;
  /** Parsed Date object */
  date: Date;
}
