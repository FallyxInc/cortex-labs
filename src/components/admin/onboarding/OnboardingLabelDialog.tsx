import React, { useState } from 'react';
import { Highlight } from './types';

interface LabelDialogProps {
  highlight: Partial<Highlight>;
  existingHighlights: Highlight[];
  onSave: (label: string, labelType: Highlight['labelType'], noteType?: string, fieldKey?: string) => void;
  onCancel: () => void;
}

export function LabelDialog({ highlight, existingHighlights, onSave, onCancel }: LabelDialogProps) {
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
