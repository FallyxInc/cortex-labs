"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  HydrationResident,
  HydrationDataResponse,
  HydrationErrorResponse,
} from "@/types/hydrationTypes";

interface UseHydrationDataParams {
  homeId: string;
  startDate: string;
  endDate: string;
  enabled?: boolean;
}

interface HydrationMetrics {
  totalResidents: number;
  goalMetCount: number;
  goalMetPercentage: number;
  missed3DaysCount: number;
}

interface UseHydrationDataReturn {
  residents: HydrationResident[];
  isLoading: boolean;
  error: string | null;
  metrics: HydrationMetrics;
  dateColumns: string[];
  refetch: () => Promise<void>;
}

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
 * Get the most recent date value for a resident
 */
function getMostRecentDateValue(
  resident: HydrationResident,
  dateColumns: string[]
): number {
  if (!resident.dateData || dateColumns.length === 0) return 0;
  const mostRecentDate = dateColumns[dateColumns.length - 1];
  return resident.dateData[mostRecentDate] || 0;
}

/**
 * Calculate if a resident has missed their goal for 3 consecutive days
 */
function calculateMissed3Days(
  resident: HydrationResident,
  dateColumns: string[]
): boolean {
  if (!resident.dateData || dateColumns.length < 3 || resident.goal === 0) {
    return false;
  }

  // Sort dates to ensure proper order
  const sortedDates = [...dateColumns].sort((a, b) => {
    const dateA = parseLegacyDate(a);
    const dateB = parseLegacyDate(b);
    return dateA.getTime() - dateB.getTime();
  });

  // Check all possible 3 consecutive day windows
  for (let i = 0; i <= sortedDates.length - 3; i++) {
    const date1 = sortedDates[i];
    const date2 = sortedDates[i + 1];
    const date3 = sortedDates[i + 2];

    // Check if these dates are consecutive
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

      // Check if all three days are below goal
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

export function useHydrationData({
  homeId,
  startDate,
  endDate,
  enabled = true,
}: UseHydrationDataParams): UseHydrationDataReturn {
  const [residents, setResidents] = useState<HydrationResident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHydrationData = useCallback(async () => {
    if (!homeId || !startDate || !endDate || !enabled) {
      setResidents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        homeId,
        startDate,
        endDate,
      });

      const response = await fetch(`/api/hydration?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        const errorData = data as HydrationErrorResponse;
        throw new Error(errorData.error || "Failed to fetch hydration data");
      }

      const successData = data as HydrationDataResponse;

      if (successData.success) {
        setResidents(successData.data);
      } else {
        setResidents([]);
      }
    } catch (err) {
      console.error("Error fetching hydration data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setResidents([]);
    } finally {
      setIsLoading(false);
    }
  }, [homeId, startDate, endDate, enabled]);

  useEffect(() => {
    fetchHydrationData();
  }, [fetchHydrationData]);

  // Extract all unique dates from all residents and sort them
  const dateColumns = useMemo(() => {
    const allDates = new Set<string>();
    residents.forEach((resident) => {
      if (resident.dateData) {
        Object.keys(resident.dateData).forEach((date) => allDates.add(date));
      }
    });

    return Array.from(allDates).sort((a, b) => {
      const dateA = parseLegacyDate(a);
      const dateB = parseLegacyDate(b);
      return dateA.getTime() - dateB.getTime();
    });
  }, [residents]);

  // Calculate metrics
  const metrics = useMemo((): HydrationMetrics => {
    const totalResidents = residents.length;

    const goalMetCount = residents.filter((r) => {
      const mostRecent = getMostRecentDateValue(r, dateColumns);
      return r.goal > 0 && mostRecent >= r.goal;
    }).length;

    const goalMetPercentage =
      totalResidents > 0
        ? Math.round((goalMetCount / totalResidents) * 100 * 10) / 10
        : 0;

    const missed3DaysCount = residents.filter((r) =>
      calculateMissed3Days(r, dateColumns)
    ).length;

    return {
      totalResidents,
      goalMetCount,
      goalMetPercentage,
      missed3DaysCount,
    };
  }, [residents, dateColumns]);

  return {
    residents,
    isLoading,
    error,
    metrics,
    dateColumns,
    refetch: fetchHydrationData,
  };
}
