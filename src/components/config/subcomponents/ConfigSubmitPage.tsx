import { useState, useEffect } from 'react';
import { ChainExtractionConfig, ExtractionType } from '@/types/behaviourProcessingTypes';

interface ChainOption {
  id: string;
  name: string;
  hasConfig: boolean;
}

interface ReviewAndSavePageProps {
  config: ChainExtractionConfig | null;
  chainId: string | null;
  chainName: string | null;
  editingConfig: ChainExtractionConfig | null;
  onChainIdChange: (value: string | null) => void;
  onChainNameChange: (value: string | null) => void;
  onBack: () => void;
  onSave: () => void;
}

export function ReviewAndSavePage({
  config,
  chainId,
  chainName,
  editingConfig,
  onChainIdChange,
  onChainNameChange,
  onBack,
  onSave,
}: ReviewAndSavePageProps) {
  const [availableChains, setAvailableChains] = useState<ChainOption[]>([]);
  const [loadingChains, setLoadingChains] = useState(false);
  const [selectedExistingChain, setSelectedExistingChain] = useState<string>('');
  const [chainSelectionMode, setChainSelectionMode] = useState<'existing' | 'new'>('new');
  const [newChainName, setNewChainName] = useState<string>('');

  // Helper function to sanitize chain name to chainId
  const sanitizeChainId = (name: string): string => {
    return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  };

  // Fetch available chains and align chainId/chainName from selection or existing values
  useEffect(() => {
    const fetchAvailableChains = async () => {
      setLoadingChains(true);
      try {
        const response = await fetch('/api/admin/chains');
        if (response.ok) {
          const data = await response.json();
          setAvailableChains(data.chains || []);
          if (chainId && data.chains) {
            const chain = data.chains.find((c: ChainOption) => c.id === chainId);
            if (chain) {
              onChainIdChange(chain.id);
              onChainNameChange(chain.name);
              setChainSelectionMode('existing');
              setSelectedExistingChain(chain.id);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching chains:', error);
      } finally {
        setLoadingChains(false);
      }
    };

    fetchAvailableChains();
    // Pre-select existing chain values if provided
    if (editingConfig && chainId) {
      setSelectedExistingChain(chainId);
      setChainSelectionMode('existing');
      onChainIdChange(chainId);
    } else if (editingConfig && chainName) {
      setNewChainName(chainName);
      setChainSelectionMode('new');
      const sanitizedId = sanitizeChainId(chainName);
      onChainIdChange(sanitizedId);
      onChainNameChange(chainName);
    } 
    // if (chainId && !editingConfig) {
    //   setSelectedExistingChain(chainId);
    //   setChainSelectionMode('existing');
    //   onChainIdChange(chainId);
    // } else if (chainName && !editingConfig) {
    //   setNewChainName(chainName);
    //   setChainSelectionMode('new');
    //   const sanitizedId = sanitizeChainId(chainName);
    //   onChainIdChange(sanitizedId);
    //   onChainNameChange(chainName);
    // } else if (editingConfig && chainId) {
    //   setSelectedExistingChain(chainId);
    //   setChainSelectionMode('existing');
    //   onChainIdChange(chainId);
    // } else {
    //   onChainIdChange(null);
    // }
    // if (chainName) {
    //   onChainNameChange(chainName);
    // } else {
    //   onChainNameChange(null);
    // }
  }, [chainId, chainName, editingConfig, onChainIdChange, onChainNameChange]);

  const handleChainSelect = (selectedChainId: string) => {
    setSelectedExistingChain(selectedChainId);
    if (selectedChainId) {
      const chain = availableChains.find(c => c.id === selectedChainId);
      if (chain) {
        onChainIdChange(chain.id);
        onChainNameChange(chain.name);
      }
    } else {
      onChainIdChange(null);
      onChainNameChange(null);
    }
  };

  const handleNewChainNameChange = (name: string) => {
    setNewChainName(name);
    const sanitizedId = sanitizeChainId(name);
    onChainIdChange(sanitizedId);
    onChainNameChange(name);
  };

  const handleModeChange = (mode: 'existing' | 'new') => {
    setChainSelectionMode(mode);
    if (mode === 'existing') {
      setNewChainName('');
      if (selectedExistingChain) {
        handleChainSelect(selectedExistingChain);
      } else {
        onChainIdChange(null);
        onChainNameChange(null);
      }
    } else {
      setSelectedExistingChain('');
      if (newChainName) {
        handleNewChainNameChange(newChainName);
      } else {
        onChainIdChange(null);
        onChainNameChange(null);
      }
    }
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {editingConfig ? 'Review & Update Configuration' : 'Review & Save Configuration'}
        </h2>
        <p className="text-gray-600 mb-4">
          Review the configuration details and {editingConfig ? 'update' : 'save'} your chain extraction configuration.
        </p>
      </div>

      {/* Chain Selection */}
      <div className="border rounded-lg p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4">Chain Selection</h3>
        <div className="space-y-4">
          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose an option <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="chainMode"
                  value="new"
                  checked={chainSelectionMode === 'new'}
                  onChange={() => handleModeChange('new')}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Create New Chain</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="chainMode"
                  value="existing"
                  checked={chainSelectionMode === 'existing'}
                  onChange={() => handleModeChange('existing')}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Select Existing Chain</span>
              </label>
            </div>
          </div>

          {/* Create New Chain Form */}
          {chainSelectionMode === 'new' && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chain Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newChainName}
                  onChange={(e) => handleNewChainNameChange(e.target.value)}
                  placeholder="Enter chain name (e.g., Acme Care)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                {newChainName && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                    <span className="text-gray-600">Chain ID will be: </span>
                    <span className="font-mono text-cyan-600">{sanitizeChainId(newChainName)}</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  A new chain will be created with this configuration. This enables a no-code onboarding approach.
                </p>
              </div>
            </div>
          )}

          {/* Select Existing Chain */}
          {chainSelectionMode === 'existing' && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Chain <span className="text-red-500">*</span>
                </label>
                {loadingChains ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500"></div>
                    <span className="text-sm">Loading chains...</span>
                  </div>
                ) : (
                  <select
                    value={selectedExistingChain}
                    onChange={(e) => handleChainSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">-- Select a chain --</option>
                    {availableChains.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name} ({chain.id}) {chain.hasConfig ? '- Has Config' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedExistingChain && availableChains.find(c => c.id === selectedExistingChain)?.hasConfig && (
                  <p className="mt-1 text-sm text-amber-600">
                    This chain already has a configuration. Saving will overwrite the existing configuration.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Summary */}
      {config && (
        <div className="space-y-4">
          {/* Note Types Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <h3 className="font-semibold text-gray-900 mb-2">Behaviour Note Types</h3>
              {config.behaviourNoteTypes.length > 0 ? (
                <ul className="space-y-1">
                  {config.behaviourNoteTypes.map((type, idx) => (
                    <li key={idx} className="text-sm bg-white rounded px-2 py-1">{type}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">None configured</p>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-2">Follow-up Note Types</h3>
              {config.followUpNoteTypes.length > 0 ? (
                <ul className="space-y-1">
                  {config.followUpNoteTypes.map((type, idx) => (
                    <li key={idx} className="text-sm bg-white rounded px-2 py-1">{type}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">None configured</p>
              )}
            </div>
          </div>

          {/* Default Field Extraction Markers */}
          <div className="bg-white rounded-lg p-4 border">
            <h3 className="font-semibold text-gray-900 mb-3">Default Field Extraction Markers (PDF)</h3>
            {renderFieldExtractionMarkers(config.fieldExtractionMarkers)}
            <div className="mt-3 flex gap-2">
              {config.hasTimeFrequency && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Time/Frequency Enabled</span>
              )}
              {config.hasEvaluation && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Evaluation Enabled</span>
              )}
            </div>
          </div>

          {/* Behaviour Note Configs */}
          {renderNoteTypeConfig(
            config.behaviourNoteConfigs,
            'Behaviour Note-Specific Configurations',
            'bg-yellow-50 border-yellow-200'
          )}

          {/* Follow-up Note Configs */}
          {renderNoteTypeConfig(
            config.followUpNoteConfigs,
            'Follow-up Note-Specific Configurations',
            'bg-blue-50 border-blue-200'
          )}

          {/* Excel Field Mappings */}
          {config.excelFieldMappings && Object.keys(config.excelFieldMappings).length > 0 && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="font-semibold text-gray-900 mb-2">Excel Field Mappings</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(config.excelFieldMappings).map(([fieldKey, mapping]) => (
                  <div key={fieldKey} className="bg-white rounded p-2 text-sm">
                    <strong>{fieldKey}:</strong> {mapping.excelColumn}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Junk Markers */}
          {config.junkMarkers && config.junkMarkers.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Junk Markers</h3>
              <div className="flex flex-wrap gap-2">
                {config.junkMarkers.map((marker, idx) => (
                  <span key={idx} className="px-2 py-1 bg-gray-200 rounded text-xs text-gray-700">
                    {marker}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Processing Settings */}
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h3 className="font-semibold text-gray-900 mb-2">Processing Settings</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Matching Window:</strong> {config.matchingWindowHours || 24} hours
              </div>
              <div>
                <strong>Injury Columns:</strong> {config.excelExtraction?.injuryColumns.start || 13} - {config.excelExtraction?.injuryColumns.end || 37}
              </div>
            </div>
          </div>
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
              : chainSelectionMode === 'new'
              ? 'bg-cyan-500 text-white hover:bg-cyan-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {chainSelectionMode === 'new' 
            ? (editingConfig ? 'Update & Create Chain' : 'Create Chain & Save Configuration')
            : (editingConfig ? 'Update Configuration' : 'Save Configuration')
          }
        </button>
      </div>
    </div>
  );
}
