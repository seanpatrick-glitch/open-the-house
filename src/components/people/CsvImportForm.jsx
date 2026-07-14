import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const UNIVERSAL_FIELDS = [
  { key: 'name',             label: 'Name' },
  { key: 'email',            label: 'Email' },
  { key: 'phone',            label: 'Phone' },
  { key: 'emergencyContact', label: 'Emergency Contact' },
];

const TOGGLEABLE_LABELS = {
  address:             'Address',
  dateOfBirth:         'Date of Birth',
  tShirtSize:          'T-Shirt Size',
  dietaryRestrictions: 'Dietary Restrictions',
  accessibilityNeeds:  'Accessibility Needs',
};

export default function CsvImportForm({ personType, onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;

  const fileInputRef              = useRef(null);
  const [headers, setHeaders]     = useState([]);
  const [rows, setRows]           = useState([]);
  const [mapping, setMapping]     = useState({});
  const [preview, setPreview]     = useState([]);
  const [step, setStep]           = useState('upload'); // upload | map | confirm
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');

  // Build the list of fields this person type uses
  const typeFields = [
    ...UNIVERSAL_FIELDS,
    ...Object.entries(personType.toggleableFields || {})
      .filter(([, v]) => v)
      .map(([k]) => ({ key: k, label: TOGGLEABLE_LABELS[k] || k })),
    ...(personType.customFields || [])
      .sort((a, b) => a.order - b.order)
      .map(f => ({ key: f.fieldId, label: f.label })),
  ];

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data.length) {
          setError('The CSV file appears to be empty.');
          return;
        }
        const cols = results.meta.fields || [];
        setHeaders(cols);
        setRows(results.data);

        // Auto-map where column header closely matches a field label
        const autoMap = {};
        typeFields.forEach(field => {
          const match = cols.find(col =>
            col.toLowerCase().replace(/[^a-z0-9]/g, '') ===
            field.label.toLowerCase().replace(/[^a-z0-9]/g, '')
          );
          if (match) autoMap[field.key] = match;
        });
        setMapping(autoMap);
        setStep('map');
      },
      error: (err) => {
        setError(`Failed to parse file: ${err.message}`);
      },
    });
  }

  function updateMapping(fieldKey, csvColumn) {
    setMapping(prev => ({ ...prev, [fieldKey]: csvColumn }));
  }

  function buildPreview() {
    return rows.slice(0, 5).map(row => {
      const values = {};
      typeFields.forEach(field => {
        const col = mapping[field.key];
        if (col) values[field.label] = row[col] || '';
      });
      return values;
    });
  }

  function handlePreview() {
    if (!mapping.name) {
      setError('You must map the Name column before continuing.');
      return;
    }
    setError('');
    setPreview(buildPreview());
    setStep('confirm');
  }

  async function handleImport() {
    setImporting(true);
    setError('');
    let successCount = 0;
    let failCount    = 0;

    for (const row of rows) {
      try {
        const fieldValues = {};
        typeFields.forEach(field => {
          const col = mapping[field.key];
          fieldValues[field.key] = col ? (row[col] || '') : '';
        });

        await addDoc(
          collection(db, 'organizations', orgId, 'people'),
          {
            orgId,
            typeId:      personType.id,
            typeLabel:   personType.label,
            uid:         null,
            status:      'active',
            createdBy:   uid,
            createdAt:   serverTimestamp(),
            approvedBy:  uid,
            approvedAt:  serverTimestamp(),
            assignments: [],
            totalHours:  0,
            fieldValues,
          }
        );
        successCount++;
      } catch {
        failCount++;
      }
    }

    setResult({ successCount, failCount, total: rows.length });
    setImporting(false);
  }

  // Step: upload
  if (step === 'upload') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Import {personType.label} Records</h3>
        <p className="text-sm text-gray-500 mb-5">Upload a CSV file. You will map columns to fields in the next step.</p>

        <div
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-sm font-medium text-gray-700 mb-1">Click to select a CSV file</p>
          <p className="text-xs text-gray-400">Comma-separated values (.csv)</p>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <div className="flex items-center gap-3 mt-6">
          <button onClick={onCancel} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Step: map columns
  if (step === 'map') {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Map Columns</h3>
        <p className="text-sm text-gray-500 mb-5">
          Match each field to a column from your CSV. {rows.length} rows found.
        </p>

        <div className="space-y-3 mb-6">
          {typeFields.map(field => (
            <div key={field.key} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 w-40 flex-shrink-0">
                {field.label}
                {field.key === 'name' && <span className="text-red-500 ml-0.5">*</span>}
              </span>
              <select
                value={mapping[field.key] || ''}
                onChange={e => updateMapping(field.key, e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— skip —</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex items-center gap-3">
          <button onClick={handlePreview}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
            Preview Import
          </button>
          <button onClick={() => setStep('upload')}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Back
          </button>
        </div>
      </div>
    );
  }

  // Step: confirm
  if (step === 'confirm') {
    if (result) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Import Complete</h3>
          <div className="space-y-2 mb-6">
            <p className="text-sm text-green-700">{result.successCount} records imported successfully.</p>
            {result.failCount > 0 && (
              <p className="text-sm text-red-600">{result.failCount} records failed to import.</p>
            )}
          </div>
          <button onClick={onSuccess}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
            Done
          </button>
        </div>
      );
    }

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-2xl">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Confirm Import</h3>
        <p className="text-sm text-gray-500 mb-5">
          Previewing the first {preview.length} of {rows.length} rows. Check that the data looks right before importing.
        </p>

        <div className="overflow-x-auto border border-gray-200 rounded-xl mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {Object.keys(preview[0] || {}).map(col => (
                  <th key={col} className="text-left px-3 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {preview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap">{val || <span className="text-gray-300">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleImport} disabled={importing}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
            {importing ? `Importing ${rows.length} records...` : `Import ${rows.length} Records`}
          </button>
          <button onClick={() => setStep('map')}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Back
          </button>
        </div>
      </div>
    );
  }

  return null;
}
