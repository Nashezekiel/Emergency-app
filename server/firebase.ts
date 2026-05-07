import admin from "firebase-admin";

let _app: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App {
  if (_app) return _app;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "[Firebase] Missing credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env"
    );
  }

  if (!admin.apps.length) {
    _app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      storageBucket: `${projectId}.firebasestorage.app`,
    });
  } else {
    _app = admin.apps[0]!;
  }

  console.log("[Firebase] Admin SDK initialized for project:", projectId);
  return _app;
}

export function getFirestore() {
  return getFirebaseAdmin().firestore();
}

export function getStorage() {
  return getFirebaseAdmin().storage();
}
