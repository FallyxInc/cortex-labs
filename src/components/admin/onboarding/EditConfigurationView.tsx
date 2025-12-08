import { useState } from 'react';
import { StoredChainExtractionConfig, NoteTypeExtractionConfig, FieldExtractionConfig, ExtractionType } from '../../../lib/processing/types';

interface EditConfigurationViewProps {
  config: StoredChainExtractionConfig;
  chainId: string;
  chainName: string;
  onChainIdChange: (value: string) => void;
  onChainNameChange: (value: string) => void;
  onSave: (updatedConfig: StoredChainExtractionConfig) => void;
  onCancel: () => void;
}

export function EditConfigurationView({
  config,
  chainId,
  chainName,
  onChainIdChange,
  onChainNameChange,
  onSave,
  onCancel,
}: EditConfigurationViewProps) {
  const [editedConfig, setEditedConfig] = useState<StoredChainExtractionConfig>({ ...config });

  // Helper to get all note types with their configs
  const getAllNoteTypesWithConfigs = () => {
    const noteTypes: { name: string; isFollowUp: boolean; config: NoteTypeExtractionConfig | null }[] = [];

    // Behaviour note types
    for (const noteType of editedConfig.behaviourNoteTypes) {
      noteTypes.push({
        name: noteType,
        isFollowUp: false,
        config: editedConfig.behaviourNoteConfigs?.[noteType] || null,
      });
    }

    // Follow-up note types
    for (const noteType of editedConfig.followUpNoteTypes) {
      noteTypes.push({
        name: noteType,
        isFollowUp: true,
        config: editedConfig.followUpNoteConfigs?.[noteType] || null,
      });
    }

    return noteTypes;
  };

  const handleAddNoteType = () => {
    const noteTypeName = prompt('Enter note type name:');
    if (!noteTypeName) return;

    const isFollowUp = confirm('Is this a follow-up note type?');

    setEditedConfig(prev => {
      const newConfig = { ...prev };

      if (isFollowUp) {
        newConfig.followUpNoteTypes = [...prev.followUpNoteTypes, noteTypeName];
        newConfig.followUpNoteConfigs = {
          ...prev.followUpNoteConfigs,
          [noteTypeName]: {
            extractionMarkers: {},
            hasTimeFrequency: false,
            hasEvaluation: false,
          },
        };
      } else {
        newConfig.behaviourNoteTypes = [...prev.behaviourNoteTypes, noteTypeName];
        newConfig.behaviourNoteConfigs = {
          ...prev.behaviourNoteConfigs,
          [noteTypeName]: {
            extractionMarkers: {},
            hasTimeFrequency: false,
            hasEvaluation: false,
          },
        };
      }

      return newConfig;
    });
  };

  const handleRemoveNoteType = (noteTypeName: string, isFollowUp: boolean) => {
    if (!confirm(`Remove note type "${noteTypeName}"?`)) return;

    setEditedConfig(prev => {
      const newConfig = { ...prev };

      if (isFollowUp) {
        newConfig.followUpNoteTypes = prev.followUpNoteTypes.filter(nt => nt !== noteTypeName);
        if (newConfig.followUpNoteConfigs) {
          const newConfigs = { ...newConfig.followUpNoteConfigs };
          delete newConfigs[noteTypeName];
          newConfig.followUpNoteConfigs = newConfigs;
        }
      } else {
        newConfig.behaviourNoteTypes = prev.behaviourNoteTypes.filter(nt => nt !== noteTypeName);
        if (newConfig.behaviourNoteConfigs) {
          const newConfigs = { ...newConfig.behaviourNoteConfigs };
          delete newConfigs[noteTypeName];
          newConfig.behaviourNoteConfigs = newConfigs;
        }
      }

      return newConfig;
    });
  };

  const handleUpdateNoteTypeName = (oldName: string, newName: string, isFollowUp: boolean) => {
    if (!newName || newName === oldName) return;

    setEditedConfig(prev => {
      const newConfig = { ...prev };

      if (isFollowUp) {
        newConfig.followUpNoteTypes = prev.followUpNoteTypes.map(nt => nt === oldName ? newName : nt);
        if (prev.followUpNoteConfigs?.[oldName]) {
          const newConfigs = { ...prev.followUpNoteConfigs };
          newConfigs[newName] = newConfigs[oldName];
          delete newConfigs[oldName];
          newConfig.followUpNoteConfigs = newConfigs;
        }
      } else {
        newConfig.behaviourNoteTypes = prev.behaviourNoteTypes.map(nt => nt === oldName ? newName : nt);
        if (prev.behaviourNoteConfigs?.[oldName]) {
          const newConfigs = { ...prev.behaviourNoteConfigs };
          newConfigs[newName] = newConfigs[oldName];
          delete newConfigs[oldName];
          newConfig.behaviourNoteConfigs = newConfigs;
        }
      }

      return newConfig;
    });
  };

  const handleAddField = (noteTypeName: string, isFollowUp: boolean) => {
    const fieldKey = prompt('Enter field key (e.g., behaviour_type, interventions, description):');
    if (!fieldKey) return;

    const fieldName = prompt('Enter field name (as it appears in PDF):');
    if (!fieldName) return;

    setEditedConfig(prev => {
      const newConfig = { ...prev };
      const configKey = isFollowUp ? 'followUpNoteConfigs' : 'behaviourNoteConfigs';

      const noteConfig = prev[configKey]?.[noteTypeName] || {
        extractionMarkers: {},
        hasTimeFrequency: false,
        hasEvaluation: false,
      };

      newConfig[configKey] = {
        ...prev[configKey],
        [noteTypeName]: {
          ...noteConfig,
          extractionMarkers: {
            ...noteConfig.extractionMarkers,
            [fieldKey]: {
              fieldName,
              endMarkers: [],
            },
          },
        },
      };

      return newConfig;
    });
  };

  const handleRemoveField = (noteTypeName: string, fieldKey: string, isFollowUp: boolean) => {
    if (!confirm(`Remove field "${fieldKey}"?`)) return;

    setEditedConfig(prev => {
      const newConfig = { ...prev };
      const configKey = isFollowUp ? 'followUpNoteConfigs' : 'behaviourNoteConfigs';

      const noteConfig = prev[configKey]?.[noteTypeName];
      if (!noteConfig) return prev;

      const newMarkers = { ...noteConfig.extractionMarkers };
      delete newMarkers[fieldKey as ExtractionType];

      newConfig[configKey] = {
        ...prev[configKey],
        [noteTypeName]: {
          ...noteConfig,
          extractionMarkers: newMarkers,
        },
      };

      return newConfig;
    });
  };

  const handleUpdateFieldName = (noteTypeName: string, fieldKey: string, newFieldName: string, isFollowUp: boolean) => {
    if (!newFieldName) return;

    setEditedConfig(prev => {
      const newConfig = { ...prev };
      const configKey = isFollowUp ? 'followUpNoteConfigs' : 'behaviourNoteConfigs';

      const noteConfig = prev[configKey]?.[noteTypeName];
      if (!noteConfig) return prev;

      newConfig[configKey] = {
        ...prev[configKey],
        [noteTypeName]: {
          ...noteConfig,
          extractionMarkers: {
            ...noteConfig.extractionMarkers,
            [fieldKey]: {
              ...noteConfig.extractionMarkers[fieldKey as ExtractionType]!,
              fieldName: newFieldName,
            },
          },
        },
      };

      return newConfig;
    });
  };

  const handleAddEndMarker = (noteTypeName: string, fieldKey: string, isFollowUp: boolean) => {
    const endMarker = prompt('Enter end marker text:');
    if (!endMarker) return;

    setEditedConfig(prev => {
      const newConfig = { ...prev };
      const configKey = isFollowUp ? 'followUpNoteConfigs' : 'behaviourNoteConfigs';

      const noteConfig = prev[configKey]?.[noteTypeName];
      if (!noteConfig) return prev;

      const currentField = noteConfig.extractionMarkers[fieldKey as ExtractionType];
      if (!currentField) return prev;

      newConfig[configKey] = {
        ...prev[configKey],
        [noteTypeName]: {
          ...noteConfig,
          extractionMarkers: {
            ...noteConfig.extractionMarkers,
            [fieldKey]: {
              ...currentField,
              endMarkers: [...currentField.endMarkers, endMarker],
            },
          },
        },
      };

      return newConfig;
    });
  };

  const handleRemoveEndMarker = (noteTypeName: string, fieldKey: string, index: number, isFollowUp: boolean) => {
    setEditedConfig(prev => {
      const newConfig = { ...prev };
      const configKey = isFollowUp ? 'followUpNoteConfigs' : 'behaviourNoteConfigs';

      const noteConfig = prev[configKey]?.[noteTypeName];
      if (!noteConfig) return prev;

      const currentField = noteConfig.extractionMarkers[fieldKey as ExtractionType];
      if (!currentField) return prev;

      newConfig[configKey] = {
        ...prev[configKey],
        [noteTypeName]: {
          ...noteConfig,
          extractionMarkers: {
            ...noteConfig.extractionMarkers,
            [fieldKey]: {
              ...currentField,
              endMarkers: currentField.endMarkers.filter((_, i) => i !== index),
            },
          },
        },
      };

      return newConfig;
    });
  };

  const handleSave = () => {
    const updatedConfig: StoredChainExtractionConfig = {
      ...editedConfig,
      chainId,
      chainName,
    };
    onSave(updatedConfig);
  };

  const noteTypesWithConfigs = getAllNoteTypesWithConfigs();
  const totalFields = noteTypesWithConfigs.reduce((sum, nt) => {
    return sum + Object.keys(nt.config?.extractionMarkers || {}).length;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Edit Chain Configuration</h2>
        <p className="text-gray-600 mb-4">
          Update the chain information and field extraction configurations.
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
              onChange={(e) => onChainIdChange(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
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
              onChange={(e) => onChainNameChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., Mill Creek Care"
            />
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Configuration Summary</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Behaviour Note Types:</span>{' '}
              {editedConfig.behaviourNoteTypes.length}
            </div>
            <div>
              <span className="font-medium">Follow-up Note Types:</span>{' '}
              {editedConfig.followUpNoteTypes.length}
            </div>
            <div>
              <span className="font-medium">Total Fields:</span>{' '}
              {totalFields}
            </div>
            <div>
              <span className="font-medium">Matching Window:</span>{' '}
              {editedConfig.matchingWindowHours || 24} hours
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Note Types & Field Extraction</h3>
          <button
            onClick={handleAddNoteType}
            className="px-3 py-1.5 text-sm bg-cyan-500 text-white rounded hover:bg-cyan-600"
          >
            + Add Note Type
          </button>
        </div>

        <div className="space-y-6">
          {noteTypesWithConfigs.map(({ name: noteTypeName, isFollowUp, config: noteConfig }) => (
            <div key={noteTypeName} className={`border rounded-lg p-4 ${isFollowUp ? 'bg-blue-50' : 'bg-yellow-50'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={noteTypeName}
                    onChange={(e) => handleUpdateNoteTypeName(noteTypeName, e.target.value, isFollowUp)}
                    className="px-3 py-1.5 border rounded-lg font-semibold bg-white"
                  />
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    isFollowUp
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {isFollowUp ? 'Follow-up' : 'Behaviour'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAddField(noteTypeName, isFollowUp)}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    + Add Field
                  </button>
                  <button
                    onClick={() => handleRemoveNoteType(noteTypeName, isFollowUp)}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="ml-4 space-y-3 mt-3">
                {noteConfig && Object.entries(noteConfig.extractionMarkers).map(([fieldKey, fieldConfig]) => (
                  <div key={fieldKey} className="bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-700">{fieldKey}</span>
                        <input
                          type="text"
                          value={Array.isArray(fieldConfig.fieldName) ? fieldConfig.fieldName[0] : fieldConfig.fieldName}
                          onChange={(e) => handleUpdateFieldName(noteTypeName, fieldKey, e.target.value, isFollowUp)}
                          className="px-2 py-1 text-sm border rounded flex-1 max-w-xs"
                          placeholder="Field name in PDF"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveField(noteTypeName, fieldKey, isFollowUp)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="ml-4 mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">End Markers:</span>
                        <button
                          onClick={() => handleAddEndMarker(noteTypeName, fieldKey, isFollowUp)}
                          className="px-2 py-0.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                          + Add
                        </button>
                      </div>
                      {fieldConfig.endMarkers.length > 0 ? (
                        <div className="space-y-1">
                          {fieldConfig.endMarkers.map((marker, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <span className="text-xs px-2 py-1 bg-gray-100 rounded">{marker}</span>
                              <button
                                onClick={() => handleRemoveEndMarker(noteTypeName, fieldKey, index, isFollowUp)}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                x
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No end markers</p>
                      )}
                    </div>
                  </div>
                ))}
                {(!noteConfig || Object.keys(noteConfig.extractionMarkers).length === 0) && (
                  <p className="text-sm text-gray-400 italic ml-4">No fields configured</p>
                )}
              </div>
            </div>
          ))}

          {noteTypesWithConfigs.length === 0 && (
            <p className="text-center text-gray-400 py-8">No note types configured. Add one to get started.</p>
          )}
        </div>
      </div>

      <div className="flex space-x-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!chainId || !chainName}
          className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Save Changes & Review
        </button>
      </div>
    </div>
  );
}
