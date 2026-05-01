// App.jsx — the root of the app. Sets up routing and authentication.

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import SignupFlow from './components/auth/SignupFlow'
import AuthRouter from './auth/AuthRouter'
import Dashboard from './components/Dashboard'
import ShowTracker from './components/ShowTracker'
import UserManagement from './components/UserManagement'
import InviteManager from './components/invites/InviteManager'
import AcceptInvite from './components/invites/AcceptInvite'

// ProtectedRoute: only logged-in users can see this screen
function ProtectedRoute({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? children : <Navigate to="/" replace />
}

// AdminRoute: only admin users can see this screen
function AdminRoute({ children }) {
  const { currentUser, isAdmin } = useAuth()
  if (!currentUser) return <Navigate to="/" replace />
  if (!isAdmin())   return <Navigate to="/dashboard" replace />
  return children
}

// PublicRoute: only redirect to dashboard if the user is fully set up
// (auth account exists AND venue profile exists). A user mid-signup
// has currentUser but no userProfile yet and must not be redirected.
function PublicRoute({ children }) {
  const { currentUser, userProfile } = useAuth()
  return (currentUser && userProfile) ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Toast notifications (pop-up messages for save, upload, etc.) */}
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/"                  element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup"            element={<PublicRoute><SignupFlow /></PublicRoute>} />
          <Route path="/invite/:token"     element={<AcceptInvite />} />
          <Route path="/dashboard"         element={<ProtectedRoute><AuthRouter /></ProtectedRoute>} />
          <Route path="/dashboard-legacy"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/show/:showId"      element={<ProtectedRoute><ShowTracker /></ProtectedRoute>} />
          <Route path="/invites"           element={<AdminRoute><InviteManager /></AdminRoute>} />
          <Route path="/users"             element={<AdminRoute><UserManagement /></AdminRoute>} />
          <Route path="*"                  element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
