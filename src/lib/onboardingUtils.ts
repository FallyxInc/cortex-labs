import jsPDF from 'jspdf';
import { ChainExtractionConfig, ExtractionType } from '@/lib/processing/types';

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

export interface OnboardingConfig {
  chainId: string;
  chainName: string;
  behaviourNoteTypes: string[];
  followUpNoteTypes: string[];
  noteTypeConfigs: Record<string, NoteTypeConfig>;
  excelFieldMappings?: Record<string, ExcelFieldMapping>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExcelData {
  headers: string[];
  rows: Record<string, unknown>[];
  preview: string;
}

export type WizardStep = 'pdf-config' | 'excel-config' | 'review' | 'saved' | 'edit-config';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const normalizeConfig = (config: Partial<OnboardingConfig>): OnboardingConfig => {
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
  };
};

// ============================================================================
// RFC GENERATOR
// ============================================================================

export const generateRFC = (config: OnboardingConfig) => {
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

    yPos += 2; // Add small spacing after text
  };

  // Title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(6, 182, 212);
  pdf.text('RFC: Onboarding Configuration', pageWidth / 2, yPos, { align: 'center' });
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
  const chainConfig: ChainExtractionConfig = {
    behaviourNoteTypes: config.behaviourNoteTypes,
    followUpNoteTypes: config.followUpNoteTypes,
    extraFollowUpNoteTypes: [],
    injuryColumns: {
      start: 13,
      end: 87,
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
        chainConfig.fieldExtractionMarkers[fieldKey as ExtractionType] = {
          fieldName: fieldConfig.fieldName,
          endMarkers: fieldConfig.endMarkers || [],
        };
      }
    }
  }

  const tsConfig = formatTsValue(chainConfig, 2);
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
