// TypeScript port of update.py - Firebase synchronization

import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import { adminDb } from "@/lib/firebase-admin";

interface UpdateFieldMapping {
  [key: string]: string;
}

const UPDATE_FIELD_MAPPING: UpdateFieldMapping = {
  isInjuryUpdated: "injury",
  isCauseUpdated: "cause",
  isHirUpdated: "hir",
  isHospitalUpdated: "transfer_to_hospital",
  isIncidentReportUpdated: "incidentReport",
  isInterventionsUpdated: "interventions",
  isPhysicianRefUpdated: "physicianRef",
  isPoaContactedUpdated: "poaContacted",
  isPostFallNotesUpdated: "postFallNotes",
  isPtRefUpdated: "ptRef",
};

function parseCsv(content: string): Record<string, any>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }

  return rows;
}

async function writeCsv(
  filePath: string,
  headers: string[],
  data: Record<string, any>[],
): Promise<void> {
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] || "";
          const escaped = String(value).replace(/"/g, '""');
          return escaped.includes(",") ||
            escaped.includes("\n") ||
            escaped.includes('"')
            ? `"${escaped}"`
            : escaped;
        })
        .join(","),
    ),
  ].join("\n");

  await writeFile(filePath, csvContent, "utf-8");
}

export async function syncFirebaseWithCsv(
  homeId: string,
  csvFilepath: string,
): Promise<void> {
  console.log(`Processing file: ${csvFilepath}`);
  console.log("SYNCING:", csvFilepath);

  try {
    const filename = csvFilepath.split("/").pop() || "";

    // Extract year and month from filepath
    const match = csvFilepath.match(/\/(\d{4})_(\d{2})_/);
    if (!match) {
      throw new Error(`Could not extract date from filepath: ${csvFilepath}`);
    }

    const currentYear = match[1];
    const currentMonth = match[2];

    console.log(`\n${"=".repeat(50)}`);
    const firebasePath = `${homeId}/${currentYear}/${currentMonth}`;
    console.log(`Searching Firebase path: ${firebasePath}`);

    // Get Firebase data
    const snapshot = await adminDb.ref(firebasePath).once("value");
    let allFirebaseData = snapshot.val() || {};

    // Convert list to dictionary if needed
    if (Array.isArray(allFirebaseData)) {
      allFirebaseData = Object.fromEntries(
        allFirebaseData
          .map((item, index) => [String(index), item])
          .filter(([_, item]) => item !== null),
      );
    }

    // Read CSV
    const csvContent = await readFile(csvFilepath, "utf-8");
    const csvRows = parseCsv(csvContent);

    // Get headers and add missing columns
    const originalHeaders = csvRows.length > 0 ? Object.keys(csvRows[0]) : [];
    const extendedHeaders = [...originalHeaders];
    const addedColumns: string[] = [];

    for (const updateFlag of Object.keys(UPDATE_FIELD_MAPPING)) {
      if (!extendedHeaders.includes(updateFlag)) {
        extendedHeaders.push(updateFlag);
        addedColumns.push(updateFlag);
      }
    }

    if (addedColumns.length > 0) {
      console.log(`Adding missing columns to CSV: ${addedColumns.join(", ")}`);
    }

    // Update rows
    const updatedRows = csvRows.map((csvRow) => {
      // Initialize missing columns
      for (const column of addedColumns) {
        if (!(column in csvRow)) {
          csvRow[column] = "";
        }
      }

      // Find matching Firebase row
      let matchingFirebaseRow: any = null;
      for (const [firebaseDocId, firebaseDoc] of Object.entries(
        allFirebaseData,
      )) {
        const fbDoc = firebaseDoc as Record<string, any>;
        if (
          fbDoc.date === csvRow.date &&
          fbDoc.name === csvRow.name &&
          fbDoc.time === csvRow.time
        ) {
          matchingFirebaseRow = fbDoc;
          break;
        }
      }

      if (matchingFirebaseRow) {
        console.log(
          `\nUpdating row for ${csvRow.name} on ${csvRow.date} at ${csvRow.time}`,
        );
        const updatedRow = { ...csvRow };

        for (const [updateFlag, field] of Object.entries(
          UPDATE_FIELD_MAPPING,
        )) {
          if (matchingFirebaseRow[updateFlag] === "yes") {
            if (field in matchingFirebaseRow && matchingFirebaseRow[field]) {
              const oldValue = updatedRow[field];
              updatedRow[field] = matchingFirebaseRow[field];
              updatedRow[updateFlag] = "yes";

              if (updatedRow[field] !== oldValue) {
                console.log(
                  `  ${field}: '${oldValue}' → '${updatedRow[field]}' (Flag: ${updateFlag})`,
                );
              }
            }
          }
        }

        return updatedRow;
      } else {
        console.log(
          `No matching Firebase record for ${csvRow.name} on ${csvRow.date} at ${csvRow.time}`,
        );
        return csvRow;
      }
    });

    // Write updated CSV
    await writeCsv(csvFilepath, extendedHeaders, updatedRows);
    console.log(`Updated CSV file saved: ${csvFilepath}`);
    console.log(`${"=".repeat(50)}\n`);
  } catch (error) {
    console.error(`Error in syncFirebaseWithCsv: ${error}`);
    throw error;
  }
}

export async function processMergedCsvFiles(
  homeId: string,
  chainId: string,
): Promise<void> {
  // Construct the path to the chain's analyzed directory
  const chainAnalyzedDir = join(
    process.cwd(),
    "files",
    "chains",
    chainId,
    "analyzed",
  );

  console.log(`\n🔄 Processing merged CSV files for Firebase sync`);
  console.log(`🏠 Home: ${homeId}, Chain: ${chainId}`);
  console.log(`📂 Searching in: ${chainAnalyzedDir}`);

  try {
    // Read all date folders in the analyzed directory
    const dateFolders = await readdir(chainAnalyzedDir, {
      withFileTypes: true,
    });

    for (const dateFolder of dateFolders) {
      if (!dateFolder.isDirectory()) continue;

      const dateFolderPath = join(chainAnalyzedDir, dateFolder.name);
      console.log(`\n📅 Processing date folder: ${dateFolder.name}`);

      // Read all files in the date folder
      const files = await readdir(dateFolderPath);

      // Filter for merged.csv files that belong to this home
      const mergedFiles = files.filter((file) => {
        const normalizedFile = file.toLowerCase();
        const normalizedHome = homeId.toLowerCase().replace(/_/g, "_");
        return (
          normalizedFile.includes(normalizedHome) &&
          file.endsWith("_merged.csv")
        );
      });

      if (mergedFiles.length === 0) {
        console.log(
          `  ⏭️ No merged.csv files found for home ${homeId} in ${dateFolder.name}`,
        );
        continue;
      }

      // Process each merged file for this home
      for (const file of mergedFiles) {
        const fullFilepath = join(dateFolderPath, file);
        console.log(`\n  🔄 Syncing file: ${file}`);

        try {
          await syncFirebaseWithCsv(homeId, fullFilepath);
          console.log(`    ✅ Successfully synced ${file}`);
        } catch (error) {
          console.error(`    ❌ Error processing ${file}: ${error}`);
        }
      }
    }

    console.log(`\n✨ Completed syncing all merged CSV files for ${homeId}`);
  } catch (error) {
    console.error(`❌ Error processing merged CSV files: ${error}`);
    throw error;
  }
}
