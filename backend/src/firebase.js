// src/firebase.js — Firebase Admin SDK initialisation

const admin = require("firebase-admin");

let app;

function getFirebaseApp() {
  if (app) return app;

  // In test mode skip real Firebase initialisation entirely —
  // verifyIdToken is stubbed out so the SDK is never actually called
  if (process.env.NODE_ENV === "test") return null;

  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccount);
    } catch (err) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON: " + err.message);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
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
 * Verify a Firebase ID token.
 *
 * In NODE_ENV=test, tokens prefixed with "test_token_" are accepted without
 * hitting Firebase at all. Format: "test_token_<uid>_<email>"
 * Example: "test_token_uid_alice_alice@acme.com"
 */
async function verifyIdToken(idToken) {
  if (process.env.NODE_ENV === "test") {
    if (idToken.startsWith("test_token_")) {
      const withoutPrefix    = idToken.replace("test_token_", "");
      const firstUnderscore  = withoutPrefix.indexOf("_");
      const uid   = withoutPrefix.slice(0, firstUnderscore);
      const email = withoutPrefix.slice(firstUnderscore + 1);
      return { uid, email, name: email.split("@")[0], picture: null };
    }
    throw new Error("Invalid test token. Use format: test_token_<uid>_<email>");
  }

  getFirebaseApp();
  return admin.auth().verifyIdToken(idToken);
}

module.exports = { getFirebaseApp, verifyIdToken };
