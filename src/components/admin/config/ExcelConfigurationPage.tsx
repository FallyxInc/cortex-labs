import React, { useEffect, useMemo, useState } from 'react';
import { ExcelData, AIOutputFormat } from '../../../lib/chainConfig';
import { ExcelExtractionConfig } from '../../../lib/processing/types';

type IncidentColumnKey = keyof ExcelExtractionConfig['incidentColumns'];

interface ExcelConfigurationPageProps {
  excelFile: File | null;
  excelData: ExcelData | null;
  excelExtraction: ExcelExtractionConfig;
  aiSuggestions: AIOutputFormat | null;
  onExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExcelExtractionChange: (config: ExcelExtractionConfig) => void;
  onRemoveExcelFile: () => void;
  isAnalyzing?: boolean;
  onBack: () => void;
  onContinue: () => void;
}

const INCIDENT_FIELD_META: Array<{
  key: IncidentColumnKey;
  label: string;
  hint: string;
}> = [
  { key: 'incident_number', label: 'Incident #', hint: 'Unique incident identifier' },
  { key: 'name', label: 'Resident Name', hint: 'Full resident name' },
  { key: 'date_time', label: 'Incident Date/Time', hint: 'Combined date and time column' },
  { key: 'incident_location', label: 'Incident Location', hint: 'Location or unit of the incident' },
  { key: 'room', label: 'Resident Room', hint: 'Room or bed number' },
  { key: 'incident_type', label: 'Incident Type', hint: 'Category or type of incident' },
];

const BADGE_CLASSES: Record<string, string> = {
  incident_number: 'bg-amber-100 text-amber-900 border-amber-200',
  name: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  date_time: 'bg-blue-100 text-blue-900 border-blue-200',
  incident_location: 'bg-indigo-100 text-indigo-900 border-indigo-200',
  room: 'bg-sky-100 text-sky-900 border-sky-200',
  incident_type: 'bg-purple-100 text-purple-900 border-purple-200',
  injury: 'bg-rose-100 text-rose-900 border-rose-200',
  mapping: 'bg-gray-100 text-gray-800 border-gray-200',
};

const CELL_TONE: Record<string, string> = {
  incident_number: 'bg-amber-50',
  name: 'bg-emerald-50',
  date_time: 'bg-blue-50',
  incident_location: 'bg-indigo-50',
  room: 'bg-sky-50',
  incident_type: 'bg-purple-50',
  injury: 'bg-rose-50',
  selected: 'bg-cyan-100',
};

const DEFAULT_INCIDENT_COLUMNS: ExcelExtractionConfig['incidentColumns'] = {
  incident_number: 'Incident #',
  name: 'Resident Name',
  date_time: 'Incident Date/Time',
  incident_location: 'Incident Location',
  room: 'Resident Room Number',
  incident_type: 'Incident Type',
};

