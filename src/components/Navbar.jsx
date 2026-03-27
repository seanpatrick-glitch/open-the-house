// Navbar.jsx — the dark top bar that appears on every screen after login

import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Navbar({ title, backTo }) {
  const { logout } = useAuth()
  const navigate   = useNavigate()

  async function handleLogout() {
    try {
      await logout()
      navigate('/')
    } catch {
      toast.error('Could not log out. Please try again.')
    }
  }

  return (
    <nav className="bg-gray-900 text-white px-4 py-3 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto flex items-center justify-between">

        {/* Left side: optional back button + title */}
        <div className="flex items-center gap-3">
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              ← Back
            </button>
          )}
          <span className="font-bold text-lg truncate max-w-xs">{title || 'Show Prep'}</span>
        </div>

        {/* Right side: logout */}
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-white transition-colors ml-4 flex-shrink-0"
        >
          Log Out
        </button>
      </div>
    </nav>
  )
}
