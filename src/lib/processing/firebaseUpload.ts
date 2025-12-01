// TypeScript port of upload_to_dashboard.py - Firebase data upload

import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { adminDb } from "@/lib/firebase-admin";
import { extractDateFromFilename } from "./homesDb";

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

export async function uploadCsvToFirebase(
  csvFilePath: string,
  dashboard: string,
  year: string,
  month: string,
): Promise<void> {
  const refPath = `${dashboard}/${year}/${month}`;
  const ref = adminDb.ref(refPath);

  try {
    // Remove existing data at the reference
    await ref.remove();
    console.log(`Removed existing data at ${refPath}`);
  } catch (error) {
    console.error(`Error deleting data: ${error}`);
    throw error;
  }

  // Read and upload CSV data
  const csvContent = await readFile(csvFilePath, "utf-8");
  const rows = parseCsv(csvContent);

  for (let index = 0; index < rows.length; index++) {
    await ref.child(String(index)).set(rows[index]);
    console.log(`Uploaded row ${index} to ${refPath}/${index}`);
  }
}

export async function processCsvFiles(
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

  console.log(
    `\n🔍 Processing CSV files for home: ${homeId}, chain: ${chainId}`,
  );
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

      // Filter for files that belong to this home
      const homeFiles = files.filter((file) => {
        return file.endsWith("_merged.csv") || file.endsWith("_follow.csv");
      });

      if (homeFiles.length === 0) {
        console.log(
          `  ⏭️ No files found for home ${homeId} in ${dateFolder.name}`,
        );
        continue;
      }

      // Extract date from the first file to get year and month
      const firstFile = homeFiles[0];
      const date = extractDateFromFilename(firstFile);

      if (!date) {
        console.warn(`  ⚠️ Could not extract date from filename: ${firstFile}`);
        continue;
      }

      const year = String(date.year);
      const month = String(date.month).padStart(2, "0");

      console.log(`  📊 Extracted date - Year: ${year}, Month: ${month}`);

      // Process each file for this home
      for (const file of homeFiles) {
        const filePath = join(dateFolderPath, file);
        console.log(`\n  ⬆️ Uploading file: ${file}`);

        if (file.endsWith("_merged.csv")) {
          console.log(
            `    → Uploading to ${homeId}/behaviours/${year}/${month}`,
          );
          await uploadCsvToFirebase(
            filePath,
            `${homeId}/behaviours`,
            year,
            month,
          );
          console.log(`    ✅ Successfully uploaded behaviours data`);
        } else if (file.endsWith("_follow.csv")) {
          console.log(`    → Uploading to ${homeId}/follow/${year}/${month}`);
          await uploadCsvToFirebase(filePath, `${homeId}/follow`, year, month);
          console.log(`    ✅ Successfully uploaded follow-up data`);
        }
      }
    }

    console.log(`\n✨ Completed processing all CSV files for ${homeId}`);
  } catch (error) {
    console.error(`❌ Error processing CSV files: ${error}`);
    throw error;
  }
}
