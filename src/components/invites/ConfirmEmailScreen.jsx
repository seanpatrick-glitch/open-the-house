import { useState } from 'react'

// Shared in-app replacement for window.prompt() on the invite-acceptance path.
// Used by both JoinPage.jsx and PersonJoinPage.jsx when there's no cached
// email in localStorage (the normal case when the link is opened on a
// different device than the one the invite was sent from).
export default function ConfirmEmailScreen({
  onConfirm,
  submitting,
  error,
  theme = 'amber', // 'amber' | 'indigo'
  showEmoji = true,
  containerClassName,
  cardClassName,
}) {
  const [email, setEmail] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    onConfirm(email.trim())
  }

  const accent = theme === 'indigo'
    ? { button: 'bg-places-blue hover:bg-places-blue/90', ring: 'focus:ring-places-blue' }
    : { button: 'bg-spotlight hover:bg-spotlight/90', ring: 'focus:ring-spotlight' }

  return (
    <div className={containerClassName}>
      <div className={cardClassName}>
        <div className="text-center mb-6">
          {showEmoji && <div className="text-4xl mb-3">🎭</div>}
          <h1 className="text-xl font-bold text-gray-900">Confirm your email</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Enter the email address this invite was sent to, so we can finish signing you in.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-1 mb-4">
            <label className="block text-sm font-medium text-gray-700">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              autoFocus
              className={`w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 ${accent.ring} text-base`}
            />
          </div>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full ${accent.button} disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base`}
          >
            {submitting ? 'Confirming…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
