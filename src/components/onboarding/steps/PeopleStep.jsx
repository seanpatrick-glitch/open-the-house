// PeopleStep.jsx — Onboarding wizard Step 1 (People). Seeds a default
// personType if the org has none, then lets the admin build a roster with a
// simple repeatable name + role/title input. Each person is written to
// Firestore immediately on Add, matching CreatePersonForm.jsx's write shape,
// so nothing is lost if the admin abandons the wizard partway.

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { cleanFieldValues } from '../../people/PersonFieldsEditor';

const DEFAULT_TYPE_LABEL = 'Team Member';
const ROLE_FIELD_ID = 'roleTitle';

export default function PeopleStep({ orgId, onNext, onBack }) {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;

  const [loadingType, setLoadingType] = useState(true);
  const [personType, setPersonType] = useState(null);
  const [name, setName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [addedPeople, setAddedPeople] = useState([]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    (async () => {
      try {
        const typesRef = collection(db, 'organizations', orgId, 'personTypes');
        const snap = await getDocs(typesRef);

        if (!snap.empty) {
          const existing = snap.docs[0];
          if (!cancelled) setPersonType({ id: existing.id, ...existing.data() });
        } else {
          const newType = {
            label: DEFAULT_TYPE_LABEL,
            description: '',
            orgId,
            departmentHeadId: null,
            departmentId: null,
            createdBy: uid,
            createdAt: serverTimestamp(),
            active: true,
            universalFields: { name: true, email: true, phone: true, emergencyContact: true },
            toggleableFields: {
              address: false,
              dateOfBirth: false,
              tShirtSize: false,
              dietaryRestrictions: false,
              accessibilityNeeds: false,
            },
            customFields: [
              { fieldId: ROLE_FIELD_ID, label: 'Role / Title', type: 'text', options: [], required: false, order: 0 },
            ],
          };
          const ref = await addDoc(typesRef, newType);
          if (!cancelled) setPersonType({ id: ref.id, ...newType });
        }
      } catch (err) {
        console.error('PeopleStep seed personType error:', err);
        if (!cancelled) setError('Could not set up the roster. Please try again.');
      } finally {
        if (!cancelled) setLoadingType(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orgId, uid]);

  async function handleAddPerson() {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!personType) return;

    setAdding(true);
    setError('');
    try {
      const fieldValues = cleanFieldValues({
        name: name.trim(),
        email: '',
        phone: '',
        emergencyContact: '',
        [ROLE_FIELD_ID]: roleTitle.trim(),
      });

      await addDoc(
        collection(db, 'organizations', orgId, 'people'),
        {
          orgId,
          typeId: personType.id,
          typeLabel: personType.label,
          uid: null,
          status: 'active',
          createdBy: uid,
          createdAt: serverTimestamp(),
          approvedBy: uid,
          approvedAt: serverTimestamp(),
          assignments: [],
          totalHours: 0,
          accountUid: null,
          accountStatus: 'no_account',
          staff: false,
          fieldValues,
        }
      );

      setAddedPeople(prev => [...prev, { name: name.trim(), roleTitle: roleTitle.trim() }]);
      setName('');
      setRoleTitle('');
    } catch (err) {
      console.error('PeopleStep add person error:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  const canProceed = addedPeople.length > 0;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Add your people</h2>
      <p className="text-gray-500 text-sm mb-6">
        Start your roster. You can add more detail later — just names and roles for now.
      </p>

      {loadingType ? (
        <p className="text-sm text-gray-400">Setting up...</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPerson(); } }}
              placeholder="Name"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <input
              type="text"
              value={roleTitle}
              onChange={e => setRoleTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPerson(); } }}
              placeholder="Role / title (optional)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={handleAddPerson}
              disabled={adding || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {addedPeople.length > 0 && (
            <ul className="space-y-1 mb-6 max-h-48 overflow-y-auto">
              {addedPeople.map((p, i) => (
                <li key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 flex justify-between">
                  <span className="font-medium">{p.name}</span>
                  {p.roleTitle && <span className="text-gray-400">{p.roleTitle}</span>}
                </li>
              ))}
            </ul>
          )}

          {!canProceed && (
            <p className="text-xs text-gray-400 mb-4">Add at least one person to continue.</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors text-base"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!canProceed}
              className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
