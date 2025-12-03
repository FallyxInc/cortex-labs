'use client';

import React, { useState, useRef, useEffect } from 'react';

import { PdfConfigurationPage } from './onboarding/PdfConfiguration';
import { ExcelConfigurationPage } from './onboarding/ExcelConfigurationPage';
import { ReviewAndSavePage } from './onboarding/OnboardingConfigSubmit';
import { LabelDialog } from './onboarding/OnboardingLabelDialog';
import { EditConfigurationView } from './onboarding/EditConfigurationView';
import { WizardStep, OnboardingConfig, ExcelData, Highlight, ExcelFieldMapping, DataSourceMapping, escapeHtml, normalizeConfig } from '@/lib/onboardingUtils';
import { AIOutputFormat } from '@/lib/processing/onboardingUtils';

export default function OnboardingWizard() {
  const [step, setStep] = useState<WizardStep>('pdf-config');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string>('');
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');
  const [currentHighlight, setCurrentHighlight] = useState<Partial<Highlight> | null>(null);
  const [config, setConfig] = useState<OnboardingConfig | null>(null);
  const [chainId, setChainId] = useState<string>('');
  const [chainName, setChainName] = useState<string>('');
  const [savedConfigs, setSavedConfigs] = useState<OnboardingConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [viewingConfig, setViewingConfig] = useState<OnboardingConfig | null>(null);
  const [editingConfig, setEditingConfig] = useState<OnboardingConfig | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AIOutputFormat | null>(null);
  const [dataSourceMapping, setDataSourceMapping] = useState<DataSourceMapping | null>(null);
  const [excelFieldMappings, setExcelFieldMappings] = useState<Record<string, ExcelFieldMapping>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

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

  const extractPdfFile = async () => {
    if (!pdfFile) return null;

    const formData = new FormData();
    formData.append('pdf', pdfFile);

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
        setPdfPages(data.pages || []);
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

          applyAISuggestionsForPdf(aiData.suggestions, extractedPdfText);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyAISuggestionsForPdf = (suggestions: any, fullText: string) => {
    const newHighlights: Highlight[] = [];

    if (suggestions.behaviourNoteTypes) {
      for (const noteType of suggestions.behaviourNoteTypes) {
        const index = fullText.indexOf(noteType.noteType);
        if (index !== -1) {
          newHighlights.push({
            id: `ai-note-${Date.now()}-${Math.random()}`,
            text: noteType.noteType,
            startIndex: index,
            endIndex: index + noteType.noteType.length,
            label: noteType.noteType,
            labelType: 'note-type',
            aiGenerated: true,
          });
        }
      }
    }

    if (suggestions.followUpNoteTypes) {
      for (const noteType of suggestions.followUpNoteTypes) {
        const index = fullText.indexOf(noteType.noteType);
        if (index !== -1) {
          newHighlights.push({
            id: `ai-followup-${Date.now()}-${Math.random()}`,
            text: noteType.noteType,
            startIndex: index,
            endIndex: index + noteType.noteType.length,
            label: noteType.noteType,
            labelType: 'note-type',
            aiGenerated: true,
          });
        }
      }
    }

    if (suggestions.fieldExtractionMarkers) {
      const firstNoteType = newHighlights.find(h => h.labelType === 'note-type')?.label || '';

      for (const [fieldKey, fieldData] of Object.entries(suggestions.fieldExtractionMarkers)) {
        const field = fieldData as { fieldName: string; endMarkers: string[]; confidence?: number; dataSource?: string };
        const index = fullText.indexOf(field.fieldName);
        if (index !== -1) {
          newHighlights.push({
            id: `ai-field-${Date.now()}-${Math.random()}`,
            text: field.fieldName,
            startIndex: index,
            endIndex: index + field.fieldName.length,
            label: fieldKey,
            labelType: 'field-name',
            noteType: firstNoteType,
            fieldKey: fieldKey,
            aiGenerated: true,
          });

          if (field.endMarkers && Array.isArray(field.endMarkers) && field.endMarkers.length > 0) {
            for (const endMarker of field.endMarkers) {
              const endIndex = fullText.indexOf(endMarker, index + field.fieldName.length);
              if (endIndex !== -1) {
                newHighlights.push({
                  id: `ai-endmarker-${Date.now()}-${Math.random()}`,
                  text: endMarker,
                  startIndex: endIndex,
                  endIndex: endIndex + endMarker.length,
                  label: `End marker for ${fieldKey}`,
                  labelType: 'end-marker',
                  noteType: firstNoteType,
                  fieldKey: fieldKey,
                  aiGenerated: true,
                });
              }
            }
          }
        }
      }
    }

    setHighlights(newHighlights);
  };

  // ============================================================================
  // PDF TEXT SELECTION & HIGHLIGHTING
  // ============================================================================

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();

    if (!selectedText || selectedText.length < 2) return;

    const textNode = textRef.current;
    if (!textNode) return;

    const fullText = textNode.textContent || '';

    let startIndex = -1;
    let endIndex = -1;

    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    const walker = document.createTreeWalker(
      textNode,
      NodeFilter.SHOW_TEXT,
      null
    );

    let charCount = 0;
    let foundStart = false;
    let foundEnd = false;

    let node = walker.nextNode();
    while (node) {
      const nodeLength = node.textContent?.length || 0;

      if (node === startContainer && !foundStart) {
        startIndex = charCount + range.startOffset;
        foundStart = true;
      }

      if (node === endContainer && !foundEnd) {
        endIndex = charCount + range.endOffset;
        foundEnd = true;
        break;
      }

      charCount += nodeLength;
      node = walker.nextNode();
    }

    if (startIndex === -1 || endIndex === -1) {
      const firstIndex = fullText.indexOf(selectedText);
      if (firstIndex !== -1) {
        startIndex = firstIndex;
        endIndex = firstIndex + selectedText.length;
      } else {
        return;
      }
    }

    const overlaps = highlights.some(h => {
      return (startIndex < h.endIndex && endIndex > h.startIndex);
    });

    if (!overlaps && startIndex >= 0 && endIndex > startIndex) {
      setSelectedText(selectedText);

      setCurrentHighlight({
        text: selectedText,
        startIndex,
        endIndex,
      });
    }
  };

  const handleLabelHighlight = (label: string, labelType: Highlight['labelType'], noteType?: string, fieldKey?: string) => {
    if (!currentHighlight) return;

    const highlight: Highlight = {
      id: `highlight-${Date.now()}-${Math.random()}`,
      text: currentHighlight.text || '',
      startIndex: currentHighlight.startIndex || 0,
      endIndex: currentHighlight.endIndex || 0,
      label,
      labelType,
      noteType,
      fieldKey,
    };

    setHighlights([...highlights, highlight]);
    setCurrentHighlight(null);
    setSelectedText('');

    window.getSelection()?.removeAllRanges();
  };

  const renderHighlightedText = () => {
    if (!pdfText) return null;

    const sortedHighlights = [...highlights].sort((a, b) => a.startIndex - b.startIndex);

    let html = '';
    let lastIndex = 0;

    for (const highlight of sortedHighlights) {
      html += escapeHtml(pdfText.substring(lastIndex, highlight.startIndex));

      const color = highlight.labelType === 'note-type' ? '#fef3c7' :
                   highlight.labelType === 'field-name' ? '#dbeafe' :
                   highlight.labelType === 'end-marker' ? '#fce7f3' : '#e5e7eb';
      html += `<mark style="background-color: ${color}; padding: 2px 4px; border-radius: 3px;" title="${highlight.label}">${escapeHtml(highlight.text)}</mark>`;

      lastIndex = highlight.endIndex;
    }

    html += escapeHtml(pdfText.substring(lastIndex));

    return html;
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
    const noteTypeHighlights = highlights.filter(h => h.labelType === 'note-type');
    const fieldHighlights = highlights.filter(h => h.labelType === 'field-name');
    const endMarkerHighlights = highlights.filter(h => h.labelType === 'end-marker');

    const behaviourNoteTypes: string[] = [];
    const followUpNoteTypes: string[] = [];
    const noteTypeConfigs: OnboardingConfig['noteTypeConfigs'] = {};

    for (const noteHighlight of noteTypeHighlights) {
      const noteTypeName = noteHighlight.label;
      const isFollowUp = noteHighlight.text.toLowerCase().includes('follow') ||
                        noteHighlight.text.toLowerCase().includes('follow-up');

      if (isFollowUp) {
        followUpNoteTypes.push(noteTypeName);
      } else {
        behaviourNoteTypes.push(noteTypeName);
      }

      noteTypeConfigs[noteTypeName] = {
        name: noteTypeName,
        isFollowUp,
        fields: {},
      };
    }

    for (const fieldHighlight of fieldHighlights) {
      const noteType = fieldHighlight.noteType || '';
      if (!noteType || !noteTypeConfigs[noteType]) continue;

      const fieldKey = fieldHighlight.fieldKey || fieldHighlight.label.toLowerCase().replace(/\s+/g, '_');
      const fieldName = fieldHighlight.text;

      const endMarkers: string[] = [];
      for (const endMarker of endMarkerHighlights) {
        if (endMarker.noteType === noteType && endMarker.fieldKey === fieldKey) {
          endMarkers.push(endMarker.text);
        }
      }

      noteTypeConfigs[noteType].fields[fieldKey] = {
        fieldName,
        endMarkers,
      };
    }

    const newConfig: OnboardingConfig = {
      chainId,
      chainName,
      behaviourNoteTypes,
      followUpNoteTypes,
      noteTypeConfigs,
      excelFieldMappings: excelFieldMappings,
    };

    setConfig(newConfig);
  };

  // ============================================================================
  // CONFIGURATION SAVE & LOAD
  // ============================================================================

  const handleSaveConfiguration = async () => {
    if (!config) return;

    try {
      const response = await fetch('/api/admin/save-onboarding-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
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

      alert(`Configuration saved successfully for ${config.chainName} (${config.chainId})!`);

      await loadSavedConfigs();

      // Reset to start new configuration
      if (editingConfig) {
        setStep('saved');
        setEditingConfig(null);
      } else {
        setStep('pdf-config');
        setPdfFile(null);
        setExcelFile(null);
        setPdfText('');
        setPdfPages([]);
        setExcelData(null);
        setHighlights([]);
        setExcelFieldMappings({});
      }
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
      const response = await fetch('/api/admin/save-onboarding-config');
      if (response.ok) {
        const data = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const normalizedConfigs = (data.configs || []).map((config: any) => normalizeConfig(config));
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
    setStep('saved');
  };

  const handleLoadConfig = (savedConfig: OnboardingConfig) => {
    setViewingConfig(savedConfig);
  };

  const handleEditConfig = (savedConfig: OnboardingConfig) => {
    setEditingConfig(savedConfig);
    setChainId(savedConfig.chainId);
    setChainName(savedConfig.chainName);
    setConfig(savedConfig);
    setExcelFieldMappings(savedConfig.excelFieldMappings || {});
    setStep('edit-config');
  };

  const handleEditConfigSave = (updatedConfig: OnboardingConfig) => {
    setConfig(updatedConfig);
    setEditingConfig(updatedConfig);
    setChainId(updatedConfig.chainId);
    setChainName(updatedConfig.chainName);
    setStep('review');
  };

  const handleCloseViewConfig = () => {
    setViewingConfig(null);
  };

  const handleCancelEdit = () => {
    setEditingConfig(null);
    setChainId('');
    setChainName('');
    setConfig(null);
    setStep('saved');
  };

  const handleDeleteConfig = async (chainIdToDelete: string) => {
    if (!confirm(`Are you sure you want to delete the configuration for ${chainIdToDelete}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/save-onboarding-config?chainId=${chainIdToDelete}`, {
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
    setPdfPages([]);
    setExcelData(null);
    setHighlights([]);
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
      {/* Progress Steps */}
      {step !== 'saved' && step !== 'edit-config' && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {['PDF Config', 'Excel Config', 'Review'].map((label, index) => {
              const stepValue = ['pdf-config', 'excel-config', 'review'][index];
              const currentIndex = ['pdf-config', 'excel-config', 'review'].indexOf(step);
              return (
                <React.Fragment key={stepValue}>
                  <div className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        step === stepValue
                          ? 'bg-cyan-500 text-white'
                          : index < currentIndex
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="ml-2 text-sm font-medium text-gray-700">{label}</span>
                  </div>
                  {index < 2 && <div className="flex-1 h-1 mx-4 bg-gray-200" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* PDF Configuration Page */}
      {step === 'pdf-config' && (
        <>
          <PdfConfigurationPage
            pdfFile={pdfFile}
            pdfText={pdfText}
            pdfPages={pdfPages}
            highlights={highlights}
            selectedText={selectedText}
            aiLoading={aiLoading}
            aiSuggestions={aiSuggestions}
            onPdfUpload={handlePdfUpload}
            onAnalyzePdf={handleAnalyzePdf}
            onTextSelection={handleTextSelection}
            onClearAiHighlights={() => setHighlights(highlights.filter(h => !h.aiGenerated))}
            onContinue={handlePdfContinue}
            onSkip={handlePdfSkip}
            onViewSavedConfigs={handleViewSavedConfigs}
            renderHighlightedText={renderHighlightedText}
          />

          {currentHighlight && (
            <LabelDialog
              highlight={currentHighlight}
              existingHighlights={highlights}
              onSave={handleLabelHighlight}
              onCancel={() => setCurrentHighlight(null)}
            />
          )}
        </>
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
      {(step === 'review' || step === 'saved') && (
        <ReviewAndSavePage
          mode={step === 'saved' ? 'saved' : 'review'}
          config={config}
          chainId={chainId}
          chainName={chainName}
          savedConfigs={savedConfigs}
          loadingConfigs={loadingConfigs}
          viewingConfig={viewingConfig}
          editingConfig={editingConfig}
          onChainIdChange={setChainId}
          onChainNameChange={setChainName}
          onBack={() => setStep('excel-config')}
          onSave={handleSaveConfiguration}
          onStartNew={handleStartNewConfig}
          onViewConfig={handleLoadConfig}
          onEditConfig={handleEditConfig}
          onDeleteConfig={handleDeleteConfig}
          onCloseViewConfig={handleCloseViewConfig}
        />
      )}

      {/* Edit Configuration */}
      {step === 'edit-config' && editingConfig && (
        <EditConfigurationView
          config={editingConfig}
          chainId={chainId}
          chainName={chainName}
          onChainIdChange={setChainId}
          onChainNameChange={setChainName}
          onSave={handleEditConfigSave}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}
