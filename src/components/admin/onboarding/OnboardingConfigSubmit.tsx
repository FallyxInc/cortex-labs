import React from 'react';
import { OnboardingConfig, generateRFC } from '../../../lib/onboardingUtils';

interface ReviewAndSavePageProps {
  mode: 'review' | 'saved';
  config: OnboardingConfig | null;
  chainId: string;
  chainName: string;
  savedConfigs: OnboardingConfig[];
  loadingConfigs: boolean;
  viewingConfig: OnboardingConfig | null;
  editingConfig: OnboardingConfig | null;
  onChainIdChange: (value: string) => void;
  onChainNameChange: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
  onStartNew: () => void;
  onViewConfig: (config: OnboardingConfig) => void;
  onEditConfig: (config: OnboardingConfig) => void;
  onDeleteConfig: (chainId: string) => void;
  onCloseViewConfig: () => void;
}

export function ReviewAndSavePage({
  mode,
  config,
  chainId,
  chainName,
  savedConfigs,
  loadingConfigs,
  viewingConfig,
  editingConfig,
  onChainIdChange,
  onChainNameChange,
  onBack,
  onSave,
  onStartNew,
  onViewConfig,
  onEditConfig,
  onDeleteConfig,
  onCloseViewConfig,
}: ReviewAndSavePageProps) {
  if (mode === 'saved') {
    return (
      <>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Saved Configurations</h2>
              <p className="text-gray-600 mb-4">
                View and manage your saved onboarding configurations.
              </p>
            </div>
            <button
              onClick={onStartNew}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              Create New Configuration
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
                        onClick={() => generateRFC(savedConfig)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                      >
                        Export RFC PDF
                      </button>
                      <button
                        onClick={() => onDeleteConfig(savedConfig.chainId)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </div>
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
                      <p className="text-xs text-green-700 font-medium mb-1">Excel Field Mappings</p>
                      <p className="text-sm font-semibold text-green-900">
                        {Object.keys(savedConfig.excelFieldMappings || {}).length}
                      </p>
                    </div>
                  </div>

                  {Object.keys(savedConfig.noteTypeConfigs).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500 font-medium mb-2">Note Types:</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(savedConfig.noteTypeConfigs).map((noteType) => {
                          const noteConfig = savedConfig.noteTypeConfigs[noteType];
                          const fieldCount = noteConfig?.fields ? Object.keys(noteConfig.fields).length : 0;
                          return (
                            <div
                              key={noteType}
                              className="px-3 py-1 bg-gray-100 rounded text-xs text-gray-700"
                            >
                              {noteConfig?.name || noteType} ({fieldCount} {fieldCount === 1 ? 'field' : 'fields'})
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

        {/* Config Details Modal */}
        {viewingConfig && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  {viewingConfig.chainName} ({viewingConfig.chainId})
                </h3>
                <button
                  onClick={onCloseViewConfig}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Chain Information</h4>
                  <p><strong>Chain ID:</strong> {viewingConfig.chainId}</p>
                  <p><strong>Chain Name:</strong> {viewingConfig.chainName}</p>
                </div>

                <div className="bg-yellow-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Behaviour Note Types</h4>
                  {viewingConfig.behaviourNoteTypes.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {viewingConfig.behaviourNoteTypes.map((type, idx) => (
                        <li key={idx}>{type}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">None configured</p>
                  )}
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Follow-up Note Types</h4>
                  {viewingConfig.followUpNoteTypes.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {viewingConfig.followUpNoteTypes.map((type, idx) => (
                        <li key={idx}>{type}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">None configured</p>
                  )}
                </div>

                {Object.keys(viewingConfig.noteTypeConfigs).length > 0 && (
                  <div className="bg-white rounded-lg p-4 border">
                    <h4 className="font-semibold text-gray-900 mb-2">Field Extraction Configuration (PDF)</h4>
                    {Object.entries(viewingConfig.noteTypeConfigs).map(([noteTypeKey, noteConfig]) => (
                      <div key={noteTypeKey} className="mb-4 last:mb-0">
                        <h5 className="font-semibold text-sm text-gray-800 mb-1">
                          {noteConfig.name} ({noteConfig.isFollowUp ? 'Follow-up' : 'Behaviour'})
                        </h5>
                        {noteConfig.fields && Object.keys(noteConfig.fields).length > 0 ? (
                          <div className="ml-4 space-y-2">
                            {Object.entries(noteConfig.fields).map(([fieldKey, fieldConfig]) => (
                              <div key={fieldKey} className="text-sm">
                                <strong>{fieldKey}:</strong> &quot;{fieldConfig.fieldName}&quot;
                                {fieldConfig.endMarkers && fieldConfig.endMarkers.length > 0 && (
                                  <div className="ml-4 text-xs text-gray-600">
                                    End markers: {fieldConfig.endMarkers.join(', ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="ml-4 text-sm text-gray-500">No fields configured</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {viewingConfig.excelFieldMappings && Object.keys(viewingConfig.excelFieldMappings).length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Excel Field Mappings</h4>
                    <div className="space-y-1">
                      {Object.entries(viewingConfig.excelFieldMappings).map(([fieldKey, mapping]) => (
                        <div key={fieldKey} className="text-sm">
                          <strong>{fieldKey}:</strong> &quot;{mapping.excelColumn}&quot;
                          {mapping.confidence && (
                            <span className="text-xs text-gray-600 ml-2">
                              ({Math.round(mapping.confidence * 100)}% confidence)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Review mode
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {editingConfig ? 'Review Updated Configuration' : 'Step 3: Review & Save'}
        </h2>
        <p className="text-gray-600 mb-4">
          Review the configuration details and save your onboarding configuration.
        </p>
      </div>

      {/* Chain Information */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4">Chain Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chain ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={chainId}
              onChange={(e) => onChainIdChange(e.target.value)}
              placeholder="e.g., kindera"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chain Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={chainName}
              onChange={(e) => onChainNameChange(e.target.value)}
              placeholder="e.g., Kindera Care"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Configuration Summary */}
      {config && (
        <div className="space-y-4">
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <h3 className="font-semibold text-gray-900 mb-2">Behaviour Note Types</h3>
            {config.behaviourNoteTypes.length > 0 ? (
              <ul className="list-disc list-inside">
                {config.behaviourNoteTypes.map((type, idx) => (
                  <li key={idx} className="text-gray-700">{type}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">None configured</p>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-2">Follow-up Note Types</h3>
            {config.followUpNoteTypes.length > 0 ? (
              <ul className="list-disc list-inside">
                {config.followUpNoteTypes.map((type, idx) => (
                  <li key={idx} className="text-gray-700">{type}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">None configured</p>
            )}
          </div>

          {Object.keys(config.noteTypeConfigs).length > 0 && (
            <div className="bg-white rounded-lg p-4 border">
              <h3 className="font-semibold text-gray-900 mb-3">Field Extraction Configuration (PDF)</h3>
              <div className="space-y-3">
                {Object.entries(config.noteTypeConfigs).map(([noteTypeKey, noteConfig]) => (
                  <div key={noteTypeKey} className="border-l-4 border-cyan-400 pl-4 py-2 bg-gray-50 rounded">
                    <h4 className="font-semibold text-sm text-gray-800 mb-2">
                      {noteConfig.name} ({noteConfig.isFollowUp ? 'Follow-up' : 'Behaviour'})
                    </h4>
                    {noteConfig.fields && Object.keys(noteConfig.fields).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(noteConfig.fields).map(([fieldKey, fieldConfig]) => (
                          <div key={fieldKey} className="text-sm text-gray-700">
                            <strong>{fieldKey}:</strong> &quot;{fieldConfig.fieldName}&quot;
                            {fieldConfig.endMarkers && fieldConfig.endMarkers.length > 0 && (
                              <div className="ml-4 text-xs text-gray-600">
                                End markers: {fieldConfig.endMarkers.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No fields configured</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {config.excelFieldMappings && Object.keys(config.excelFieldMappings).length > 0 && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="font-semibold text-gray-900 mb-2">Excel Field Mappings</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(config.excelFieldMappings).map(([fieldKey, mapping]) => (
                  <div key={fieldKey} className="text-sm text-gray-700">
                    <strong>{fieldKey}:</strong> {mapping.excelColumn}
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
          onClick={onBack}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onSave}
          disabled={!chainId || !chainName}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            !chainId || !chainName
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {editingConfig ? 'Update Configuration' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
