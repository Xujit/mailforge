// src/firebase.js — Firebase client SDK setup

import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// ── Config ────────────────────────────────────────────────────────────────────
// All VITE_* vars are injected at build time from .env
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const google   = new GoogleAuthProvider();

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Sign up with email + password */
export async function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/** Sign in with email + password */
export async function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/** Sign in with Google popup */
export async function signInWithGoogle() {
  return signInWithPopup(auth, google);
}

/** Sign out */
export async function logout() {
  return signOut(auth);
}

/** Get fresh ID token (Firebase auto-refreshes every hour) */
export async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

/** Subscribe to auth state changes */
export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth };
