// AuthContext.jsx — makes login state and user profile available to every screen

import React, { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser,    setCurrentUser]    = useState(null)
  const [userProfile,    setUserProfile]    = useState(null)  // { name, role }
  const [loading,        setLoading]        = useState(true)

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  function logout() {
    return signOut(auth)
  }

  // Returns true if the logged-in user is the admin (you)
  function isAdmin() {
    return userProfile?.role === 'admin'
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        // Load the user's name and role from Firestore users/{uid}
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists()) {
          setUserProfile(snap.data())
        } else {
          // Fallback — treat as admin if no profile doc exists yet
          setUserProfile({ name: user.email, role: 'admin' })
        }
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = { currentUser, userProfile, login, logout, isAdmin }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
