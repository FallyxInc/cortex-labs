import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  };
  
  initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

const adminDb = getDatabase();

export { adminDb };

