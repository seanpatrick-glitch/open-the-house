// AuthContext.jsx — makes login state and user profile available to every screen

import React, { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)  // { uid, email, orgId, role, level, scopeId }
  const [loading,     setLoading]     = useState(true)

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  function logout() {
    return signOut(auth)
  }

  function isAdmin() {
    return userProfile?.role === 'admin'
  }

  useEffect(() => {
    let profileUnsub = null

    const authUnsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)

      if (profileUnsub) {
        profileUnsub()
        profileUnsub = null
      }

      if (!user) {
        setUserProfile(null)
        setLoading(false)
        return
      }

      profileUnsub = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (!snap.exists()) {
            setUserProfile(null)
            setLoading(false)
            return
          }

          const data = snap.data()
          const orgs = data.organizations

          if (!orgs || Object.keys(orgs).length === 0) {
            setUserProfile(null)
            setLoading(false)
            return
          }

          const orgId = Object.keys(orgs)[0]
          const membership = orgs[orgId]

          setUserProfile({
            uid:     user.uid,
            email:   data.email,
            orgId,
            role:    membership.role,
            level:   membership.level,
            scopeId: membership.scopeId,
          })
          setLoading(false)
        },
        (error) => {
          console.error('AuthContext profile listener error:', error)
          setUserProfile(null)
          setLoading(false)
        }
      )
    })

    return () => {
      authUnsub()
      if (profileUnsub) profileUnsub()
    }
  }, [])

  const value = { currentUser, userProfile, loading, login, logout, isAdmin }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
