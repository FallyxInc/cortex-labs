import { StoredChainExtractionConfig, ExtractionType } from '../../../lib/processing/types';

interface ConfigManagementPageProps {
  savedConfigs: StoredChainExtractionConfig[];
  loadingConfigs: boolean;
  viewingConfig: StoredChainExtractionConfig | null;
  onStartNew: () => void;
  onViewConfig: (config: StoredChainExtractionConfig) => void;
  onEditConfig: (config: StoredChainExtractionConfig) => void;
  onDeleteConfig: (chainId: string) => void;
  onCloseViewConfig: () => void;
  onExportConfig: (config: StoredChainExtractionConfig) => void;
}

export function ConfigManagementPage({
  savedConfigs,
  loadingConfigs,
  viewingConfig,
  onStartNew,
  onViewConfig,
  onEditConfig,
  onDeleteConfig,
  onCloseViewConfig,
  onExportConfig,
}: ConfigManagementPageProps) {

  // Render field extraction markers
  const renderFieldExtractionMarkers = (markers: Partial<Record<ExtractionType, { fieldName: string | string[]; endMarkers: string[] }>>) => {
    const entries = Object.entries(markers);
    if (entries.length === 0) {
      return <p className="text-gray-500 text-sm">No field extraction markers configured</p>;
    }

    return (
      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="bg-gray-50 rounded p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">{key}</span>
              <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">
                {Array.isArray(value.fieldName) ? value.fieldName.join(' | ') : value.fieldName}
              </span>
            </div>
            {value.endMarkers && value.endMarkers.length > 0 && (
              <div className="mt-1 text-xs text-gray-600">
                End markers: {value.endMarkers.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render note type config
  const renderNoteTypeConfig = (
    configs: Record<string, { extractionMarkers: Partial<Record<ExtractionType, { fieldName: string | string[]; endMarkers: string[] }>>; hasTimeFrequency?: boolean; hasEvaluation?: boolean }> | undefined,
    title: string,
    colorClass: string
  ) => {
    if (!configs || Object.keys(configs).length === 0) {
      return null;
    }

    return (
      <div className={`${colorClass} rounded-lg p-4 border`}>
        <h4 className="font-semibold text-gray-900 mb-3">{title}</h4>
        <div className="space-y-4">
          {Object.entries(configs).map(([noteType, noteConfig]) => (
            <div key={noteType} className="bg-white rounded-lg p-3 border">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium text-gray-800">{noteType}</h5>
                <div className="flex gap-1">
                  {noteConfig.hasTimeFrequency && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Time/Freq</span>
                  )}
                  {noteConfig.hasEvaluation && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Evaluation</span>
                  )}
                </div>
              </div>
              {renderFieldExtractionMarkers(noteConfig.extractionMarkers)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Comprehensive config view modal
  const renderConfigDetailsModal = (displayConfig: StoredChainExtractionConfig) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">
            {displayConfig.chainName} ({displayConfig.chainId})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => onExportConfig(displayConfig)}
              className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              Export JSON
            </button>
            <button
              onClick={onCloseViewConfig}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Chain Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Chain Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Chain ID:</strong> {displayConfig.chainId}</div>
              <div><strong>Chain Name:</strong> {displayConfig.chainName}</div>
              <div><strong>Matching Window:</strong> {displayConfig.matchingWindowHours || 24} hours</div>
              <div><strong>Injury Columns:</strong> {displayConfig.injuryColumns?.start} - {displayConfig.injuryColumns?.end}</div>
            </div>
          </div>

          {/* Note Types */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <h4 className="font-semibold text-gray-900 mb-2">Behaviour Note Types</h4>
              {displayConfig.behaviourNoteTypes.length > 0 ? (
                <ul className="space-y-1">
                  {displayConfig.behaviourNoteTypes.map((type, idx) => (
                    <li key={idx} className="text-sm bg-white rounded px-2 py-1">{type}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">None configured</p>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-gray-900 mb-2">Follow-up Note Types</h4>
              {displayConfig.followUpNoteTypes.length > 0 ? (
                <ul className="space-y-1">
                  {displayConfig.followUpNoteTypes.map((type, idx) => (
                    <li key={idx} className="text-sm bg-white rounded px-2 py-1">{type}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">None configured</p>
              )}
              {displayConfig.extraFollowUpNoteTypes && displayConfig.extraFollowUpNoteTypes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="text-xs text-blue-700 font-medium mb-1">Extra Follow-up Types:</p>
                  {displayConfig.extraFollowUpNoteTypes.map((type, idx) => (
                    <span key={idx} className="text-xs bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 mr-1">{type}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Default Field Extraction Markers */}
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="font-semibold text-gray-900 mb-3">Default Field Extraction Markers (PDF)</h4>
            {renderFieldExtractionMarkers(displayConfig.fieldExtractionMarkers)}
            <div className="mt-3 flex gap-2">
              {displayConfig.hasTimeFrequency && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Time/Frequency Enabled</span>
              )}
              {displayConfig.hasEvaluation && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Evaluation Enabled</span>
              )}
            </div>
          </div>

          {/* Behaviour Note Configs */}
          {renderNoteTypeConfig(
            displayConfig.behaviourNoteConfigs,
            'Behaviour Note-Specific Configurations',
            'bg-yellow-50 border-yellow-200'
          )}

          {/* Follow-up Note Configs */}
          {renderNoteTypeConfig(
            displayConfig.followUpNoteConfigs,
            'Follow-up Note-Specific Configurations',
            'bg-blue-50 border-blue-200'
          )}

          {/* Excel Field Mappings */}
          {displayConfig.excelFieldMappings && Object.keys(displayConfig.excelFieldMappings).length > 0 && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-gray-900 mb-3">Excel Field Mappings</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(displayConfig.excelFieldMappings).map(([fieldKey, mapping]) => (
                  <div key={fieldKey} className="bg-white rounded p-2 text-sm">
                    <strong>{fieldKey}:</strong> {mapping.excelColumn}
                    {mapping.confidence && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({Math.round(mapping.confidence * 100)}% confidence)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          {(displayConfig.createdAt || displayConfig.updatedAt) && (
            <div className="text-xs text-gray-500 pt-2 border-t">
              {displayConfig.createdAt && <span>Created: {new Date(displayConfig.createdAt).toLocaleString()}</span>}
              {displayConfig.updatedAt && displayConfig.updatedAt !== displayConfig.createdAt && (
                <span className="ml-4">Updated: {new Date(displayConfig.updatedAt).toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Chain Configurations</h2>
            <p className="text-gray-600 mb-4">
              Manage your chain extraction configurations.
            </p>
          </div>
          <button
            onClick={onStartNew}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            + Create New Configuration
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
              onClick={onStartNew}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
            >
              Create Your First Configuration
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
                          <span> &bull; Updated: {new Date(savedConfig.updatedAt).toLocaleDateString()}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onViewConfig(savedConfig)}
                      className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 text-sm"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => onEditConfig(savedConfig)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onExportConfig(savedConfig)}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={() => onDeleteConfig(savedConfig.chainId)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="bg-yellow-50 rounded p-3">
                    <p className="text-xs text-yellow-700 font-medium mb-1">Behaviour Note Types</p>
                    <p className="text-sm font-semibold text-yellow-900">{savedConfig.behaviourNoteTypes.length}</p>
                  </div>
                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-xs text-blue-700 font-medium mb-1">Follow-up Note Types</p>
                    <p className="text-sm font-semibold text-blue-900">{savedConfig.followUpNoteTypes.length}</p>
                  </div>
                  <div className="bg-purple-50 rounded p-3">
                    <p className="text-xs text-purple-700 font-medium mb-1">Field Markers</p>
                    <p className="text-sm font-semibold text-purple-900">
                      {Object.keys(savedConfig.fieldExtractionMarkers || {}).length}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded p-3">
                    <p className="text-xs text-green-700 font-medium mb-1">Excel Mappings</p>
                    <p className="text-sm font-semibold text-green-900">
                      {Object.keys(savedConfig.excelFieldMappings || {}).length}
                    </p>
                  </div>
                </div>

                {/* Note type badges */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500 font-medium mb-2">Configured Note Types:</p>
                  <div className="flex flex-wrap gap-2">
                    {savedConfig.behaviourNoteTypes.map((noteType) => (
                      <span
                        key={noteType}
                        className="px-2 py-1 bg-yellow-100 rounded text-xs text-yellow-800"
                      >
                        {noteType}
                      </span>
                    ))}
                    {savedConfig.followUpNoteTypes.map((noteType) => (
                      <span
                        key={noteType}
                        className="px-2 py-1 bg-blue-100 rounded text-xs text-blue-800"
                      >
                        {noteType}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Config Details Modal */}
      {viewingConfig && renderConfigDetailsModal(viewingConfig)}
    </>
  );
}
