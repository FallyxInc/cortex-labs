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
import { ChainExtractionConfig, ExcelIncidentColumns, ExtractionType, FieldExtractionConfig, NoteTypeExtractionConfig } from '@/lib/processing/types';
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

export interface ChainConfig {
  chainId: string;
  chainName: string;
  behaviourNoteTypes: string[];
  followUpNoteTypes: string[];
  noteTypeConfigs: Record<string, NoteTypeConfig>;
  excelFieldMappings?: Record<string, ExcelFieldMapping>;
  excelIncidentColumns?: ExcelIncidentColumns;
  createdAt?: string;
  updatedAt?: string;
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

export const normalizeChainConfig = (config: Partial<ChainConfig>): ChainConfig => {
  const normalizedNoteTypeConfigs: Record<string, NoteTypeConfig> = {};

  if (config.noteTypeConfigs) {
    for (const [key, noteConfig] of Object.entries(config.noteTypeConfigs)) {
      normalizedNoteTypeConfigs[key] = {
        name: noteConfig?.name || key,
        isFollowUp: noteConfig?.isFollowUp || false,
        fields: noteConfig?.fields || {},
      };
    }
  }

  return {
    chainId: config.chainId || '',
    chainName: config.chainName || '',
    behaviourNoteTypes: config.behaviourNoteTypes || [],
    followUpNoteTypes: config.followUpNoteTypes || [],
    noteTypeConfigs: normalizedNoteTypeConfigs,
    excelFieldMappings: config.excelFieldMappings || {},
    excelIncidentColumns: config.excelIncidentColumns || DEFAULT_EXCEL_INCIDENT_COLUMNS,
  };
};

// ============================================================================
// AI OUTPUT CONVERSION
// ============================================================================

/**
 * Convert AI output format to ChainConfig format
 */
export function convertAIOutputToChainConfig(aiOutput: AIOutputFormat): ChainConfig {
  const noteTypeConfigs: Record<string, NoteTypeConfig> = {};

  // Process behaviour note types
  const behaviourNoteTypes: string[] = [];
  for (const noteTypeInfo of aiOutput.behaviourNoteTypes || []) {
    const noteType = noteTypeInfo.noteType;
    behaviourNoteTypes.push(noteType);

    // Group fields by note type
    if (!noteTypeConfigs[noteType]) {
      noteTypeConfigs[noteType] = {
        name: noteType,
        isFollowUp: false,
        fields: {}
      };
    }

    // Add fields from fieldExtractionMarkers to this note type
    if (aiOutput.fieldExtractionMarkers) {
      for (const [fieldKey, fieldConfig] of Object.entries(aiOutput.fieldExtractionMarkers)) {
        // All PDF fields belong to behaviour note types
        if (behaviourNoteTypes.length === 1 || !fieldConfig.dataSource || fieldConfig.dataSource === 'PDF') {
          noteTypeConfigs[noteType].fields[fieldKey] = {
            fieldName: fieldConfig.fieldName,
            endMarkers: fieldConfig.endMarkers || []
          };
        }
      }
    }
  }

  // Process follow-up note types
  const followUpNoteTypes: string[] = [];
  for (const noteTypeInfo of aiOutput.followUpNoteTypes || []) {
    const noteType = noteTypeInfo.noteType;
    followUpNoteTypes.push(noteType);

    if (!noteTypeConfigs[noteType]) {
      noteTypeConfigs[noteType] = {
        name: noteType,
        isFollowUp: true,
        fields: {}
      };
    }
  }

  // Convert excelFieldMappings
  const excelFieldMappings: Record<string, ExcelFieldMapping> = {};

  if (aiOutput.excelFieldMappings) {
    for (const [fieldKey, mapping] of Object.entries(aiOutput.excelFieldMappings)) {
      excelFieldMappings[fieldKey] = {
        excelColumn: mapping.excelColumn,
        confidence: mapping.confidence ?? 0.8,
        reasoning: mapping.reasoning ?? 'AI-generated mapping',
        dataSource: 'EXCEL'
      };
    }
  }

  return {
    chainId: aiOutput.chainId || '',
    chainName: aiOutput.chainName || '',
    behaviourNoteTypes,
    followUpNoteTypes,
    noteTypeConfigs,
    excelFieldMappings,
    excelIncidentColumns: aiOutput.excelIncidentColumns || DEFAULT_EXCEL_INCIDENT_COLUMNS,
  };
}

// ============================================================================
// INJURY COLUMN DETECTION
// ============================================================================

/**
 * Detect injury columns from Excel field mappings
 */
export function detectInjuryColumnsFromExcelMapping(
  excelFieldMappings?: Record<string, unknown>,
  excelHeaders?: string[]
): { start: number; end: number } {
  // Default fallback
  const defaultColumns = { start: 13, end: 37 };

  if (!excelHeaders || excelHeaders.length === 0) {
    return defaultColumns;
  }

  // Common injury-related keywords
  const injuryKeywords = [
    'abrasion', 'bleeding', 'broken skin', 'bruise', 'burn',
    'dislocation', 'fracture', 'frostbite', 'hematoma',
    'hypoglycemia', 'incision', 'laceration', 'pain',
    'redness', 'scratches', 'skin tear', 'sprain', 'strain',
    'swelling', 'unconscious', 'contusion', 'head injury',
    'soft tissue', 'external rotation', 'suspected fracture',
    'possible fracture', 'sutures', 'unable to determine'
  ];

  const injuryIndices: number[] = [];

  excelHeaders.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim();
    if (injuryKeywords.some(keyword => normalizedHeader.includes(keyword.toLowerCase()))) {
      injuryIndices.push(index);
    }
  });

  if (injuryIndices.length === 0) {
    return defaultColumns;
  }

  return {
    start: Math.min(...injuryIndices),
    end: Math.max(...injuryIndices)
  };
}

