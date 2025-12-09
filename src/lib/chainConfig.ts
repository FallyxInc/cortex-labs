/**
 * Chain Configuration Utilities
 *
 * This module consolidates all chain configuration related functionality:
 * - Type definitions for chain configs
 * - AI output conversion utilities
 * - Config validation
 * - Firebase config loading
 * - RFC PDF generation
 */

import jsPDF from 'jspdf';
import { ChainExtractionConfig, ExcelExtractionConfig, ExcelIncidentColumns, ExtractionType, FieldExtractionConfig, NoteTypeExtractionConfig } from '@/lib/processing/types';
import { adminDb } from './firebase-admin';
import { CHAIN_EXTRACTION_CONFIGS } from './processing/homesDb';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Highlight {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  label: string;
  labelType: 'note-type' | 'field-name' | 'end-marker' | 'other';
  noteType?: string;
  fieldKey?: string;
  aiGenerated?: boolean;
}

export interface NoteTypeConfig {
  name: string;
  isFollowUp: boolean;
  fields: Record<string, {
    fieldName: string;
    endMarkers: string[];
  }>;
}

export interface ExcelFieldMapping {
  excelColumn: string;
  confidence: number;
  reasoning: string;
  dataSource: 'EXCEL';
}

export interface DataSourceMapping {
  excel: string[];
  pdf: string[];
  note: string;
}

export interface ExcelData {
  headers: string[];
  rows: Record<string, unknown>[];
  preview: string;
}

export const DEFAULT_EXCEL_INCIDENT_COLUMNS: ExcelIncidentColumns = {
  incident_number: 'Incident #',
  name: 'Resident Name',
  date_time: 'Incident Date/Time',
  incident_location: 'Incident Location',
  room: 'Resident Room Number',
  incident_type: 'Incident Type',
};

export const DEFAULT_EXCEL_EXTRACTION: ExcelExtractionConfig = {
  injuryColumns: { start: 13, end: 37 },
  incidentColumns: DEFAULT_EXCEL_INCIDENT_COLUMNS,
};

export type WizardStep = 'pdf-config' | 'excel-config' | 'review' | 'saved' | 'edit-config';

export interface AIOutputFormat {
  chainId: string;
  chainName: string;
  behaviourNoteTypes: Array<{
    noteType: string;
    isFollowUp: boolean;
    confidence?: number;
  }>;
  followUpNoteTypes: Array<{
    noteType: string;
    isFollowUp: boolean;
    confidence?: number;
  }>;
  fieldExtractionMarkers: Record<string, {
    fieldName: string;
    endMarkers: string[];
    confidence?: number;
    dataSource?: string;
  }>;
  excelFieldMappings: Record<string, {
    excelColumn: string;
    confidence?: number;
    reasoning?: string;
    dataSource: 'EXCEL';
  }>;
  excelIncidentColumns?: ExcelIncidentColumns;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};


// ============================================================================
// FIREBASE LOADING
// ============================================================================

/**
 * Load chain extraction config dynamically from Firebase
 */
export async function getChainConfigFromFirebase(
  chainId: string
): Promise<ChainExtractionConfig | null> {
  try {
    const configRef = adminDb.ref(`/chains/${chainId}/config`);
    const snapshot = await configRef.once('value');

    if (snapshot.exists()) {
      const chainConfig = snapshot.val() as ChainExtractionConfig;

      return chainConfig;
    }
  } catch (error) {
    console.error(`Error loading chain config for ${chainId}:`, error);
  }

  return null;
}
