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
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)  // { uid, email, role, venueId }
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        const userVenueSnap = await getDoc(doc(db, 'userVenues', user.uid))
        if (!userVenueSnap.exists()) {
          setUserProfile(null)
          setLoading(false)
          return
        }

        const { venueId } = userVenueSnap.data()
        const profileSnap = await getDoc(doc(db, 'venues', venueId, 'users', user.uid))
        if (!profileSnap.exists()) {
          setUserProfile(null)
          setLoading(false)
          return
        }

        const data = profileSnap.data()
        setUserProfile({
          uid:     data.uid,
          email:   data.email,
          role:    data.role,
          venueId,
        })
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = { currentUser, userProfile, loading, login, logout, isAdmin }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
