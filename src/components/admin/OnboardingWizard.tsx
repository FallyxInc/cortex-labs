'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChainExtractionConfig } from '@/lib/processing/types';

interface Highlight {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  label: string;
  labelType: 'note-type' | 'field-name' | 'end-marker' | 'other';
  noteType?: string; // Which note type this field belongs to
  fieldKey?: string; // The field key (e.g., 'behaviour_type', 'interventions')
}

interface NoteTypeConfig {
  name: string;
  isFollowUp: boolean;
  fields: Record<string, {
    fieldName: string;
    endMarkers: string[];
  }>;
}

interface OnboardingConfig {
  chainId: string;
  chainName: string;
  behaviourNoteTypes: string[];
  followUpNoteTypes: string[];
  noteTypeConfigs: Record<string, NoteTypeConfig>;
}

export default function OnboardingWizard() {
  const [step, setStep] = useState<'upload' | 'highlight' | 'configure' | 'review' | 'saved'>('upload');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState<string>('');
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionStart, setSelectionStart] = useState<number>(-1);
  const [selectionEnd, setSelectionEnd] = useState<number>(-1);
  const [currentHighlight, setCurrentHighlight] = useState<Partial<Highlight> | null>(null);
  const [config, setConfig] = useState<OnboardingConfig | null>(null);
  const [chainId, setChainId] = useState<string>('');
  const [chainName, setChainName] = useState<string>('');
  const [savedConfigs, setSavedConfigs] = useState<OnboardingConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [viewingConfig, setViewingConfig] = useState<OnboardingConfig | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load saved configs on mount
    loadSavedConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setPdfFile(file);
    
    // Upload and extract text
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/admin/extract-pdf-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to extract PDF text');
      }

      const data = await response.json();
      setPdfText(data.text);
      setPdfPages(data.pages || []);
      setStep('highlight');
    } catch (error) {
      console.error('Error extracting PDF:', error);
      alert('Failed to extract text from PDF. Please try again.');
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();
    
    if (!selectedText || selectedText.length < 2) return;

    // Find the position in the full text
    const textNode = textRef.current;
    if (!textNode) return;

    // Get the plain text content (without HTML tags)
    const fullText = textNode.textContent || '';
    
    // Find the first occurrence of the selected text that's not already highlighted
    // We need to account for existing highlights by checking character positions
    let searchStart = 0;
    let startIndex = -1;
    let endIndex = -1;

    // Try to find the selection in the plain text
    // We'll use the range's start and end containers to get more accurate positions
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    // Calculate position by walking through text nodes
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

    // Fallback: if we couldn't find exact positions, use text search
    if (startIndex === -1 || endIndex === -1) {
      const firstIndex = fullText.indexOf(selectedText, searchStart);
      if (firstIndex !== -1) {
        startIndex = firstIndex;
        endIndex = firstIndex + selectedText.length;
      } else {
        return; // Couldn't find the text
      }
    }

    // Check if this range overlaps with existing highlights
    const overlaps = highlights.some(h => {
      return (startIndex < h.endIndex && endIndex > h.startIndex);
    });

    if (!overlaps && startIndex >= 0 && endIndex > startIndex) {
      setSelectedText(selectedText);
      setSelectionStart(startIndex);
      setSelectionEnd(endIndex);
      
      // Show dialog to label the selection
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
    
    // Clear selection
    window.getSelection()?.removeAllRanges();
  };

  const buildConfiguration = () => {
    if (!chainId || !chainName) {
      alert('Please enter chain ID and name');
      return;
    }

    // Group highlights by note type
    const noteTypeHighlights = highlights.filter(h => h.labelType === 'note-type');
    const fieldHighlights = highlights.filter(h => h.labelType === 'field-name');
    const endMarkerHighlights = highlights.filter(h => h.labelType === 'end-marker');

    const behaviourNoteTypes: string[] = [];
    const followUpNoteTypes: string[] = [];
    const noteTypeConfigs: Record<string, NoteTypeConfig> = {};

    // Process note types
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

    // Process fields
    for (const fieldHighlight of fieldHighlights) {
      const noteType = fieldHighlight.noteType || '';
      if (!noteType || !noteTypeConfigs[noteType]) continue;

      const fieldKey = fieldHighlight.fieldKey || fieldHighlight.label.toLowerCase().replace(/\s+/g, '_');
      const fieldName = fieldHighlight.text;

      // Find end markers for this field
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
    };

    setConfig(newConfig);
    setStep('review');
  };

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
        throw new Error(errorData.error || 'Failed to save configuration');
      }

      const data = await response.json();
      
      alert(`Configuration saved successfully for ${config.chainName} (${config.chainId})!`);
      
      // Refresh saved configs list
      await loadSavedConfigs();
      
      // Reset wizard
      setStep('upload');
      setPdfFile(null);
      setPdfText('');
      setHighlights([]);
      setConfig(null);
      setChainId('');
      setChainName('');
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
        setSavedConfigs(data.configs || []);
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

  const handleCloseViewConfig = () => {
    setViewingConfig(null);
  };

  const renderHighlightedText = () => {
    if (!pdfText) return null;

    let result = pdfText;
    const sortedHighlights = [...highlights].sort((a, b) => a.startIndex - b.startIndex);

    // Build HTML with highlights
    let html = '';
    let lastIndex = 0;

    for (const highlight of sortedHighlights) {
      // Add text before highlight
      html += escapeHtml(result.substring(lastIndex, highlight.startIndex));
      
      // Add highlighted text
      const color = highlight.labelType === 'note-type' ? '#fef3c7' : 
                   highlight.labelType === 'field-name' ? '#dbeafe' : 
                   highlight.labelType === 'end-marker' ? '#fce7f3' : '#e5e7eb';
      html += `<mark style="background-color: ${color}; padding: 2px 4px; border-radius: 3px;" title="${highlight.label}">${escapeHtml(highlight.text)}</mark>`;
      
      lastIndex = highlight.endIndex;
    }

    // Add remaining text
    html += escapeHtml(result.substring(lastIndex));

    return html;
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Progress Steps */}
      {step !== 'saved' && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {['upload', 'highlight', 'configure', 'review'].map((s, index) => (
              <React.Fragment key={s}>
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      step === s
                        ? 'bg-cyan-500 text-white'
                        : index < ['upload', 'highlight', 'configure', 'review'].indexOf(step)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-700 capitalize">{s}</span>
                </div>
                {index < 3 && <div className="flex-1 h-1 mx-4 bg-gray-200" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Upload PDF */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Sample PDF</h2>
              <p className="text-gray-600 mb-4">
                Upload a sample PDF that contains behavior notes. This will be used to configure the extraction parameters.
              </p>
            </div>
            <button
              onClick={handleViewSavedConfigs}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View Saved Configurations
            </button>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="cursor-pointer inline-block px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              Choose PDF File
            </label>
            {pdfFile && (
              <p className="mt-4 text-sm text-gray-600">Selected: {pdfFile.name}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Highlight and Label */}
      {step === 'highlight' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Highlight and Label Sections</h2>
            <p className="text-gray-600 mb-4">
              Select text in the PDF and label what it represents. You can label:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Note Types</strong> - The type of note (e.g., "Behaviour - Responsive Behaviour", "Behaviour - Follow up")</li>
              <li><strong>Field Names</strong> - The labels for fields (e.g., "Type of Behaviour :", "Interventions :")</li>
              <li><strong>End Markers</strong> - Text that marks the end of a field (e.g., "Antecedent/Triggers", "Page")</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* PDF Text Display */}
            <div className="border rounded-lg p-4 bg-gray-50 max-h-[600px] overflow-y-auto">
              <div
                ref={textRef}
                onMouseUp={handleTextSelection}
                className="whitespace-pre-wrap font-mono text-sm"
                dangerouslySetInnerHTML={{ __html: renderHighlightedText() || escapeHtml(pdfText) }}
              />
            </div>

            {/* Highlights Panel */}
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Current Selection</h3>
                {selectedText ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 bg-gray-100 p-2 rounded">{selectedText.substring(0, 100)}...</p>
                    <button
                      onClick={() => setCurrentHighlight({
                        text: selectedText,
                        startIndex: selectionStart,
                        endIndex: selectionEnd,
                      })}
                      className="w-full px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600"
                    >
                      Label This Selection
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Select text in the PDF to label it</p>
                )}
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">All Highlights ({highlights.length})</h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {(() => {
                    // Group highlights by note type
                    const noteTypeHighlights = highlights.filter(h => h.labelType === 'note-type');
                    const fieldHighlights = highlights.filter(h => h.labelType === 'field-name');
                    const endMarkerHighlights = highlights.filter(h => h.labelType === 'end-marker');
                    const otherHighlights = highlights.filter(h => h.labelType === 'other');

                    // Create hierarchical structure
                    const hierarchicalStructure = noteTypeHighlights.map(noteType => {
                      const fieldsForNoteType = fieldHighlights.filter(f => f.noteType === noteType.label);
                      return { noteType, fields: fieldsForNoteType };
                    });

                    return (
                      <>
                        {/* Hierarchical view: Note types with their fields */}
                        {hierarchicalStructure.map(({ noteType, fields }) => (
                          <div key={noteType.id} className="border-l-4 border-yellow-400 pl-3">
                            {/* Note Type */}
                            <div className="text-sm p-2 bg-yellow-50 rounded mb-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-yellow-900">{noteType.label}</span>
                                <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                                  note-type
                                </span>
                              </div>
                              <p className="text-xs text-yellow-700 mt-1 truncate">{noteType.text.substring(0, 60)}...</p>
                            </div>

                            {/* Fields under this note type */}
                            {fields.length > 0 && (
                              <div className="ml-4 space-y-2 mt-2">
                                {fields.map((field) => {
                                  const endMarkersForField = endMarkerHighlights.filter(
                                    em => em.noteType === noteType.label && em.fieldKey === field.fieldKey
                                  );
                                  
                                  return (
                                    <div key={field.id} className="border-l-2 border-blue-300 pl-3">
                                      {/* Field Name */}
                                      <div className="text-sm p-2 bg-blue-50 rounded">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-blue-900">{field.label}</span>
                                          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                            field-name
                                          </span>
                                        </div>
                                        <p className="text-xs text-blue-700 mt-1 truncate">{field.text.substring(0, 50)}...</p>
                                      </div>

                                      {/* End Markers for this field */}
                                      {endMarkersForField.length > 0 && (
                                        <div className="ml-4 space-y-1 mt-1">
                                          {endMarkersForField.map((endMarker) => (
                                            <div key={endMarker.id} className="text-xs p-1.5 bg-pink-50 rounded border-l-2 border-pink-300">
                                              <div className="flex items-center justify-between">
                                                <span className="text-pink-900">{endMarker.text.substring(0, 40)}...</span>
                                                <span className="px-1.5 py-0.5 rounded text-xs bg-pink-100 text-pink-800">
                                                  end-marker
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Standalone fields (not associated with a note type) */}
                        {fieldHighlights.filter(f => !f.noteType).length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-gray-500 mb-2 font-medium">Unassigned Fields</p>
                            {fieldHighlights.filter(f => !f.noteType).map((field) => (
                              <div key={field.id} className="text-sm p-2 bg-gray-50 rounded mb-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{field.label}</span>
                                  <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                    field-name
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 truncate">{field.text.substring(0, 50)}...</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Other highlights */}
                        {otherHighlights.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs text-gray-500 mb-2 font-medium">Other</p>
                            {otherHighlights.map((h) => (
                              <div key={h.id} className="text-sm p-2 bg-gray-50 rounded mb-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{h.label}</span>
                                  <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                                    {h.labelType}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 truncate">{h.text.substring(0, 50)}...</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <button
                onClick={() => setStep('configure')}
                disabled={highlights.length === 0}
                className="w-full px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Continue to Configuration
              </button>
            </div>
          </div>

          {/* Label Dialog */}
          {currentHighlight && (
            <LabelDialog
              highlight={currentHighlight}
              existingHighlights={highlights}
              onSave={handleLabelHighlight}
              onCancel={() => setCurrentHighlight(null)}
            />
          )}
        </div>
      )}

      {/* Step 3: Configure */}
      {step === 'configure' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Configure Chain Settings</h2>
            <p className="text-gray-600 mb-4">
              Enter the chain information and organize the highlighted fields.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chain ID *
                </label>
                <input
                  type="text"
                  value={chainId}
                  onChange={(e) => setChainId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., mill_creek"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chain Name *
                </label>
                <input
                  type="text"
                  value={chainName}
                  onChange={(e) => setChainName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Mill Creek Care"
                />
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Field Organization</h3>
              <p className="text-sm text-gray-600">
                Review your highlights and ensure they are properly organized. You can go back to add more highlights if needed.
              </p>
              <div className="mt-4 space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Note Types:</span>{' '}
                  {highlights.filter(h => h.labelType === 'note-type').length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Field Names:</span>{' '}
                  {highlights.filter(h => h.labelType === 'field-name').length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">End Markers:</span>{' '}
                  {highlights.filter(h => h.labelType === 'end-marker').length}
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setStep('highlight')}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={buildConfiguration}
              disabled={!chainId || !chainName}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Build Configuration
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 'review' && config && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Review Configuration</h2>
            <p className="text-gray-600 mb-4">
              Review the generated configuration before saving.
            </p>
          </div>

          <div className="border rounded-lg p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Chain Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Chain ID:</span>{' '}
                  <span className="font-medium">{config.chainId}</span>
                </div>
                <div>
                  <span className="text-gray-600">Chain Name:</span>{' '}
                  <span className="font-medium">{config.chainName}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Behaviour Note Types</h3>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {config.behaviourNoteTypes.map((type, i) => (
                  <li key={i}>{type}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Follow-up Note Types</h3>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {config.followUpNoteTypes.map((type, i) => (
                  <li key={i}>{type}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Field Extraction Markers</h3>
              <div className="space-y-3">
                {Object.entries(config.noteTypeConfigs).map(([noteType, noteConfig]) => (
                  <div key={noteType} className="border-l-4 border-cyan-500 pl-4">
                    <h4 className="font-medium text-sm mb-2">{noteType}</h4>
                    {Object.entries(noteConfig.fields).length > 0 ? (
                      <ul className="text-sm text-gray-700 space-y-1">
                        {Object.entries(noteConfig.fields).map(([fieldKey, fieldConfig]) => (
                          <li key={fieldKey}>
                            <span className="font-medium">{fieldKey}:</span>{' '}
                            <span className="text-gray-600">"{fieldConfig.fieldName}"</span>
                            {fieldConfig.endMarkers.length > 0 && (
                              <span className="text-gray-500 text-xs ml-2">
                                (ends at: {fieldConfig.endMarkers.join(', ')})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500">No fields configured</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setStep('configure')}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleSaveConfiguration}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* Step: View Saved Configurations */}
      {step === 'saved' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Saved Configurations</h2>
              <p className="text-gray-600 mb-4">
                View and manage your saved onboarding configurations.
              </p>
            </div>
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to Upload
            </button>
          </div>

          {loadingConfigs ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading configurations...</p>
            </div>
          ) : savedConfigs.length === 0 ? (
            <div className="border rounded-lg p-12 text-center bg-gray-50">
              <p className="text-gray-600 mb-4">No saved configurations yet.</p>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
              >
                Create New Configuration
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {savedConfigs.map((savedConfig) => (
                <div key={savedConfig.chainId} className="border rounded-lg p-6 bg-white hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{savedConfig.chainName}</h3>
                      <p className="text-sm text-gray-500 mt-1">Chain ID: {savedConfig.chainId}</p>
                      {savedConfig.createdAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Created: {new Date(savedConfig.createdAt).toLocaleDateString()}
                          {savedConfig.updatedAt && savedConfig.updatedAt !== savedConfig.createdAt && (
                            <span> • Updated: {new Date(savedConfig.updatedAt).toLocaleDateString()}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleLoadConfig(savedConfig)}
                      className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 text-sm"
                    >
                      View Details
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-yellow-50 rounded p-3">
                      <p className="text-xs text-yellow-700 font-medium mb-1">Behaviour Note Types</p>
                      <p className="text-sm font-semibold text-yellow-900">{savedConfig.behaviourNoteTypes.length}</p>
                    </div>
                    <div className="bg-blue-50 rounded p-3">
                      <p className="text-xs text-blue-700 font-medium mb-1">Follow-up Note Types</p>
                      <p className="text-sm font-semibold text-blue-900">{savedConfig.followUpNoteTypes.length}</p>
                    </div>
                    <div className="bg-green-50 rounded p-3">
                      <p className="text-xs text-green-700 font-medium mb-1">Note Type Configs</p>
                      <p className="text-sm font-semibold text-green-900">{Object.keys(savedConfig.noteTypeConfigs).length}</p>
                    </div>
                  </div>

                  {Object.keys(savedConfig.noteTypeConfigs).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500 font-medium mb-2">Note Types:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(savedConfig.noteTypeConfigs).map((noteType) => {
                          const noteConfig = savedConfig.noteTypeConfigs[noteType];
                          const fieldCount = Object.keys(noteConfig.fields).length;
                          return (
                            <div
                              key={noteType}
                              className="px-3 py-1 bg-gray-100 rounded text-xs text-gray-700"
                            >
                              {noteType} ({fieldCount} {fieldCount === 1 ? 'field' : 'fields'})
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config Details Modal */}
      {viewingConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">
                Configuration Details: {viewingConfig.chainName}
              </h3>
              <button
                onClick={handleCloseViewConfig}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h4 className="font-semibold mb-2">Chain Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Chain ID:</span>{' '}
                    <span className="font-medium">{viewingConfig.chainId}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Chain Name:</span>{' '}
                    <span className="font-medium">{viewingConfig.chainName}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Behaviour Note Types</h4>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {viewingConfig.behaviourNoteTypes.map((type, i) => (
                    <li key={i}>{type}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Follow-up Note Types</h4>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {viewingConfig.followUpNoteTypes.map((type, i) => (
                    <li key={i}>{type}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Field Extraction Markers</h4>
                <div className="space-y-3">
                  {Object.entries(viewingConfig.noteTypeConfigs).map(([noteType, noteConfig]) => (
                    <div key={noteType} className="border-l-4 border-cyan-500 pl-4">
                      <h5 className="font-medium text-sm mb-2">{noteType}</h5>
                      {Object.entries(noteConfig.fields).length > 0 ? (
                        <ul className="text-sm text-gray-700 space-y-1">
                          {Object.entries(noteConfig.fields).map(([fieldKey, fieldConfig]) => (
                            <li key={fieldKey}>
                              <span className="font-medium">{fieldKey}:</span>{' '}
                              <span className="text-gray-600">"{fieldConfig.fieldName}"</span>
                              {fieldConfig.endMarkers.length > 0 && (
                                <span className="text-gray-500 text-xs ml-2">
                                  (ends at: {fieldConfig.endMarkers.join(', ')})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500">No fields configured</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end">
              <button
                onClick={handleCloseViewConfig}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface LabelDialogProps {
  highlight: Partial<Highlight>;
  existingHighlights: Highlight[];
  onSave: (label: string, labelType: Highlight['labelType'], noteType?: string, fieldKey?: string) => void;
  onCancel: () => void;
}

function LabelDialog({ highlight, existingHighlights, onSave, onCancel }: LabelDialogProps) {
  const [label, setLabel] = useState('');
  const [labelType, setLabelType] = useState<Highlight['labelType']>('field-name');
  const [noteType, setNoteType] = useState<string>('');
  const [fieldKey, setFieldKey] = useState<string>('');

  const noteTypes = existingHighlights
    .filter(h => h.labelType === 'note-type')
    .map(h => h.label);

  const handleSave = () => {
    if (!label.trim()) {
      alert('Please enter a label');
      return;
    }

    if (labelType === 'field-name' && !noteType) {
      alert('Please select a note type for this field');
      return;
    }

    onSave(label, labelType, noteType || undefined, fieldKey || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4">Label Selection</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Selected Text
            </label>
            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {highlight.text?.substring(0, 200)}
              {highlight.text && highlight.text.length > 200 && '...'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label Type *
            </label>
            <select
              value={labelType}
              onChange={(e) => setLabelType(e.target.value as Highlight['labelType'])}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="note-type">Note Type</option>
              <option value="field-name">Field Name</option>
              <option value="end-marker">End Marker</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Enter label for this selection"
            />
          </div>

          {labelType === 'field-name' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note Type *
                </label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select note type...</option>
                  {noteTypes.map((nt) => (
                    <option key={nt} value={nt}>{nt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Key (optional)
                </label>
                <input
                  type="text"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., behaviour_type, interventions"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to auto-generate from label
                </p>
              </div>
            </>
          )}

          {labelType === 'end-marker' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note Type
                </label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All note types</option>
                  {noteTypes.map((nt) => (
                    <option key={nt} value={nt}>{nt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Key (optional)
                </label>
                <input
                  type="text"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., behaviour_type, interventions"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to apply to all fields
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex space-x-4 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

