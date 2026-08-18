// InvitesStep.jsx — Onboarding wizard Step 4 (Invites). Placeholder shell
// built in Unit 1; real content (batch invite rows) built in Unit 5.

import React from 'react'

export default function InvitesStep({ onFinish, onBack, finishing }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Invite your team</h2>
      <p className="text-gray-500 text-sm mb-6">Coming soon.</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={finishing}
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base disabled:opacity-50"
        >
          {finishing ? 'Finishing…' : 'Finish'}
        </button>
      </div>
    </div>
  )
}
