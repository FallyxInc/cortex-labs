import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export async function POST(request: NextRequest) {
  console.log("🗑️ [DELETE RESIDENT API] Starting resident deletion...");

  try {
    const { homeId, residentName } = await request.json();

    console.log("📊 [DELETE RESIDENT API] Request parameters:", {
      homeId,
      residentName,
    });

    if (!homeId || !residentName) {
      console.error(
        "❌ [DELETE RESIDENT API] Missing required parameters"
      );
      return NextResponse.json(
        {
          error:
            "Missing required parameters: homeId and residentName are required",
        },
        { status: 400 }
      );
    }

    console.log(`🏠 [DELETE RESIDENT API] Home ID: ${homeId}`);

    // Get hydration data reference
    const hydrationRef = adminDb.ref(`/${homeId}/hydration`);

    // Get all years
    const yearsSnapshot = await hydrationRef.once("value");
    if (!yearsSnapshot.exists()) {
      console.log("⚠️ [DELETE RESIDENT API] No hydration data found");
      return NextResponse.json(
        { error: "No hydration data found for this home" },
        { status: 404 }
      );
    }

    const years = yearsSnapshot.val();
    let deletedCount = 0;
    const updates: Record<string, null> = {};

    // Iterate through all years/months/days to find and delete resident records
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
          // Check if this resident exists in this day
          for (const residentKey of Object.keys(residents)) {
            const resident = residents[residentKey];
            // Match by name (handle sanitized keys)
            if (
              resident?.name === residentName ||
              residentKey.replace(/_/g, ".") === residentName.replace(/[.#$[\]]/g, "_")
            ) {
              // Mark for deletion
              updates[`/${homeId}/hydration/${year}/${month}/${day}/${residentKey}`] = null;
              deletedCount++;
            }
          }
        }
      }
    }

    if (deletedCount === 0) {
      console.log(
        `⚠️ [DELETE RESIDENT API] Resident "${residentName}" not found in hydration data`
      );
      return NextResponse.json(
        { error: `Resident "${residentName}" not found in hydration data` },
        { status: 404 }
      );
    }

    // Perform all deletions
    await adminDb.ref().update(updates);

    console.log(
      `✅ [DELETE RESIDENT API] Removed resident "${residentName}" from ${deletedCount} record(s)`
    );

    return NextResponse.json({
      success: true,
      message: `Resident "${residentName}" has been deleted from ${deletedCount} record(s)`,
      deletedCount,
    });
  } catch (error) {
    console.error("💥 [DELETE RESIDENT API] Error deleting resident:", error);
    return NextResponse.json(
      {
        error: "Failed to delete resident",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

