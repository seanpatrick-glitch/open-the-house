import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const TOGGLEABLE_FIELDS = [
  { key: 'address',              label: 'Address' },
  { key: 'dateOfBirth',          label: 'Date of Birth' },
  { key: 'tShirtSize',           label: 'T-Shirt Size' },
  { key: 'dietaryRestrictions',  label: 'Dietary Restrictions' },
  { key: 'accessibilityNeeds',   label: 'Accessibility Needs' },
];

export default function CreatePersonTypeForm({ onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;

  const [label, setLabel]             = useState('');
  const [description, setDescription] = useState('');
  const [toggledFields, setToggledFields] = useState({});
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  function toggleField(key) {
    setToggledFields(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!label.trim()) {
      setError('A label is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const toggleableFields = {};
      TOGGLEABLE_FIELDS.forEach(f => {
        toggleableFields[f.key] = toggledFields[f.key] ?? false;
      });

      await addDoc(
        collection(db, 'organizations', orgId, 'personTypes'),
        {
          label:           label.trim(),
          description:     description.trim(),
          orgId,
          departmentHeadId: null,
          departmentId:    null,
          createdBy:       uid,
          createdAt:       serverTimestamp(),
          active:          true,
          universalFields: {
            name:             true,
            email:            true,
            phone:            true,
            emergencyContact: true,
          },
          toggleableFields,
          customFields:    [],
        }
      );
      onSuccess();
    } catch (err) {
      console.error('CreatePersonTypeForm error:', err);
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
      <h3 className="text-base font-semibold text-gray-900 mb-5">New Person Type</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Artist, Volunteer, Staff"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional — what is this type of person?"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Universal Fields</p>
          <p className="text-xs text-gray-400 mb-2">Always collected. Cannot be turned off.</p>
          <div className="flex flex-wrap gap-2">
            {['Name', 'Email', 'Phone', 'Emergency Contact'].map(f => (
              <span key={f} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Optional Fields</p>
          <p className="text-xs text-gray-400 mb-3">Turn on the fields you want to collect for this type.</p>
          <div className="space-y-2">
            {TOGGLEABLE_FIELDS.map(field => (
              <div key={field.key} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-700">{field.label}</span>
                <button
                  type="button"
                  onClick={() => toggleField(field.key)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    toggledFields[field.key] ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={toggledFields[field.key] ?? false}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    toggledFields[field.key] ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={handleSave}
          disabled={saving || !label.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save Person Type'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
