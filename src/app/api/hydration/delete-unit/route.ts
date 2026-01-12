import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

/**
 * Extract unit from source filename (same logic as frontend)
 */
function extractUnitFromSource(source: string): string {
  if (!source) return "Unknown";
  const filename = source.replace(/\.pdf.*$/i, "");
  return filename || "Unknown";
}

export async function POST(request: NextRequest) {
  console.log("🗑️ [DELETE UNIT API] Starting unit deletion...");

  try {
    const { homeId, unit } = await request.json();

    console.log("📊 [DELETE UNIT API] Request parameters:", {
      homeId,
      unit,
    });

    if (!homeId || !unit) {
      console.error("❌ [DELETE UNIT API] Missing required parameters");
      return NextResponse.json(
        {
          error: "Missing required parameters: homeId and unit are required",
        },
        { status: 400 }
      );
    }

    console.log(`🏠 [DELETE UNIT API] Home ID: ${homeId}, Unit: ${unit}`);

    // Get hydration data reference
    const hydrationRef = adminDb.ref(`/${homeId}/hydration`);

    // Get all years
    const yearsSnapshot = await hydrationRef.once("value");
    if (!yearsSnapshot.exists()) {
      console.log("⚠️ [DELETE UNIT API] No hydration data found");
      return NextResponse.json(
        { error: "No hydration data found for this home" },
        { status: 404 }
      );
    }

    const years = yearsSnapshot.val();
    let deletedResidentsCount = 0;
    const updates: Record<string, null> = {};

    // Helper to normalize unit strings for comparison
    const normalizeUnit = (unitValue: string): string => {
      return String(unitValue || "").trim().toLowerCase();
    };

    const unitToDelete = normalizeUnit(String(unit));

    // Iterate through all years/months/days to find residents in the unit
    for (const year of Object.keys(years)) {
      const yearRef = hydrationRef.child(year);
      const monthsSnapshot = await yearRef.once("value");
      if (!monthsSnapshot.exists()) continue;

      const months = monthsSnapshot.val();
      for (const month of Object.keys(months)) {
        const monthRef = yearRef.child(month);
        const daysSnapshot = await monthRef.once("value");
        if (!daysSnapshot.exists()) continue;

        const days = daysSnapshot.val();
        for (const day of Object.keys(days)) {
          const dayRef = monthRef.child(day);
          const residentsSnapshot = await dayRef.once("value");
          if (!residentsSnapshot.exists()) continue;

          const residents = residentsSnapshot.val();
          for (const residentKey of Object.keys(residents)) {
            const resident = residents[residentKey];
            // Extract unit from source field
            const residentUnit = extractUnitFromSource(resident?.source || "");
            const normalizedResidentUnit = normalizeUnit(residentUnit);

            // Check if this resident's unit matches the unit to delete
            const matches =
              normalizedResidentUnit === unitToDelete ||
              (normalizedResidentUnit &&
                unitToDelete &&
                (normalizedResidentUnit.includes(unitToDelete) ||
                  unitToDelete.includes(normalizedResidentUnit)));

            if (matches) {
              // Mark for deletion
              updates[
                `/${homeId}/hydration/${year}/${month}/${day}/${residentKey}`
              ] = null;
              deletedResidentsCount++;
            }
          }
        }
      }
    }

    if (deletedResidentsCount === 0) {
      console.log(
        `⚠️ [DELETE UNIT API] No residents found in unit "${unit}"`
      );
      return NextResponse.json(
        { error: `No residents found in unit "${unit}"` },
        { status: 404 }
      );
    }

    // Perform all deletions
    await adminDb.ref().update(updates);

    console.log(
      `✅ [DELETE UNIT API] Removed ${deletedResidentsCount} resident record(s) from unit "${unit}"`
    );

    return NextResponse.json({
      success: true,
      message: `Unit "${unit}" has been deleted: ${deletedResidentsCount} resident record(s) removed`,
      deletedResidents: deletedResidentsCount,
    });
  } catch (error) {
    console.error("💥 [DELETE UNIT API] Error deleting unit:", error);
    return NextResponse.json(
      {
        error: "Failed to delete unit",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

