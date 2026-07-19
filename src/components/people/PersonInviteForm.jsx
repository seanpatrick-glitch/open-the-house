import { useState } from 'react';
import { doc, addDoc, updateDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { auth } from '../../firebase';

const ACTION_CODE_SETTINGS = (orgId, tokenId) => ({
  url: `${window.location.origin}/person-join?orgId=${orgId}&tokenId=${tokenId}`,
  handleCodeInApp: true,
});

export default function PersonInviteForm({ person, onSuccess, onCancel }) {
  const { userProfile } = useAuth();
  const { orgId, uid } = userProfile;

  const [sending, setSending] = useState(false);
  const [error, setError]     = useState('');

  const email = person.fieldValues?.email;

  async function handleSend() {
    if (!email) {
      setError('This person does not have an email address on file. Add one before sending an invite.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const tokenRef = await addDoc(
        collection(db, 'organizations', orgId, 'personInviteTokens'),
        {
          orgId,
          personId:  person.id,
          email,
          personType: person.typeLabel,
          invitedBy:  uid,
          createdAt:  serverTimestamp(),
          expiresAt,
          accepted:   false,
        }
      );

      await updateDoc(
        doc(db, 'organizations', orgId, 'people', person.id),
        { accountStatus: 'invited' }
      );

      await sendSignInLinkToEmail(
        auth,
        email,
        ACTION_CODE_SETTINGS(orgId, tokenRef.id)
      );

      window.localStorage.setItem('personInviteEmail', email);
      window.localStorage.setItem('personInviteOrgId', orgId);
      window.localStorage.setItem('personInviteTokenId', tokenRef.id);

      onSuccess();
    } catch (err) {
      console.error('PersonInviteForm error:', err);
      setError('Failed to send invite. Please try again.');
      setSending(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-md">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Invite to Platform</h3>
      <p className="text-sm text-gray-500 mb-4">
        Send {person.fieldValues?.name || 'this person'} a secure sign-in link at <span className="font-medium text-gray-700">{email || 'no email on file'}</span>.
        They will create an account and their profile will be linked automatically.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSend}
          disabled={sending || !email}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {sending ? 'Sending...' : 'Send Invite'}
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
