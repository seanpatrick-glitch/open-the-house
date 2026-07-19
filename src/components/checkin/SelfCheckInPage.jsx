import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';

export default function SelfCheckInPage() {
  const navigate  = useNavigate();
  const [status, setStatus]   = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function handleCheckIn() {
      const params       = new URLSearchParams(window.location.search);
      const orgId        = params.get('orgId');
      const tokenId      = params.get('tokenId');
      const assignmentId = params.get('assignmentId');

      if (!orgId || !tokenId || !assignmentId) {
        setStatus('invalid');
        return;
      }

      try {
        // Validate token
        const tokenSnap = await getDoc(
          doc(db, 'organizations', orgId, 'checkinTokens', tokenId)
        );

        if (!tokenSnap.exists() || !tokenSnap.data().active) {
          setStatus('invalid');
          setMessage('This check-in link is not active.');
          return;
        }

        const token      = tokenSnap.data();
        const now        = Date.now();
        const validUntil = token.validUntil?.toMillis?.() ?? 0;

        if (now > validUntil) {
          setStatus('expired');
          setMessage('This check-in window has closed.');
          return;
        }

        // Wait for auth state
        const user = await new Promise(resolve => {
          const unsub = onAuthStateChanged(auth, u => {
            unsub();
            resolve(u);
          });
        });

        if (!user) {
          setStatus('unauthenticated');
          return;
        }

        // Find the person record linked to this user
        const peopleSnap = await getDoc(
          doc(db, 'organizations', orgId, 'people', user.uid)
        );

        // Try by accountUid match
        const { getDocs, query, where } = await import('firebase/firestore');
        const personQuery = await getDocs(
          query(
            collection(db, 'organizations', orgId, 'people'),
            where('accountUid', '==', user.uid)
          )
        );

        if (personQuery.empty) {
          setStatus('error');
          setMessage('Your account is not linked to a person record in this organization.');
          return;
        }

        const personDoc = personQuery.docs[0];
        const personId  = personDoc.id;

        // Write check-in
        await addDoc(
          collection(db, 'organizations', orgId, 'checkins'),
          {
            personId,
            orgId,
            assignmentId,
            date:        Timestamp.fromDate(new Date()),
            present:     true,
            checkedInBy: 'self',
            recordedAt:  serverTimestamp(),
            tokenId,
          }
        );

        setStatus('success');
        setMessage(`You are checked in. See you at the show.`);
      } catch (err) {
        console.error('SelfCheckInPage error:', err);
        setStatus('error');
        setMessage('Something went wrong. Ask your coordinator to check you in manually.');
      }
    }

    handleCheckIn();
  }, []);

  const screens = {
    loading: {
      title: 'Checking you in...',
      sub:   '',
    },
    success: {
      title: message,
      sub:   '',
    },
    invalid: {
      title: 'This link is not valid.',
      sub:   'Ask your coordinator for the correct check-in link.',
    },
    expired: {
      title: 'Check-in window closed.',
      sub:   message,
    },
    unauthenticated: {
      title: 'Sign in to check in.',
      sub:   'Open the app and sign in first, then scan this code again.',
    },
    error: {
      title: 'Something went wrong.',
      sub:   message,
    },
  };

  const screen = screens[status] || screens.error;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-xl font-bold text-gray-900 mb-2">{screen.title}</p>
        {screen.sub && <p className="text-sm text-gray-500">{screen.sub}</p>}
        {status === 'success' && (
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Go to dashboard
          </button>
        )}
      </div>
    </div>
  );
}
