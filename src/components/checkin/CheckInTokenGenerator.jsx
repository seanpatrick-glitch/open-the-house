import { useState } from 'react';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export default function CheckInTokenGenerator({ production, onClose }) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const uid   = userProfile?.uid;

  const [date, setDate]         = useState(() => new Date().toISOString().split('T')[0]);
  const [windowMins, setWindowMins] = useState(30);
  const [token, setToken]       = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError]       = useState('');

  async function handleGenerate() {
    if (!date) {
      setError('Select a date first.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const baseDate  = parseLocalDate(date);
      const validFrom = Timestamp.fromDate(baseDate);
      const validUntil = Timestamp.fromMillis(
        baseDate.getTime() + windowMins * 60 * 1000
      );

      const tokenRef = await addDoc(
        collection(db, 'organizations', orgId, 'checkinTokens'),
        {
          orgId,
          assignmentId: production.id,
          date:         Timestamp.fromDate(baseDate),
          createdBy:    uid,
          validFrom,
          validUntil,
          active:       true,
          createdAt:    serverTimestamp(),
        }
      );

      setToken({
        id:          tokenRef.id,
        validUntil,
        url: `${window.location.origin}/self-checkin?orgId=${orgId}&tokenId=${tokenRef.id}&assignmentId=${production.id}`,
      });
    } catch (err) {
      console.error('CheckInTokenGenerator error:', err);
      setError('Failed to generate token. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">QR Check-In for {production.name}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!token ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Check-in window</label>
            <select
              value={windowMins}
              onChange={e => setWindowMins(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">QR code stops working after this window closes.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            {generating ? 'Generating...' : 'Generate QR Code'}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <QRCodeSVG value={token.url} size={200} />
          </div>
          <p className="text-xs text-gray-500 mb-1">Have people scan this to check themselves in.</p>
          <p className="text-xs text-gray-400 mb-4">
            Expires {token.validUntil.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
          <button
            onClick={() => setToken(null)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            Generate a new code
          </button>
        </div>
      )}
    </div>
  );
}
