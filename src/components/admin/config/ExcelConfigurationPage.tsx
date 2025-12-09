import React from 'react';
import { ExcelData, ExcelFieldMapping, DataSourceMapping, AIOutputFormat } from '../../../lib/chainConfig';

interface ExcelConfigurationPageProps {
  excelFile: File | null;
  excelData: ExcelData | null;
  excelFieldMappings: Record<string, ExcelFieldMapping>;
  aiLoading: boolean;
  aiSuggestions: AIOutputFormat | null;
  dataSourceMapping: DataSourceMapping | null;
  onExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAnalyzeExcel: () => void;
  onExcelFieldMap: (fieldKey: string, column: string) => void;
  onAddExcelFieldMapping: () => void;
  onRemoveExcelFieldMapping: (fieldKey: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function ExcelConfigurationPage({
  excelFile,
  excelData,
  excelFieldMappings,
  aiLoading,
  aiSuggestions,
  dataSourceMapping,
  onExcelUpload,
  onAnalyzeExcel,
  onExcelFieldMap,
  onAddExcelFieldMapping,
  onRemoveExcelFieldMapping,
  onBack,
  onContinue,
  onSkip,
}: ExcelConfigurationPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Step 2: Excel Configuration</h2>
        <p className="text-gray-600 mb-4">
          Upload an Excel file containing base incident records. The Excel file typically provides 8 fields:
          incident_number, name, date, time, incident_location, room, injuries, incident_type.
          Map the Excel columns to these standard fields.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Data Source Priority:</strong> Excel is always the source of truth for base incident data.
            PDF behaviour notes are matched and merged with Excel records by resident name and time window.
          </p>
        </div>
      </div>

      {/* Excel Upload Section */}
      {!excelData && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Excel File</h3>
          <p className="text-sm text-gray-600 mb-4">
            Contains base incident records (.xls or .xlsx)
          </p>
          <input
            type="file"
            accept=".xls,.xlsx"
            onChange={onExcelUpload}
            className="hidden"
            id="excel-upload"
          />
          <label
            htmlFor="excel-upload"
            className="cursor-pointer inline-block px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Choose Excel File
          </label>
          {excelFile && (
            <p className="mt-4 text-sm text-gray-600">Selected: {excelFile.name}</p>
          )}
        </div>
      )}

      {/* Analyze Excel Button */}
      {excelFile && !excelData && !aiLoading && (
        <div className="text-center">
          <button
            onClick={onAnalyzeExcel}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-semibold"
          >
            Analyze Excel with AI
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Click to extract data and analyze column mappings
          </p>
        </div>
      )}

      {/* AI Loading */}
      {aiLoading && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            <p className="text-sm font-medium text-blue-700">
              AI is analyzing the Excel file and generating field mappings...
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
                AI Analysis Complete
              </p>
              <p className="text-xs text-green-700 mb-2">
                Found {Object.keys(aiSuggestions.excelFieldMappings || {}).length} Excel field mappings.
                Review and adjust the mappings below.
              </p>
              {dataSourceMapping && (
                <div className="mt-2 text-xs text-green-700">
                  <p className="font-semibold">Data Sources:</p>
                  <p><strong>Excel (8 fields):</strong> {dataSourceMapping.excel?.join(', ') || 'N/A'}</p>
                  <p className="text-sm text-gray-600 mt-2 italic">
                    Note: Excel is always the source of truth. PDF fields are merged with Excel records.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Excel Data Display */}
      {excelData && (
        <>
          <div className="border rounded-lg p-4 bg-gray-50 max-h-[600px] overflow-y-auto">
            <h3 className="font-semibold mb-2 text-gray-900">Excel Data (Base Incident Records)</h3>
            <p className="text-xs text-gray-600 mb-2">
              Click column headers to map them to fields. Contains 8 fields: incident_number, name, date, time, incident_location, room, injuries, incident_type
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    {excelData.headers.slice(0, 10).map((header, idx) => {
                      const isMapped = Object.values(excelFieldMappings).some(m => m.excelColumn === header);
                      return (
                        <th
                          key={idx}
                          onClick={() => {
                            const fieldKey = prompt(`Map column "${header}" to which field?\n\nOptions: incident_number, name, date, time, incident_location, room, injuries, incident_type`);
                            if (fieldKey) {
                              onExcelFieldMap(fieldKey, header);
                            }
                          }}
                          className={`border px-2 py-1 text-left font-semibold cursor-pointer hover:bg-blue-200 transition-colors ${
                            isMapped ? 'bg-green-200' : ''
                          }`}
                          title={isMapped ? `Mapped to: ${Object.entries(excelFieldMappings).find(([, m]) => m.excelColumn === header)?.[0] || ''}` : 'Click to map this column'}
                        >
                          {header} {isMapped && '✓'}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {excelData.rows.slice(0, 20).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-b">
                      {excelData.headers.slice(0, 10).map((header, colIdx) => (
                        <td key={colIdx} className="border px-2 py-1">
                          {String(row[header] || '').substring(0, 30)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {excelData.rows.length > 20 && (
                <p className="text-xs text-gray-500 mt-2">
                  Showing first 20 of {excelData.rows.length} rows
                </p>
              )}
            </div>
          </div>

          {/* Excel Field Mappings */}
          <div className="border rounded-lg p-4 bg-green-50">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Excel Field Mappings</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Excel provides 8 fields: incident_number, name, date, time, incident_location, room, injuries, incident_type.
                  Click column headers in the table above to map them.
                </p>
              </div>
              <button
                onClick={onAddExcelFieldMapping}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
              >
                + Add Mapping
              </button>
            </div>

            {Object.keys(excelFieldMappings).length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {Object.entries(excelFieldMappings).map(([fieldKey, mapping]) => (
                  <div key={fieldKey} className="border-l-4 border-green-400 pl-3 py-2 bg-white rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-green-900">{fieldKey}</span>
                          {mapping.confidence && (
                            <span className="text-xs text-gray-500">
                              ({Math.round(mapping.confidence * 100)}% confidence)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Excel Column: <span className="font-mono">{mapping.excelColumn}</span>
                        </div>
                        {mapping.reasoning && (
                          <div className="text-xs text-gray-500 mt-1 italic">
                            {mapping.reasoning}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onRemoveExcelFieldMapping(fieldKey)}
                        className="ml-2 text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                No field mappings yet. Click column headers above or use &quot;+ Add Mapping&quot; to create mappings.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            <button
              onClick={onBack}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back to PDF Configuration
            </button>
            <button
              onClick={onContinue}
              disabled={Object.keys(excelFieldMappings).length === 0}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                Object.keys(excelFieldMappings).length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              Continue to Review
            </button>
          </div>
        </>
      )}

      {/* Skip Option (when no Excel uploaded) */}
      {!excelFile && (
        <div className="flex justify-between items-center pt-4 border-t">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to PDF Configuration
          </button>
          <div className="text-center">
            <button
              onClick={onSkip}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Skip Excel - Continue to Review
            </button>
            <p className="text-xs text-gray-500 mt-2">
              You can configure chain settings without Excel
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
