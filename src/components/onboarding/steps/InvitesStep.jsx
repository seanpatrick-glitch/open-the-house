// InvitesStep.jsx — Onboarding wizard Step 4 (Invites). Batch invite rows,
// reusing sendCollaboratorInvite() (extracted from InviteCollaborator.jsx)
// in a loop, one call per row, since that logic is already stateless per
// invite. Department Head is deliberately left out of the role options here
// — no departments exist yet at this point in a brand-new org (this wizard
// has no Departments step), so an admin invites a department head later via
// the normal Invite Collaborator screen once departments exist. See
// PROJECT_STATE.md for this decision.

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { sendCollaboratorInvite } from '../../../utils/collaboratorInvites';

// Department Head intentionally excluded — see file header.
const ROLE_OPTIONS = [
  { value: 'orgCollaborator',        label: 'Org Collaborator' },
  { value: 'admin',                  label: 'Admin' },
  { value: 'secondaryAdmin',         label: 'Secondary Admin' },
  { value: 'venueManager',           label: 'Venue Manager' },
  { value: 'productionCollaborator', label: 'Production Collaborator' },
];

let rowIdCounter = 0;
function nextRowId() {
  rowIdCounter += 1;
  return `row-${rowIdCounter}`;
}

export default function InvitesStep({ orgId, onFinish, onBack, finishing }) {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;

  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    getDocs(collection(db, 'organizations', orgId, 'people'))
      .then(snap => {
        if (cancelled) return;
        const prefilled = snap.docs
          .map(d => d.data())
          .filter(p => p.fieldValues?.email?.trim())
          .map(p => ({
            id: nextRowId(),
            name: p.fieldValues.name || '',
            email: p.fieldValues.email.trim(),
            role: 'orgCollaborator',
          }));
        setRows(prefilled);
      })
      .catch(err => {
        console.error('InvitesStep load people error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });

    return () => { cancelled = true; };
  }, [orgId]);

  function addRow() {
    setRows(prev => [...prev, { id: nextRowId(), name: '', email: '', role: 'orgCollaborator' }]);
  }

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function handleSendInvites() {
    const toSend = rows.filter(r => r.email.trim());
    if (toSend.length === 0) {
      onFinish();
      return;
    }

    setSending(true);
    setError('');
    let failures = 0;

    for (const row of toSend) {
      try {
        await sendCollaboratorInvite({
          orgId,
          uid,
          email: row.email.trim(),
          role: row.role,
        });
      } catch (err) {
        console.error('InvitesStep send invite error:', row.email, err);
        failures += 1;
      }
    }

    setSending(false);

    if (failures > 0) {
      setError(`${failures} of ${toSend.length} invite(s) could not be sent. You can invite them later from Collaborators.`);
    }

    onFinish();
  }

  const busy = sending || finishing;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Invite your team</h2>
      <p className="text-gray-500 text-sm mb-6">
        Send sign-in invites to people who need to use the app directly. You can always invite more later.
      </p>

      {loadingRows ? (
        <p className="text-sm text-gray-400 mb-4">Loading...</p>
      ) : (
        <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
          {rows.map(row => (
            <div key={row.id} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input
                type="email"
                value={row.email}
                onChange={e => updateRow(row.id, 'email', e.target.value)}
                placeholder={row.name ? `${row.name}'s email` : 'name@email.com'}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spotlight"
              />
              <select
                value={row.role}
                onChange={e => updateRow(row.id, 'role', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-spotlight"
              >
                {ROLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors px-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="text-sm font-medium text-places-blue hover:text-places-blue/90 transition-colors mb-6"
      >
        + Add row
      </button>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={busy}
          className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          Skip for now, invite people later
        </button>
        <button
          type="button"
          onClick={handleSendInvites}
          disabled={busy}
          className="flex-1 bg-spotlight hover:bg-spotlight/90 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          {sending ? 'Sending…' : finishing ? 'Finishing…' : 'Send invites & finish'}
        </button>
      </div>
    </div>
  );
}
