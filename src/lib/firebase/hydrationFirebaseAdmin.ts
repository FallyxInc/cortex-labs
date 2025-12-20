import { initializeApp, getApps, cert, ServiceAccount, App } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

// Check if we have the required environment variables
const hasRequiredEnvVars = () => {
  return !!(
    process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PROJECT_ID &&
    process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PRIVATE_KEY &&
    process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_CLIENT_EMAIL
  );
};

// Lazy initialization function
function initializeFirebaseAdmin(): App | null {
  // Skip initialization if environment variables are not set (e.g., during build)
  if (!hasRequiredEnvVars()) {
    console.warn('[Firebase Admin] Skipping initialization - environment variables not set');
    return null;
  }

  if (!getApps().length) {
    try {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PROJECT_ID!,
        private_key_id: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PRIVATE_KEY_ID || '',
        private_key: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        client_email: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_CLIENT_EMAIL!,
        client_id: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_CLIENT_ID || '',
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_CLIENT_X509_CERT_URL || '',
        universe_domain: "googleapis.com",
      };

      return initializeApp({
        credential: cert(serviceAccount as ServiceAccount),
        databaseURL: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_DATABASE_URL,
        storageBucket: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_STORAGE_BUCKET,
      });
    } catch (error) {
      console.error('[Firebase Admin] Initialization error:', error);
      return null;
    }
  }
  return getApps()[0];
}

// Cache for lazy-loaded instances
let _adminDb: Database | null = null;
let _adminFirestore: Firestore | null = null;
let _adminStorage: Storage | null = null;

// Getter functions for lazy initialization
function getAdminDb(): Database {
  if (!_adminDb) {
    const app = initializeFirebaseAdmin();
    if (!app) {
      throw new Error('[Firebase Admin] Cannot get Database - Firebase Admin not initialized');
    }
    _adminDb = getDatabase();
  }
  return _adminDb;
}

function getAdminFirestore(): Firestore {
  if (!_adminFirestore) {
    const app = initializeFirebaseAdmin();
    if (!app) {
      throw new Error('[Firebase Admin] Cannot get Firestore - Firebase Admin not initialized');
    }
    _adminFirestore = getFirestore();
  }
  return _adminFirestore;
}

function getAdminStorage(): Storage {
  if (!_adminStorage) {
    const app = initializeFirebaseAdmin();
    if (!app) {
      throw new Error('[Firebase Admin] Cannot get Storage - Firebase Admin not initialized');
    }
    _adminStorage = getStorage();
  }
  return _adminStorage;
}

// Use Proxy to create lazy-loading exports
export const adminDb = new Proxy({} as Database, {
  get: (target, prop) => {
    const db = getAdminDb();
    return (db as any)[prop];
  },
  set: (target, prop, value) => {
    const db = getAdminDb();
    (db as any)[prop] = value;
    return true;
  }
});

export const adminFirestore = new Proxy({} as Firestore, {
  get: (target, prop) => {
    const firestore = getAdminFirestore();
    return (firestore as any)[prop];
  },
  set: (target, prop, value) => {
    const firestore = getAdminFirestore();
    (firestore as any)[prop] = value;
    return true;
  }
});

export const adminStorage = new Proxy({} as Storage, {
  get: (target, prop) => {
    const storage = getAdminStorage();
    return (storage as any)[prop];
  },
  set: (target, prop, value) => {
    const storage = getAdminStorage();
    (storage as any)[prop] = value;
    return true;
  }
});

