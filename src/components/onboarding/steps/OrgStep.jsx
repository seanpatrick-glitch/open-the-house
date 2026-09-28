// OrgStep.jsx — Onboarding wizard Step 1 (Organization). Surfaces and lets
// the admin confirm or correct the org name already collected at signup
// (SignupStep3.jsx) and optionally add a logo, reusing OrgLogoUpload.jsx
// (Unit 2's Settings component) directly rather than duplicating its
// upload flow. Neither field blocks Next: the org already has a name
// regardless of what happens on this screen, and a logo can always be
// added later in Settings.

import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import OrgLogoUpload from '../../shared/OrgLogoUpload';

export default function OrgStep({ orgId, onNext }) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    getDoc(doc(db, 'organizations', orgId))
      .then(snap => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data();
        setName(data.name ?? '');
        setSavedName(data.name ?? '');
        setLogoUrl(data.logoUrl ?? null);
      })
      .catch(err => {
        console.error('OrgStep load org error:', err);
        if (!cancelled) setError('Could not load your organization. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [orgId]);

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === savedName || savingRef.current) return;
    savingRef.current = true;
    try {
      await updateDoc(doc(db, 'organizations', orgId), { name: trimmed });
      setSavedName(trimmed);
    } catch (err) {
      console.error('OrgStep save name error:', err);
      setError('Could not save the organization name. You can also update it later in Settings.');
    } finally {
      savingRef.current = false;
    }
  }

  async function handleNext() {
    await commitName();
    onNext();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Your organization</h2>
      <p className="text-gray-500 text-sm mb-6">
        Confirm your organization's name and add a logo if you have one. Both are optional here and can be changed anytime in Settings.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={commitName}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotlight"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo (optional)</label>
            <OrgLogoUpload orgId={orgId} logoUrl={logoUrl} onLogoChange={setLogoUrl} />
          </div>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button
            type="button"
            onClick={handleNext}
            className="w-full bg-spotlight hover:bg-spotlight/90 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
          >
            Next
          </button>
        </>
      )}
    </div>
  );
}
