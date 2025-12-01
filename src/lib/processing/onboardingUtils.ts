// Utility functions for onboarding configuration conversion and validation

import { ChainExtractionConfig, FieldExtractionConfig, NoteTypeExtractionConfig } from "./types";
import { adminDb } from "@/lib/firebase-admin";
import { CHAIN_EXTRACTION_CONFIGS } from "./homesDb";

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
    dataSource: 'EXCEL' | 'BOTH';
  }>;
}

export interface OnboardingConfig {
  chainId: string;
  chainName: string;
  behaviourNoteTypes: string[];
  followUpNoteTypes: string[];
  noteTypeConfigs: Record<string, {
    name: string;
    isFollowUp: boolean;
    fields: Record<string, {
      fieldName: string;
      endMarkers: string[];
    }>;
  }>;
  excelFieldMappings?: Record<string, {
    excelColumn: string;
    confidence: number;
    reasoning: string;
    dataSource: 'EXCEL' | 'BOTH';
  }>;
}

/**
 * Convert AI output format to OnboardingConfig format
 */
export function convertAIOutputToOnboardingConfig(aiOutput: AIOutputFormat): OnboardingConfig {
  const noteTypeConfigs: Record<string, {
    name: string;
    isFollowUp: boolean;
    fields: Record<string, { fieldName: string; endMarkers: string[] }>;
  }> = {};

  // Process behaviour note types
  const behaviourNoteTypes: string[] = [];
  for (const noteTypeInfo of aiOutput.behaviourNoteTypes || []) {
    const noteType = noteTypeInfo.noteType;
    behaviourNoteTypes.push(noteType);

    // Group fields by note type - for now, use the fieldExtractionMarkers for the first behaviour note type
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
        // Check if this field belongs to this note type (for now, assign to first behaviour note type)
        if (behaviourNoteTypes.length === 1 || fieldConfig.dataSource === 'PDF') {
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

  // Convert excelFieldMappings to ensure required fields are present
  const excelFieldMappings: Record<string, {
    excelColumn: string;
    confidence: number;
    reasoning: string;
    dataSource: 'EXCEL' | 'BOTH';
  }> = {};
  
  if (aiOutput.excelFieldMappings) {
    for (const [fieldKey, mapping] of Object.entries(aiOutput.excelFieldMappings)) {
      excelFieldMappings[fieldKey] = {
        excelColumn: mapping.excelColumn,
        confidence: mapping.confidence ?? 0.8, // Default confidence if not provided
        reasoning: mapping.reasoning ?? 'AI-generated mapping',
        dataSource: mapping.dataSource
      };
    }
  }

  return {
    chainId: aiOutput.chainId || '',
    chainName: aiOutput.chainName || '',
    behaviourNoteTypes,
    followUpNoteTypes,
    noteTypeConfigs,
    excelFieldMappings
  };
}

/**
 * Detect injury columns from Excel field mappings
 */
export function detectInjuryColumnsFromExcelMapping(
  excelFieldMappings?: Record<string, any>,
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

/**
 * Convert OnboardingConfig to ChainExtractionConfig for runtime use
 */
export function convertOnboardingConfigToChainConfig(
  onboardingConfig: OnboardingConfig,
  excelHeaders?: string[]
): ChainExtractionConfig {
  // Extract default field markers from first behaviour note type
  const firstBehaviourNote = onboardingConfig.behaviourNoteTypes[0];
  const defaultFields: Record<string, FieldExtractionConfig> = {};
  
  if (firstBehaviourNote && onboardingConfig.noteTypeConfigs[firstBehaviourNote]) {
    const noteConfig = onboardingConfig.noteTypeConfigs[firstBehaviourNote];
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

  for (const noteType of onboardingConfig.behaviourNoteTypes) {
    const noteConfig = onboardingConfig.noteTypeConfigs[noteType];
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

  for (const noteType of onboardingConfig.followUpNoteTypes) {
    const noteConfig = onboardingConfig.noteTypeConfigs[noteType];
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
    onboardingConfig.excelFieldMappings,
    excelHeaders
  );

  // Check if time_frequency or evaluation are present in any note type
  const hasTimeFrequency = onboardingConfig.behaviourNoteTypes.some(nt => 
    onboardingConfig.noteTypeConfigs[nt]?.fields.time_frequency
  );
  const hasEvaluation = onboardingConfig.behaviourNoteTypes.some(nt => 
    onboardingConfig.noteTypeConfigs[nt]?.fields.evaluation
  );

  return {
    behaviourNoteTypes: onboardingConfig.behaviourNoteTypes,
    followUpNoteTypes: onboardingConfig.followUpNoteTypes,
    fieldExtractionMarkers: defaultFields,
    behaviourNoteConfigs,
    followUpNoteConfigs,
    injuryColumns,
    matchingWindowHours: 24,
    hasTimeFrequency,
    hasEvaluation
  };
}

/**
 * Validate onboarding configuration
 */
export function validateOnboardingConfig(config: OnboardingConfig): string[] {
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

  // Validate that each behaviour note type has field configs
  for (const noteType of config.behaviourNoteTypes) {
    const noteConfig = config.noteTypeConfigs[noteType];
    if (!noteConfig || !noteConfig.fields || Object.keys(noteConfig.fields).length === 0) {
      errors.push(`Behaviour note type "${noteType}" is missing field configurations`);
    }
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
      if (!mapping.excelColumn || mapping.excelColumn.trim() === '') {
        errors.push(`Excel field mapping for "${fieldKey}" is missing column name`);
      }
    }
  }

  return errors;
}

/**
 * Load chain extraction config dynamically from Firebase
 */
export async function getChainExtractionConfigFromFirebase(
  chainId: string
): Promise<ChainExtractionConfig | null> {
  try {
    const configRef = adminDb.ref(`/onboardingConfigs/${chainId}`);
    const snapshot = await configRef.once('value');

    if (snapshot.exists()) {
      const onboardingConfig = snapshot.val() as OnboardingConfig;
      const chainConfig = convertOnboardingConfigToChainConfig(onboardingConfig);

      // Cache it in the static configs for future use
      CHAIN_EXTRACTION_CONFIGS[chainId] = chainConfig;

      return chainConfig;
    }
  } catch (error) {
    console.error(`Error loading chain config for ${chainId}:`, error);
  }

  return null;
}