// ============================================================================
// CONFIG CONVERSION (ChainConfig -> ChainExtractionConfig)
// ============================================================================

/**
 * Convert ChainConfig to ChainExtractionConfig for runtime use
 */
export function convertChainConfigToExtractionConfig(
  chainConfig: ChainConfig,
  excelHeaders?: string[]
): ChainExtractionConfig {
  // Extract default field markers from first behaviour note type
  const firstBehaviourNote = chainConfig.behaviourNoteTypes[0];
  const defaultFields: Record<string, FieldExtractionConfig> = {};

  if (firstBehaviourNote && chainConfig.noteTypeConfigs[firstBehaviourNote]) {
    const noteConfig = chainConfig.noteTypeConfigs[firstBehaviourNote];
    for (const [fieldKey, fieldConfig] of Object.entries(noteConfig.fields)) {
      defaultFields[fieldKey] = {
        fieldName: fieldConfig.fieldName,
        endMarkers: fieldConfig.endMarkers
      };
    }
  }

  // Build note-type-specific configs
  const behaviourNoteConfigs: Record<string, NoteTypeExtractionConfig> = {};
  const followUpNoteConfigs: Record<string, NoteTypeExtractionConfig> = {};

  for (const noteType of chainConfig.behaviourNoteTypes) {
    const noteConfig = chainConfig.noteTypeConfigs[noteType];
    if (noteConfig) {
      const extractionMarkers: Record<string, FieldExtractionConfig> = {};
      for (const [fieldKey, fieldConfig] of Object.entries(noteConfig.fields)) {
        extractionMarkers[fieldKey] = {
          fieldName: fieldConfig.fieldName,
          endMarkers: fieldConfig.endMarkers
        };
      }

      behaviourNoteConfigs[noteType] = {
        extractionMarkers,
        hasTimeFrequency: !!noteConfig.fields.time_frequency,
        hasEvaluation: !!noteConfig.fields.evaluation
      };
    }
  }

  for (const noteType of chainConfig.followUpNoteTypes) {
    const noteConfig = chainConfig.noteTypeConfigs[noteType];
    if (noteConfig) {
      const extractionMarkers: Record<string, FieldExtractionConfig> = {};
      for (const [fieldKey, fieldConfig] of Object.entries(noteConfig.fields)) {
        extractionMarkers[fieldKey] = {
          fieldName: fieldConfig.fieldName,
          endMarkers: fieldConfig.endMarkers
        };
      }

      followUpNoteConfigs[noteType] = {
        extractionMarkers,
        hasTimeFrequency: !!noteConfig.fields.time_frequency,
        hasEvaluation: !!noteConfig.fields.evaluation
      };
    }
  }

  // Detect injury columns
  const injuryColumns = detectInjuryColumnsFromExcelMapping(
    chainConfig.excelFieldMappings,
    excelHeaders
  );
  const excelIncidentColumns = chainConfig.excelIncidentColumns || DEFAULT_EXCEL_INCIDENT_COLUMNS;

  // Check if time_frequency or evaluation are present in any note type
  const hasTimeFrequency = chainConfig.behaviourNoteTypes.some(nt =>
    chainConfig.noteTypeConfigs[nt]?.fields.time_frequency
  );
  const hasEvaluation = chainConfig.behaviourNoteTypes.some(nt =>
    chainConfig.noteTypeConfigs[nt]?.fields.evaluation
  );

  return {
    behaviourNoteTypes: chainConfig.behaviourNoteTypes,
    followUpNoteTypes: chainConfig.followUpNoteTypes,
    fieldExtractionMarkers: defaultFields,
    behaviourNoteConfigs,
    followUpNoteConfigs,
    excelExtraction: {
      injuryColumns,
      incidentColumns: excelIncidentColumns,
    },
    matchingWindowHours: 24,
    hasTimeFrequency,
    hasEvaluation
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate chain configuration
 */
export function validateChainConfig(config: ChainConfig): string[] {
  const errors: string[] = [];

  if (!config.chainId || config.chainId.trim() === '') {
    errors.push('Chain ID is required');
  }

  if (!config.chainName || config.chainName.trim() === '') {
    errors.push('Chain name is required');
  }

  if (!config.behaviourNoteTypes || config.behaviourNoteTypes.length === 0) {
    errors.push('At least one behaviour note type is required');
  }

  // Validate required Excel fields
  const requiredExcelFields = ['incident_number', 'name', 'date', 'time', 'incident_type'];
  for (const field of requiredExcelFields) {
    if (!config.excelFieldMappings?.[field]) {
      errors.push(`Excel field mapping for "${field}" is required`);
    }
  }

  // Validate Excel field mappings have required properties
  if (config.excelFieldMappings) {
    for (const [fieldKey, mapping] of Object.entries(config.excelFieldMappings)) {
      if (!mapping || typeof mapping !== 'object') {
        errors.push(`Excel field mapping for "${fieldKey}" is invalid`);
        continue;
      }
      if (!mapping.excelColumn || (typeof mapping.excelColumn === 'string' && mapping.excelColumn.trim() === '')) {
        errors.push(`Excel field mapping for "${fieldKey}" is missing column name`);
      }
    }
  }

  return errors;
}

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
      const chainConfig = snapshot.val() as ChainConfig;
      const extractionConfig = convertChainConfigToExtractionConfig(chainConfig);

      // Cache it in the static configs for future use
      CHAIN_EXTRACTION_CONFIGS[chainId] = extractionConfig;

      return extractionConfig;
    }
  } catch (error) {
    console.error(`Error loading chain config for ${chainId}:`, error);
  }

  return null;
}

// ============================================================================
// RFC PDF GENERATOR
// ============================================================================

export const generateRFC = (config: ChainConfig) => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  const margin = 20;
  const lineHeight = 7;
  let yPos = margin;

  // Helper function to add a new page if needed
  const checkNewPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number, isBold: boolean = false, color: number[] = [0, 0, 0]) => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
    pdf.setTextColor(color[0], color[1], color[2]);

    const maxWidth = pageWidth - 2 * margin;
    const lines = pdf.splitTextToSize(text, maxWidth);

    checkNewPage(lines.length * lineHeight);

    lines.forEach((line: string) => {
      pdf.text(line, margin, yPos);
      yPos += lineHeight;
    });

    yPos += 2;
  };

  // Title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(6, 182, 212);
  pdf.text('RFC: Chain Configuration', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Chain Information Section
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('1. Chain Information', margin, yPos);
  yPos += 10;

  addText(`Chain ID: ${config.chainId}`, 12, true);
  addText(`Chain Name: ${config.chainName}`, 12, true);
  yPos += 5;

  // Note Types Section
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('2. Note Types Configuration', margin, yPos);
  yPos += 10;

  addText('2.1 Behaviour Note Types', 14, true);
  if (config.behaviourNoteTypes.length > 0) {
    config.behaviourNoteTypes.forEach((type, index) => {
      addText(`${index + 1}. ${type}`, 11);
    });
  } else {
    addText('No behaviour note types configured', 11, false, [128, 128, 128]);
  }
  yPos += 5;

  addText('2.2 Follow-up Note Types', 14, true);
  if (config.followUpNoteTypes.length > 0) {
    config.followUpNoteTypes.forEach((type, index) => {
      addText(`${index + 1}. ${type}`, 11);
    });
  } else {
    addText('No follow-up note types configured', 11, false, [128, 128, 128]);
  }
  yPos += 5;

  // Field Extraction Markers Section
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  checkNewPage(15);
  pdf.text('3. Field Extraction Markers', margin, yPos);
  yPos += 10;

  const noteTypeEntries = Object.entries(config.noteTypeConfigs);
  if (noteTypeEntries.length === 0) {
    addText('No note type configurations found', 11, false, [128, 128, 128]);
  } else {
    noteTypeEntries.forEach(([noteType, noteConfig], noteIndex) => {
      checkNewPage(20);
      addText(`3.${noteIndex + 1} Note Type: ${noteType}`, 14, true);
      addText(`Type: ${noteConfig.isFollowUp ? 'Follow-up Note' : 'Behaviour Note'}`, 11);
      yPos += 3;

      const fieldEntries = noteConfig.fields ? Object.entries(noteConfig.fields) : [];
      if (fieldEntries.length === 0) {
        addText('  No fields configured for this note type', 10, false, [128, 128, 128]);
      } else {
        fieldEntries.forEach(([fieldKey, fieldConfig], fieldIndex) => {
          checkNewPage(25);
          addText(`  Field ${fieldIndex + 1}: ${fieldKey}`, 12, true);
          addText(`    Field Name: "${fieldConfig.fieldName}"`, 10);
          if (fieldConfig.endMarkers && fieldConfig.endMarkers.length > 0) {
            addText(`    End Markers: ${fieldConfig.endMarkers.join(', ')}`, 10);
          } else {
            addText(`    End Markers: None specified`, 10, false, [128, 128, 128]);
          }
          yPos += 2;
        });
      }
      yPos += 5;
    });
  }

  // Code Section
  checkNewPage(30);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('4. Implementation Code', margin, yPos);
  yPos += 10;

  addText('4.1 TypeScript Configuration', 14, true);

  // Generate TypeScript code
  const formatTsValue = (value: unknown, indent: number = 2): string => {
    const spaces = ' '.repeat(indent);
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      return `[\n${value.map(v => `${spaces}  ${JSON.stringify(v)}`).join(',\n')}\n${spaces}]`;
    }
    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value);
      if (entries.length === 0) return '{}';
      return `{\n${entries.map(([k, v]) => {
        const formattedValue = formatTsValue(v, indent + 2);
        return `${spaces}  ${k}: ${formattedValue}`;
      }).join(',\n')}\n${spaces}}`;
    }
    return JSON.stringify(value);
  };

  // Convert to ChainExtractionConfig format
  const chainExtractionConfig: ChainExtractionConfig = {
    behaviourNoteTypes: config.behaviourNoteTypes,
    followUpNoteTypes: config.followUpNoteTypes,
    extraFollowUpNoteTypes: [],
    excelExtraction: {
      injuryColumns: {
        start: 13,
        end: 87,
      },
      incidentColumns: DEFAULT_EXCEL_INCIDENT_COLUMNS,
    },
    fieldExtractionMarkers: {},
    hasTimeFrequency: false,
    hasEvaluation: false,
  };

  // Merge field extraction markers from all note types
  const firstNoteType = Object.keys(config.noteTypeConfigs)[0];
  if (firstNoteType) {
    const noteConfig = config.noteTypeConfigs[firstNoteType];
    if (noteConfig.fields) {
      for (const [fieldKey, fieldConfig] of Object.entries(noteConfig.fields)) {
        chainExtractionConfig.fieldExtractionMarkers[fieldKey as ExtractionType] = {
          fieldName: fieldConfig.fieldName,
          endMarkers: fieldConfig.endMarkers || [],
        };
      }
    }
  }

  const tsConfig = formatTsValue(chainExtractionConfig, 2);
  const tsCode = `${config.chainId}: ${tsConfig},`;

  // Add code with monospace font
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(0, 0, 0);

  const codeLines = pdf.splitTextToSize(tsCode, pageWidth - 2 * margin);
  codeLines.forEach((line: string) => {
    checkNewPage(lineHeight);
    pdf.text(line, margin, yPos);
    yPos += lineHeight;
  });

  // Instructions
  yPos += 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  addText('4.2 Implementation Instructions', 14, true);
  addText('Add the above configuration to the CHAIN_EXTRACTION_CONFIGS object in src/lib/processing/homesDb.ts', 10);
  addText('Location: src/lib/processing/homesDb.ts', 10, false, [128, 128, 128]);
  addText('Object: CHAIN_EXTRACTION_CONFIGS', 10, false, [128, 128, 128]);

  // Footer
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `RFC - ${config.chainName} (${config.chainId}) - Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  pdf.save(`RFC_${config.chainId}_${new Date().toISOString().split('T')[0]}.pdf`);
};
