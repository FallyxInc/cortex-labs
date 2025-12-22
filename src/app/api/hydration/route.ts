import { NextRequest, NextResponse } from 'next/server';
import { getLegacyHydrationData } from './hydration-legacy';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { HydrationResident, HydrationDataResponse } from '@/types/hydrationTypes';

/**
 * Convert legacy date format (MM/DD/YYYY) to standard date (YYYY-MM-DD)
 */
function legacyDateToStandard(legacyDate: string): string {
  const [month, day, year] = legacyDate.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Convert standard date (YYYY-MM-DD) to legacy format (MM/DD/YYYY)
 */
function standardDateToLegacy(standardDate: string): string {
  const [year, month, day] = standardDate.split('-');
  return `${month}/${day}/${year}`;
}

/**
 * Check if a date is within a date range
 */
function isDateInRange(dateStr: string, startDate: string, endDate: string): boolean {
  const date = new Date(dateStr);
  const start = new Date(startDate);
  const end = new Date(endDate);
  return date >= start && date <= end;
}

/**
 * Fetch hydration data from the default firebase (behaviours database)
 * Data is stored at /{homeId}/hydration/{year}/{month}/{date}/{residentId}
 */
async function getDefaultHydrationData(
  homeId: string,
  startDate: string,
  endDate: string
): Promise<HydrationResident[]> {
  console.log('📊 [DEFAULT HYDRATION] Fetching data from default firebase...');

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Generate list of year-month combinations to fetch
  const dateRanges: { year: number; month: string }[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0);

  while (current <= endMonth) {
    dateRanges.push({
      year: current.getFullYear(),
      month: String(current.getMonth() + 1).padStart(2, '0'),
    });
    current.setMonth(current.getMonth() + 1);
  }

  console.log(`📅 [DEFAULT HYDRATION] Fetching data for ${dateRanges.length} month(s)`);

  const residentMap = new Map<string, HydrationResident>();

  for (const { year, month } of dateRanges) {
    try {
      // Fetch the month's data
      const monthRef = adminDb.ref(`/${homeId}/hydration/${year}/${month}`);
      const snapshot = await monthRef.once('value');

      if (!snapshot.exists()) {
        console.log(`📭 [DEFAULT HYDRATION] No data for ${year}/${month}`);
        continue;
      }

      const monthData = snapshot.val();
      console.log(`📥 [DEFAULT HYDRATION] Found data for ${year}/${month}`);

      // monthData structure: { "DD": { "residentName": { intake, goal, ... } } }
      for (const day of Object.keys(monthData)) {
        const dateStr = `${year}-${month}-${day.padStart(2, '0')}`;
        const legacyDateStr = standardDateToLegacy(dateStr);

        // Check if date is within range
        if (!isDateInRange(dateStr, startDate, endDate)) {
          continue;
        }

        const dayData = monthData[day];

        for (const residentName of Object.keys(dayData)) {
          const record = dayData[residentName];

          if (!residentMap.has(residentName)) {
            residentMap.set(residentName, {
              name: residentName,
              goal: record.goal || 0,
              source: record.source || '',
              missed3Days: record.missed3Days || 'no',
              hasFeedingTube: record.hasFeedingTube || false,
              ipc_found: record.ipc_found || 'no',
              infection: record.infection || '-',
              infection_type: record.infection_type || '-',
              dateData: {},
            });
          }

          const resident = residentMap.get(residentName)!;
          resident.dateData[legacyDateStr] = record.intake || record.data || 0;

          // Update other fields if present
          if (record.goal) resident.goal = record.goal;
          if (record.source) resident.source = record.source;
          if (record.missed3Days === 'yes') resident.missed3Days = 'yes';
          if (record.hasFeedingTube) resident.hasFeedingTube = true;
          if (record.ipc_found === 'yes') {
            resident.ipc_found = 'yes';
            if (record.infection) resident.infection = record.infection;
            if (record.infection_type) resident.infection_type = record.infection_type;
          }
        }
      }
    } catch (error) {
      console.error(`❌ [DEFAULT HYDRATION] Error fetching ${year}/${month}:`, error);
    }
  }

  const residents = Array.from(residentMap.values());
  console.log(`✅ [DEFAULT HYDRATION] Fetched ${residents.length} residents from default firebase`);
  return residents;
}

/**
 * Merge legacy and default hydration data
 * Default data takes priority over legacy data for overlapping entries
 */
function mergeHydrationData(
  legacyData: HydrationResident[],
  defaultData: HydrationResident[]
): HydrationResident[] {
  console.log('🔀 [MERGE] Merging legacy and default hydration data...');

  const residentMap = new Map<string, HydrationResident>();

  // Add legacy data first
  for (const resident of legacyData) {
    residentMap.set(resident.name, { ...resident });
  }

  // Merge default data (overrides legacy for overlapping dates)
  for (const resident of defaultData) {
    if (residentMap.has(resident.name)) {
      const existing = residentMap.get(resident.name)!;

      // Merge dateData - default takes priority
      const mergedDateData = { ...existing.dateData, ...resident.dateData };

      // Update resident with default data taking priority
      residentMap.set(resident.name, {
        name: resident.name,
        goal: resident.goal || existing.goal,
        source: resident.source || existing.source,
        missed3Days: resident.missed3Days === 'yes' || existing.missed3Days === 'yes' ? 'yes' : 'no',
        hasFeedingTube: resident.hasFeedingTube || existing.hasFeedingTube,
        ipc_found: resident.ipc_found === 'yes' || existing.ipc_found === 'yes' ? 'yes' : 'no',
        infection: resident.infection !== '-' ? resident.infection : existing.infection,
        infection_type: resident.infection_type !== '-' ? resident.infection_type : existing.infection_type,
        dateData: mergedDateData,
      });
    } else {
      residentMap.set(resident.name, { ...resident });
    }
  }

  const merged = Array.from(residentMap.values());
  console.log(`✅ [MERGE] Merged ${merged.length} unique residents`);
  return merged;
}

/**
 * Filter hydration data by date range
 */
function filterByDateRange(
  residents: HydrationResident[],
  startDate: string,
  endDate: string
): HydrationResident[] {
  return residents.map(resident => {
    const filteredDateData: Record<string, number> = {};

    for (const [legacyDate, value] of Object.entries(resident.dateData) as [string, number][]) {
      const standardDate = legacyDateToStandard(legacyDate);
      if (isDateInRange(standardDate, startDate, endDate)) {
        filteredDateData[legacyDate] = value;
      }
    }

    return {
      ...resident,
      dateData: filteredDateData,
    };
  }).filter(resident => Object.keys(resident.dateData).length > 0);
}

export async function GET(request: NextRequest) {
  console.log('🚀 [HYDRATION API] Starting hydration data request...');

  // Get query parameters
  const homeId = request.nextUrl.searchParams.get('homeId');
  const retirementHome = request.nextUrl.searchParams.get('retirementHome');
  const startDate = request.nextUrl.searchParams.get('startDate');
  const endDate = request.nextUrl.searchParams.get('endDate');

  // Validate required parameters
  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Start date and end date are required' },
      { status: 400 }
    );
  }

  if (!homeId && !retirementHome) {
    return NextResponse.json(
      { error: 'Either homeId or retirementHome is required' },
      { status: 400 }
    );
  }

  try {
    let hydrationId: string | null = null;
    const resolvedHomeId = homeId;

    // If homeId is provided, look up hydrationId from home config
    if (homeId) {
      console.log(`🏠 [HYDRATION API] Looking up hydrationId for home: ${homeId}`);
      const homeRef = adminDb.ref(`/${homeId}`);
      const homeSnapshot = await homeRef.once('value');

      if (!homeSnapshot.exists()) {
        return NextResponse.json(
          { error: 'Home not found' },
          { status: 404 }
        );
      }

      const homeData = homeSnapshot.val();
      hydrationId = homeData.hydrationId || null;

      // Get display name for legacy lookup if hydrationId exists
      if (hydrationId) {
        console.log(`🔗 [HYDRATION API] Found hydrationId: ${hydrationId}`);
      } else {
        console.log(`📭 [HYDRATION API] No hydrationId configured for home: ${homeId}`);
      }
    } else if (retirementHome) {
      // Use retirementHome directly for legacy lookup
      hydrationId = retirementHome;
      console.log(`🏠 [HYDRATION API] Using retirementHome for legacy lookup: ${retirementHome}`);
    }

    // Fetch data from both sources
    let legacyData: HydrationResident[] = [];
    let defaultData: HydrationResident[] = [];

    // Fetch legacy data if hydrationId is available
    if (hydrationId) {
      try {
        const rawLegacyData = await getLegacyHydrationData('home_manager', hydrationId);
        legacyData = rawLegacyData as HydrationResident[];
        console.log(`📊 [HYDRATION API] Legacy data: ${legacyData.length} residents`);
      } catch (error) {
        console.error('❌ [HYDRATION API] Error fetching legacy data:', error);
        // Continue without legacy data
      }
    }

    // Fetch default data if homeId is available
    if (resolvedHomeId) {
      try {
        defaultData = await getDefaultHydrationData(resolvedHomeId, startDate, endDate);
        console.log(`📊 [HYDRATION API] Default data: ${defaultData.length} residents`);
      } catch (error) {
        console.error('❌ [HYDRATION API] Error fetching default data:', error);
        // Continue without default data
      }
    }

    // Handle case with no data from either source
    if (legacyData.length === 0 && defaultData.length === 0) {
      console.log('📭 [HYDRATION API] No data found from any source');
      const response: HydrationDataResponse = {
        success: true,
        data: [],
        startDate,
        endDate,
        homeId: resolvedHomeId || '',
        hydrationId: hydrationId || undefined,
        sources: {
          legacy: 0,
          default: 0,
          merged: 0,
        },
      };
      return NextResponse.json(response);
    }

    // Merge data from both sources
    let mergedData: HydrationResident[];

    if (legacyData.length > 0 && defaultData.length > 0) {
      mergedData = mergeHydrationData(legacyData, defaultData);
    } else if (defaultData.length > 0) {
      mergedData = defaultData;
    } else {
      mergedData = legacyData;
    }

    // Filter by date range
    const filteredData = filterByDateRange(mergedData, startDate, endDate);

    console.log(`🎉 [HYDRATION API] Returning ${filteredData.length} residents`);

    const response: HydrationDataResponse = {
      success: true,
      data: filteredData,
      startDate,
      endDate,
      homeId: resolvedHomeId || '',
      hydrationId: hydrationId || undefined,
      sources: {
        legacy: legacyData.length,
        default: defaultData.length,
        merged: filteredData.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ [HYDRATION API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch hydration data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('📝 [HYDRATION API] Processing POST request...');

  try {
    const body = await request.json();
    const { homeId, date, residents } = body;

    // Validate required fields
    if (!homeId || !date || !residents) {
      return NextResponse.json(
        { error: 'homeId, date, and residents are required' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Date must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    // Parse date components
    const [year, month, day] = date.split('-');

    // Verify home exists
    const homeRef = adminDb.ref(`/${homeId}`);
    const homeSnapshot = await homeRef.once('value');

    if (!homeSnapshot.exists()) {
      return NextResponse.json(
        { error: 'Home not found' },
        { status: 404 }
      );
    }

    // Write data to firebase at /{homeId}/hydration/{year}/{month}/{day}/{residentName}
    const hydrationRef = adminDb.ref(`/${homeId}/hydration/${year}/${month}/${day}`);

    const updates: Record<string, {
      name: string;
      intake: number;
      goal: number;
      source: string;
      missed3Days: string;
      hasFeedingTube: boolean;
      ipc_found: string;
      infection: string;
      infection_type: string;
      updatedAt: string;
    }> = {};
    for (const resident of residents) {
      if (!resident.name) {
        continue;
      }

      // Sanitize resident name for use as a key
      const sanitizedName = resident.name.replace(/[.#$[\]]/g, '_');

      updates[sanitizedName] = {
        name: resident.name,
        intake: resident.intake || 0,
        goal: resident.goal || 0,
        source: resident.source || '',
        missed3Days: resident.missed3Days || 'no',
        hasFeedingTube: resident.hasFeedingTube || false,
        ipc_found: resident.ipc_found || 'no',
        infection: resident.infection || '-',
        infection_type: resident.infection_type || '-',
        updatedAt: new Date().toISOString(),
      };
    }

    await hydrationRef.update(updates);

    console.log(`✅ [HYDRATION API] Saved ${Object.keys(updates).length} resident records for ${date}`);

    return NextResponse.json({
      success: true,
      message: `Saved hydration data for ${Object.keys(updates).length} residents`,
      date,
      homeId,
    });
  } catch (error) {
    console.error('❌ [HYDRATION API] Error saving hydration data:', error);
    return NextResponse.json(
      {
        error: 'Failed to save hydration data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
