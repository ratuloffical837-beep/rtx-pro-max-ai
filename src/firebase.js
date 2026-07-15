// firebase.js — Firebase client init (frontend only).
// 🔴 This is a brand-new Firebase/Firestore project, separate from the old
// crypto app. Every value below is read from VITE_-prefixed env vars — no
// project ID, API key, or config value is hardcoded here. The project owner
// fills in their own values in .env / their hosting dashboard.
//
// Init is wrapped in try/catch so the app never hard-crashes on boot if
// Firebase config is missing or invalid — it just runs with db = null, and
// any screen that needs Firestore (trial counter, payment form) should
// handle that gracefully.

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let app
let db

try {
  app = initializeApp(firebaseConfig)
  db = getFirestore(app)
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('🔥 Firebase client init failed:', e.message)
  db = null
}

export { db }
export default app
