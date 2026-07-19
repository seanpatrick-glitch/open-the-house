import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';

export default function PersonJoinPage() {
  const navigate  = useNavigate();
  const [status, setStatus] = useState('loading');
  const [error,  setError]  = useState('');

  useEffect(() => {
    async function completeSignIn() {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        setStatus('invalid');
        return;
      }

      const params  = new URLSearchParams(window.location.search);
      const orgId   = params.get('orgId')   || window.localStorage.getItem('personInviteOrgId');
      const tokenId = params.get('tokenId') || window.localStorage.getItem('personInviteTokenId');

      let email = window.localStorage.getItem('personInviteEmail');
      if (!email) {
        email = window.prompt('Please enter your email address to confirm your identity.');
      }
      if (!email) {
        setStatus('invalid');
        return;
      }

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

        // Link uid to person document
        await updateDoc(
          doc(db, 'organizations', orgId, 'people', token.personId),
          {
            accountUid:    uid,
            accountStatus: 'active',
          }
        );

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
        console.error('PersonJoinPage error:', err);
        setError('Something went wrong. Please try again or contact your coordinator.');
        setStatus('error');
      }
    }

    completeSignIn();
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Setting up your account...</p>
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
