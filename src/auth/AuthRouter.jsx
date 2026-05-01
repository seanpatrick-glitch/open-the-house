import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminView from '../views/AdminView'
import CollaboratorView from '../views/CollaboratorView'
import VolunteerView from '../views/VolunteerView'

export default function AuthRouter() {
  const { userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-base">Loading...</p>
      </div>
    )
  }

  if (!userProfile) {
    return <Navigate to="/" replace />
  }

  if (userProfile.role === 'admin')        return <AdminView />
  if (userProfile.role === 'collaborator') return <CollaboratorView />
  if (userProfile.role === 'volunteer')    return <VolunteerView />

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <p className="text-white text-base text-center">
        Account not configured. Contact your administrator.
      </p>
    </div>
  )
}
