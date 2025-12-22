import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { adminFirestore } from '@/lib/firebase/hydrationFirebaseAdmin';

// Retirement home name mapping to URL-safe identifiers
export const retirementHomeMapping: Record<string, string> = {
  'Cedar Grove': 'cedar-grove',
  'Responsive Senior Living': 'responsive-senior-living',
  'Eatonville': 'eatonville',
  'Hawthorne': 'hawthorne',
  'Sprucedale': 'sprucedale'
};

// Function to get URL-safe identifier for retirement home
export function getHomeIdentifier(displayName: string): string {
  const identifier = retirementHomeMapping[displayName];
  if (identifier) {
    console.log(`🏠 [MAPPING] Mapped "${displayName}" to "${identifier}"`);
    return identifier;
  }
  
  // Fallback: convert to URL-safe format
  const fallback = displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  console.log(`🏠 [MAPPING] Fallback mapping "${displayName}" to "${fallback}"`);
  return fallback;
}


// Function to parse JavaScript dashboard file and extract hydrationData array
function parseDashboardFile(content: string): any[] {
  // Extract the hydrationData array from the JavaScript file
  const match = content.match(/const hydrationData = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Could not parse dashboard file - hydrationData not found');
  }
  
  try {
    // Use eval to parse the JavaScript array (safe in server context)
    const hydrationData = eval(`(${match[1]})`);
    return hydrationData;
  } catch (error) {
    throw new Error(`Failed to parse hydrationData: ${error}`);
  }
}

// Function to convert date from filename format (MM_DD_YYYY) to CSV format (MM/DD/YYYY)
function convertDateFormat(dateStr: string): string {
  return dateStr.replace(/_/g, '/');
}


