// Login.jsx — the sign-in screen

import React, { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import wordmark from '../assets/brand/wordmark.png'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const { login } = useAuth()
  const navigate  = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault() // prevents page from refreshing on form submit
    if (!email || !password) {
      toast.error('Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      toast.error('Login failed. Check your email and password and try again.')
      console.error(err)
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error('Enter your email above first, then click "Forgot password?"')
      return
    }
    setSendingReset(true)
    try {
      await sendPasswordResetEmail(auth, email)
      toast.success(`Password reset email sent to ${email}`)
    } catch (err) {
      toast.error('Could not send reset email. Check the address and try again.')
      console.error(err)
    }
    setSendingReset(false)
  }

  return (
    <div className="min-h-screen bg-stage-navy flex flex-col items-center justify-center px-4">
      {/* Wordmark sits on the navy page background — the lettering is white
          and only reads on dark, blue, or photographic surfaces */}
      <img src={wordmark} alt="Places People! There's more to the show than just the stage" className="h-40 w-auto mb-8" />

      <div className="bg-places-blue rounded-2xl shadow-2xl p-8 w-full max-w-md">

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/85 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-white/20 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-white/85">
                Password
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={sendingReset}
                className="text-xs font-medium text-white/80 hover:text-house-white disabled:opacity-50 transition-colors"
              >
                {sendingReset ? 'Sending…' : 'Forgot password?'}
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-white/20 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-spotlight text-base"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-spotlight hover:bg-spotlight/90 text-stage-navy font-semibold py-3 px-4 rounded-lg transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-center text-white/50 mt-6">
          Private access only
        </p>

        <p className="text-sm text-center text-white/70 mt-4">
          New here?{' '}
          <Link to="/signup" className="text-spotlight hover:text-white font-medium">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
