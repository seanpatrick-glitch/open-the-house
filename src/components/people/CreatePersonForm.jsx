import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import PersonFieldsEditor, { validatePersonFields, cleanFieldValues } from './PersonFieldsEditor';

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
    const validationError = validatePersonFields(fieldValues);
    if (validationError) {
      setError(validationError);
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
          accountUid:    null,
          accountStatus: 'no_account',
          staff:         false,
          fieldValues: cleanFieldValues(fieldValues),
        }
      );
      onSuccess();
    } catch (err) {
      console.error('CreatePersonForm error:', err);
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

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
          <PersonFieldsEditor personType={selectedType} fieldValues={fieldValues} setField={setField} />
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
