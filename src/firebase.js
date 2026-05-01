// firebase.js — connects your app to all Firebase services
// The values come from your .env.local file (never hard-coded here)

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyAcfAWxvJj0tThNZY7PDrEicaLhbFdsppg",
  authDomain: "open-the-house.firebaseapp.com",
  projectId: "open-the-house",
  storageBucket: "open-the-house.firebasestorage.app",
  messagingSenderId: "882406284232",
  appId: "1:882406284232:web:76e4a421f3e9c4a5bd7efd"
}

const app = initializeApp(firebaseConfig)

export const db      = getFirestore(app)   // Firestore database
export const storage = getStorage(app)     // File storage
export const auth    = getAuth(app)        // Authentication

export { firebaseConfig }
export default app
