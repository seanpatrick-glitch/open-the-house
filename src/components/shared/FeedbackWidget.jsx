// FeedbackWidget.jsx — floating Bug/Feedback widget, visible on every
// dashboard for any logged-in user regardless of role. Mounted once in
// AuthRouter.jsx (not duplicated per view) since DashboardShell (admin/
// secondaryAdmin/departmentHead/venueManager), CollaboratorView, and
// PersonView are three separate top-level render trees with no shared
// shell of their own. Writes to organizations/{orgId}/feedback/{feedbackId}
// (see firestore.rules), which emailOnNewFeedback (functions/index.js)
// alerts the team about.

import { useState } from 'react';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const TYPE_OPTIONS = [
  { value: 'bug', label: 'Bug' },
  { value: 'feedback', label: 'Feedback' },
];

export default function FeedbackWidget() {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('bug');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!userProfile?.orgId) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim() || submitting) return;

    setSubmitting(true);
    try {
      const orgSnap = await getDoc(doc(db, 'organizations', userProfile.orgId));
      const orgName = orgSnap.exists() ? orgSnap.data().name ?? null : null;

      await addDoc(collection(db, 'organizations', userProfile.orgId, 'feedback'), {
        type,
        description: description.trim(),
        orgId: userProfile.orgId,
        orgName,
        createdBy: userProfile.uid,
        submitterEmail: userProfile.email ?? null,
        submitterRole: userProfile.role ?? null,
        page: window.location.pathname,
        createdAt: serverTimestamp(),
      });

      toast.success('Thanks. Your report was sent to the team.');
      setDescription('');
      setType('bug');
      setOpen(false);
    } catch (err) {
      console.error('FeedbackWidget submit error:', err);
      toast.error('Could not send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg transition-colors"
      >
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Report a bug or share feedback</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-2">
                  {TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`flex-1 text-sm font-medium py-2 rounded-lg border transition-colors ${
                        type === opt.value
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="What happened, or what would help?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting || !description.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  {submitting ? 'Sending…' : 'Send'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
