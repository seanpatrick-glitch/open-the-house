// UserManagement.jsx — Admin page to create and manage collaborator accounts
// Only accessible to users with role === 'admin'

import React, { useState, useEffect } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  getAuth,
} from 'firebase/auth'
import { initializeApp, deleteApp } from 'firebase/app'
import { db, auth, firebaseConfig } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import Navbar from './Navbar'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'exec',         label: 'Exec' },
  { value: 'biz_manager',  label: 'Biz Manager' },
  { value: 'prod_manager', label: 'Prod Manager' },
]

const ROLE_LABELS = {
  admin:        'Admin',
  exec:         'Exec',
  biz_manager:  'Biz Manager',
  prod_manager: 'Prod Manager',
}

export default function UserManagement() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState(false)

  // Form state
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState('exec')

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin()) navigate('/dashboard')
  }, [])

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const snap = await getDocs(collection(db, 'users'))
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
      toast.error('Could not load users.')
    }
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error('Please fill in all fields.')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }
    setCreating(true)
    try {
      // Use a secondary app instance so creating the account doesn't affect the
      // current admin session (createUserWithEmailAndPassword auto-signs in).
      const secondaryApp  = initializeApp(firebaseConfig, 'secondary')
      const secondaryAuth = getAuth(secondaryApp)
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password)
      const uid  = cred.user.uid
      await secondaryAuth.signOut()
      await deleteApp(secondaryApp)

      // Save profile to Firestore users/{uid}
      await setDoc(doc(db, 'users', uid), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      })

      toast.success(`Account created for ${name.trim()}!`)
      setName(''); setEmail(''); setPassword(''); setRole('exec')
      await loadUsers()
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/email-already-in-use') {
        toast.error('That email is already registered.')
      } else {
        toast.error(err.message || 'Could not create account.')
      }
    }
    setCreating(false)
  }

  async function handleSendReset(email) {
    try {
      await sendPasswordResetEmail(auth, email)
      toast.success(`Password reset email sent to ${email}`)
    } catch (err) {
      toast.error('Could not send reset email.')
    }
  }

  // Non-admins in the list (don't show the current admin account here to prevent accidental deletion)
  const collaborators = users.filter(u => u.role !== 'admin')
  const adminUsers    = users.filter(u => u.role === 'admin')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="User Management" backTo="/dashboard" />

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Existing users */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
            Team Members
          </h2>

          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <div className="space-y-2">
              {/* Admin accounts */}
              {adminUsers.map(u => (
                <div key={u.uid} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div>
                    <span className="text-sm font-semibold text-gray-700">{u.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{u.email}</span>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                    Admin
                  </span>
                </div>
              ))}

              {collaborators.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No collaborators yet. Create accounts below.
                </p>
              )}

              {collaborators.map(u => (
                <div key={u.uid} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{u.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    <button
                      onClick={() => handleSendReset(u.email)}
                      className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
                    >
                      Reset password
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create new account */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
            Create New Account
          </h2>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Hillary"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="their@email.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password
                <span className="text-gray-400 font-normal ml-1">(they can change it after)</span>
              </label>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              Collaborators can view all show data and add notes to any section. They cannot edit, delete, or change anything in the app.
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

      </main>
    </div>
  )
}
