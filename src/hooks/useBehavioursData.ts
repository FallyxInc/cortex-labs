"use client";

import { useState, useEffect, useCallback } from "react";
import { ref, onValue, off, get } from "firebase/database";
import { db } from "@/lib/firebase/firebase";
import {
  BehaviourIncident,
  FollowUpRecord,
  OverviewMetrics,
  MONTHS_FORWARD,
} from "@/types/behaviourTypes";

const DEFAULT_OVERVIEW_METRICS: OverviewMetrics = {
  antipsychotics: {
    percentage: 15,
    change: -3,
    residents: ["John Smith", "Mary Johnson", "Robert Davis"],
  },
  worsened: {
    percentage: 28,
    change: 5,
    residents: ["Sarah Wilson", "Michael Brown", "Lisa Anderson"],
  },
  improved: {
    percentage: 57,
    change: 8,
    residents: ["David Miller", "Jennifer Taylor", "Thomas White"],
  },
};

interface UseBehavioursDataParams {
  firebaseId: string;
  startDate: string;
  endDate: string;
}

interface UseBehavioursDataReturn {
  data: BehaviourIncident[];
  followUpData: FollowUpRecord[];
  isLoading: boolean;
  followUpLoading: boolean;
  threeMonthData: Map<string, BehaviourIncident[]>;
  overviewMetrics: OverviewMetrics;
  availableYearMonth: Record<string, string[]>;
}

