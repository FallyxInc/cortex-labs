/**
 * Centralized Home Name Mappings
 * 
 * This file provides mappings between different naming conventions used throughout the system:
 * - Home IDs (used in Firebase/database): e.g., "millCreek", "berkshire"
 * - Python Directory Names (used in python/ folder): e.g., "millcreek", "berkshire"
 * - Home Names (used in UI/forms): e.g., "mill_creek_care", "berkshire_care"
 * 
 * Mappings are now stored in Firebase and auto-generated when creating homes via the UI.
 * The hardcoded mappings below serve as fallback for backwards compatibility.
 */

import { get, ref } from 'firebase/database';
import { db } from './firebase/firebase';

export interface HomeMapping {
  /** Home ID used in Firebase/database (camelCase) */
  firebaseId: string;
  /** Python directory name (lowercase, no underscores) */
  pythonDir: string;
  homeName: string; 
  displayName: string;
}

const HOMES: Record<string, HomeMapping> = {
  millCreek: {
    firebaseId: 'millCreek',
    pythonDir: 'millcreek',
    homeName: 'mill_creek_care',
    displayName: 'Mill Creek Care'
  },
  berkshire: {
    firebaseId: 'berkshire',
    pythonDir: 'berkshire',
    homeName: 'berkshire_care',
    displayName: 'Berkshire Care'
  },
  banwell: {
    firebaseId: 'banwell',
    pythonDir: 'banwell',
    homeName: 'banwell_gardens',
    displayName: 'Banwell Gardens'
  },
  oneill: {
    firebaseId: 'oneill',
    pythonDir: 'oneill',
    homeName: 'the_oneill',
    displayName: 'The O\'Neill'
  },
  franklingardens: {
    firebaseId: 'franklingardens',
    pythonDir: 'franklingardens',
    homeName: 'franklingardens',
    displayName: 'Franklin Gardens'
  },
  test: {
    firebaseId: 'test',
    pythonDir: 'test',
    homeName: 'test',
    displayName: 'Test'
  },
}
/**
 * Complete mapping of all homes in the system.
 * When adding a new home, add an entry here with all four identifiers.
 */
export const HOME_MAPPINGS: Record<string, HomeMapping> = {
  // Mill Creek
  millCreek: HOMES.millCreek,
  mill_creek_care: HOMES.millCreek,
  MCB: HOMES.millCreek,
  
  // Berkshire
  berkshire_care: HOMES.berkshire,
  berkshire: HOMES.berkshire,
  
  // Banwell
  banwell_gardens: HOMES.banwell,
  banwell: HOMES.banwell,
  
  // The O'Neill
  the_oneill: HOMES.oneill,
  ONCB: HOMES.oneill,
  oneill: HOMES.oneill,
  
  // Franklin Gardens
  franklingardens: HOMES.franklingardens,
  // Test
  // test: HOMES.test,
};


// Cache for Firebase mappings to avoid repeated reads
let firebaseMappingsCache: Record<string, HomeMapping> = {};
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load mappings from Firebase (with caching)
 */
async function loadFirebaseMappingsAdmin(): Promise<Record<string, HomeMapping>> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (Object.keys(firebaseMappingsCache).length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    return firebaseMappingsCache;
  }

  try {
    // Only import Firebase admin on the server side
    if (typeof window === 'undefined') {
      const { adminDb } = await import('@/lib/firebase/firebaseAdmin');
      const mappingsRef = adminDb.ref('/homeMappings');
      const snapshot = await mappingsRef.once('value');
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        firebaseMappingsCache = (data || {}) as Record<string, HomeMapping>;
        cacheTimestamp = now;
        return firebaseMappingsCache;
      }
    }
  } catch (error) {
    console.warn('Failed to load Firebase mappings, using fallback:', error);
  }

  firebaseMappingsCache = {};
  return {};
}

async function loadFirebaseMappings(): Promise<Record<string, HomeMapping>> {
  const mappingsRef = ref(db, "/homeMappings");
  const snapshot = await get(mappingsRef);
  return snapshot.val() as Record<string, HomeMapping>;
}

/**
 * Get home name from any home identifier (async - checks FirebaseAdmin)
 */
export async function getHomeNameAdmin(home: string): Promise<string> {

  const firebaseMappings = await loadFirebaseMappingsAdmin();
  const mappings = { ...HOME_MAPPINGS, ...(firebaseMappings || {}) };
  const mapping = mappings[home];
  return mapping?.homeName || home;
}
/**
 * Get home name from any home identifier (async - checks FirebaseAdmin)
 */
export async function getHomeDisplayNameAdmin(home: string): Promise<string> {

  const firebaseMappings = await loadFirebaseMappingsAdmin();
  const mappings = { ...HOME_MAPPINGS, ...(firebaseMappings || {}) };
  const mapping = mappings[home];
  return mapping?.displayName || home;
}

export async function getHomeName(home: string): Promise<string> {
  const firebaseMappings = await loadFirebaseMappings();
  const mappings = { ...HOME_MAPPINGS, ...(firebaseMappings || {}) };
  const mapping = mappings[home];
  return mapping?.homeName || home;
}

export async function getHomeDisplayNamesAdmin() : Promise<string[]> {
  const firebaseMappings = await loadFirebaseMappingsAdmin();
  const mappings = { ...HOME_MAPPINGS, ...(firebaseMappings || {}) };
  return Object.values(mappings).map(mapping => mapping.displayName);
}

