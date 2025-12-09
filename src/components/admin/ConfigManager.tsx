'use client';

import React, { useState, useEffect } from 'react';

import { PdfConfigurationPage } from './config/PdfConfigurationPage';
import { ExcelConfigurationPage } from './config/ExcelConfigurationPage';
import { ReviewAndSavePage } from './config/ConfigSubmitPage';
import { ConfigManagementPage } from './config/ConfigManagementPage';
import { ChainExtractionConfig, ExcelExtractionConfig } from '@/lib/processing/types';
import { AIOutputFormat, ExcelData, DataSourceMapping, ExcelFieldMapping } from '@/lib/chainConfig';

export type ConfigManagerStep = 'manage' | 'pdf-config' | 'excel-config' | 'review';

const DEFAULT_EXCEL_EXTRACTION: ExcelExtractionConfig = {
  injuryColumns: { start: 13, end: 37 },
  incidentColumns: {
    incident_number: 'Incident #',
    name: 'Resident Name',
    date_time: 'Incident Date/Time',
    incident_location: 'Incident Location',
    room: 'Resident Room Number',
    incident_type: 'Incident Type',
  },
};

const DEFAULT_PDF_CONFIG: ChainExtractionConfig = {
  behaviourNoteTypes: [],
  followUpNoteTypes: [],
  extraFollowUpNoteTypes: [],
  excelExtraction: DEFAULT_EXCEL_EXTRACTION,
  matchingWindowHours: 24,
  fieldExtractionMarkers: {},
  hasTimeFrequency: false,
  hasEvaluation: false,
  behaviourNoteConfigs: {},
  followUpNoteConfigs: {},
};

