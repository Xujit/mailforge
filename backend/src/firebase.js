// src/firebase.js — Firebase Admin SDK initialisation
//
// Supports two credential strategies:
//   1. FIREBASE_SERVICE_ACCOUNT env var — JSON string of the service account key
//      (recommended for production / CI)
//   2. GOOGLE_APPLICATION_CREDENTIALS env var — path to the service account JSON file
//      (convenient for local dev)

const admin = require("firebase-admin");

let app;

function getFirebaseApp() {
  if (app) return app;

  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Option 1: JSON string in env var (preferred for VPS / GitHub Actions secrets)
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } catch (err) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON: " + err.message);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Option 2: Path to service account JSON file
    credential = admin.credential.applicationDefault();
  } else {
    throw new Error(
      "Firebase Admin not configured.\n" +
      "Set FIREBASE_SERVICE_ACCOUNT (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path) in .env"
    );
  }

  app = admin.initializeApp({ credential });
  console.log("🔥  Firebase Admin SDK initialised");
  return app;
}

/**
 * Verify a Firebase ID token and return the decoded claims.
 * Throws if the token is invalid or expired.
 */
async function verifyIdToken(idToken) {
  getFirebaseApp();
  return admin.auth().verifyIdToken(idToken);
}

module.exports = { getFirebaseApp, verifyIdToken };
