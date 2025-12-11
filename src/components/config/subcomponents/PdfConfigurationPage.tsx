import React, { useRef, useState } from 'react';
import { ChainExtractionConfig, ExtractionType, FieldExtractionConfig, NoteTypeExtractionConfig } from '@/lib/processing/types';

interface PdfConfigurationPageProps {
  pdfFile: File | null;
  pdfText: string;
  config: ChainExtractionConfig;
  onConfigChange: (config: ChainExtractionConfig) => void;
  onPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyzePdf: () => void;
  onAnalyzeWithAI: () => void;
  isAnalyzing?: boolean;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
  isEditing?: boolean;
}

const EXTRACTION_TYPES = Object.values(ExtractionType);

interface Highlight {
  text: string;
  start: number;
  end: number;
  color: string;
  label: string;
}

export function PdfConfigurationPage({
  pdfFile,
  pdfText,
  config,
  onConfigChange,
  onPdfUpload,
  onAnalyzePdf,
  onAnalyzeWithAI,
  isAnalyzing = false,
  onContinue,
  onSkip,
  onBack,
  isEditing = false,
}: PdfConfigurationPageProps) {
  const [selectedText, setSelectedText] = useState<string>('');
  const pdfRef = useRef<HTMLDivElement>(null);

  // Helper to update config
  const setConfig = (updater: ChainExtractionConfig | ((prev: ChainExtractionConfig) => ChainExtractionConfig)) => {
    if (typeof updater === 'function') {
      onConfigChange(updater(config));
    } else {
      onConfigChange(updater);
    }
  };

  // Handle text selection in PDF
  const handleTextSelection = () => {
    if (!pdfRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    if (text) {
      setSelectedText(text);
    }
  };

  // Generate highlights from config (supports overlapping)
  const generateHighlights = (): Highlight[] => {
    const highlights: Highlight[] = [];
    const normalize = (value: string) => value.trim().toLowerCase();
    const fieldNames = new Set<string>();
    const endMarkers = new Set<string>();

    const collectFieldNames = (value: string | string[]) => {
      (Array.isArray(value) ? value : [value]).forEach(v => fieldNames.add(normalize(v)));
    };

    const collectMarkerSets = (markerConfig?: Partial<Record<ExtractionType, FieldExtractionConfig>>) => {
      if (!markerConfig) return;
      Object.values(markerConfig).forEach(marker => {
        if (!marker) return;
        collectFieldNames(marker.fieldName);
        marker.endMarkers.forEach(em => endMarkers.add(normalize(em)));
      });
    };

    const collectNoteConfigs = (noteConfigs?: Record<string, NoteTypeExtractionConfig>) => {
      if (!noteConfigs) return;
      Object.values(noteConfigs).forEach(noteCfg => {
        Object.values(noteCfg.extractionMarkers).forEach(marker => {
          if (!marker) return;
          collectFieldNames(marker.fieldName);
          marker.endMarkers.forEach(em => endMarkers.add(normalize(em)));
        });
      });
    };

    collectMarkerSets(config.fieldExtractionMarkers);
    collectNoteConfigs(config.behaviourNoteConfigs);
    collectNoteConfigs(config.followUpNoteConfigs);

    const dualMarkers = new Set<string>();
    fieldNames.forEach(name => {
      if (endMarkers.has(name)) dualMarkers.add(name);
    });

    // Helper to add highlight (allows overlaps)
    const addHighlight = (text: string, start: number, end: number, color: string, label: string) => {
      const isDual = dualMarkers.has(normalize(text));
      highlights.push({
        text,
        start,
        end,
        color: isDual ? 'bg-purple-300' : color,
        label: isDual ? 'Field + End Marker' : label
      });
    };

    // Priority 1: Highlight behaviour note types (highest priority)
    config.behaviourNoteTypes.forEach(noteType => {
      let startIndex = 0;
      while (true) {
        const index = pdfText.indexOf(noteType, startIndex);
        if (index === -1) break;
        addHighlight(noteType, index, index + noteType.length, 'bg-yellow-200', 'Behaviour Type');
        startIndex = index + noteType.length;
      }
    });

    // Priority 2: Highlight followup note types
    config.followUpNoteTypes.forEach(noteType => {
      let startIndex = 0;
      while (true) {
        const index = pdfText.indexOf(noteType, startIndex);
        if (index === -1) break;
        addHighlight(noteType, index, index + noteType.length, 'bg-green-200', 'Follow-up Type');
        startIndex = index + noteType.length;
      }
    });

    // Priority 3: Highlight field markers
    Object.entries(config.fieldExtractionMarkers).forEach(([type, marker]) => {
      const fieldNames = Array.isArray(marker.fieldName) ? marker.fieldName : [marker.fieldName];
      fieldNames.forEach(fieldName => {
        let startIndex = 0;
        while (true) {
          const index = pdfText.indexOf(fieldName, startIndex);
          if (index === -1) break;
          addHighlight(fieldName, index, index + fieldName.length, 'bg-blue-200', `Field: ${type}`);
          startIndex = index + fieldName.length;
        }
      });

      // Priority 4: Highlight end markers (lowest priority)
      marker.endMarkers.forEach(endMarker => {
        let startIndex = 0;
        while (true) {
          const index = pdfText.indexOf(endMarker, startIndex);
          if (index === -1) break;
          addHighlight(endMarker, index, index + endMarker.length, 'bg-pink-200', `End: ${type}`);
          startIndex = index + endMarker.length;
        }
      });
    });

    // Priority 5: Highlight behaviour note config extraction markers
    if (config.behaviourNoteConfigs) {
      Object.entries(config.behaviourNoteConfigs).forEach(([noteTypeName, noteConfig]) => {
        Object.entries(noteConfig.extractionMarkers).forEach(([type, marker]) => {
          const fieldNames = Array.isArray(marker.fieldName) ? marker.fieldName : [marker.fieldName];
          fieldNames.forEach(fieldName => {
            let startIndex = 0;
            while (true) {
              const index = pdfText.indexOf(fieldName, startIndex);
              if (index === -1) break;
              addHighlight(fieldName, index, index + fieldName.length, 'bg-blue-200', `Behaviour Config Field: ${noteTypeName} - ${type}`);
              startIndex = index + fieldName.length;
            }
          });

          marker.endMarkers.forEach(endMarker => {
            let startIndex = 0;
            while (true) {
              const index = pdfText.indexOf(endMarker, startIndex);
              if (index === -1) break;
              addHighlight(endMarker, index, index + endMarker.length, 'bg-pink-200', `Behaviour Config End: ${noteTypeName} - ${type}`);
              startIndex = index + endMarker.length;
            }
          });
        });
      });
    }

    // Priority 6: Highlight follow-up note config extraction markers
    if (config.followUpNoteConfigs) {
      Object.entries(config.followUpNoteConfigs).forEach(([noteTypeName, noteConfig]) => {
        Object.entries(noteConfig.extractionMarkers).forEach(([type, marker]) => {
          const fieldNames = Array.isArray(marker.fieldName) ? marker.fieldName : [marker.fieldName];
          fieldNames.forEach(fieldName => {
            let startIndex = 0;
            while (true) {
              const index = pdfText.indexOf(fieldName, startIndex);
              if (index === -1) break;
              addHighlight(fieldName, index, index + fieldName.length, 'bg-blue-200', `Follow-up Config Field: ${noteTypeName} - ${type}`);
              startIndex = index + fieldName.length;
            }
          });

          marker.endMarkers.forEach(endMarker => {
            let startIndex = 0;
            while (true) {
              const index = pdfText.indexOf(endMarker, startIndex);
              if (index === -1) break;
              addHighlight(endMarker, index, index + endMarker.length, 'bg-pink-200', `Follow-up Config End: ${noteTypeName} - ${type}`);
              startIndex = index + endMarker.length;
            }
          });
        });
      });
    }

    return highlights.sort((a, b) => a.start - b.start);
  };

  // Render highlighted PDF text with support for overlapping highlights
  const renderHighlightedPdf = () => {
    if (!pdfText) return '';

    const highlights = generateHighlights();
    if (highlights.length === 0) return pdfText;

    // Create a map of character positions to their highlights
    const charMap: Map<number, Highlight[]> = new Map();
    highlights.forEach(highlight => {
      for (let i = highlight.start; i < highlight.end; i++) {
        if (!charMap.has(i)) {
          charMap.set(i, []);
        }
        charMap.get(i)!.push(highlight);
      }
    });

    // Build segments with consistent highlight combinations
    const segments: Array<{ start: number; end: number; highlights: Highlight[] }> = [];
    let currentStart = 0;
    let currentHighlights: Highlight[] = [];

    const highlightsEqual = (a: Highlight[], b: Highlight[]) => {
      if (a.length !== b.length) return false;
      const aLabels = a.map(h => h.label).sort().join('|');
      const bLabels = b.map(h => h.label).sort().join('|');
      return aLabels === bLabels;
    };

    for (let i = 0; i < pdfText.length; i++) {
      const highlights = charMap.get(i) || [];
      
      if (!highlightsEqual(highlights, currentHighlights)) {
        if (i > currentStart) {
          segments.push({ start: currentStart, end: i, highlights: currentHighlights });
        }
        currentStart = i;
        currentHighlights = highlights;
      }
    }
    
    // Add final segment
    if (currentStart < pdfText.length) {
      segments.push({ start: currentStart, end: pdfText.length, highlights: currentHighlights });
    }

    const getBgColor = (cls: string) => {
      switch (cls) {
        case 'bg-yellow-200':
          return '#FEF08A';
        case 'bg-green-200':
          return '#BBF7D0';
        case 'bg-blue-200':
          return '#BFDBFE';
        case 'bg-pink-200':
          return '#FBCFE8';
        case 'bg-purple-300':
          return '#D8B4FE';
        default:
          return '#E5E7EB';
      }
    };

    const isFieldLabel = (label: string) => {
      const lower = label.toLowerCase();
      return lower.includes('field:') || lower.includes('config field') || lower === 'field + end marker';
    };

    const isEndLabel = (label: string) => {
      const lower = label.toLowerCase();
      return lower.includes('end:') || lower.includes('config end') || lower.includes('end marker');
    };

    // Render segments
    let result = '';
    segments.forEach(segment => {
      const text = pdfText.slice(segment.start, segment.end);

      if (segment.highlights.length === 0) {
        result += escapeHtml(text);
        return;
      }

      if (segment.highlights.length === 1) {
        const h = segment.highlights[0];
        const isFieldEnd = h.label === 'Field + End Marker';
        const bg = isFieldEnd ? getBgColor('bg-purple-300') : getBgColor(h.color);
        result += `<span class="px-1" style="background:${bg};" title="${escapeHtml(h.label)}">${escapeHtml(text)}</span>`;
        return;
      }

      // Multiple overlapping highlights - prefer Field + End (exact label) if present
      const preferred = segment.highlights.find(h => h.label === 'Field + End Marker') || segment.highlights[0];
      const labels = segment.highlights.map(h => h.label).join(' + ');
      const hasField = segment.highlights.some(h => isFieldLabel(h.label));
      const hasEnd = segment.highlights.some(h => isEndLabel(h.label));
      const isFieldEndCombo = preferred.label === 'Field + End Marker' || (hasField && hasEnd);
      const bg = isFieldEndCombo ? getBgColor('bg-purple-300') : getBgColor(preferred.color);
      result += `<span class="px-1" style="background:${bg};" title="${escapeHtml(labels)}">${escapeHtml(text)}</span>`;
    });

    return result;
  };

  // Add item to string array
  const addToArray = (field: 'behaviourNoteTypes' | 'followUpNoteTypes' | 'extraFollowUpNoteTypes', value: string) => {
    if (!value.trim()) return;
    setConfig(prev => {
      const currentArray = prev[field] || [];
      if (currentArray.includes(value.trim())) return prev; // Don't add duplicates
      return {
        ...prev,
        [field]: [...currentArray, value.trim()]
      };
    });
    setSelectedText(''); // Clear selection after use
  };

  // Remove item from string array
  const removeFromArray = (field: 'behaviourNoteTypes' | 'followUpNoteTypes' | 'extraFollowUpNoteTypes', index: number) => {
    setConfig(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index)
    }));
  };

  // Add field extraction marker
  const addFieldMarker = (extractionType: ExtractionType, fieldName: string, endMarkers: string[]) => {
    setConfig(prev => ({
      ...prev,
      fieldExtractionMarkers: {
        ...prev.fieldExtractionMarkers,
        [extractionType]: { fieldName, endMarkers }
      }
    }));
  };

  // Add end marker to existing field
  const addEndMarkerToField = (extractionType: ExtractionType, endMarker: string) => {
    setConfig(prev => {
      const existing = prev.fieldExtractionMarkers[extractionType];
      if (!existing) return prev;

      if (existing.endMarkers.includes(endMarker)) return prev; // Don't add duplicates

      return {
        ...prev,
        fieldExtractionMarkers: {
          ...prev.fieldExtractionMarkers,
          [extractionType]: {
            ...existing,
            endMarkers: [...existing.endMarkers, endMarker]
          }
        }
      };
    });
    setSelectedText(''); // Clear selection after use
  };

  // Remove end marker from field
  const removeEndMarkerFromField = (extractionType: ExtractionType, endMarkerIndex: number) => {
    setConfig(prev => {
      const existing = prev.fieldExtractionMarkers[extractionType];
      if (!existing) return prev;

      return {
        ...prev,
        fieldExtractionMarkers: {
          ...prev.fieldExtractionMarkers,
          [extractionType]: {
            ...existing,
            endMarkers: existing.endMarkers.filter((_, i) => i !== endMarkerIndex)
          }
        }
      };
    });
  };

  // Remove field extraction marker
  const removeFieldMarker = (extractionType: ExtractionType) => {
    setConfig(prev => {
      const newMarkers = { ...prev.fieldExtractionMarkers };
      delete newMarkers[extractionType];
      return { ...prev, fieldExtractionMarkers: newMarkers };
    });
  };

  // Update field name for existing marker
  const updateFieldName = (extractionType: ExtractionType, fieldName: string) => {
    setConfig(prev => {
      const existing = prev.fieldExtractionMarkers[extractionType];
      if (!existing) return prev;

      return {
        ...prev,
        fieldExtractionMarkers: {
          ...prev.fieldExtractionMarkers,
          [extractionType]: {
            ...existing,
            fieldName
          }
        }
      };
    });
  };

  // Update field marker (can change type, field name, and end markers)
  const updateFieldMarker = (oldType: ExtractionType, newType: ExtractionType, fieldName: string, endMarkers: string[]) => {
    setConfig(prev => {
      const newMarkers = { ...prev.fieldExtractionMarkers };
      if (oldType !== newType) {
        delete newMarkers[oldType];
      }
      newMarkers[newType] = { fieldName, endMarkers };
      return { ...prev, fieldExtractionMarkers: newMarkers };
    });
  };

  // Add note type config
  const addNoteTypeConfig = (
    configType: 'behaviourNoteConfigs' | 'followUpNoteConfigs',
    noteTypeName: string,
    noteConfig: NoteTypeExtractionConfig
  ) => {
    setConfig(prev => ({
      ...prev,
      [configType]: {
        ...(prev[configType] || {}),
        [noteTypeName]: noteConfig
      }
    }));
  };

  // Update note type config
  const updateNoteTypeConfig = (
    configType: 'behaviourNoteConfigs' | 'followUpNoteConfigs',
    noteTypeName: string,
    noteConfig: NoteTypeExtractionConfig
  ) => {
    addNoteTypeConfig(configType, noteTypeName, noteConfig);
  };

  // Remove note type config
  const removeNoteTypeConfig = (
    configType: 'behaviourNoteConfigs' | 'followUpNoteConfigs',
    noteTypeName: string
  ) => {
    setConfig(prev => {
      const newConfigs = { ...(prev[configType] || {}) };
      delete newConfigs[noteTypeName];
      return { ...prev, [configType]: newConfigs };
    });
  };

  const handleContinue = () => {
    onContinue();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {isEditing ? 'Edit PDF Configuration' : 'PDF Configuration'}
          </h2>
          <p className="text-gray-600 mb-4">
            {isEditing
              ? 'Update the extraction settings. You can optionally upload a new PDF to reference.'
              : 'Configure the extraction settings for behaviour notes. Uploading a PDF is optional but helps with configuration.'}
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {isEditing ? 'Cancel Edit' : 'Back to Configurations'}
        </button>
      </div>

      {/* PDF Upload Section - Optional */}
      {!pdfText && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upload Reference PDF
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Upload a PDF to reference while editing, or continue with the configuration below.
          </p>
          <input
            type="file"
            accept=".pdf"
            onChange={onPdfUpload}
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
      )}

      {/* Analyze PDF Button */}
      {pdfFile && !pdfText && (
        <div className="text-center">
          <button
            onClick={onAnalyzePdf}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-semibold"
          >
            Extract PDF Text
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Click to extract text from the PDF
          </p>
        </div>
      )}

      {/* Two-Column Layout: PDF Viewer + Config Editor (or single column if no PDF) */}
      <div className={pdfText ? "grid grid-cols-2 gap-6" : ""}>
        {/* Left Column: PDF Viewer (only shown when PDF is loaded) */}
        {pdfText && (
          <div className="rounded-lg pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">PDF Content</h3>
              <button
                onClick={onAnalyzeWithAI}
                disabled={isAnalyzing}
                className="px-3 py-1.5 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  '✨ Analyze with AI'
                )}
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Select text to use in configuration. Overlapping highlights shown with bold ring.
            </p>
            <div className="text-xs mb-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-yellow-200 px-2 py-0.5 rounded text-xs">Behaviour Type</span>
                <span className="bg-green-200 px-2 py-0.5 rounded text-xs">Follow-up Type</span>
                <span className="bg-blue-200 px-2 py-0.5 rounded text-xs">Field Name</span>
                <span className="bg-pink-200 px-2 py-0.5 rounded text-xs">End Marker</span>
                <span className="bg-purple-300 px-2 py-0.5 rounded text-xs">Field + End</span>
              </div>
            </div>
            <div
              ref={pdfRef}
              onMouseUp={handleTextSelection}
              className="whitespace-pre-wrap font-mono text-xs max-h-[1000px] bg-white p-4 rounded border cursor-text select-text overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: renderHighlightedPdf() }}
            />
          </div>
        )}

        {/* Config Editor Column (always shown) */}
        <div className="rounded-lg p-4 bg-white overflow-y-auto">
          <h3 className="font-semibold mb-4 text-gray-900">Extraction Configuration</h3>

            {/* Behaviour Note Types */}
            <ConfigSection title="Behaviour Note Types">
              <StringArrayEditor
                items={config.behaviourNoteTypes}
                onAdd={(value) => addToArray('behaviourNoteTypes', value)}
                onRemove={(index) => removeFromArray('behaviourNoteTypes', index)}
                placeholder="e.g., Behaviour - Responsive Behaviour"
                selectedText={selectedText}
                onUseSelected={() => addToArray('behaviourNoteTypes', selectedText)}
              />
            </ConfigSection>

            {/* Follow-up Note Types */}
            <ConfigSection title="Follow-up Note Types">
              <StringArrayEditor
                items={config.followUpNoteTypes}
                onAdd={(value) => addToArray('followUpNoteTypes', value)}
                onRemove={(index) => removeFromArray('followUpNoteTypes', index)}
                placeholder="e.g., Behaviour - Follow up"
                selectedText={selectedText}
                onUseSelected={() => addToArray('followUpNoteTypes', selectedText)}
              />
            </ConfigSection>

            {/* Extra Follow-up Note Types */}
            <ConfigSection title="Extra Follow-up Note Types (Optional)">
              <StringArrayEditor
                items={config.extraFollowUpNoteTypes || []}
                onAdd={(value) => addToArray('extraFollowUpNoteTypes', value)}
                onRemove={(index) => removeFromArray('extraFollowUpNoteTypes', index)}
                placeholder="e.g., Family/Resident Involvement"
                selectedText={selectedText}
                onUseSelected={() => addToArray('extraFollowUpNoteTypes', selectedText)}
              />
            </ConfigSection>

            {/* Matching Window Hours */}
            <ConfigSection title="Matching Window Hours">
              <input
                type="number"
                value={config.matchingWindowHours || 24}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  matchingWindowHours: parseInt(e.target.value) || 24
                }))}
                className="w-full px-2 py-1 text-sm border rounded"
                placeholder="24"
              />
            </ConfigSection>

            {/* Boolean Flags */}
            <ConfigSection title="Configuration Flags">
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.hasTimeFrequency || false}
                    onChange={(e) => setConfig(prev => ({ ...prev, hasTimeFrequency: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Has Time Frequency</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.hasEvaluation || false}
                    onChange={(e) => setConfig(prev => ({ ...prev, hasEvaluation: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Has Evaluation</span>
                </label>
              </div>
            </ConfigSection>

            {/* Default Field Extraction Markers */}
            <ConfigSection title="Default Field Extraction Markers">
              <FieldExtractionEditor
                markers={config.fieldExtractionMarkers}
                onAdd={addFieldMarker}
                onRemove={removeFieldMarker}
                onUpdateFieldName={updateFieldName}
                onAddEndMarker={addEndMarkerToField}
                onRemoveEndMarker={removeEndMarkerFromField}
                onUpdate={updateFieldMarker}
                selectedText={selectedText}
              />
            </ConfigSection>

            {/* Behaviour Note Custom Field Markers */}
            <ConfigSection title="Behaviour Note Custom Field Markers (Optional)">
              <NoteTypeConfigEditor
                noteTypes={config.behaviourNoteTypes}
                configs={config.behaviourNoteConfigs || {}}
                onAdd={(noteTypeName, noteConfig) => addNoteTypeConfig('behaviourNoteConfigs', noteTypeName, noteConfig)}
                onUpdate={(noteTypeName, noteConfig) => updateNoteTypeConfig('behaviourNoteConfigs', noteTypeName, noteConfig)}
                onRemove={(noteTypeName) => removeNoteTypeConfig('behaviourNoteConfigs', noteTypeName)}
                selectedText={selectedText}
              />
            </ConfigSection>

            {/* Follow-up Note Custom Field Markers */}
            <ConfigSection title="Follow-up Note Custom Field Markers (Optional)">
              <NoteTypeConfigEditor
                noteTypes={config.followUpNoteTypes}
                configs={config.followUpNoteConfigs || {}}
                onAdd={(noteTypeName, noteConfig) => addNoteTypeConfig('followUpNoteConfigs', noteTypeName, noteConfig)}
                onUpdate={(noteTypeName, noteConfig) => updateNoteTypeConfig('followUpNoteConfigs', noteTypeName, noteConfig)}
                onRemove={(noteTypeName) => removeNoteTypeConfig('followUpNoteConfigs', noteTypeName)}
                selectedText={selectedText}
              />
            </ConfigSection>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t">
        <button
          onClick={onSkip}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Skip to Excel Configuration
        </button>
        <button
          onClick={handleContinue}
          className="px-6 py-3 rounded-lg font-semibold transition-colors bg-cyan-500 text-white hover:bg-cyan-600"
        >
          Continue to Excel Configuration
        </button>
      </div>
    </div>
  );
}

// Helper function
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper Components

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="mb-4 border-b pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left mb-2"
      >
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        <span className="text-gray-500 text-xs">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  );
}

function StringArrayEditor({
  items,
  onAdd,
  onRemove,
  placeholder,
  selectedText,
  onUseSelected
}: {
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder?: string;
  selectedText?: string;
  onUseSelected?: () => void;
}) {
  const [newItem, setNewItem] = useState('');

  const handleAddHighlight = () => {
    if (selectedText) {
      setNewItem(selectedText);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleAdd = () => {
    if (newItem) {
      onAdd(newItem);
      setNewItem('');
    }
  };

  const hasSelected = selectedText && onUseSelected;

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-2 bg-gray-50 p-2 rounded">
          <span className="flex-1 text-sm">{item}</span>
          <button
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-800 text-xs px-2 py-1"
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex space-x-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          className="flex-1 px-2 py-1 text-sm border rounded"
        />
        {hasSelected && (
          <button
            onClick={handleAddHighlight}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
          >
            Add Highlight
          </button>
        )}
        <button
          onClick={handleAdd}
          disabled={!newItem}
          className="px-3 py-1 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Shared component for displaying a single field marker with inline editing
function FieldMarkerCard({
  type,
  marker,
  onRemove,
  onUpdate,
  availableTypes,
  selectedText
}: {
  type: ExtractionType;
  marker: FieldExtractionConfig;
  onRemove: () => void;
  onUpdate?: (oldType: ExtractionType, newType: ExtractionType, fieldName: string, endMarkers: string[]) => void;
  availableTypes?: ExtractionType[];
  selectedText?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const canEdit = !!onUpdate;
  const currentFieldName = Array.isArray(marker.fieldName) ? marker.fieldName.join(', ') : marker.fieldName;

  const handleUpdate = (oldType: ExtractionType, newType: ExtractionType, fieldName: string, endMarkers: string[]) => {
    if (onUpdate) {
      onUpdate(oldType, newType, fieldName, endMarkers);
    }
    setIsEditing(false);
  };

  if (isEditing && canEdit && availableTypes) {
    return (
      <FieldMarkerForm
        availableTypes={availableTypes}
        onAdd={() => {}}
        onCancel={() => setIsEditing(false)}
        selectedText={selectedText}
        editingType={type}
        initialFieldName={currentFieldName}
        initialEndMarkers={marker.endMarkers}
        onUpdate={handleUpdate}
      />
    );
  }

  return (
    <div className="bg-gray-50 p-3 rounded border">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-semibold text-gray-700">{type}</span>
        <div className="flex gap-1">
          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-blue-600 hover:text-blue-800 text-xs px-2"
            >
              Edit
            </button>
          )}
          <button
            onClick={onRemove}
            className="text-red-600 hover:text-red-800 text-xs px-2"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="text-xs space-y-2">
        <div>
          <span className="font-medium">Field:</span> {currentFieldName}
        </div>
        <div>
          <span className="font-medium">End Markers:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {marker.endMarkers.map((endMarker, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-white px-1 py-0.5 rounded border">
                {endMarker}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Unified field markers editor - used by both Default and Custom field markers
function FieldMarkersEditor({
  markers,
  onAdd,
  onRemove,
  onUpdate,
  selectedText
}: {
  markers: Partial<Record<ExtractionType, FieldExtractionConfig>>;
  onAdd: (extractionType: ExtractionType, fieldName: string, endMarkers: string[]) => void;
  onRemove: (extractionType: ExtractionType) => void;
  onUpdate?: (oldType: ExtractionType, newType: ExtractionType, fieldName: string, endMarkers: string[]) => void;
  selectedText?: string;
}) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const existingTypes = Object.keys(markers) as ExtractionType[];
  const availableTypes = EXTRACTION_TYPES.filter(t => !existingTypes.includes(t));

  const handleAdd = (type: ExtractionType, fieldName: string, endMarkers: string[]) => {
    onAdd(type, fieldName, endMarkers);
    setIsAddingNew(false);
  };

  return (
    <div className="space-y-3">
      {existingTypes.map(type => {
        const marker = markers[type]!;
        return (
          <FieldMarkerCard
            key={type}
            type={type}
            marker={marker}
            onRemove={() => onRemove(type)}
            onUpdate={onUpdate ? (oldType, newType, fieldName, endMarkers) => onUpdate(oldType, newType, fieldName, endMarkers) : undefined}
            availableTypes={EXTRACTION_TYPES}
            selectedText={selectedText}
          />
        );
      })}

      {availableTypes.length > 0 && !isAddingNew && (
        <button
          onClick={() => setIsAddingNew(true)}
          className="w-full px-3 py-2 border-2 border-dashed border-gray-300 text-gray-600 text-sm rounded hover:border-cyan-400 hover:text-cyan-600 transition-colors"
        >
          + Add Field Marker
        </button>
      )}

      {isAddingNew && (
        <FieldMarkerForm
          availableTypes={availableTypes}
          onAdd={handleAdd}
          onCancel={() => setIsAddingNew(false)}
          selectedText={selectedText}
        />
      )}
    </div>
  );
}

// Wrapper for backwards compatibility - Default Field Extraction Markers
function FieldExtractionEditor({
  markers,
  onAdd,
  onRemove,
  onUpdate,
  selectedText,
  ..._unusedProps
}: {
  markers: Partial<Record<ExtractionType, FieldExtractionConfig>>;
  onAdd: (extractionType: ExtractionType, fieldName: string, endMarkers: string[]) => void;
  onRemove: (extractionType: ExtractionType) => void;
  onUpdateFieldName: (extractionType: ExtractionType, fieldName: string) => void;
  onAddEndMarker: (extractionType: ExtractionType, endMarker: string) => void;
  onRemoveEndMarker: (extractionType: ExtractionType, index: number) => void;
  onUpdate?: (oldType: ExtractionType, newType: ExtractionType, fieldName: string, endMarkers: string[]) => void;
  selectedText?: string;
}) {
  void _unusedProps;
  return (
    <FieldMarkersEditor
      markers={markers}
      onAdd={onAdd}
      onRemove={onRemove}
      onUpdate={onUpdate}
      selectedText={selectedText}
    />
  );
}

// Section for a single note type's custom field markers - inline editing
function NoteTypeSection({
  noteTypeName,
  config,
  onUpdate,
  onRemove,
  selectedText
}: {
  noteTypeName: string;
  config: NoteTypeExtractionConfig;
  onUpdate: (config: NoteTypeExtractionConfig) => void;
  onRemove: () => void;
  selectedText?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const addMarker = (extractionType: ExtractionType, fieldName: string, endMarkers: string[]) => {
    onUpdate({
      ...config,
      extractionMarkers: {
        ...config.extractionMarkers,
        [extractionType]: { fieldName, endMarkers }
      }
    });
  };

  const removeMarker = (extractionType: ExtractionType) => {
    const newMarkers = { ...config.extractionMarkers };
    delete newMarkers[extractionType];
    onUpdate({ ...config, extractionMarkers: newMarkers });
  };

  const updateMarker = (oldType: ExtractionType, newType: ExtractionType, fieldName: string, endMarkers: string[]) => {
    const newMarkers = { ...config.extractionMarkers };
    if (oldType !== newType) {
      delete newMarkers[oldType];
    }
    newMarkers[newType] = { fieldName, endMarkers };
    onUpdate({
      ...config,
      extractionMarkers: newMarkers
    });
  };

  const markerCount = Object.keys(config.extractionMarkers).length;

  return (
    <div className="bg-purple-50 p-3 rounded border border-purple-200">
      <div className="flex justify-between items-start mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-xs text-gray-500">{isExpanded ? '▼' : '▶'}</span>
          <span className="text-sm font-semibold text-gray-900">{noteTypeName}</span>
          <span className="text-xs text-gray-500">({markerCount} markers)</span>
        </button>
        <button
          onClick={onRemove}
          className="text-red-600 hover:text-red-800 text-xs px-2"
        >
          Remove
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3 mt-3">
          <FieldMarkersEditor
            markers={config.extractionMarkers}
            onAdd={addMarker}
            onRemove={removeMarker}
            onUpdate={updateMarker}
            selectedText={selectedText}
          />

          <div className="border-t pt-3 space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.hasTimeFrequency || false}
                onChange={(e) => onUpdate({ ...config, hasTimeFrequency: e.target.checked })}
                className="rounded"
              />
              <span className="text-xs">Has Time Frequency</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.hasEvaluation || false}
                onChange={(e) => onUpdate({ ...config, hasEvaluation: e.target.checked })}
                className="rounded"
              />
              <span className="text-xs">Has Evaluation</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteTypeConfigEditor({
  noteTypes,
  configs,
  onAdd,
  onUpdate,
  onRemove,
  selectedText
}: {
  noteTypes: string[];
  configs: Record<string, NoteTypeExtractionConfig>;
  onAdd: (noteTypeName: string, config: NoteTypeExtractionConfig) => void;
  onUpdate: (noteTypeName: string, config: NoteTypeExtractionConfig) => void;
  onRemove: (noteTypeName: string) => void;
  selectedText?: string;
}) {
  const configuredNoteTypes = Object.keys(configs);
  const availableNoteTypes = noteTypes.filter(nt => !configuredNoteTypes.includes(nt));

  const handleAddNoteType = (noteTypeName: string) => {
    if (!noteTypeName) return;
    onAdd(noteTypeName, {
      extractionMarkers: {},
      hasTimeFrequency: false,
      hasEvaluation: false,
    });
  };

  return (
    <div className="space-y-3">
      {configuredNoteTypes.map(noteTypeName => (
        <NoteTypeSection
          key={noteTypeName}
          noteTypeName={noteTypeName}
          config={configs[noteTypeName]}
          onUpdate={(config) => onUpdate(noteTypeName, config)}
          onRemove={() => onRemove(noteTypeName)}
          selectedText={selectedText}
        />
      ))}

      {availableNoteTypes.length > 0 && (
        <div className="border-t pt-3">
          <select
            value=""
            onChange={(e) => handleAddNoteType(e.target.value)}
            className="w-full px-2 py-2 text-sm border rounded bg-white"
          >
            <option value="">+ Add custom markers for note type...</option>
            {availableNoteTypes.map(nt => (
              <option key={nt} value={nt}>{nt}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// Shared form component for creating new field markers
function FieldMarkerForm({
  availableTypes,
  onAdd,
  onCancel,
  selectedText,
  editingType,
  initialFieldName,
  initialEndMarkers,
  onUpdate
}: {
  availableTypes: ExtractionType[];
  onAdd: (extractionType: ExtractionType, fieldName: string, endMarkers: string[]) => void;
  onCancel: () => void;
  selectedText?: string;
  editingType?: ExtractionType;
  initialFieldName?: string;
  initialEndMarkers?: string[];
  onUpdate?: (oldType: ExtractionType, newType: ExtractionType, fieldName: string, endMarkers: string[]) => void;
}) {
  const isEditing = !!editingType;
  const [selectedType, setSelectedType] = useState<ExtractionType | ''>(editingType || '');
  const [fieldName, setFieldName] = useState(initialFieldName || '');
  const [endMarkers, setEndMarkers] = useState<string[]>(initialEndMarkers || []);
  const [newEndMarker, setNewEndMarker] = useState('');

  const handleAdd = () => {
    if (!selectedType || !fieldName) return;
    if (isEditing && onUpdate && editingType) {
      onUpdate(editingType, selectedType as ExtractionType, fieldName, endMarkers);
    } else {
      onAdd(selectedType as ExtractionType, fieldName, endMarkers);
    }
  };

  const handleAddFieldName = () => {
    if (selectedText) {
      setFieldName(selectedText);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleAddHighlightToEndMarker = () => {
    if (selectedText) {
      setNewEndMarker(selectedText);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleAddEndMarker = () => {
    if (newEndMarker) {
      setEndMarkers(prev => [...prev, newEndMarker]);
      setNewEndMarker('');
    }
  };

  const handleRemoveEndMarker = (index: number) => {
    setEndMarkers(prev => prev.filter((_, i) => i !== index));
  };

  const hasFieldSelected = selectedText && !fieldName;
  const hasEndMarkerSelected = selectedText;

  const typesForSelect = isEditing && editingType 
    ? [...availableTypes, editingType].sort()
    : availableTypes;

  if (typesForSelect.length === 0) return null;

  return (
    <div className="bg-white p-3 rounded border space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-700">
          {isEditing ? 'Edit Field Marker' : 'New Field Marker'}
        </span>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 text-xs"
        >
          Cancel
        </button>
      </div>

      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value as ExtractionType)}
        className="w-full px-2 py-1 text-sm border rounded"
        disabled={isEditing && typesForSelect.length === 1}
      >
        <option value="">Select extraction type...</option>
        {typesForSelect.map((type, index) => (
          <option key={`${type}-${index}`} value={type}>{type}</option>
        ))}
      </select>

      {(selectedType || isEditing) && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Field Name</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="e.g., 'Type of Behaviour :'"
                className="flex-1 px-2 py-1 text-sm border rounded"
              />
              {hasFieldSelected && (
                <button
                  onClick={handleAddFieldName}
                  className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                >
                  Add Highlight
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Markers</label>
            <div className="space-y-1">
              {endMarkers.map((marker, idx) => (
                <div key={idx} className="flex items-center space-x-2 bg-gray-50 p-1 rounded text-xs">
                  <span className="flex-1">{marker}</span>
                  <button
                    onClick={() => handleRemoveEndMarker(idx)}
                    className="text-red-600 hover:text-red-800 px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newEndMarker}
                  onChange={(e) => setNewEndMarker(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEndMarker()}
                  placeholder="e.g., 'Page', 'Range'"
                  className="flex-1 px-2 py-1 text-sm border rounded"
                />
                {hasEndMarkerSelected && (
                  <button
                    onClick={handleAddHighlightToEndMarker}
                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                  >
                    Add Highlight
                  </button>
                )}
                <button
                  onClick={handleAddEndMarker}
                  disabled={!newEndMarker}
                  className="px-3 py-1 bg-cyan-500 text-white text-xs rounded hover:bg-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!selectedType || !fieldName}
            className="w-full px-3 py-1 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600 disabled:bg-gray-300"
          >
            {isEditing ? 'Save Changes' : 'Create Field Marker'}
          </button>
        </>
      )}
    </div>
  );
}
