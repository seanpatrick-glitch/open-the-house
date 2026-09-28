import React, { useState } from 'react'
import toast from 'react-hot-toast'
import wordmark from '../../assets/brand/wordmark-mark.png'

const VALID_CODE = 'OTH2026'

export default function SignupStep2({ onComplete }) {
  const [code,    setCode]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()

    if (!code.trim()) {
      setError('Please enter your access code.')
      return
    }

    setLoading(true)
    if (code.trim() === VALID_CODE) {
      setError('')
      onComplete()
    } else {
      setError('Invalid access code. Please check your code and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stage-navy flex flex-col items-center justify-center px-4">
      <img src={wordmark} alt="Places People!" className="h-14 w-auto mb-6" />
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm">Enter your beta access code</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError('') }}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base"
              placeholder="Enter your code"
              autoComplete="off"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-spotlight hover:bg-spotlight/90 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Verifying…' : 'Continue'}
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-6">Step 2 of 3</p>
      </div>
    </div>
  )
}
