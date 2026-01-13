import { initializeApp, getApps, cert, ServiceAccount, App } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

const HYDRATION_APP_NAME = "hydration";

// Check if we have the required environment variables
const hasRequiredEnvVars = (): boolean => {
  return !!(
    process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PROJECT_ID &&
    process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PRIVATE_KEY &&
    process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_CLIENT_EMAIL
  );
};

// Get the hydration app by name, or initialize it if it doesn't exist
function getHydrationApp(): App | null {
  // Skip initialization if environment variables are not set (e.g., during build)
  if (!hasRequiredEnvVars()) {
    console.warn('[Hydration Firebase Admin] Skipping initialization - environment variables not set');
    return null;
  }

  // Check if the hydration app already exists
  const existingApps = getApps();
  const existingApp = existingApps.find(app => app.name === HYDRATION_APP_NAME);

  if (existingApp) {
    return existingApp;
  }

  // Initialize the hydration app
  try {
    const rawKey = process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PRIVATE_KEY;
    const processedKey = rawKey?.replace(/\\n/g, '\n');
    
    console.log('[Hydration Firebase Admin] Debug Config:', {
      projectId: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_CLIENT_EMAIL,
      rawKeyLength: rawKey?.length,
      processedKeyLength: processedKey?.length,
      keyStart: processedKey?.substring(0, 30),
      keyEnd: processedKey?.substring(processedKey.length - 30)
    });

    const serviceAccount = {
      type: "service_account",
      project_id: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PROJECT_ID,
      private_key_id: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_PRIVATE_KEY_ID || '',
      private_key: processedKey,
      client_email: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_CLIENT_EMAIL,
      client_id: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_CLIENT_ID || '',
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_ADMIN_CLIENT_X509_CERT_URL || '',
      universe_domain: "googleapis.com",
    };

    return initializeApp(
      {
        credential: cert(serviceAccount as ServiceAccount),
        databaseURL: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_DATABASE_URL,
        storageBucket: process.env.NEXT_PUBLIC_HYDRATION_FIREBASE_STORAGE_BUCKET,
      },
      HYDRATION_APP_NAME
    );
  } catch (error) {
    console.error('[Hydration Firebase Admin] Initialization error:', error);
    return null;
  }
}

// Cache for lazy-loaded instances
let _hydrationDb: Database | null = null;
let _hydrationFirestore: Firestore | null = null;
let _hydrationStorage: Storage | null = null;

/**
 * Get the Hydration Firebase Realtime Database instance.
 * Lazily initializes the Firebase Admin app if not already initialized.
 */
export function getHydrationDatabase(): Database {
  if (!_hydrationDb) {
    const app = getHydrationApp();
    if (!app) {
      throw new Error('[Hydration Firebase Admin] Cannot get Database - Firebase Admin not initialized');
    }
    _hydrationDb = getDatabase(app);
  }
  return _hydrationDb;
}

/**
 * Get the Hydration Firebase Firestore instance.
 * Lazily initializes the Firebase Admin app if not already initialized.
 */
export function getHydrationFirestoreInstance(): Firestore {
  if (!_hydrationFirestore) {
    const app = getHydrationApp();
    if (!app) {
      throw new Error('[Hydration Firebase Admin] Cannot get Firestore - Firebase Admin not initialized');
    }
    _hydrationFirestore = getFirestore(app);
  }
  return _hydrationFirestore;
}

/**
 * Get the Hydration Firebase Storage instance.
 * Lazily initializes the Firebase Admin app if not already initialized.
 */
export function getHydrationStorageInstance(): Storage {
  if (!_hydrationStorage) {
    const app = getHydrationApp();
    if (!app) {
      throw new Error('[Hydration Firebase Admin] Cannot get Storage - Firebase Admin not initialized');
    }
    _hydrationStorage = getStorage(app);
  }
  return _hydrationStorage;
}

// Backward-compatible exports using getter object pattern
// Usage: import { adminDb } from './hydrationFirebaseAdmin'; adminDb.ref(...)
export const adminDb: Database = Object.defineProperty({}, 'ref', {
  get() {
    return getHydrationDatabase().ref.bind(getHydrationDatabase());
  }
}) as Database;

export const adminFirestore: Firestore = Object.defineProperty({}, 'collection', {
  get() {
    return getHydrationFirestoreInstance().collection.bind(getHydrationFirestoreInstance());
  }
}) as Firestore;

export const adminStorage: Storage = Object.defineProperty({}, 'bucket', {
  get() {
    return getHydrationStorageInstance().bucket.bind(getHydrationStorageInstance());
  }
}) as Storage;
