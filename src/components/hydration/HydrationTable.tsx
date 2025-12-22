"use client";

import { useState, useMemo } from "react";
import { HydrationResident } from "@/types/hydrationTypes";

interface HydrationTableProps {
  residents: HydrationResident[];
  dateColumns: string[];
  isLoading: boolean;
}

type SortField = "name" | "goal" | "average" | "status" | "missed3Days";
type SortDirection = "asc" | "desc";
/**
 * Parse legacy date format (MM/DD/YYYY) to Date object
 */
function parseLegacyDate(dateStr: string): Date {
  const parts = dateStr.split("/");
  return new Date(
    parseInt(parts[2]),
    parseInt(parts[0]) - 1,
    parseInt(parts[1])
  );
}

/**
 * Format date without year (MM/DD)
 */
function formatDateWithoutYear(dateStr: string): string {
  const parts = dateStr.split("/");
  return `${parts[0]}/${parts[1]}`;
}

/**
 * Extract unit from source filename
 */
function extractUnit(source: string): string {
  if (!source) return "Unknown";
  const filename = source.replace(/\.pdf.*$/i, "");
  return filename || "Unknown";
}

/**
 * Calculate average intake from dateData
 */
function calculateAverageIntake(dateData: Record<string, number>): number {
  const values = Object.values(dateData).filter((v) => v > 0);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Get most recent date value for a resident
 */
function getMostRecentValue(
  resident: HydrationResident,
  dateColumns: string[]
): number {
  if (!resident.dateData || dateColumns.length === 0) return 0;
  const mostRecentDate = dateColumns[dateColumns.length - 1];
  return resident.dateData[mostRecentDate] || 0;
}

/**
 * Calculate if missed 3 consecutive days below goal
 */
function calculateMissed3Days(
  resident: HydrationResident,
  dateColumns: string[]
): boolean {
  if (!resident.dateData || dateColumns.length < 3 || resident.goal === 0) {
    return false;
  }

  const sortedDates = [...dateColumns].sort((a, b) => {
    const dateA = parseLegacyDate(a);
    const dateB = parseLegacyDate(b);
    return dateA.getTime() - dateB.getTime();
  });

  for (let i = 0; i <= sortedDates.length - 3; i++) {
    const date1 = sortedDates[i];
    const date2 = sortedDates[i + 1];
    const date3 = sortedDates[i + 2];

    const date1Obj = parseLegacyDate(date1);
    const date2Obj = parseLegacyDate(date2);
    const date3Obj = parseLegacyDate(date3);

    const daysDiff1 = Math.abs(
      (date2Obj.getTime() - date1Obj.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysDiff2 = Math.abs(
      (date3Obj.getTime() - date2Obj.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff1 === 1 && daysDiff2 === 1) {
      const val1 = resident.dateData[date1] || 0;
      const val2 = resident.dateData[date2] || 0;
      const val3 = resident.dateData[date3] || 0;

      if (
        val1 < resident.goal &&
        val2 < resident.goal &&
        val3 < resident.goal
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Clean resident name (remove "No Middle Name")
 */
function cleanResidentName(name: string): string {
  return name.replace(/\s+No Middle Name\s*/gi, " ").trim();
}

export default function HydrationTable({
  residents,
  dateColumns,
  isLoading,
}: HydrationTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [dateRange, setDateRange] = useState<number>(7);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Get unique units
  const units = useMemo(() => {
    const unitSet = new Set<string>();
    residents.forEach((r) => {
      const unit = extractUnit(r.source);
      if (unit !== "Unknown") {
        unitSet.add(unit);
      }
    });
    return Array.from(unitSet).sort();
  }, [residents]);

  // Filter date columns by range
  const sortedDateColumns = useMemo(() => {
    if (dateColumns.length === 0) return [];

    const sortedDates = [...dateColumns].sort((a, b) => {
      const dateA = parseLegacyDate(a);
      const dateB = parseLegacyDate(b);
      return dateA.getTime() - dateB.getTime();
    });

    return sortedDates;
  }, [dateColumns]);

  // Get visible date columns filtered by date range (backwards from most recent date)
  const filteredDateColumns = useMemo(() => {
    if (sortedDateColumns.length === 0) return [];
    
    // get the last N dates where N is the dateRange
    // get most recent dates regardless of whether they're consecutive
    const startIndex = Math.max(0, sortedDateColumns.length - dateRange);
    return sortedDateColumns.slice(startIndex);
  }, [sortedDateColumns, dateRange]);

  // Filter and sort residents
  const filteredResidents = useMemo(() => {
    const filtered = residents.filter((resident) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const name = cleanResidentName(resident.name).toLowerCase();
        if (!name.includes(query)) return false;
      }

      // Unit filter
      if (selectedUnit !== "all") {
        const unit = extractUnit(resident.source);
        if (unit !== selectedUnit) return false;
      }

      return true;
    });

    // Sort
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: number | string;
        let bValue: number | string;

        switch (sortField) {
          case "name":
            aValue = cleanResidentName(a.name).toLowerCase();
            bValue = cleanResidentName(b.name).toLowerCase();
            break;
          case "goal":
            aValue = a.goal;
            bValue = b.goal;
            break;
          case "average":
            aValue = calculateAverageIntake(a.dateData);
            bValue = calculateAverageIntake(b.dateData);
            break;
          case "status":
            aValue =
              a.goal > 0
                ? (getMostRecentValue(a, filteredDateColumns) / a.goal) * 100
                : -1;
            bValue =
              b.goal > 0
                ? (getMostRecentValue(b, filteredDateColumns) / b.goal) * 100
                : -1;
            break;
          case "missed3Days":
            aValue = calculateMissed3Days(a, filteredDateColumns) ? 1 : 0;
            bValue = calculateMissed3Days(b, filteredDateColumns) ? 1 : 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [
    residents,
    searchQuery,
    selectedUnit,
    sortField,
    sortDirection,
    filteredDateColumns,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="py-12 px-6 flex justify-center items-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 m-0">Resident Hydration Data</h3>
          <p className="text-sm text-gray-500 mt-1 mb-0">
            Showing {filteredResidents.length} of {residents.length} residents
          </p>
        </div>
        <div className="flex items-center justify-center align-middle gap-3 flex-wrap ">
          <input
            type="text"
            placeholder="Search residents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border h-10 border-gray-300 rounded-lg text-sm outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          />
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="px-3 py-2 border h-10  mt-2 border-gray-300 rounded-lg text-sm cursor-pointer appearance-none pr-8 outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 "
          >
            <option value="all">All Units</option>
            {units.map((unit) => (
              <option key={unit} value={unit}>
                Unit {unit}
              </option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(parseInt(e.target.value))}
            className="px-3 py-2 border h-10 mt-2 border-gray-300 rounded-lg text-sm bg-white cursor-pointer appearance-none pr-8 outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value={3}>Last 3 Days</option>
            <option value={5}>Last 5 Days</option>
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
          </select>
        </div>
      </div>

      {filteredResidents.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h4 className="text-lg font-semibold text-gray-700 mb-2 mt-0">No hydration data found</h4>
          <p className="text-sm text-gray-500 m-0">
            {searchQuery || selectedUnit !== "all"
              ? "Try adjusting your filters"
              : "Hydration data will appear here once available"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  Resident Name{getSortIndicator("name")}
                </th>
                <th
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
                  onClick={() => handleSort("goal")}
                >
                  Goal (mL){getSortIndicator("goal")}
                </th>
                <th
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
                  onClick={() => handleSort("average")}
                >
                  Average (mL){getSortIndicator("average")}
                </th>
                <th
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
                  onClick={() => handleSort("status")}
                >
                  Status{getSortIndicator("status")}
                </th>
                {filteredDateColumns.map((date) => (
                  <th key={date} className="px-4 py-3 text-center text-sm font-semibold text-cyan-500 whitespace-nowrap">
                    {formatDateWithoutYear(date)}
                  </th>
                ))}
                <th
                  className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
                  onClick={() => handleSort("missed3Days")}
                >
                  Missed 3 Days{getSortIndicator("missed3Days")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredResidents.map((resident, index) => {
                const unit = extractUnit(resident.source);
                const average = calculateAverageIntake(resident.dateData);
                const mostRecent = getMostRecentValue(
                  resident,
                  filteredDateColumns
                );
                const statusPercent =
                  resident.goal > 0
                    ? Math.min(
                        Math.round((mostRecent / resident.goal) * 100),
                        100
                      )
                    : 0;
                const missed = calculateMissed3Days(
                  resident,
                  filteredDateColumns
                );

                return (
                  <tr
                    key={`${resident.name}-${index}`}
                    className={`border-b border-gray-200 transition-colors hover:bg-gray-50 ${missed ? "bg-red-50 hover:bg-red-100" : ""}`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-gray-900">
                            {cleanResidentName(resident.name)}
                            {resident.ipc_found === "yes" && (
                              <span
                                className="inline-block w-6 h-6 cursor-help ml-1"
                                title={`IPC Alert - Infection: ${resident.infection || "-"}, Type: ${resident.infection_type || "-"}`}
                              >
                                ⚠️
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {unit}
                            {resident.hasFeedingTube && (
                              <span
                                className="inline-flex items-center justify-center w-5 h-5 bg-yellow-100 rounded-full text-xs cursor-help ml-1"
                                title="Has feeding tube"
                              >
                                🥤
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-center">{resident.goal}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-center">{average}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="w-full max-w-[120px]">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-300 to-cyan-500 rounded-full transition-all duration-300"
                            style={{ width: `${statusPercent}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1 text-center">
                          {resident.goal === 0 ? "N/A" : `${statusPercent}%`}
                        </div>
                      </div>
                    </td>
                    {filteredDateColumns.map((date) => (
                      <td key={date} className="px-4 py-3 text-sm text-gray-700 text-center tabular-nums">
                        {resident.dateData[date] || 0}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm text-center">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          missed
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {missed ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