export function ExcelConfigurationPage({
  excelFile,
  excelData,
  excelExtraction,
  aiSuggestions,
  onExcelUpload,
  onExcelExtractionChange,
  onRemoveExcelFile,
  isAnalyzing,
  onBack,
  onContinue,
}: ExcelConfigurationPageProps) {
  const headers = useMemo(() => excelData?.headers || [], [excelData]);
  const rows = excelData?.rows || [];
  const headerDatalistId = 'excel-headers-list';
  const [selectedHeader, setSelectedHeader] = useState<string>('');

  const resolvedExtraction = useMemo<ExcelExtractionConfig>(() => {
    return {
      injuryColumns: excelExtraction?.injuryColumns || { start: 13, end: 37 },
      incidentColumns: {
        ...DEFAULT_INCIDENT_COLUMNS,
        ...(excelExtraction?.incidentColumns || {}),
      },
    };
  }, [excelExtraction]);

  const incidentLookup = useMemo(() => {
    const lookup = new Map<string, IncidentColumnKey[]>();
    Object.entries(resolvedExtraction.incidentColumns).forEach(([key, col]) => {
      if (!col) return;
      const normalized = col.toString().trim().toLowerCase();
      lookup.set(normalized, [...(lookup.get(normalized) || []), key as IncidentColumnKey]);
    });
    return lookup;
  }, [resolvedExtraction.incidentColumns]);

  const columnMeta = useMemo(() => {
    return headers.map((header, index) => {
      const normalized = header?.toString().trim().toLowerCase() || '';
      const badges: Array<{ label: string; tone: string }> = [];
      const incidentTags = incidentLookup.get(normalized);
      incidentTags?.forEach((tag) => {
        badges.push({ label: INCIDENT_FIELD_META.find(f => f.key === tag)?.label || tag, tone: tag });
      });

      if (index >= resolvedExtraction.injuryColumns.start && index <= resolvedExtraction.injuryColumns.end) {
        badges.push({ label: 'Injury columns', tone: 'injury' });
      }

      const isSelected = selectedHeader === header;
      const dominantTone = isSelected
        ? 'selected'
        : badges.find(b => b.tone === 'injury')?.tone || badges[0]?.tone || '';

      return { header, index, badges, tone: dominantTone, isSelected };
    });
  }, [headers, incidentLookup, resolvedExtraction.injuryColumns, selectedHeader]);

  const handleIncidentColumnChange = (fieldKey: IncidentColumnKey, column: string) => {
    const nextConfig: ExcelExtractionConfig = {
      ...resolvedExtraction,
      incidentColumns: {
        ...resolvedExtraction.incidentColumns,
        [fieldKey]: column,
      },
    };
    onExcelExtractionChange(nextConfig);
  };

  const [injuryStartEditing, setInjuryStartEditing] = useState<string | null>(null);
  const [injuryEndEditing, setInjuryEndEditing] = useState<string | null>(null);

  const handleRangeFocus = (key: 'start' | 'end') => {
    const value = key === 'start' 
      ? resolvedExtraction.injuryColumns.start 
      : resolvedExtraction.injuryColumns.end;
    if (key === 'start') setInjuryStartEditing(value.toString());
    else setInjuryEndEditing(value.toString());
  };

  const handleRangeBlur = (key: 'start' | 'end') => {
    const raw = key === 'start' ? injuryStartEditing : injuryEndEditing;
    const parsed = raw === '' || raw === null ? 0 : Number(raw);
    const value = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;

    const nextConfig: ExcelExtractionConfig = {
      ...resolvedExtraction,
      injuryColumns: {
        ...resolvedExtraction.injuryColumns,
        [key]: value,
      },
    };
    onExcelExtractionChange(nextConfig);
    
    if (key === 'start') setInjuryStartEditing(null);
    else setInjuryEndEditing(null);
  };

  const missingIncidentFields = INCIDENT_FIELD_META.filter(
    (f) => !resolvedExtraction.incidentColumns[f.key]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Step 2: Excel Configuration</h2>
            <p className="text-sm text-gray-600">
              Configure incident columns and injury window, then upload and review the full Excel sheet with live highlights.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2">
            {excelFile && (
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <span className="rounded bg-gray-100 px-2 py-1 border border-gray-200">File: {excelFile.name}</span>
                <button
                  onClick={onRemoveExcelFile}
                  className="rounded bg-red-500 px-2 py-1 text-white hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            )}
            {isAnalyzing && (
              <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 border border-cyan-200">
                Analyzing Excel File with AI to determine column mappings...
              </span>
            )}
            {!isAnalyzing && aiSuggestions?.excelFieldMappings && (
              <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800 border border-green-200">
                AI suggestions ready
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold pl-1 text-gray-900">Core incident columns</h3>
              </div>
              {missingIncidentFields.length > 0 && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                  {missingIncidentFields.length} missing
                </span>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {INCIDENT_FIELD_META.map((field) => (
                <div key={field.key} className="rounded border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{field.label}</p>
                      <p className="text-xs text-gray-600">{field.hint}</p>
                    </div>
                    <span
                      className={`ml-2 inline-flex items-center rounded px-2 py-1 text-[11px] font-medium border ${
                        resolvedExtraction.incidentColumns[field.key]
                          ? BADGE_CLASSES[field.key]
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {resolvedExtraction.incidentColumns[field.key] || 'Not set'}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      list={headerDatalistId}
                      value={resolvedExtraction.incidentColumns[field.key]}
                      onChange={(e) => handleIncidentColumnChange(field.key, e.target.value)}
                      placeholder="Type or pick a column header"
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    {selectedHeader && (
                      <button
                        onClick={() => handleIncidentColumnChange(field.key, selectedHeader)}
                        className="rounded bg-cyan-500 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-600"
                      >
                        Use column
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 text-sm">Injury columns</h4>
                <span className="text-[11px] text-gray-500">Zero-based indices</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-600">
                  Start (col #)
                  <input
                    type="number"
                    min={0}
                    value={injuryStartEditing ?? resolvedExtraction.injuryColumns.start}
                    onChange={(e) => setInjuryStartEditing(e.target.value)}
                    onFocus={() => handleRangeFocus('start')}
                    onBlur={() => handleRangeBlur('start')}
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  End (col #)
                  <input
                    type="number"
                    min={0}
                    value={injuryEndEditing ?? resolvedExtraction.injuryColumns.end}
                    onChange={(e) => setInjuryEndEditing(e.target.value)}
                    onFocus={() => handleRangeFocus('end')}
                    onBlur={() => handleRangeBlur('end')}
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-600">
                Columns between start and end (inclusive) are scanned for &quot;Y&quot; to build the injuries list.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {!excelData && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <h3 className="font-semibold text-gray-900">Upload Reference Excel File</h3>
              <p className="text-xs text-gray-600">
                Upload the Excel file to preview every column with live highlights and column numbers.
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
                className="mt-2 cursor-pointer inline-flex items-center rounded-lg bg-green-500 px-5 py-2 text-white text-sm hover:bg-green-600"
              >
                Upload Excel
              </label>
              {excelFile && (
                <span className="text-xs text-gray-600">Selected: {excelFile.name}</span>
              )}
            </div>
          </div>
        )}

        {excelData && isAnalyzing && (
          <div className="rounded-lg border bg-white p-6 shadow-sm flex items-center gap-3 text-sm text-cyan-800">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            Analyzing Excel File with AI to determine column mappings..
          </div>
        )}

        {excelData && !isAnalyzing && (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Excel Detection Preview</h3>
                <p className="text-xs text-gray-600">Click on columns, then use buttons above to assign fields.</p>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded border-2 border-cyan-400 bg-cyan-100 px-2 py-0.5 text-cyan-900 font-medium">
                  Selected
                </span>
                {INCIDENT_FIELD_META.map((f) => (
                  <span
                    key={f.key}
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${BADGE_CLASSES[f.key]}`}
                  >
                    {f.label}
                  </span>
                ))}
                <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${BADGE_CLASSES.injury}`}>
                  Injury columns
                </span>
              </div>
            </div>

            <div className="mt-3 overflow-auto rounded border">
              <table className="min-w-max text-xs">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="text-gray-600">
                    <th className="sticky left-0 bg-gray-50 px-2 py-2 border-b border-r text-left">#</th>
                    {columnMeta.map((col) => (
                      <th
                        key={`num-${col.index}`}
                        onClick={() => setSelectedHeader(col.isSelected ? '' : col.header)}
                        className={`px-2 py-2 border-b border-r text-left font-semibold text-[11px] cursor-pointer transition-colors ${
                            `${CELL_TONE[col.tone] || ''} hover:bg-cyan-50`
                        }`}
                      >
                        {col.index}
                      </th>
                    ))}
                  </tr>
                  <tr className="text-gray-800">
                    <th className="sticky left-0 bg-gray-50 px-2 py-2 border-b border-r text-left font-semibold">Header</th>
                    {columnMeta.map((col) => (
                      <th
                        key={`head-${col.index}`}
                        onClick={() => setSelectedHeader(col.isSelected ? '' : col.header)}
                        className={`px-2 py-2 border-b border-r text-left align-top cursor-pointer transition-colors ${
                            `${CELL_TONE[col.tone] || ''} hover:bg-cyan-50`
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <span className={`font-semibold ${col.isSelected ? 'text-cyan-900' : ''}`}>
                            {col.header}
                            {col.isSelected && <span className="ml-1 text-cyan-600">✓</span>}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {col.badges.map((badge, idx) => (
                              <span
                                key={`${badge.label}-${idx}`}
                                className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${BADGE_CLASSES[badge.tone] || BADGE_CLASSES.mapping}`}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={`row-${rowIdx}`} className="border-b last:border-b-0">
                      <td className="sticky left-0 bg-white px-2 py-1 border-r text-[11px] font-medium text-gray-700">
                        {rowIdx + 1}
                      </td>
                      {columnMeta.map((col) => (
                        <td
                          key={`cell-${rowIdx}-${col.index}`}
                          onClick={() => setSelectedHeader(col.isSelected ? '' : col.header)}
                          className={`px-2 py-1 border-r align-top cursor-pointer transition-colors ${
                            col.isSelected
                              ? 'bg-cyan-100'
                              : `${CELL_TONE[col.tone] || ''} hover:bg-cyan-50`
                          }`}
                        >
                          {String((row as Record<string, unknown>)[col.header] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      <datalist id={headerDatalistId}>
        {headers.map((header, idx) => (
          <option key={`header-${idx}`} value={header} />
        ))}
      </datalist>

      <div className="flex flex-col gap-4 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to PDF Configuration
          </button>
          <button
            onClick={onContinue}
            className="px-6 py-3 rounded-lg font-semibold transition-colors bg-green-500 text-white hover:bg-green-600"
          >
            Continue to Review
          </button>
        </div>
      </div>
    </div>
  );
}