export function useBehavioursData({
  firebaseId,
  startDate,
  endDate,
}: UseBehavioursDataParams): UseBehavioursDataReturn {
  const [data, setData] = useState<BehaviourIncident[]>([]);
  const [followUpData, setFollowUpData] = useState<FollowUpRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followUpLoading, setFollowUpLoading] = useState(true);
  const [threeMonthData, setThreeMonthData] = useState<
    Map<string, BehaviourIncident[]>
  >(new Map());
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics>(
    DEFAULT_OVERVIEW_METRICS,
  );
  const [availableYearMonth, setAvailableYearMonth] = useState<
    Record<string, string[]>
  >({});

  // Fetch behaviours and follow-up data based on date range
  useEffect(() => {
    if (!startDate || !endDate) {
      setData([]);
      setFollowUpData([]);
      setIsLoading(false);
      setFollowUpLoading(false);
      return;
    }

    setIsLoading(true);
    setFollowUpLoading(true);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate list of all year-month combinations between start and end dates
    const dateRanges: { year: number; month: string }[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0);

    while (current <= endMonth) {
      dateRanges.push({
        year: current.getFullYear(),
        month: String(current.getMonth() + 1).padStart(2, "0"),
      });
      current.setMonth(current.getMonth() + 1);
    }

    const allBehavioursData: BehaviourIncident[] = [];
    const allFollowUpData: FollowUpRecord[] = [];
    const listeners: {
      ref: ReturnType<typeof ref>;
      listener: ReturnType<typeof onValue>;
    }[] = [];

    let completedBehavioursFetches = 0;
    let completedFollowUpFetches = 0;
    const totalBehavioursFetches = dateRanges.length;
    const totalFollowUpFetches = dateRanges.length;

    dateRanges.forEach(({ year, month }) => {
      // Fetch behaviours data
      const behavioursRef = ref(
        db,
        `/${firebaseId}/behaviours/${year}/${month}`,
      );

      const behavioursListener = onValue(behavioursRef, (snapshot) => {
        if (snapshot.exists()) {
          const behavioursData = snapshot.val();
          const monthData = Object.values(behavioursData).map(
            (item: unknown) => ({
              ...(item as BehaviourIncident),
              id: (item as BehaviourIncident).id || "",
              yearMonth: `${year}-${month}`,
            }),
          );

          // Filter by actual date range
          const filteredData = monthData.filter((item) => {
            if (!item.date) return false;
            const itemDate = new Date(item.date);
            return itemDate >= start && itemDate <= end;
          });

          allBehavioursData.push(...filteredData);
        }

        completedBehavioursFetches++;
        if (completedBehavioursFetches === totalBehavioursFetches) {
          // Sort by date descending
          const sortedData = allBehavioursData.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          );
          setData(sortedData);
          setIsLoading(false);
        }
      });
      listeners.push({ ref: behavioursRef, listener: behavioursListener });

      // Fetch follow-up data
      const followUpRef = ref(db, `/${firebaseId}/follow/${year}/${month}`);

      const followUpListener = onValue(followUpRef, (snapshot) => {
        if (snapshot.exists()) {
          const followUpDataRaw = snapshot.val();
          const monthFollowUpData = Object.values(followUpDataRaw).map(
            (item: unknown, index: number) => ({
              ...(item as FollowUpRecord),
              id: (item as FollowUpRecord).id || `${year}-${month}-${index}`,
              resident_name:
                (item as FollowUpRecord).resident_name ||
                (item as FollowUpRecord).Name ||
                "Unknown Resident",
              date: (item as FollowUpRecord).date || "Unknown Date",
              summary_of_behaviour:
                (item as FollowUpRecord).summary_of_behaviour ||
                "No summary available",
              other_notes:
                (item as FollowUpRecord).other_notes || "No notes available",
              yearMonth: `${year}-${month}`,
            }),
          );

          // Filter by actual date range
          const filteredFollowUpData = monthFollowUpData.filter((item) => {
            if (!item.date || item.date === "Unknown Date") return false;
            const itemDate = new Date(item.date);
            return itemDate >= start && itemDate <= end;
          });

          allFollowUpData.push(...filteredFollowUpData);
        }

        completedFollowUpFetches++;
        if (completedFollowUpFetches === totalFollowUpFetches) {
          // Sort by date descending
          const sortedFollowUpData = allFollowUpData.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          );
          setFollowUpData(sortedFollowUpData);
          setFollowUpLoading(false);
        }
      });
      listeners.push({ ref: followUpRef, listener: followUpListener });
    });

    // Also fetch past three months data for trends (relative to end date)
    const endYear = end.getFullYear();
    const endMonthNum = end.getMonth() + 1;
    const pastThreeMonths: { year: number; month: string }[] = [];

    for (let i = 3; i >= 1; i--) {
      const month = endMonthNum - i;
      if (month > 0) {
        pastThreeMonths.push({
          year: endYear,
          month: String(month).padStart(2, "0"),
        });
      } else {
        pastThreeMonths.push({
          year: endYear - 1,
          month: String(12 + month).padStart(2, "0"),
        });
      }
    }

    const allThreeMonthData = new Map<string, BehaviourIncident[]>();
    pastThreeMonths.forEach(({ year, month }) => {
      allThreeMonthData.set(month, []);

      const monthRef = ref(db, `/${firebaseId}/behaviours/${year}/${month}`);

      const listener = onValue(monthRef, (snapshot) => {
        if (snapshot.exists()) {
          const behavioursData = snapshot.val();
          const monthData = Object.keys(behavioursData).map(
            (key) => behavioursData[key] as BehaviourIncident,
          );
          allThreeMonthData.set(month, monthData);
          setThreeMonthData(new Map(allThreeMonthData));
        }
      });
      listeners.push({ ref: monthRef, listener });
    });

    return () => {
      listeners.forEach(({ ref: listenerRef }) => {
        off(listenerRef);
      });
    };
  }, [startDate, endDate, firebaseId]);

  // Fetch overview metrics from Firebase
  useEffect(() => {
    const metricsRef = ref(db, `/${firebaseId}/overviewMetrics`);
    const metricsListener = onValue(metricsRef, (snapshot) => {
      if (snapshot.exists()) {
        const metricsData = snapshot.val();
        setOverviewMetrics({
          antipsychotics:
            metricsData.antipsychotics ||
            DEFAULT_OVERVIEW_METRICS.antipsychotics,
          worsened: metricsData.worsened || DEFAULT_OVERVIEW_METRICS.worsened,
          improved: metricsData.improved || DEFAULT_OVERVIEW_METRICS.improved,
        });
      }
    });

    return () => {
      off(metricsRef);
    };
  }, [firebaseId]);

  // Fetch available year-months
  useEffect(() => {
    const yearsRef = ref(db, `/${firebaseId}/behaviours`);

    const unsubscribe = onValue(yearsRef, (snapshot) => {
      const yearMonthMapping: Record<string, string[]> = {};
      if (snapshot.exists()) {
        const dataSnapshot = snapshot.val();

        Object.keys(dataSnapshot).forEach((year) => {
          if (!yearMonthMapping[year]) {
            yearMonthMapping[year] = [];
          }

          Object.keys(dataSnapshot[year] || {}).forEach((month) => {
            if (dataSnapshot[year][month]) {
              const monthName = MONTHS_FORWARD[month];
              if (monthName) {
                yearMonthMapping[year].push(monthName);
              }
            }
          });

          yearMonthMapping[year].sort();
        });

        const sortedYears = Object.keys(yearMonthMapping).sort(
          (a, b) => Number(b) - Number(a),
        );
        const sortedMapping: Record<string, string[]> = {};
        sortedYears.forEach((year) => {
          sortedMapping[year] = yearMonthMapping[year];
        });

        setAvailableYearMonth(sortedMapping);
      }
    });

    return () => {
      off(yearsRef);
    };
  }, [firebaseId]);

  return {
    data,
    followUpData,
    isLoading,
    followUpLoading,
    threeMonthData,
    overviewMetrics,
    availableYearMonth,
  };
}
