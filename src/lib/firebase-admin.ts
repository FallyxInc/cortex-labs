import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PROJECT_ID || '',
    privateKeyId: process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY_ID || '',
    privateKey: process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    clientEmail: process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL || '',
    clientId: process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_ID || '',
  };
  
  initializeApp({
    credential: cert(serviceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

const adminDb = getDatabase();

export { adminDb };

