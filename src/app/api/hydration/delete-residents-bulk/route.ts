import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/firebaseAdmin";

export async function POST(request: NextRequest) {
  console.log("🗑️ [DELETE RESIDENTS BULK API] Starting bulk resident deletion...");

  try {
    const { homeId, residentNames } = await request.json();

    console.log("📊 [DELETE RESIDENTS BULK API] Request parameters:", {
      homeId,
      residentCount: residentNames?.length || 0,
    });

    if (
      !homeId ||
      !residentNames ||
      !Array.isArray(residentNames) ||
      residentNames.length === 0
    ) {
      console.error(
        "❌ [DELETE RESIDENTS BULK API] Missing required parameters"
      );
      return NextResponse.json(
        {
          error:
            "Missing required parameters: homeId and residentNames (non-empty array) are required",
        },
        { status: 400 }
      );
    }

    console.log(`🏠 [DELETE RESIDENTS BULK API] Home ID: ${homeId}`);
    console.log(
      `🗑️ [DELETE RESIDENTS BULK API] Deleting ${residentNames.length} residents:`,
      residentNames
    );

    // Create a Set for faster lookup
    const namesToDelete = new Set(
      residentNames.map((name: string) => name.trim())
    );

    // Get hydration data reference
    const hydrationRef = adminDb.ref(`/${homeId}/hydration`);

    // Get all years
    const yearsSnapshot = await hydrationRef.once("value");
    if (!yearsSnapshot.exists()) {
      console.log("⚠️ [DELETE RESIDENTS BULK API] No hydration data found");
      return NextResponse.json(
        { error: "No hydration data found for this home" },
        { status: 404 }
      );
    }

    const years = yearsSnapshot.val();
    let totalDeletedCount = 0;
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
          // Check if any of these residents should be deleted
          for (const residentKey of Object.keys(residents)) {
            const resident = residents[residentKey];
            // Match by name (handle sanitized keys)
            const residentName = resident?.name || residentKey.replace(/_/g, ".");
            if (namesToDelete.has(residentName.trim())) {
              // Mark for deletion
              updates[
                `/${homeId}/hydration/${year}/${month}/${day}/${residentKey}`
              ] = null;
              totalDeletedCount++;
            }
          }
        }
      }
    }

    if (totalDeletedCount === 0) {
      console.log(
        `⚠️ [DELETE RESIDENTS BULK API] None of the specified residents were found in hydration data`
      );
      return NextResponse.json(
        {
          error: `None of the specified residents were found in hydration data`,
        },
        { status: 404 }
      );
    }

    // Perform all deletions
    await adminDb.ref().update(updates);

    console.log(
      `✅ [DELETE RESIDENTS BULK API] Removed ${totalDeletedCount} resident record(s) from ${residentNames.length} resident(s)`
    );

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${totalDeletedCount} record(s) for ${residentNames.length} resident(s)`,
      deletedCount: totalDeletedCount,
      residentCount: residentNames.length,
    });
  } catch (error) {
    console.error(
      "💥 [DELETE RESIDENTS BULK API] Error deleting residents:",
      error
    );
    return NextResponse.json(
      {
        error: "Failed to delete residents",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

