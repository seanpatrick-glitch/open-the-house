import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const TOGGLEABLE_LABELS = {
  address:             'Address',
  dateOfBirth:         'Date of Birth',
  tShirtSize:          'T-Shirt Size',
  dietaryRestrictions: 'Dietary Restrictions',
  accessibilityNeeds:  'Accessibility Needs',
};

export default function CreatePersonForm({ onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;

  const [personTypes, setPersonTypes]     = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedType, setSelectedType]   = useState(null);
  const [fieldValues, setFieldValues]     = useState({});
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');

  useEffect(() => {
    if (!orgId) return;
    getDocs(query(
      collection(db, 'organizations', orgId, 'personTypes'),
      where('active', '==', true)
    )).then(snap => {
      const types = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPersonTypes(types);
      if (types.length === 1) {
        setSelectedTypeId(types[0].id);
        setSelectedType(types[0]);
      }
    });
  }, [orgId]);

  function handleTypeChange(typeId) {
    const type = personTypes.find(t => t.id === typeId);
    setSelectedTypeId(typeId);
    setSelectedType(type || null);
    setFieldValues({});
  }

  function setField(key, value) {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!selectedTypeId || !selectedType) {
      setError('Please select a person type.');
      return;
    }
    if (!fieldValues.name?.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addDoc(
        collection(db, 'organizations', orgId, 'people'),
        {
          orgId,
          typeId:      selectedTypeId,
          typeLabel:   selectedType.label,
          uid:         null,
          status:      'active',
          createdBy:   uid,
          createdAt:   serverTimestamp(),
          approvedBy:  uid,
          approvedAt:  serverTimestamp(),
          assignments: [],
          totalHours:  0,
          fieldValues: {
            name:             fieldValues.name?.trim() || '',
            email:            fieldValues.email?.trim() || '',
            phone:            fieldValues.phone?.trim() || '',
            emergencyContact: fieldValues.emergencyContact?.trim() || '',
            ...Object.fromEntries(
              Object.entries(fieldValues).filter(
                ([k]) => !['name','email','phone','emergencyContact'].includes(k)
              ).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
            ),
          },
        }
      );
      onSuccess();
    } catch (err) {
      console.error('CreatePersonForm error:', err);
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  const activeToggleableFields = selectedType
    ? Object.entries(selectedType.toggleableFields || {}).filter(([, v]) => v)
    : [];

  const customFields = selectedType?.customFields || [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
      <h3 className="text-base font-semibold text-gray-900 mb-5">Add Person</h3>

      <div className="space-y-4">

        {/* Type selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Person Type <span className="text-red-500">*</span>
          </label>
          {personTypes.length === 0 ? (
            <p className="text-sm text-gray-400">No person types configured. Add a type in Settings first.</p>
          ) : (
            <select
              value={selectedTypeId}
              onChange={e => handleTypeChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a type...</option>
              {personTypes.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          )}
        </div>

        {selectedType && (
          <>
            {/* Universal fields */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Required Fields</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input type="text" value={fieldValues.name || ''} onChange={e => setField('name', e.target.value)}
                    placeholder="Full name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={fieldValues.email || ''} onChange={e => setField('email', e.target.value)}
                    placeholder="email@example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={fieldValues.phone || ''} onChange={e => setField('phone', e.target.value)}
                    placeholder="Phone number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                  <input type="text" value={fieldValues.emergencyContact || ''} onChange={e => setField('emergencyContact', e.target.value)}
                    placeholder="Name and phone number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>

            {/* Toggleable fields */}
            {activeToggleableFields.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Additional Fields</p>
                <div className="space-y-3">
                  {activeToggleableFields.map(([key]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{TOGGLEABLE_LABELS[key] || key}</label>
                      <input type={key === 'dateOfBirth' ? 'date' : 'text'}
                        value={fieldValues[key] || ''}
                        onChange={e => setField(key, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom fields */}
            {customFields.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Custom Fields</p>
                <div className="space-y-3">
                  {customFields
                    .sort((a, b) => a.order - b.order)
                    .map(field => (
                      <div key={field.fieldId}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        {field.type === 'text' && (
                          <input type="text" value={fieldValues[field.fieldId] || ''}
                            onChange={e => setField(field.fieldId, e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        )}
                        {field.type === 'date' && (
                          <input type="date" value={fieldValues[field.fieldId] || ''}
                            onChange={e => setField(field.fieldId, e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        )}
                        {(field.type === 'select') && (
                          <select value={fieldValues[field.fieldId] || ''}
                            onChange={e => setField(field.fieldId, e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="">Select...</option>
                            {(field.options || []).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}
                        {field.type === 'multiselect' && (
                          <div className="space-y-1">
                            {(field.options || []).map(opt => (
                              <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox"
                                  checked={(fieldValues[field.fieldId] || []).includes(opt)}
                                  onChange={e => {
                                    const current = fieldValues[field.fieldId] || [];
                                    setField(field.fieldId, e.target.checked
                                      ? [...current, opt]
                                      : current.filter(v => v !== opt));
                                  }}
                                  className="rounded border-gray-300" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                        {field.type === 'checkboxGroup' && (
                          <div className="space-y-1">
                            {(field.options || []).map(opt => (
                              <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox"
                                  checked={(fieldValues[field.fieldId] || []).includes(opt)}
                                  onChange={e => {
                                    const current = fieldValues[field.fieldId] || [];
                                    setField(field.fieldId, e.target.checked
                                      ? [...current, opt]
                                      : current.filter(v => v !== opt));
                                  }}
                                  className="rounded border-gray-300" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6">
        <button onClick={handleSave}
          disabled={saving || !selectedTypeId || !fieldValues.name?.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {saving ? 'Saving...' : 'Save Person'}
        </button>
        <button onClick={onCancel}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
