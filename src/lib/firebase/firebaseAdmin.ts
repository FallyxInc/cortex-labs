import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getDatabase, Database } from "firebase-admin/database";

const BEHAVIOURS_APP_NAME = "behaviours";

// Check if we have the required environment variables
const hasRequiredEnvVars = (): boolean => {
  return !!(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  );
};

// Get the behaviours app by name, or initialize it if it doesn't exist
function getBehavioursApp(): App | null {
  // Skip initialization if environment variables are not set (e.g., during build)
  if (!hasRequiredEnvVars()) {
    console.warn('[Behaviours Firebase Admin] Skipping initialization - environment variables not set');
    return null;
  }

  // Check if the behaviours app already exists
  const existingApps = getApps();
  const existingApp = existingApps.find(app => app.name === BEHAVIOURS_APP_NAME);

  if (existingApp) {
    return existingApp;
  }

  // Initialize the behaviours app
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "",
      project_id: process.env.FIREBASE_ADMIN_PROJECT_ID || "",
      privateKeyId: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID || "",
      privateKey:
        process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || "",
      clientId: process.env.FIREBASE_ADMIN_CLIENT_ID || "",
    };

    return initializeApp(
      {
        credential: cert(serviceAccount),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      },
      BEHAVIOURS_APP_NAME
    );
  } catch (error) {
    console.error('[Behaviours Firebase Admin] Initialization error:', error);
    return null;
  }
}

// Cache for lazy-loaded database instance
let _adminDb: Database | null = null;

// Getter function for lazy initialization
function getAdminDatabase(): Database {
  if (!_adminDb) {
    const app = getBehavioursApp();
    if (!app) {
      throw new Error('[Behaviours Firebase Admin] Cannot get Database - Firebase Admin not initialized');
    }
    _adminDb = getDatabase(app);
  }
  return _adminDb;
}

// Export a getter that lazily initializes the database
// This allows the database to be accessed like a regular variable
// while still supporting lazy initialization
export const adminDb: Database = new Proxy({} as Database, {
  get: (_target, prop) => {
    const db = getAdminDatabase();
    const value = (db as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(db);
    }
    return value;
  },
  set: (_target, prop, value) => {
    const db = getAdminDatabase();
    (db as unknown as Record<string | symbol, unknown>)[prop] = value;
    return true;
  }
});
