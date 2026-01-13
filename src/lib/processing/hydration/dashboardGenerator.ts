/**
 * Dashboard data generator.
 * Validates, cleans, and generates dashboard data files from processed resident data.
 */

import * as fs from "fs";
import * as path from "path";
import { cleanName, normalizeToLastFirst } from "@/lib/utils/nameUtils";
import { calculateMissed3Days } from "./hydrationProcessor";
import type {
	ResidentWithIPC,
	DashboardResident,
	DashboardData,
	ProcessingLogger,
} from "@/types/hydrationProcessingTypes";

/**
 * Invalid keywords that indicate an entry is not a real resident.
 */
const INVALID_KEYWORDS = [
	"admission",
	"admissiondate",
	"delusional",
	"delusions",
	"threatening",
	"bowel",
	"disorder",
	"stroke",
	"lacunar",
	"resisting",
	"fracture",
	"anxiety",
	"acute pain",
	"degeneration",
	"potential",
	"daily",
	"boost",
	"carb",
	"smart",
	"once",
	"corticobasal",
	"ganglia",
	"physician",
	"location",
	"unspecified",
	"meeting",
	"independence",
	"inability",
	"medical",
	"diagnoses",
];

/**
 * Convert date string from MM/DD/YYYY to MM_DD_YYYY format.
 *
 * @param dateStr - Date in MM/DD/YYYY format
 * @returns Date in MM_DD_YYYY format
 */