// Normalize config to ensure all required fields exist
const normalizeConfig = (config: Partial<ChainExtractionConfig>): ChainExtractionConfig => {
  return {
    behaviourNoteTypes: config.behaviourNoteTypes || [],
    followUpNoteTypes: config.followUpNoteTypes || [],
    extraFollowUpNoteTypes: config.extraFollowUpNoteTypes || [],
    excelExtraction: config.excelExtraction || DEFAULT_EXCEL_EXTRACTION,
    matchingWindowHours: config.matchingWindowHours || 24,
    fieldExtractionMarkers: config.fieldExtractionMarkers || {},
    hasTimeFrequency: config.hasTimeFrequency || false,
    hasEvaluation: config.hasEvaluation || false,
    behaviourNoteConfigs: config.behaviourNoteConfigs || {},
    followUpNoteConfigs: config.followUpNoteConfigs || {},
    excelFieldMappings: config.excelFieldMappings || {},
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
};

export default function ConfigManagerWizard() {
  const [step, setStep] = useState<ConfigManagerStep>('manage');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string>('');
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [pdfExtractionConfig, setPdfExtractionConfig] = useState<ChainExtractionConfig>(DEFAULT_PDF_CONFIG);
  const [config, setConfig] = useState<ChainExtractionConfig | null>(null);
  const [chainId, setChainId] = useState<string>('');
  const [chainName, setChainName] = useState<string>('');
  const [savedConfigs, setSavedConfigs] = useState<Array<ChainExtractionConfig & { chainId: string; chainName: string }>>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [viewingConfig, setViewingConfig] = useState<(ChainExtractionConfig & { chainId: string; chainName: string }) | null>(null);
  const [editingConfig, setEditingConfig] = useState<(ChainExtractionConfig & { chainId: string; chainName: string }) | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AIOutputFormat | null>(null);
  const [dataSourceMapping, setDataSourceMapping] = useState<DataSourceMapping | null>(null);
  const [excelFieldMappings, setExcelFieldMappings] = useState<Record<string, ExcelFieldMapping>>({});
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    loadSavedConfigs();
  }, []);

  // ============================================================================
  // FILE UPLOAD HANDLERS
  // ============================================================================

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setPdfFile(file);
    extractPdfFile(file);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.type === 'application/vnd.ms-excel' ||
                   file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                   file.name.toLowerCase().endsWith('.xls') ||
                   file.name.toLowerCase().endsWith('.xlsx');

    if (!isExcel) {
      alert('Please upload an Excel file (.xls or .xlsx)');
      return;
    }

    setExcelFile(file);
  };

  // ============================================================================
  // FILE EXTRACTION & AI ANALYSIS
  // ============================================================================

  const extractPdfFile = async (file: File | null = null) => {
    if (!pdfFile && !file) return null;

    const formData = new FormData();
    if (file) {
      formData.append('pdf', file);
    } else if (pdfFile) {
      formData.append('pdf', pdfFile);
    }

    try {
      const response = await fetch('/api/admin/extract-pdf-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract PDF content');
      }

      const data = await response.json();

      if (data.pdfText) {
        setPdfText(data.pdfText);
      }

      return data;
    } catch (error) {
      console.error('Error extracting PDF:', error);
      alert(`Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const extractExcelFile = async () => {
    if (!excelFile) return null;

    const formData = new FormData();
    formData.append('excel', excelFile);

    try {
      const response = await fetch('/api/admin/extract-pdf-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract Excel content');
      }

      const data = await response.json();

      if (data.excelData) {
        setExcelData(data.excelData);
      }

      return data;
    } catch (error) {
      console.error('Error extracting Excel:', error);
      alert(`Failed to extract Excel content: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const handleAnalyzePdfWithAI = async () => {
    if (!pdfText) {
      alert('No PDF text to analyze');
      return;
    }

    setAiLoading(true);

    try {
      const aiResponse = await fetch('/api/admin/analyze-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfText, excelData: null }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        setAiSuggestions(aiData.suggestions);
        if (aiData.extractionConfig) {
          setPdfExtractionConfig(prev => ({
            ...prev,
            ...aiData.extractionConfig,
          }));
        }
        else {
          throw new Error('Config could not be produced. ');
        }
      } else {
        throw new Error('AI analysis failed: ' + aiResponse.statusText);
      }
    } catch (error) {
      console.error('Error running AI analysis:', error);
      alert('Failed to analyze PDF. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAnalyzePdf = async () => {
    try {
      let extractedPdfText = pdfText;

      if (!pdfText) {
        const extractedData = await extractPdfFile();
        extractedPdfText = extractedData?.pdfText || '';
      }

      if (!extractedPdfText) {
        alert('No PDF text to analyze');
        return;
      }

      setAiLoading(true);

      try {
        const aiResponse = await fetch('/api/admin/analyze-pdf-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pdfText: extractedPdfText,
            excelData: null,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          setAiSuggestions(aiData.suggestions);
        } else {
          console.warn('AI analysis failed, continuing without suggestions');
          alert('AI analysis failed. Please try again.');
        }
      } catch (aiError) {
        console.error('Error running AI analysis:', aiError);
        alert('Failed to analyze PDF. Please try again.');
      } finally {
        setAiLoading(false);
      }
    } catch (error) {
      console.error('Error in handleAnalyzePdf:', error);
      setAiLoading(false);
    }
  };

  const handleAnalyzeExcel = async () => {
    try {
      let extractedExcelData = excelData;

      if (!excelData) {
        const extractedData = await extractExcelFile();
        extractedExcelData = extractedData?.excelData || null;
      }

      if (!extractedExcelData) {
        alert('No Excel data to analyze');
        return;
      }

      setAiLoading(true);

      try {
        const aiResponse = await fetch('/api/admin/analyze-pdf-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pdfText: '',
            excelData: extractedExcelData,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          setAiSuggestions(aiData.suggestions);
          setDataSourceMapping(aiData.dataSourceMapping);

          if (aiData.suggestions?.excelFieldMappings) {
            setExcelFieldMappings(aiData.suggestions.excelFieldMappings);
          }
        } else {
          console.warn('AI analysis failed, continuing without suggestions');
          alert('AI analysis failed. Please try again.');
        }
      } catch (aiError) {
        console.error('Error running AI analysis:', aiError);
        alert('Failed to analyze Excel. Please try again.');
      } finally {
        setAiLoading(false);
      }
    } catch (error) {
      console.error('Error in handleAnalyzeExcel:', error);
      setAiLoading(false);
    }
  };


  // ============================================================================
  // EXCEL FIELD MAPPING
  // ============================================================================

  const handleExcelFieldMap = (fieldKey: string, column: string) => {
    setExcelFieldMappings({
      ...excelFieldMappings,
      [fieldKey]: {
        excelColumn: column,
        confidence: 1.0,
        reasoning: 'Manually mapped',
        dataSource: 'EXCEL',
      },
    });
  };

  const handleAddExcelFieldMapping = () => {
    const fieldKey = prompt('Enter field key (e.g., incident_number, name, date, time, incident_location, room, injuries, incident_type):');
    if (fieldKey && excelData) {
      const column = prompt('Enter Excel column name:');
      if (column) {
        setExcelFieldMappings({
          ...excelFieldMappings,
          [fieldKey]: {
            excelColumn: column,
            confidence: 1.0,
            reasoning: 'Manually mapped',
            dataSource: 'EXCEL',
          },
        });
      }
    }
  };

  const handleRemoveExcelFieldMapping = (fieldKey: string) => {
    const newMappings = { ...excelFieldMappings };
    delete newMappings[fieldKey];
    setExcelFieldMappings(newMappings);
  };

  // ============================================================================
  // CONFIGURATION BUILDING
  // ============================================================================

  const buildConfiguration = () => {
    // Build ChainExtractionConfig directly from pdfExtractionConfig (without chainId/chainName)
    const newConfig: ChainExtractionConfig = {
      behaviourNoteTypes: pdfExtractionConfig.behaviourNoteTypes,
      followUpNoteTypes: pdfExtractionConfig.followUpNoteTypes,
      extraFollowUpNoteTypes: pdfExtractionConfig.extraFollowUpNoteTypes || [],
      excelExtraction: pdfExtractionConfig.excelExtraction || DEFAULT_EXCEL_EXTRACTION,
      matchingWindowHours: pdfExtractionConfig.matchingWindowHours || 24,
      fieldExtractionMarkers: pdfExtractionConfig.fieldExtractionMarkers,
      hasTimeFrequency: pdfExtractionConfig.hasTimeFrequency || false,
      hasEvaluation: pdfExtractionConfig.hasEvaluation || false,
      behaviourNoteConfigs: pdfExtractionConfig.behaviourNoteConfigs || {},
      followUpNoteConfigs: pdfExtractionConfig.followUpNoteConfigs || {},
      excelFieldMappings: excelFieldMappings,
    };

    setConfig(newConfig);
  };

  // ============================================================================
  // CONFIGURATION SAVE & LOAD
  // ============================================================================

  const handleSaveConfiguration = async () => {
    if (!config || !chainId || !chainName) return;

    try {
      const response = await fetch('/api/admin/save-chain-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chainId,
          chainName,
          ...config,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          const errorMessage = `Validation failed:\n${errorData.errors.join('\n')}`;
          throw new Error(errorMessage);
        }
        throw new Error(errorData.error || 'Failed to save configuration');
      }

      await response.json();

      alert(`Configuration saved successfully for ${chainName} (${chainId})!`);

      await loadSavedConfigs();

      // Reset to management page
      setStep('manage');
      setEditingConfig(null);
      setPdfFile(null);
      setExcelFile(null);
      setPdfText('');
      setExcelData(null);
      setPdfExtractionConfig(DEFAULT_PDF_CONFIG);
      setExcelFieldMappings({});
      setConfig(null);
      setChainId('');
      setChainName('');
      setAiSuggestions(null);
      setDataSourceMapping(null);
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadSavedConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const response = await fetch('/api/admin/save-chain-config');
      if (response.ok) {
        const data = await response.json();
        // Configs from API include chainId/chainName separately
        const normalizedConfigs = (data.configs || []).map((config: ChainExtractionConfig & { chainId: string; chainName: string }) => ({
          ...normalizeConfig(config),
          chainId: config.chainId,
          chainName: config.chainName,
        }));
        setSavedConfigs(normalizedConfigs);
      }
    } catch (error) {
      console.error('Error loading saved configs:', error);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const handleViewSavedConfigs = async () => {
    await loadSavedConfigs();
    setStep('manage');
  };

  const handleLoadConfig = (savedConfig: ChainExtractionConfig & { chainId: string; chainName: string }) => {
    setViewingConfig(savedConfig);
  };

  const handleEditConfig = (savedConfig: ChainExtractionConfig & { chainId: string; chainName: string }) => {
    // Pre-fill the PDF extraction config with existing values
    setPdfExtractionConfig({
      behaviourNoteTypes: savedConfig.behaviourNoteTypes,
      followUpNoteTypes: savedConfig.followUpNoteTypes,
      extraFollowUpNoteTypes: savedConfig.extraFollowUpNoteTypes || [],
      excelExtraction: savedConfig.excelExtraction || DEFAULT_EXCEL_EXTRACTION,
      matchingWindowHours: savedConfig.matchingWindowHours,
      fieldExtractionMarkers: savedConfig.fieldExtractionMarkers,
      hasTimeFrequency: savedConfig.hasTimeFrequency,
      hasEvaluation: savedConfig.hasEvaluation,
      behaviourNoteConfigs: savedConfig.behaviourNoteConfigs || {},
      followUpNoteConfigs: savedConfig.followUpNoteConfigs || {},
    });
    setEditingConfig(savedConfig);
    setChainId(savedConfig.chainId || '');
    setChainName(savedConfig.chainName || '');
    // Convert the excel field mappings to ensure required fields have values
    const mappings: Record<string, ExcelFieldMapping> = {};
    if (savedConfig.excelFieldMappings) {
      Object.entries(savedConfig.excelFieldMappings).forEach(([key, mapping]) => {
        mappings[key] = {
          excelColumn: mapping.excelColumn,
          confidence: mapping.confidence ?? 1.0,
          reasoning: mapping.reasoning ?? 'Loaded from saved config',
          dataSource: mapping.dataSource,
        };
      });
    }
    setExcelFieldMappings(mappings);
    // Go to pdf-config step - same flow as create
    setStep('pdf-config');
  };

  const handleCloseViewConfig = () => {
    setViewingConfig(null);
  };

  const handleCancelEdit = () => {
    setEditingConfig(null);
    setChainId('');
    setChainName('');
    setConfig(null);
    setPdfExtractionConfig(DEFAULT_PDF_CONFIG);
    setExcelFieldMappings({});
    setPdfFile(null);
    setExcelFile(null);
    setPdfText('');
    setExcelData(null);
    setStep('manage');
  };

  const handleDeleteConfig = async (chainIdToDelete: string) => {
    if (!confirm(`Are you sure you want to delete the configuration for ${chainIdToDelete}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/save-chain-config?chainId=${chainIdToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete configuration');
      }

      alert('Configuration deleted successfully');
      await loadSavedConfigs();
    } catch (error) {
      console.error('Error deleting configuration:', error);
      alert(`Failed to delete configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // ============================================================================
  // PAGE NAVIGATION
  // ============================================================================

  const handlePdfContinue = () => {
    buildConfiguration();
    setStep('excel-config');
  };

  const handlePdfSkip = () => {
    setStep('excel-config');
  };

  const handleExcelContinue = () => {
    buildConfiguration();
    setStep('review');
  };

  const handleExcelSkip = () => {
    buildConfiguration();
    setStep('review');
  };

  const handleStartNewConfig = () => {
    setPdfFile(null);
    setExcelFile(null);
    setPdfText('');
    setExcelData(null);
    setPdfExtractionConfig(DEFAULT_PDF_CONFIG);
    setExcelFieldMappings({});
    setConfig(null);
    setChainId('');
    setChainName('');
    setAiSuggestions(null);
    setDataSourceMapping(null);
    setEditingConfig(null);
    setViewingConfig(null);
    setStep('pdf-config');
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Configuration Management Page */}
      {step === 'manage' && (
        <ConfigManagementPage
          savedConfigs={savedConfigs}
          loadingConfigs={loadingConfigs}
          viewingConfig={viewingConfig}
          onStartNew={handleStartNewConfig}
          onViewConfig={handleLoadConfig}
          onEditConfig={handleEditConfig}
          onDeleteConfig={handleDeleteConfig}
          onCloseViewConfig={handleCloseViewConfig}
          onExportConfig={(configToExport: ChainExtractionConfig & { chainId: string; chainName: string }) => {
            const blob = new Blob([JSON.stringify(configToExport, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${configToExport.chainId}_config.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        />
      )}

      {/* PDF Configuration Page */}
      {step === 'pdf-config' && (
        <PdfConfigurationPage
          pdfFile={pdfFile}
          pdfText={pdfText}
          config={pdfExtractionConfig}
          onConfigChange={setPdfExtractionConfig}
          onPdfUpload={handlePdfUpload}
          onAnalyzePdf={handleAnalyzePdf}
          onAnalyzeWithAI={handleAnalyzePdfWithAI}
          isAnalyzing={aiLoading}
          onContinue={handlePdfContinue}
          onSkip={handlePdfSkip}
          onBack={editingConfig ? handleCancelEdit : handleViewSavedConfigs}
          isEditing={!!editingConfig}
        />
      )}

      {/* Excel Configuration Page */}
      {step === 'excel-config' && (
        <ExcelConfigurationPage
          excelFile={excelFile}
          excelData={excelData}
          excelFieldMappings={excelFieldMappings}
          aiLoading={aiLoading}
          aiSuggestions={aiSuggestions}
          dataSourceMapping={dataSourceMapping}
          onExcelUpload={handleExcelUpload}
          onAnalyzeExcel={handleAnalyzeExcel}
          onExcelFieldMap={handleExcelFieldMap}
          onAddExcelFieldMapping={handleAddExcelFieldMapping}
          onRemoveExcelFieldMapping={handleRemoveExcelFieldMapping}
          onBack={() => setStep('pdf-config')}
          onContinue={handleExcelContinue}
          onSkip={handleExcelSkip}
        />
      )}

      {/* Review & Save Page */}
      {step === 'review' && (
        <ReviewAndSavePage
          config={config}
          chainId={chainId}
          chainName={chainName}
          editingConfig={editingConfig}
          onChainIdChange={(val) => setChainId(val || '')}
          onChainNameChange={(val) => setChainName(val || '')}
          onBack={() => setStep('excel-config')}
          onSave={handleSaveConfiguration}
        />
      )}
    </div>
  );
}
