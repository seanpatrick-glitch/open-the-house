import { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PERSON_STATUS } from '../models/people';
import AssignmentsPanel from '../components/people/AssignmentsPanel';
import HoursPanel from '../components/people/HoursPanel';

const TOGGLEABLE_LABELS = {
  address:             'Address',
  dateOfBirth:         'Date of Birth',
  tShirtSize:          'T-Shirt Size',
  dietaryRestrictions: 'Dietary Restrictions',
  accessibilityNeeds:  'Accessibility Needs',
};

const STATUS_STYLES = {
  [PERSON_STATUS.PENDING]:  'bg-amber-100 text-amber-700',
  [PERSON_STATUS.ACTIVE]:   'bg-green-100 text-green-700',
  [PERSON_STATUS.INACTIVE]: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS = {
  [PERSON_STATUS.PENDING]:  'Pending',
  [PERSON_STATUS.ACTIVE]:   'Active',
  [PERSON_STATUS.INACTIVE]: 'Inactive',
};

export default function PersonProfileView({ personId, onBack }) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const role  = userProfile?.role;

  const isStaff = ['admin', 'secondaryAdmin', 'departmentHead'].includes(role);

  const [person, setPerson]         = useState(null);
  const [personType, setPersonType] = useState(null);
  const [internalData, setInternalData] = useState(null);
  const [loading, setLoading]       = useState(true);

  const [tagInput, setTagInput]     = useState('');
  const [tags, setTags]             = useState([]);
  const [notes, setNotes]           = useState('');
  const [savingInternal, setSavingInternal] = useState(false);
  const [internalSaved, setInternalSaved]   = useState(false);

  useEffect(() => {
    if (!orgId || !personId) return;

    const unsub = onSnapshot(
      doc(db, 'organizations', orgId, 'people', personId),
      async (snap) => {
        if (!snap.exists()) { setLoading(false); return; }
        const data = { id: snap.id, ...snap.data() };
        setPerson(data);

        // Load person type for field labels
        if (data.typeId) {
          const typeSnap = await getDoc(
            doc(db, 'organizations', orgId, 'personTypes', data.typeId)
          );
          if (typeSnap.exists()) setPersonType({ id: typeSnap.id, ...typeSnap.data() });
        }

        setLoading(false);
      }
    );

    // Load internal data for staff only
    if (isStaff) {
      const internalUnsub = onSnapshot(
        doc(db, 'organizations', orgId, 'people', personId, 'internalData', 'notes'),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setInternalData(d);
            setTags(d.tags || []);
            setNotes(d.notes || '');
          } else {
            setTags([]);
            setNotes('');
          }
        }
      );
      return () => { unsub(); internalUnsub(); };
    }

    return () => unsub();
  }, [orgId, personId, isStaff]);

  async function saveInternalData() {
    if (!orgId || !personId) return;
    setSavingInternal(true);
    try {
      await setDoc(
        doc(db, 'organizations', orgId, 'people', personId, 'internalData', 'notes'),
        {
          tags,
          notes,
          lastUpdatedBy: userProfile.uid,
          lastUpdatedAt: serverTimestamp(),
        }
      );
      setInternalSaved(true);
      setTimeout(() => setInternalSaved(false), 2000);
    } catch (err) {
      console.error('Error saving internal data:', err);
    } finally {
      setSavingInternal(false);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags(prev => [...prev, t]);
    setTagInput('');
  }

  function removeTag(tag) {
    setTags(prev => prev.filter(t => t !== tag));
  }

  if (loading) return <div className="p-6 text-gray-500 text-sm">Loading...</div>;
  if (!person) return <div className="p-6 text-gray-500 text-sm">Person not found.</div>;

  // Build field display list from type config
  const universalKeys = ['name', 'email', 'phone', 'emergencyContact'];
  const universalLabels = { name: 'Name', email: 'Email', phone: 'Phone', emergencyContact: 'Emergency Contact' };

  const activeToggleable = personType
    ? Object.entries(personType.toggleableFields || {}).filter(([, v]) => v)
    : [];

  const customFields = personType?.customFields || [];

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1">
        ← Back to People
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {person.fieldValues?.name || 'No name'}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{person.typeLabel}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[person.status] || STATUS_STYLES[PERSON_STATUS.PENDING]}`}>
              {STATUS_LABELS[person.status] || 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Universal fields */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Contact Information</h2>
        <div className="space-y-3">
          {universalKeys.map(key => (
            <div key={key} className="flex gap-4">
              <span className="text-sm text-gray-400 w-36 flex-shrink-0">{universalLabels[key]}</span>
              <span className="text-sm text-gray-900">{person.fieldValues?.[key] || <span className="text-gray-300">—</span>}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Toggleable fields */}
      {activeToggleable.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Additional Information</h2>
          <div className="space-y-3">
            {activeToggleable.map(([key]) => (
              <div key={key} className="flex gap-4">
                <span className="text-sm text-gray-400 w-36 flex-shrink-0">{TOGGLEABLE_LABELS[key] || key}</span>
                <span className="text-sm text-gray-900">{person.fieldValues?.[key] || <span className="text-gray-300">—</span>}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom fields */}
      {customFields.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Custom Fields</h2>
          <div className="space-y-3">
            {customFields.sort((a, b) => a.order - b.order).map(field => {
              const val = person.fieldValues?.[field.fieldId];
              return (
                <div key={field.fieldId} className="flex gap-4">
                  <span className="text-sm text-gray-400 w-36 flex-shrink-0">{field.label}</span>
                  <span className="text-sm text-gray-900">
                    {Array.isArray(val) ? val.join(', ') : val || <span className="text-gray-300">—</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Internal section — staff only */}
      {isStaff && (
        <div className="bg-white border border-amber-200 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Internal</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              Staff only
            </span>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="text-gray-400 hover:text-gray-600 transition-colors">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); }}}
                placeholder="Add a tag..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={addTag} disabled={!tagInput.trim()}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 transition-colors">
                Add
              </button>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes visible to staff only..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <button onClick={saveInternalData} disabled={savingInternal}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            {savingInternal ? 'Saving...' : internalSaved ? 'Saved' : 'Save Internal Data'}
          </button>
        </div>
      )}

      {isStaff && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Assignments</h2>
          <AssignmentsPanel person={person} />
        </div>
      )}

      {isStaff && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Hours</h2>
          <HoursPanel person={person} />
        </div>
      )}
    </div>
  );
}
