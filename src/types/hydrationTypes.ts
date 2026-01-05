/**
 * Hydration Types and Interfaces
 * Centralized type definitions for the hydration dashboard components
 */

// ============================================================================
// Core Data Types
// ============================================================================

export interface HydrationResident {
  name: string;
  goal: number;
  maximum: number;
  source: string;
  missed3Days: 'yes' | 'no';
  hasFeedingTube: boolean;
  ipc_found: 'yes' | 'no';
  infection: string;
  infection_type: string;
  dateData: Record<string, number>; // { "MM/DD/YYYY": intakeValue }
}

export interface HydrationDailyRecord {
  residentName: string;
  date: string; // "YYYY-MM-DD"
  intake: number;
  goal?: number;
  maximum?: number;
  source?: string;
  missed3Days?: 'yes' | 'no';
  hasFeedingTube?: boolean;
  ipc_found?: 'yes' | 'no';
  infection?: string;
  infection_type?: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface HydrationDataResponse {
  success: boolean;
  data: HydrationResident[];
  startDate: string;
  endDate: string;
  homeId: string;
  hydrationId?: string;
  sources: {
    legacy: number;
    default: number;
    merged: number;
  };
}

export interface HydrationErrorResponse {
  error: string;
  details?: string;
}