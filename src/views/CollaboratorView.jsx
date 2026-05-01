import React from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function CollaboratorView() {
  const { userProfile, logout } = useAuth()

  async function handleSignOut() {
    await logout()
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎭</div>
          <h1 className="text-3xl font-bold text-gray-900">Collaborator View</h1>
        </div>

        <div className="space-y-3 mb-8">
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</p>
            <p className="text-gray-900 text-sm">{userProfile?.email}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Role</p>
            <p className="text-gray-900 text-sm">{userProfile?.role}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Venue ID</p>
            <p className="text-gray-900 text-sm font-mono">{userProfile?.venueId}</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-base"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
