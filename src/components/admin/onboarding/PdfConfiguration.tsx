import React, { useRef } from 'react';
import { Highlight, escapeHtml } from '../../../lib/onboardingUtils';

interface PdfConfigurationPageProps {
  pdfFile: File | null;
  pdfText: string;
  pdfPages: string[];
  highlights: Highlight[];
  selectedText: string;
  aiLoading: boolean;
  aiSuggestions: any;
  onPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyzePdf: () => void;
  onTextSelection: () => void;
  onClearAiHighlights: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onViewSavedConfigs: () => void;
  renderHighlightedText: () => string | null;
}

export function PdfConfigurationPage({
  pdfFile,
  pdfText,
  pdfPages,
  highlights,
  selectedText,
  aiLoading,
  aiSuggestions,
  onPdfUpload,
  onAnalyzePdf,
  onTextSelection,
  onClearAiHighlights,
  onContinue,
  onSkip,
  onViewSavedConfigs,
  renderHighlightedText,
}: PdfConfigurationPageProps) {
  const textRef = useRef<HTMLDivElement>(null);

  const noteTypeHighlights = highlights.filter(h => h.labelType === 'note-type');
  const fieldHighlights = highlights.filter(h => h.labelType === 'field-name');
  const endMarkerHighlights = highlights.filter(h => h.labelType === 'end-marker');

  const hierarchicalStructure = noteTypeHighlights.map(noteType => {
    const fieldsForNoteType = fieldHighlights.filter(f => f.noteType === noteType.label);
    return { noteType, fields: fieldsForNoteType };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Step 1: PDF Configuration</h2>
          <p className="text-gray-600 mb-4">
            Upload a PDF file containing behaviour notes. The PDF should have field labels and note types that we can extract and configure.
            The PDF typically provides 6 fields: behaviour_type, triggers, interventions, poa_notified, time_frequency, evaluation.
          </p>
        </div>
        <button
          onClick={onViewSavedConfigs}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          View Saved Configurations
        </button>
      </div>

      {/* PDF Upload Section */}
      {!pdfText && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload PDF File</h3>
          <p className="text-sm text-gray-600 mb-4">
            Contains behaviour notes with field labels
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
      {pdfFile && !pdfText && !aiLoading && (
        <div className="text-center">
          <button
            onClick={onAnalyzePdf}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-semibold"
          >
            Analyze PDF with AI
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Click to extract text and analyze the PDF structure
          </p>
        </div>
      )}

      {/* AI Loading */}
      {aiLoading && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            <p className="text-sm font-medium text-blue-700">
              AI is analyzing the PDF and identifying field patterns...
            </p>
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      {aiSuggestions && !aiLoading && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-green-800 mb-2">
                ✓ AI Analysis Complete
              </p>
              <p className="text-xs text-green-700 mb-2">
                Found {aiSuggestions.behaviourNoteTypes?.length || 0} behaviour note types,{' '}
                {aiSuggestions.followUpNoteTypes?.length || 0} follow-up note types, and{' '}
                {Object.keys(aiSuggestions.fieldExtractionMarkers || {}).length} PDF field mappings.
                Review and adjust the highlights below.
              </p>
            </div>
            <button
              onClick={() => {}}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* PDF Text Display and Highlighting */}
      {pdfText && (
        <>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Label PDF Sections</h3>
            <p className="text-gray-600 mb-4">
              Select text in the PDF and label what it represents:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li><strong>Note Types</strong> - The type of note (e.g., &quot;Behaviour - Responsive Behaviour&quot;, &quot;Behaviour - Follow up&quot;)</li>
              <li><strong>Field Names</strong> - The labels for fields (e.g., &quot;Type of Behaviour :&quot;, &quot;Interventions :&quot;)</li>
              <li><strong>End Markers</strong> - Text that marks the end of a field (e.g., &quot;Antecedent/Triggers&quot;, &quot;Page&quot;)</li>
            </ul>
            {highlights.some(h => h.aiGenerated) && (
              <button
                onClick={onClearAiHighlights}
                className="mb-4 px-4 py-2 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
              >
                Clear AI-Generated Highlights
              </button>
            )}
          </div>

          <div className="border rounded-lg p-4 bg-gray-50 max-h-[600px] overflow-y-auto">
            <h3 className="font-semibold mb-2 text-gray-900">PDF Content (Behaviour Notes)</h3>
            <p className="text-xs text-gray-600 mb-2">
              Select text to label it. Highlights:
              <span className="ml-2 bg-yellow-100 px-2 py-1 rounded">Note Type</span>
              <span className="ml-2 bg-blue-100 px-2 py-1 rounded">Field Name</span>
              <span className="ml-2 bg-pink-100 px-2 py-1 rounded">End Marker</span>
            </p>
            <div
              ref={textRef}
              onMouseUp={onTextSelection}
              className="whitespace-pre-wrap font-mono text-sm cursor-text"
              dangerouslySetInnerHTML={{ __html: renderHighlightedText() || escapeHtml(pdfText) }}
            />
          </div>

          {/* Highlight Summary */}
          {highlights.length > 0 && (
            <div className="border rounded-lg p-4 bg-white">
              <h3 className="font-semibold mb-3 text-gray-900">Labeled Items Summary</h3>

              {/* Note Types */}
              {noteTypeHighlights.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Note Types ({noteTypeHighlights.length})</h4>
                  <div className="space-y-2">
                    {hierarchicalStructure.map(({ noteType, fields }) => (
                      <div key={noteType.id} className="border-l-4 border-yellow-400 pl-3 py-2 bg-yellow-50 rounded">
                        <div className="font-semibold text-gray-900">{noteType.label}</div>
                        <div className="text-xs text-gray-600 mt-1">&quot;{noteType.text}&quot;</div>
                        {fields.length > 0 && (
                          <div className="mt-2 ml-2 space-y-1">
                            <div className="text-xs font-semibold text-gray-700">Fields:</div>
                            {fields.map(field => {
                              const endMarkers = endMarkerHighlights.filter(
                                e => e.noteType === noteType.label && e.fieldKey === field.fieldKey
                              );
                              return (
                                <div key={field.id} className="pl-2 border-l-2 border-blue-300 bg-blue-50 py-1 px-2 rounded">
                                  <div className="text-xs font-semibold text-blue-900">{field.label}</div>
                                  <div className="text-xs text-gray-600">&quot;{field.text}&quot;</div>
                                  {endMarkers.length > 0 && (
                                    <div className="mt-1 text-xs text-gray-600">
                                      End markers: {endMarkers.map(e => `&quot;{e.text}&quot;`).join(', ')}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unassigned Field Highlights */}
              {fieldHighlights.some(f => !f.noteType) && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Unassigned Fields ({fieldHighlights.filter(f => !f.noteType).length})
                  </h4>
                  <p className="text-xs text-gray-600 mb-2">
                    These fields need to be assigned to a note type
                  </p>
                  <div className="space-y-1">
                    {fieldHighlights
                      .filter(f => !f.noteType)
                      .map(field => (
                        <div key={field.id} className="border-l-4 border-gray-400 pl-3 py-1 bg-gray-50 rounded text-xs">
                          <span className="font-semibold">{field.label}</span> - &quot;{field.text}&quot;
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <button
              onClick={onSkip}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Skip PDF Configuration
            </button>
            <button
              onClick={onContinue}
              disabled={highlights.length === 0}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                highlights.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-cyan-500 text-white hover:bg-cyan-600'
              }`}
            >
              Continue to Excel Configuration
            </button>
          </div>
        </>
      )}

      {/* Skip Option (when no PDF uploaded) */}
      {!pdfFile && (
        <div className="text-center pt-4 border-t">
          <button
            onClick={onSkip}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Skip PDF - Continue to Excel
          </button>
          <p className="text-xs text-gray-500 mt-2">
            You can configure Excel fields without a PDF
          </p>
        </div>
      )}
    </div>
  );
}
