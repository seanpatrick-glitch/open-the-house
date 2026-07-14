import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function CreateSignupTokenForm({ personTypes, onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;

  const [selectedTypeId, setSelectedTypeId] = useState(personTypes[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleCreate() {
    if (!selectedTypeId) {
      setError('Select a person type.');
      return;
    }
    const type = personTypes.find(t => t.id === selectedTypeId);
    if (!type) return;
    setSaving(true);
    setError('');
    try {
      const ref = await addDoc(
        collection(db, 'organizations', orgId, 'signupTokens'),
        {
          orgId,
          typeId:    selectedTypeId,
          typeLabel: type.label,
          createdBy: uid,
          createdAt: serverTimestamp(),
          expiresAt: null,
          active:    true,
        }
      );
      onSuccess({ id: ref.id, typeLabel: type.label });
    } catch (err) {
      console.error('CreateSignupTokenForm error:', err);
      setError('Failed to create link. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-md">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">New Signup Link</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Person Type</label>
          <select value={selectedTypeId} onChange={e => setSelectedTypeId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {personTypes.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex items-center gap-3 mt-4">
        <button onClick={handleCreate} disabled={saving || !selectedTypeId}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {saving ? 'Creating...' : 'Create Link'}
        </button>
        <button onClick={onCancel}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
