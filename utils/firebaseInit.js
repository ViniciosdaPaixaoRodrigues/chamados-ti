// Firebase initialization helper with graceful fallback
// Attempts to load service account credentials from the environment variable
// FIREBASE_SERVICE_ACCOUNT (JSON string). If not present, falls back to a
// local file named 'serviceAccountKey.json' in the project root. If neither
// is available, initializes the app with default credentials (useful for
// emulators or when running on Google Cloud where the service account is
// provided automatically.

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
  let serviceAccount = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', e);
    }
  }

  if (!serviceAccount) {
    const localPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(localPath)) {
      try {
        serviceAccount = require(localPath);
      } catch (e) {
        console.warn('Failed to load serviceAccountKey.json:', e);
      }
    }
  }

  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    console.warn('No Firebase service account found – initializing with default credentials');
    admin.initializeApp(); // may work with emulator or default GCP credentials
  }
}

module.exports = admin;
