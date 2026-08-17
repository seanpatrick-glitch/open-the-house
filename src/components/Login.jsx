// Login.jsx — the sign-in screen

import React, { useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'

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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎭</div>
          <h1 className="text-3xl font-bold text-gray-900">Places People!</h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={sendingReset}
                className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 transition-colors"
              >
                {sendingReset ? 'Sending…' : 'Forgot password?'}
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-6">
          Private access only
        </p>

        <p className="text-sm text-center text-gray-500 mt-4">
          New here?{' '}
          <Link to="/signup" className="text-amber-600 hover:text-amber-700 font-medium">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
