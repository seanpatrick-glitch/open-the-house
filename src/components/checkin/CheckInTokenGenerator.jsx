import { useState } from 'react';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function buildDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes]   = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0);
}

export default function CheckInTokenGenerator({ production, onClose }) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.orgId;
  const uid   = userProfile?.uid;

  const [date, setDate]           = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [token, setToken]         = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState('');

  async function handleGenerate() {
    setError('');

    if (!date || !startTime || !endTime) {
      setError('Date, start time, and end time are all required.');
      return;
    }

    const validFromDate  = buildDateTime(date, startTime);
    const validUntilDate = buildDateTime(date, endTime);
    const now            = new Date();

    if (validFromDate >= validUntilDate) {
      setError('Start time must be before end time.');
      return;
    }
    if (validUntilDate <= now) {
      setError('End time must be in the future.');
      return;
    }
    const windowMs = validUntilDate.getTime() - validFromDate.getTime();
    if (windowMs > 24 * 60 * 60 * 1000) {
      setError('Check-in window cannot exceed 24 hours.');
      return;
    }

    setGenerating(true);
    try {
      const baseDate   = parseLocalDate(date);
      const validFrom  = Timestamp.fromDate(validFromDate);
      const validUntil = Timestamp.fromDate(validUntilDate);

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
        id:         tokenRef.id,
        validFrom,
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in opens <span className="text-red-500">*</span></label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in closes <span className="text-red-500">*</span></label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-places-blue"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">QR code only works between these times. Set them to match your call window.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={generating || !date || !startTime || !endTime}
            className="w-full bg-places-blue hover:bg-places-blue/90 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
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
          <p className="text-xs text-gray-400 mb-1">
            Opens {token.validFrom.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Closes {token.validUntil.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
          <button
            onClick={() => setToken(null)}
            className="text-sm text-places-blue hover:text-places-blue/90 font-medium transition-colors"
          >
            Generate a new code
          </button>
        </div>
      )}
    </div>
  );
}