// Function to access Firestore dashboard data
async function accessFirestoreData(userRole: string, retirementHome: string) {
  console.log('🔥 [FIRESTORE DATA] Accessing Firestore dashboard data...');

  try {
    if (userRole === 'admin') {
      // Admin sees all data - for now, use the first available home's data
      if (!retirementHome) {
        throw new Error('Admin access requires retirement home parameter');
      }
      const homeIdentifier = getHomeIdentifier(retirementHome);
      console.log('👑 [FIRESTORE DATA] Admin access - using dashboard-data collection:', `${homeIdentifier}/dashboard-data`);

      // Get all dashboard documents from Firestore
      console.log('📥 [FIRESTORE DATA] Fetching dashboard documents from Firestore...');
      const dashboardDocs = await adminFirestore
        .collection('retirement-homes')
        .doc(homeIdentifier)
        .collection('dashboard-data')
        .get();

      if (dashboardDocs.empty) {
        console.log('❌ [FIRESTORE DATA] No dashboard documents found in Firestore');
        throw new Error('Dashboard data not found in Firestore');
      }

      console.log(`📊 [FIRESTORE DATA] Found ${dashboardDocs.size} dashboard documents`);

      // Combine all dashboard files into a single resident map
      const residentMap = new Map<string, any>();

      dashboardDocs.forEach((docSnapshot) => {
        try {
          const data = docSnapshot.data();
          const jsData = data.jsData;
          const dateStr = convertDateFormat(docSnapshot.id); // doc ID is in format MM_DD_YYYY

          if (!jsData) {
            console.log(`⚠️ [FIRESTORE DATA] Dashboard document ${docSnapshot.id} has no jsData field`);
            return;
          }

          console.log(`📅 [FIRESTORE DATA] Processing date: ${dateStr} from document: ${docSnapshot.id}`);

          // Parse the JavaScript file
          const hydrationData = parseDashboardFile(jsData);
          console.log(`✅ [FIRESTORE DATA] Parsed ${hydrationData.length} residents from document ${docSnapshot.id}`);

          // Merge data for each resident
          for (const resident of hydrationData) {
            const residentName = resident.name;

            if (!residentMap.has(residentName)) {
              // First time seeing this resident - initialize
              residentMap.set(residentName, {
                name: residentName,
                goal: resident.goal || 0,
                source: resident.source || '',
                missed3Days: resident.missed3Days || 'no',
                hasFeedingTube: resident.hasFeedingTube || false,
                ipc_found: resident.ipc_found || 'no',
                infection: resident.infection || '-',
                infection_type: resident.infection_type || '-',
                dateData: {}
              });
            }

            // Add data for this date
            const existingResident = residentMap.get(residentName);
            existingResident.dateData[dateStr] = resident.data || 0;

            // Update other fields if they're missing or empty
            if (!existingResident.source && resident.source) {
              existingResident.source = resident.source;
            }
            if (existingResident.missed3Days === 'no' && resident.missed3Days === 'yes') {
              existingResident.missed3Days = 'yes';
            }
            // Update IPC fields if they exist in the data
            if (resident.ipc_found && resident.ipc_found === 'yes') {
              existingResident.ipc_found = 'yes';
              if (resident.infection) {
                existingResident.infection = resident.infection;
              }
              if (resident.infection_type) {
                existingResident.infection_type = resident.infection_type;
              }
            }
          }
        } catch (error) {
          console.error(`❌ [FIRESTORE DATA] Error processing dashboard document ${docSnapshot.id}:`, error);
          // Continue with other documents
        }
      });

      const residents = Array.from(residentMap.values());
      console.log(`✅ [FIRESTORE DATA] Combined ${residents.length} unique residents from ${dashboardDocs.size} dashboard documents`);
      return residents;
    } else if (userRole === 'home_manager' && retirementHome) {
      // Home manager sees only their home's data
      const homeIdentifier = getHomeIdentifier(retirementHome);
      console.log('🏠 [FIRESTORE DATA] Home manager access - using dashboard-data collection:', `${homeIdentifier}/dashboard-data`);

      // Get all dashboard documents from Firestore
      console.log('📥 [FIRESTORE DATA] Fetching dashboard documents from Firestore...');
      const dashboardDocs = await adminFirestore
        .collection('retirement-homes')
        .doc(homeIdentifier)
        .collection('dashboard-data')
        .get();

      if (dashboardDocs.empty) {
        console.log('❌ [FIRESTORE DATA] No dashboard documents found in Firestore');
        throw new Error('Dashboard data not found in Firestore');
      }

      console.log(`📊 [FIRESTORE DATA] Found ${dashboardDocs.size} dashboard documents`);

      // Combine all dashboard files into a single resident map
      const residentMap = new Map<string, any>();

      dashboardDocs.forEach((docSnapshot) => {
        try {
          const data = docSnapshot.data();
          const jsData = data.jsData;
          const dateStr = convertDateFormat(docSnapshot.id); // doc ID is in format MM_DD_YYYY

          if (!jsData) {
            console.log(`⚠️ [FIRESTORE DATA] Dashboard document ${docSnapshot.id} has no jsData field`);
            return;
          }

          console.log(`📅 [FIRESTORE DATA] Processing date: ${dateStr} from document: ${docSnapshot.id}`);

          // Parse the JavaScript file
          const hydrationData = parseDashboardFile(jsData);
          console.log(`✅ [FIRESTORE DATA] Parsed ${hydrationData.length} residents from document ${docSnapshot.id}`);

          // Merge data for each resident
          for (const resident of hydrationData) {
            const residentName = resident.name;

            if (!residentMap.has(residentName)) {
              // First time seeing this resident - initialize
              residentMap.set(residentName, {
                name: residentName,
                goal: resident.goal || 0,
                source: resident.source || '',
                missed3Days: resident.missed3Days || 'no',
                hasFeedingTube: resident.hasFeedingTube || false,
                ipc_found: resident.ipc_found || 'no',
                infection: resident.infection || '-',
                infection_type: resident.infection_type || '-',
                dateData: {}
              });
            }

            // Add data for this date
            const existingResident = residentMap.get(residentName);
            existingResident.dateData[dateStr] = resident.data || 0;

            // Update other fields if they're missing or empty
            if (!existingResident.source && resident.source) {
              existingResident.source = resident.source;
            }
            if (existingResident.missed3Days === 'no' && resident.missed3Days === 'yes') {
              existingResident.missed3Days = 'yes';
            }
            // Update IPC fields if they exist in the data
            if (resident.ipc_found && resident.ipc_found === 'yes') {
              existingResident.ipc_found = 'yes';
              if (resident.infection) {
                existingResident.infection = resident.infection;
              }
              if (resident.infection_type) {
                existingResident.infection_type = resident.infection_type;
              }
            }
          }
        } catch (error) {
          console.error(`❌ [FIRESTORE DATA] Error processing dashboard document ${docSnapshot.id}:`, error);
          // Continue with other documents
        }
      });

      const residents = Array.from(residentMap.values());
      console.log(`✅ [FIRESTORE DATA] Combined ${residents.length} unique residents from ${dashboardDocs.size} dashboard documents`);
      return residents;
    } else {
      throw new Error('Invalid user role or missing retirement home');
    }
  } catch (error) {
    console.error('❌ [FIRESTORE DATA] Error accessing Firestore:', error);
    console.error('❌ [FIRESTORE DATA] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code || 'No code',
      stack: error instanceof Error ? error.stack : 'No stack'
    });
    
    // Check for specific Firestore error codes
    const errorCode = (error as any)?.code;
    if (errorCode) {
      console.error('🔍 [FIRESTORE DATA] Firestore error code:', errorCode);
      switch (errorCode) {
        case 'permission-denied':
          console.error('🔍 [FIRESTORE DATA] Permission denied: Check Firestore security rules');
          break;
        case 'unavailable':
          console.error('🔍 [FIRESTORE DATA] Service unavailable: Check Firestore configuration');
          break;
        case 'unauthenticated':
          console.error('🔍 [FIRESTORE DATA] Unauthenticated: User not authenticated');
          break;
        case 'invalid-argument':
          console.error('🔍 [FIRESTORE DATA] Invalid argument: Check data format');
          break;
        case 'failed-precondition':
          console.error('🔍 [FIRESTORE DATA] Failed precondition: Check Firestore setup');
          break;
        default:
          console.error('🔍 [FIRESTORE DATA] Other Firestore error:', errorCode);
      }
    }
    
    throw error;
  }
}

export async function getLegacyHydrationData (userRole: string, retirementHome: string): Promise<unknown[]> {
  console.log('🚀 [HYDRATION DATA API] Starting hydration data request...');
  
  try {

    // Validate user role and retirement home
    if (!userRole || (userRole === 'home_manager' && !retirementHome)) {
      console.log('❌ [HYDRATION DATA API] Error: Invalid user role or missing retirement home', { userRole, retirementHome });
      return []
    }

    // Try Firestore first, fallback to local data
    let residents: unknown[] = [];
    
    try {
      console.log('🔥 [HYDRATION DATA API] Attempting to fetch data from Firestore...');
      residents = await accessFirestoreData(userRole, retirementHome);
      console.log('✅ [HYDRATION DATA API] Successfully fetched data from Firestore');
    } catch (firestoreError) {
      console.log('❌ [HYDRATION DATA API] Firestore Failed: ', firestoreError);
      return []
      
    }

    console.log('🎉 [HYDRATION DATA API] Hydration data request completed successfully');
    return residents
  } catch (error) {
    console.error('Error reading hydration data:', error);
    throw error
  }
}
