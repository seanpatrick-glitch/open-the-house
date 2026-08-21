import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import ConfirmEmailScreen from '../invites/ConfirmEmailScreen';

export default function PersonJoinPage() {
  const navigate  = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error,  setError]  = useState('');
  const [pending, setPending] = useState(null); // { uid, email, orgId, tokenId, personId, personName }
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [confirmingEmail, setConfirmingEmail] = useState(false);

  async function completeSignIn(email) {
    const params  = new URLSearchParams(window.location.search);
    const orgId   = params.get('orgId')   || window.localStorage.getItem('personInviteOrgId');
    const tokenId = params.get('tokenId') || window.localStorage.getItem('personInviteTokenId');

    if (!orgId || !tokenId) {
      setStatus('invalid');
      return;
    }

    try {
      // Validate token
      const tokenSnap = await getDoc(
        doc(db, 'organizations', orgId, 'personInviteTokens', tokenId)
      );

      if (!tokenSnap.exists() || tokenSnap.data().accepted) {
        setStatus('invalid');
        return;
      }

      const token     = tokenSnap.data();
      const now       = Date.now();
      const expiresAt = token.expiresAt?.toMillis?.() ?? 0;
      if (now > expiresAt) {
        setError('This invite has expired. Ask your coordinator to send a new one.');
        setStatus('error');
        return;
      }

      // Sign in with email link
      const credential = await signInWithEmailLink(auth, email, window.location.href);
      const uid        = credential.user.uid;

      window.localStorage.removeItem('personInviteEmail');
      window.localStorage.removeItem('personInviteOrgId');
      window.localStorage.removeItem('personInviteTokenId');

      setPending({ uid, email, orgId, tokenId, personId: token.personId });
      setStatus('form');
    } catch (err) {
      console.error('PersonJoinPage error:', err);
      if (status === 'needs-email') {
        // Wrong email typed on the confirm-email screen — let them retry
        // instead of dropping them on the dead-end error screen.
        setEmailError('That email did not match this invite link. Please double-check and try again.');
        return;
      }
      setError('Something went wrong. Please try again or contact your coordinator.');
      setStatus('error');
    }
  }

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setStatus('invalid');
      return;
    }

    const cachedEmail = window.localStorage.getItem('personInviteEmail');
    if (cachedEmail) {
      completeSignIn(cachedEmail);
    } else {
      setStatus('needs-email');
    }
  }, [navigate]);

  async function handleConfirmEmail(email) {
    setEmailError('');
    setConfirmingEmail(true);
    await completeSignIn(email);
    setConfirmingEmail(false);
  }

  async function handleContinue() {
    if (!pending) return;

    if (!passwordInput || passwordInput.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormError('');
    setSubmitting(true);
    const { uid, email, orgId, tokenId, personId } = pending;
    const displayName = displayNameInput.trim() || email;

    try {
      await updatePassword(auth.currentUser, passwordInput);

      const batch = writeBatch(db);

      // Link uid to person document
      batch.update(
        doc(db, 'organizations', orgId, 'people', personId),
        {
          accountUid:    uid,
          accountStatus: 'active',
          displayName,
        }
      );

      batch.set(doc(db, 'users', uid), {
        name:      email,
        email,
        displayName,
        createdAt: serverTimestamp(),
        organizations: {
          [orgId]: {
            role:     'person',
            joinedAt: serverTimestamp(),
          },
        },
      });

      batch.set(
        doc(db, 'organizations', orgId, 'members', uid),
        {
          uid,
          email,
          displayName,
          role:             'person',
          personClass:      true,
          personId,
          provisionalAdmin: false,
          departmentId:     null,
          joinedAt:         serverTimestamp(),
          invitedBy:        null,
          accountStatus:    'confirmed',
        }
      );

      await batch.commit();

      // Mark token accepted
      await updateDoc(
        doc(db, 'organizations', orgId, 'personInviteTokens', tokenId),
        {
          accepted:   true,
          acceptedAt: serverTimestamp(),
        }
      );

      navigate('/dashboard');
    } catch (err) {
      console.error('PersonJoinPage submit error:', err);
      if (err.code === 'auth/weak-password') {
        setFormError('That password is too weak. Please choose a stronger one.');
        setSubmitting(false);
        return;
      }
      setError('Something went wrong. Please try again or contact your coordinator.');
      setStatus('error');
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Setting up your account...</p>
      </div>
    );
  }

  if (status === 'needs-email') {
    return (
      <ConfirmEmailScreen
        onConfirm={handleConfirmEmail}
        submitting={confirmingEmail}
        error={emailError}
        theme="indigo"
        showEmoji={false}
        containerClassName="min-h-screen bg-gray-50 flex items-center justify-center px-4"
        cardClassName="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 w-full max-w-md"
      />
    );
  }

  if (status === 'form') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900">Almost there</h1>
            <p className="text-gray-500 mt-2 text-sm">You're joining as {pending.email}.</p>
          </div>

          <div className="space-y-1 mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Display name (optional). Your own name, or a show, group, or company name if
              that fits your role better.
            </label>
            <input
              type="text"
              value={displayNameInput}
              onChange={e => setDisplayNameInput(e.target.value)}
              placeholder={pending.email}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-places-blue text-base"
              autoFocus
            />
          </div>

          <div className="space-y-1 mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Set a password
            </label>
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-places-blue text-base"
            />
          </div>

          <div className="space-y-1 mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPasswordInput}
              onChange={e => setConfirmPasswordInput(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-places-blue text-base"
            />
          </div>

          {formError && <p className="text-sm text-red-600 mb-4">{formError}</p>}

          <button
            onClick={handleContinue}
            disabled={submitting}
            className="w-full bg-places-blue hover:bg-places-blue/90 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
          >
            {submitting ? 'Setting up your account...' : 'Continue'}
          </button>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-gray-900 font-semibold mb-2">This link is not valid.</p>
          <p className="text-gray-500 text-sm">Contact your coordinator for a new invite.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-gray-900 font-semibold mb-2">Something went wrong.</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return null;
}
