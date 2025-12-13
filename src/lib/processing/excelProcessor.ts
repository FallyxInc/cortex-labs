// TypeScript port of getExcelInfo.py - Excel file processing

import * as XLSX from "xlsx";
import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import {
  ChainExtractionConfig,
  ProcessedIncident,
} from "./types";
import {
  DEFAULT_EXCEL_EXTRACTION,
  extractDateFromFilename,
} from "@/lib/utils/configUtils";


function getInjuries(
  row: Record<string, unknown>,
  allColumns: string[],
  injuryColumnsRange: { start: number; end: number },
): string {
  const columns = injuryColumnsRange;
  // Get injury columns (columns 13-86, indices N to CO)
  const injuryColumns = allColumns.slice(columns.start, columns.end);
  const injuries = new Set<string>();

  for (const col of injuryColumns) {
    if (row[col] === "Y") {
      // Remove the ".1" suffix if present
      const injuryName = col.split(".")[0];
      injuries.add(injuryName);
    }
  }

  const injuryString = Array.from(injuries).sort().join(". ");

  // Replace "Unable to determine" with "No Injury"
  if (injuryString === "Unable to determine") {
    return "No Injury";
  }

  return injuryString || "No Injury";
}

export async function processExcelFile(
  inputFile: string,
  outputFile: string,
  chainConfig?: ChainExtractionConfig | null,
): Promise<void> {
  try {
    const fileBuffer = await readFile(inputFile);
    const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
    const excelExtraction = chainConfig?.excelExtraction || DEFAULT_EXCEL_EXTRACTION;
    const excelColumns = excelExtraction.incidentColumns;

    // Read the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row 8 (0-indexed row 7)
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    range.s.r = 7; // Start from row 8 (0-indexed)

    const data = XLSX.utils.sheet_to_json(sheet, {
      range,
      defval: "",
    }) as Record<string, unknown>[];
    const allColumns = Object.keys(data[0] || {});

    // Filter out "Struck Out" incidents
    const filteredData = data.filter(
      (row) => row["Incident Status"] !== "Struck Out",
    );

    // Process data
    const processedData: ProcessedIncident[] = filteredData
      .map((row) => {
        // Parse date/time
        const incidentDateTime = row[excelColumns.date_time];
        let date = "";
        let time = "";

        if (incidentDateTime) {
          const dt =
            incidentDateTime instanceof Date
              ? incidentDateTime
              : new Date(incidentDateTime as string);

          if (!isNaN(dt.getTime())) {
            // Extract date in local timezone to avoid timezone shift
            const year = dt.getFullYear();
            const month = String(dt.getMonth() + 1).padStart(2, "0");
            const day = String(dt.getDate()).padStart(2, "0");
            date = `${year}-${month}-${day}`;

            // Extract time in local timezone
            const hours = String(dt.getHours()).padStart(2, "0");
            const minutes = String(dt.getMinutes()).padStart(2, "0");
            const seconds = String(dt.getSeconds()).padStart(2, "0");
            time = `${hours}:${minutes}:${seconds}`;
          }
        }

        return {
          incident_number: String(row[excelColumns.incident_number] || ""),
          name: String(row[excelColumns.name] || ""),
          date,
          time,
          incident_location: String(row[excelColumns.incident_location] || ""),
          room: row[excelColumns.room],
          injuries: getInjuries(row, allColumns, excelExtraction.injuryColumns),
          incident_type: String(row[excelColumns.incident_type] || ""),
        } as ProcessedIncident;
      })
      .filter((row) => row.name || row.date); // Remove rows where name AND date are blank

    // Save to CSV
    if (processedData.length > 0) {
      const headers = Object.keys(
        processedData[0],
      ) as (keyof ProcessedIncident)[];
      const csvContent = [
        headers.join(","),
        ...processedData.map((row) =>
          headers
            .map((header) => {
              const value = row[header] || "";
              const escaped = String(value).replace(/"/g, '""');
              return escaped.includes(",") || escaped.includes("\n")
                ? `"${escaped}"`
                : escaped;
            })
            .join(","),
        ),
      ].join("\n");

      await writeFile(outputFile, csvContent, "utf-8");
      console.log(`CSV file created successfully: ${outputFile}`);
    }
  } catch (error) {
    console.error(`Error processing Excel file: ${error}`);
    throw error;
  }
}

export async function processExcelFiles(
  downloadsDir: string,
  analyzedDir: string,
  chain: string,
  chainConfig?: ChainExtractionConfig | null,
): Promise<void> {
  try {
    const files = await readdir(downloadsDir);
    const xlsFiles = files.filter(
      (f) =>
        f.toLowerCase().endsWith(".xls") || f.toLowerCase().endsWith(".xlsx"),
    );

    if (xlsFiles.length === 0) {
      console.log(`No XLS files found in ${downloadsDir}`);
      return;
    }

    for (const xlsFile of xlsFiles) {
      const xlsPath = join(downloadsDir, xlsFile);
      console.log(`Starting Excel processing for: ${xlsPath}`);

      try {
        let date = extractDateFromFilename(xlsFile);
        
        // Fallback to current date if no date found in filename
        if (!date) {
          console.warn(`⚠️ Date information not found in file name: ${xlsFile}. Using current date as fallback.`);
          const now = new Date();
          date = {
            month: String(now.getMonth() + 1).padStart(2, '0'),
            day: String(now.getDate()).padStart(2, '0'),
            year: String(now.getFullYear())
          };
        }
        
        const dateDir = join(
          analyzedDir,
          `${date.month}-${date.day}-${date.year}`,
        );

        const { mkdir } = await import("fs/promises");
        await mkdir(dateDir, { recursive: true });

        const outputCsv = join(dateDir, `${date.month}-${date.day}-${date.year}_processed_incidents.csv`);

        await processExcelFile(xlsPath, outputCsv, chainConfig);
      } catch (error) {
        console.error(`Error processing ${xlsPath}: ${error}`);
      }
    }
  } catch (error) {
    console.error(`Error in processExcelFiles: ${error}`);
  }
}
