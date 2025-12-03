import React, { useState } from 'react';
import { OnboardingConfig } from '../../../lib/onboardingUtils';

interface EditConfigurationViewProps {
  config: OnboardingConfig;
  chainId: string;
  chainName: string;
  onChainIdChange: (value: string) => void;
  onChainNameChange: (value: string) => void;
  onSave: (updatedConfig: OnboardingConfig) => void;
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
  const [editedConfig, setEditedConfig] = useState<OnboardingConfig>({ ...config });
  const [editingNoteType, setEditingNoteType] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ noteTypeKey: string; fieldKey: string } | null>(null);

  const handleAddNoteType = () => {
    const noteTypeName = prompt('Enter note type name:');
    if (!noteTypeName) return;

    const isFollowUp = confirm('Is this a follow-up note type?');
    const noteTypeKey = `note_${Date.now()}`;

    setEditedConfig(prev => ({
      ...prev,
      noteTypeConfigs: {
        ...prev.noteTypeConfigs,
        [noteTypeKey]: {
          name: noteTypeName,
          isFollowUp,
          fields: {},
        },
      },
      ...(isFollowUp
        ? { followUpNoteTypes: [...prev.followUpNoteTypes, noteTypeName] }
        : { behaviourNoteTypes: [...prev.behaviourNoteTypes, noteTypeName] }),
    }));
  };

  const handleRemoveNoteType = (noteTypeKey: string, noteTypeName: string) => {
    if (!confirm(`Remove note type "${noteTypeName}"?`)) return;

    const noteTypeConfig = editedConfig.noteTypeConfigs[noteTypeKey];
    setEditedConfig(prev => {
      const newConfig = { ...prev };
      delete newConfig.noteTypeConfigs[noteTypeKey];

      if (noteTypeConfig.isFollowUp) {
        newConfig.followUpNoteTypes = prev.followUpNoteTypes.filter(nt => nt !== noteTypeName);
      } else {
        newConfig.behaviourNoteTypes = prev.behaviourNoteTypes.filter(nt => nt !== noteTypeName);
      }

      return newConfig;
    });
  };

  const handleUpdateNoteTypeName = (noteTypeKey: string, oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;

    const noteTypeConfig = editedConfig.noteTypeConfigs[noteTypeKey];
    setEditedConfig(prev => {
      const newConfig = { ...prev };
      newConfig.noteTypeConfigs[noteTypeKey] = {
        ...noteTypeConfig,
        name: newName,
      };

      if (noteTypeConfig.isFollowUp) {
        newConfig.followUpNoteTypes = prev.followUpNoteTypes.map(nt => nt === oldName ? newName : nt);
      } else {
        newConfig.behaviourNoteTypes = prev.behaviourNoteTypes.map(nt => nt === oldName ? newName : nt);
      }

      return newConfig;
    });
  };

  const handleAddField = (noteTypeKey: string) => {
    const fieldKey = prompt('Enter field key (e.g., behaviour_type, interventions):');
    if (!fieldKey) return;

    const fieldName = prompt('Enter field name (as it appears in PDF):');
    if (!fieldName) return;

    setEditedConfig(prev => ({
      ...prev,
      noteTypeConfigs: {
        ...prev.noteTypeConfigs,
        [noteTypeKey]: {
          ...prev.noteTypeConfigs[noteTypeKey],
          fields: {
            ...prev.noteTypeConfigs[noteTypeKey].fields,
            [fieldKey]: {
              fieldName,
              endMarkers: [],
            },
          },
        },
      },
    }));
  };

  const handleRemoveField = (noteTypeKey: string, fieldKey: string) => {
    if (!confirm(`Remove field "${fieldKey}"?`)) return;

    setEditedConfig(prev => {
      const newConfig = { ...prev };
      const fields = { ...newConfig.noteTypeConfigs[noteTypeKey].fields };
      delete fields[fieldKey];
      newConfig.noteTypeConfigs[noteTypeKey] = {
        ...newConfig.noteTypeConfigs[noteTypeKey],
        fields,
      };
      return newConfig;
    });
  };

  const handleUpdateFieldName = (noteTypeKey: string, fieldKey: string, newFieldName: string) => {
    if (!newFieldName) return;

    setEditedConfig(prev => ({
      ...prev,
      noteTypeConfigs: {
        ...prev.noteTypeConfigs,
        [noteTypeKey]: {
          ...prev.noteTypeConfigs[noteTypeKey],
          fields: {
            ...prev.noteTypeConfigs[noteTypeKey].fields,
            [fieldKey]: {
              ...prev.noteTypeConfigs[noteTypeKey].fields[fieldKey],
              fieldName: newFieldName,
            },
          },
        },
      },
    }));
  };

  const handleAddEndMarker = (noteTypeKey: string, fieldKey: string) => {
    const endMarker = prompt('Enter end marker text:');
    if (!endMarker) return;

    setEditedConfig(prev => ({
      ...prev,
      noteTypeConfigs: {
        ...prev.noteTypeConfigs,
        [noteTypeKey]: {
          ...prev.noteTypeConfigs[noteTypeKey],
          fields: {
            ...prev.noteTypeConfigs[noteTypeKey].fields,
            [fieldKey]: {
              ...prev.noteTypeConfigs[noteTypeKey].fields[fieldKey],
              endMarkers: [...prev.noteTypeConfigs[noteTypeKey].fields[fieldKey].endMarkers, endMarker],
            },
          },
        },
      },
    }));
  };

  const handleRemoveEndMarker = (noteTypeKey: string, fieldKey: string, index: number) => {
    setEditedConfig(prev => ({
      ...prev,
      noteTypeConfigs: {
        ...prev.noteTypeConfigs,
        [noteTypeKey]: {
          ...prev.noteTypeConfigs[noteTypeKey],
          fields: {
            ...prev.noteTypeConfigs[noteTypeKey].fields,
            [fieldKey]: {
              ...prev.noteTypeConfigs[noteTypeKey].fields[fieldKey],
              endMarkers: prev.noteTypeConfigs[noteTypeKey].fields[fieldKey].endMarkers.filter((_, i) => i !== index),
            },
          },
        },
      },
    }));
  };

  const handleSave = () => {
    const updatedConfig: OnboardingConfig = {
      ...editedConfig,
      chainId,
      chainName,
    };
    onSave(updatedConfig);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Edit Chain Configuration</h2>
        <p className="text-gray-600 mb-4">
          Update the chain information and field configurations.
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
              onChange={(e) => onChainIdChange(e.target.value)}
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
              <span className="font-medium">Total Note Types:</span>{' '}
              {Object.keys(editedConfig.noteTypeConfigs).length}
            </div>
            <div>
              <span className="font-medium">Total Fields:</span>{' '}
              {Object.values(editedConfig.noteTypeConfigs).reduce(
                (sum, config) => sum + Object.keys(config.fields).length,
                0
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Note Types & Fields</h3>
          <button
            onClick={handleAddNoteType}
            className="px-3 py-1.5 text-sm bg-cyan-500 text-white rounded hover:bg-cyan-600"
          >
            + Add Note Type
          </button>
        </div>

        <div className="space-y-6">
          {Object.entries(editedConfig.noteTypeConfigs).map(([noteTypeKey, noteTypeConfig]) => (
            <div key={noteTypeKey} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={noteTypeConfig.name}
                    onChange={(e) => handleUpdateNoteTypeName(noteTypeKey, noteTypeConfig.name, e.target.value)}
                    className="px-3 py-1.5 border rounded-lg font-semibold bg-white"
                  />
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    noteTypeConfig.isFollowUp
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {noteTypeConfig.isFollowUp ? 'Follow-up' : 'Behaviour'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleAddField(noteTypeKey)}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    + Add Field
                  </button>
                  <button
                    onClick={() => handleRemoveNoteType(noteTypeKey, noteTypeConfig.name)}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="ml-4 space-y-3 mt-3">
                {Object.entries(noteTypeConfig.fields).map(([fieldKey, fieldConfig]) => (
                  <div key={fieldKey} className="bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-700">{fieldKey}</span>
                        <input
                          type="text"
                          value={fieldConfig.fieldName}
                          onChange={(e) => handleUpdateFieldName(noteTypeKey, fieldKey, e.target.value)}
                          className="px-2 py-1 text-sm border rounded flex-1 max-w-xs"
                          placeholder="Field name in PDF"
                        />
                      </div>
                      <button
                        onClick={() => handleRemoveField(noteTypeKey, fieldKey)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="ml-4 mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">End Markers:</span>
                        <button
                          onClick={() => handleAddEndMarker(noteTypeKey, fieldKey)}
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
                                onClick={() => handleRemoveEndMarker(noteTypeKey, fieldKey, index)}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                ×
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
                {Object.keys(noteTypeConfig.fields).length === 0 && (
                  <p className="text-sm text-gray-400 italic ml-4">No fields configured</p>
                )}
              </div>
            </div>
          ))}

          {Object.keys(editedConfig.noteTypeConfigs).length === 0 && (
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
