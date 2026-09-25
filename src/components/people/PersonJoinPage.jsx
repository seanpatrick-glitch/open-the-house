import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink, getAdditionalUserInfo, updatePassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../firebase';
import { requestActiveOrg } from '../../utils/activeOrg';
import { callableErrorMessage } from '../../utils/callableError';
import ConfirmEmailScreen from '../invites/ConfirmEmailScreen';

export default function PersonJoinPage() {
  const navigate  = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error,  setError]  = useState('');
  const [pending, setPending] = useState(null); // { email, orgId, tokenId, needsPassword }
  const [joined, setJoined] = useState(false); // acceptInvite succeeded; only the password step can remain
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
      // Someone who already has an account (in this org or another) keeps
      // their password. A new login sets one — as does a login created by an
      // earlier, abandoned visit to an invite link, which has no users doc.
      const userSnap      = await getDoc(doc(db, 'users', credential.user.uid));
      const needsPassword = (getAdditionalUserInfo(credential)?.isNewUser ?? true) || !userSnap.exists();

      window.localStorage.removeItem('personInviteEmail');
      window.localStorage.removeItem('personInviteOrgId');
      window.localStorage.removeItem('personInviteTokenId');

      setPending({ email, orgId, tokenId, needsPassword });
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
    const { orgId, tokenId, needsPassword } = pending;

    if (needsPassword) {
      if (!passwordInput || passwordInput.length < 6) {
        setFormError('Password must be at least 6 characters.');
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        setFormError('Passwords do not match.');
        return;
      }
    }

    setFormError('');
    setSubmitting(true);

    // acceptInvite links this People record to the login and writes the
    // membership server-side. Someone who is already a member of this org
    // keeps their current role; linking a record never changes access.
    if (!joined) {
      try {
        requestActiveOrg(orgId);
        const acceptInvite = httpsCallable(functions, 'acceptInvite');
        await acceptInvite({ orgId, tokenId, displayName: displayNameInput.trim() });
        setJoined(true);
      } catch (err) {
        console.error('PersonJoinPage acceptInvite error:', err);
        setError(callableErrorMessage(err, 'Something went wrong. Please try again or contact your coordinator.'));
        setStatus('error');
        setSubmitting(false);
        return;
      }
    }

    if (needsPassword) {
      try {
        await updatePassword(auth.currentUser, passwordInput);
      } catch (err) {
        console.error('PersonJoinPage password error:', err);
        setFormError(err.code === 'auth/weak-password'
          ? 'You have joined, but that password is too weak. Please choose a stronger one.'
          : 'You have joined, but your password could not be saved. Please try again.');
        setSubmitting(false);
        return;
      }
    }

    navigate('/dashboard');
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
            {!pending.needsPassword && (
              <p className="text-gray-500 mt-2 text-sm">
                You already have a Places People account, so there's no password to set.
              </p>
            )}
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

          {pending.needsPassword && (
            <>
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
            </>
          )}

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