export function normalizeDateForFilename(dateStr: string): string {
	return dateStr.replace(/\//g, "_");
}

/**
 * Get all unique dates from resident data.
 *
 * @param residents - Array of residents with date data
 * @returns Sorted array of date strings
 */
export function getAllDates(residents: ResidentWithIPC[]): string[] {
	const dates = new Set<string>();
	for (const resident of residents) {
		for (const dateStr of Object.keys(resident.dateData)) {
			dates.add(dateStr);
		}
	}

	// Sort chronologically
	return Array.from(dates).sort((a, b) => {
		const [aMonth, aDay, aYear] = a.split("/").map(Number);
		const [bMonth, bDay, bYear] = b.split("/").map(Number);
		const dateA = new Date(aYear, aMonth - 1, aDay);
		const dateB = new Date(bYear, bMonth - 1, bDay);
		return dateA.getTime() - dateB.getTime();
	});
}

/**
 * Check if a name contains invalid keywords.
 *
 * @param name - Name to check
 * @returns True if name contains invalid keywords
 */
function isInvalidEntry(name: string): boolean {
	const nameLower = name.toLowerCase();
	return INVALID_KEYWORDS.some((keyword) => nameLower.includes(keyword));
}

/**
 * Validate and clean resident data.
 * Filters invalid entries and merges duplicates.
 * Ported from Python validate_and_clean_dashboard_data().
 *
 * @param residents - Array of residents to validate
 * @param logger - Optional logger
 * @returns Cleaned array of residents
 */
export function validateAndCleanData(
	residents: ResidentWithIPC[],
	logger?: ProcessingLogger,
): ResidentWithIPC[] {
	// First, clean names
	const cleanedResidents = residents.map((r) => ({
		...r,
		name: cleanName(r.name),
	}));

	// Group by normalized name
	const nameGroups = new Map<string, ResidentWithIPC[]>();
	for (const resident of cleanedResidents) {
		const normalizedName = normalizeToLastFirst(resident.name);
		if (!nameGroups.has(normalizedName)) {
			nameGroups.set(normalizedName, []);
		}
		nameGroups.get(normalizedName)!.push(resident);
	}

	// Merge duplicates
	const mergedResidents: ResidentWithIPC[] = [];

	for (const [name, entries] of nameGroups) {
		if (entries.length === 1) {
			mergedResidents.push(entries[0]);
		} else {
			logger?.info(`Merging ${entries.length} entries for: ${name}`);

			// Sort by completeness (fewer zeros is better)
			const countZeros = (entry: ResidentWithIPC): number => {
				let count = 0;
				if (!entry.mlGoal || entry.mlGoal === 0) count++;
				for (const value of Object.values(entry.dateData)) {
					if (value === 0) count++;
				}
				return count;
			};

			const sorted = [...entries].sort((a, b) => countZeros(a) - countZeros(b));
			const best = { ...sorted[0] };

			// Merge data from other entries
			for (const entry of sorted.slice(1)) {
				// Use highest non-zero goal (prefer non-zero over zero)
				if (entry.mlGoal && entry.mlGoal > 0) {
					if (!best.mlGoal || best.mlGoal === 0 || entry.mlGoal > best.mlGoal) {
						best.mlGoal = entry.mlGoal;
					}
				}

				// Use highest non-zero maximum (prefer non-zero over zero)
				if (entry.mlMaximum && entry.mlMaximum > 0) {
					if (
						!best.mlMaximum ||
						best.mlMaximum === 0 ||
						entry.mlMaximum > best.mlMaximum
					) {
						best.mlMaximum = entry.mlMaximum;
					}
				}

				// Use highest data values
				for (const [date, value] of Object.entries(entry.dateData)) {
					if (value > (best.dateData[date] || 0)) {
						best.dateData[date] = value;
					}
				}

				// Keep 'yes' for missed3Days if any entry has it
				if (entry.missed3Days) {
					best.missed3Days = true;
				}

				// Keep IPC data if found (prefer entries with IPC data)
				if (entry.ipcFound) {
					best.ipcFound = true;
					// Prefer non-empty infection values
					if (
						entry.infection &&
						entry.infection !== "-" &&
						(!best.infection || best.infection === "-")
					) {
						best.infection = entry.infection;
					}
					// Prefer non-empty infection type values
					if (
						entry.infectionType &&
						entry.infectionType !== "-" &&
						(!best.infectionType || best.infectionType === "-")
					) {
						best.infectionType = entry.infectionType;
					}
				}
			}

			// Recalculate missed3Days after merging all data
			if (best.mlGoal && best.mlGoal > 0) {
				best.missed3Days = calculateMissed3Days(best.mlGoal, best.dateData);
			}

			mergedResidents.push(best);
		}
	}

	// Filter invalid entries
	const filteredResidents: ResidentWithIPC[] = [];
	const filteredOut: string[] = [];

	for (const resident of mergedResidents) {
		if (isInvalidEntry(resident.name)) {
			filteredOut.push(resident.name);
		} else {
			filteredResidents.push(resident);
		}
	}

	if (filteredOut.length > 0) {
		logger?.info(`Filtered out ${filteredOut.length} invalid entries`);
		for (const name of filteredOut.slice(0, 10)) {
			logger?.info(`  - ${name}`);
		}
		if (filteredOut.length > 10) {
			logger?.info(`  ... and ${filteredOut.length - 10} more`);
		}
	}

	// Sort by name
	filteredResidents.sort((a, b) => a.name.localeCompare(b.name));

	logger?.info(`After cleaning: ${filteredResidents.length} residents remain`);

	return filteredResidents;
}

/**
 * Generate dashboard data for all dates.
 * Ported from Python generate_dashboard_data().
 *
 * @param residents - Validated resident data
 * @param logger - Optional logger
 * @returns Array of dashboard data, one per date
 */
export function generateDashboardData(
	residents: ResidentWithIPC[],
	logger?: ProcessingLogger,
): DashboardData[] {
	const dates = getAllDates(residents);

	logger?.info(`Found ${dates.length} date columns: ${dates.join(", ")}`);

	if (dates.length === 0) {
		logger?.warn("No date columns found!");
		return [];
	}

	const dashboardData: DashboardData[] = [];

	for (const dateStr of dates) {
		const dashboardResidents: DashboardResident[] = [];

		for (const resident of residents) {
			// Skip empty names
			if (!resident.name.trim()) continue;

			const dataValue = resident.dateData[dateStr] || 0;

			dashboardResidents.push({
				name: resident.name,
				goal: resident.mlGoal || 0,
				maximum: resident.mlMaximum || 0,
				source: resident.sourceFile,
				missed3Days: resident.missed3Days ? "yes" : "no",
				data: dataValue,
				ipc_found: resident.ipcFound ? "yes" : "no",
				infection: resident.infection,
				infection_type: resident.infectionType,
			});
		}

		const dateKey = normalizeDateForFilename(dateStr);

		dashboardData.push({
			dateKey,
			dateDisplay: dateStr,
			residents: dashboardResidents,
		});

		// Calculate stats
		const goalMet = dashboardResidents.filter(
			(r) => r.goal > 0 && r.data >= r.goal,
		).length;
		const missed3Days = dashboardResidents.filter(
			(r) => r.missed3Days === "yes",
		).length;

		logger?.info(
			`Generated dashboard for ${dateStr} with ${dashboardResidents.length} residents`,
		);
		logger?.info(`  - Goal met: ${goalMet}`);
		logger?.info(`  - Missed 3 days: ${missed3Days}`);
		if (dashboardResidents.length > 0) {
			logger?.info(
				`  - Goal met percentage: ${((goalMet / dashboardResidents.length) * 100).toFixed(1)}%`,
			);
		}
	}

	logger?.info(`Generated ${dashboardData.length} dashboard files`);

	return dashboardData;
}

/**
 * Generate JavaScript data file content for a dashboard.
 *
 * @param dashboardData - Dashboard data for a single date
 * @returns JavaScript file content
 */
export function generateJsFileContent(dashboardData: DashboardData): string {
	const now = new Date().toISOString().replace("T", " ").substring(0, 19);

	const content = `// Auto-generated dashboard data from hydration_goals.csv
// Generated on: ${now}
// Date: ${dashboardData.dateDisplay}
// Total residents: ${dashboardData.residents.length}

const hydrationData = ${JSON.stringify(dashboardData.residents, null, 12)};
`;

	return content;
}

/**
 * Generate CSV content from resident data.
 * For backwards compatibility with Firestore storage.
 *
 * @param residents - Resident data
 * @returns CSV file content
 */
export function generateCsvContent(residents: ResidentWithIPC[]): string {
	// Get all dates
	const dates = getAllDates(residents);

	// Build header
	const baseColumns = [
		"Resident Name",
		"mL Goal",
		"mL Maximum",
		"Source File",
		"Has Feeding Tube",
		"Missed 3 Days",
	];
	const ipcColumns = ["IPC Found", "Infection", "Infection Type"];
	const allColumns = [...baseColumns, ...dates, ...ipcColumns];

	// Build rows
	const lines: string[] = [allColumns.join(",")];

	for (const resident of residents) {
		const values: string[] = [
			escapeCSV(resident.name),
			resident.mlGoal?.toString() || "",
			resident.mlMaximum?.toString() || "",
			escapeCSV(resident.sourceFile),
			resident.hasFeedingTube ? "Yes" : "No",
			resident.missed3Days ? "yes" : "no",
		];

		// Add date values
		for (const date of dates) {
			values.push(resident.dateData[date]?.toString() || "");
		}

		// Add IPC values
		values.push(resident.ipcFound ? "yes" : "no");
		values.push(escapeCSV(resident.infection));
		values.push(escapeCSV(resident.infectionType));

		lines.push(values.join(","));
	}

	return lines.join("\n");
}

/**
 * Escape a value for CSV output.
 */
function escapeCSV(value: string): string {
	if (value.includes(",") || value.includes('"') || value.includes("\n")) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/**
 * Convert a home display name to a URL-safe identifier.
 * E.g., "Cedar Grove" -> "cedar-grove"
 *
 * @param homeName - The display name of the home
 * @returns URL-safe identifier
 */
export function getHomeIdentifier(homeName: string): string {
	return homeName
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

/**
 * Save processed dashboard data to files in files/hydration/<home-name>/.
 *
 * Creates the directory structure if it doesn't exist and writes:
 * - Individual dashboard_<date>.js files for each date
 * - hydration_goals.csv with all resident data
 *
 * @param dashboardData - Array of dashboard data to save
 * @param residents - Array of residents for CSV generation
 * @param homeName - The name of the retirement home
 * @param baseDir - Base directory for file storage (defaults to process.cwd())
 * @param logger - Optional logger
 * @returns Object with saved file paths
 */
export function saveDashboardToFiles(
	dashboardData: DashboardData[],
	residents: ResidentWithIPC[],
	homeName: string,
	baseDir: string = process.cwd(),
	logger?: ProcessingLogger,
): { directory: string; files: string[] } {
	const homeIdentifier = getHomeIdentifier(homeName);
	const outputDir = path.join(baseDir, "files", "hydration", homeIdentifier);

	// Create directory if it doesn't exist
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
		logger?.info(`Created directory: ${outputDir}`);
	}

	const savedFiles: string[] = [];

	// Save each dashboard file
	for (const dashboard of dashboardData) {
		const fileName = `dashboard_${dashboard.dateKey}.js`;
		const filePath = path.join(outputDir, fileName);
		const content = generateJsFileContent(dashboard);

		fs.writeFileSync(filePath, content, "utf-8");
		savedFiles.push(filePath);

		logger?.info(
			`Saved ${fileName} with ${dashboard.residents.length} residents`,
		);
	}

	// Save CSV file
	if (residents.length > 0) {
		const csvFileName = "hydration_goals.csv";
		const csvFilePath = path.join(outputDir, csvFileName);
		const csvContent = generateCsvContent(residents);

		fs.writeFileSync(csvFilePath, csvContent, "utf-8");
		savedFiles.push(csvFilePath);

		logger?.info(`Saved ${csvFileName} with ${residents.length} residents`);
	}

	logger?.info(`Saved ${savedFiles.length} files to ${outputDir}`);

	return {
		directory: outputDir,
		files: savedFiles,
	};
}
