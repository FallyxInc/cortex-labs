"use client";

import { useState, useMemo, useCallback } from "react";
import { useHydrationData } from "@/hooks/useHydrationData";
import { HydrationResident } from "@/types/hydrationTypes";

interface HydrationAnalyticsProps {
  firebaseId: string;
  startDate: string;
  endDate: string;
}

interface TrendAnalysis {
  decliningTrend: HydrationResident[];
  consistentlyLow: HydrationResident[];
  highRisk: HydrationResident[];
  improvingTrend: HydrationResident[];
  longTermImproving: HydrationResident[];
  sustainedImprovement: HydrationResident[];
}

function parseLegacyDate(dateStr: string): Date {
  const parts = dateStr.split("/");
  return new Date(
    parseInt(parts[2]),
    parseInt(parts[0]) - 1,
    parseInt(parts[1])
  );
}

function calculateAverageIntake(resident: HydrationResident): number {
  if (resident.dateData) {
    const days = Object.values(resident.dateData) as number[];
    const validDays = days.filter((day) => day > 0);
    return validDays.length > 0
      ? Math.round(validDays.reduce((sum, day) => sum + day, 0) / validDays.length)
      : 0;
  }
  return 0;
}

export default function HydrationAnalytics({
  firebaseId,
  startDate,
  endDate,
}: HydrationAnalyticsProps) {
  const { residents, isLoading, error, dateColumns } = useHydrationData({
    homeId: firebaseId,
    startDate,
    endDate,
    enabled: true,
  });

  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const trendAnalysis = useMemo((): TrendAnalysis => {
    const analysis: TrendAnalysis = {
      decliningTrend: [],
      consistentlyLow: [],
      highRisk: [],
      improvingTrend: [],
      longTermImproving: [],
      sustainedImprovement: [],
    };

    if (!residents || residents.length === 0) return analysis;

    residents.forEach((resident) => {
      if (!resident.dateData) return;

      const dates = Object.keys(resident.dateData).sort((a, b) => {
        const dateA = parseLegacyDate(a);
        const dateB = parseLegacyDate(b);
        return dateA.getTime() - dateB.getTime();
      });

      if (dates.length < 3) return;

      const values = dates.map((date) => resident.dateData![date] || 0);
      const averageIntake = calculateAverageIntake(resident);

      // Short-term analysis (last 3 days)
      const recentValues = values.slice(-3);
      const recentTrend = recentValues[recentValues.length - 1] - recentValues[0];

      // Declining trend: recent values are decreasing
      if (
        recentTrend < -100 &&
        recentValues[recentValues.length - 1] < resident.goal * 0.8
      ) {
        analysis.decliningTrend.push(resident);
      }

      // Consistently low: average is below 80% of goal
      if (
        averageIntake > 0 &&
        resident.goal > 0 &&
        averageIntake < resident.goal * 0.8
      ) {
        analysis.consistentlyLow.push(resident);
      }

      // Improving trend: recent values are increasing and above goal
      if (
        recentTrend > 100 &&
        recentValues[recentValues.length - 1] >= resident.goal
      ) {
        analysis.improvingTrend.push(resident);
      }

      // Long-term analysis (if we have enough data)
      if (dates.length >= 7) {
        const weeksOfData = Math.ceil(dates.length / 7);
        if (weeksOfData >= 2) {
          const weeklyAverages: number[] = [];
          for (let i = 0; i < values.length; i += 7) {
            const weekValues = values.slice(i, i + 7);
            if (weekValues.length > 0) {
              weeklyAverages.push(
                weekValues.reduce((a, b) => a + b, 0) / weekValues.length
              );
            }
          }

          // Count consecutive weeks of improvement
          let improvementWeeks = 0;
          for (let i = weeklyAverages.length - 1; i > 0; i--) {
            const improvement = weeklyAverages[i] - weeklyAverages[i - 1];
            if (improvement > 30) {
              improvementWeeks++;
            } else {
              break;
            }
          }

          if (improvementWeeks >= 2) {
            analysis.longTermImproving.push(resident);
          }

          // Sustained improvement: consecutive weeks above goal
          let weeksAboveGoal = 0;
          for (let i = weeklyAverages.length - 1; i >= 0; i--) {
            if (weeklyAverages[i] >= resident.goal) {
              weeksAboveGoal++;
            } else {
              break;
            }
          }

          if (weeksAboveGoal >= 2) {
            analysis.sustainedImprovement.push(resident);
          }
        }
      }

      // High risk: declining trend OR consistently low
      if (
        analysis.decliningTrend.includes(resident) ||
        analysis.consistentlyLow.includes(resident)
      ) {
        analysis.highRisk.push(resident);
      }
    });

    // Remove duplicates from highRisk
    analysis.highRisk = analysis.highRisk.filter(
      (resident, index, self) =>
        index === self.findIndex((r) => r.name === resident.name)
    );

    return analysis;
  }, [residents]);

  const toggleCard = useCallback((cardId: string) => {
    setExpandedCard((prev) => (prev === cardId ? null : cardId));
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="py-12 px-6 text-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
            <h4 className="text-lg font-semibold text-gray-700 mb-2 mt-0">Loading analytics...</h4>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h4 className="text-lg font-semibold text-gray-700 mb-2 mt-0">Error loading analytics</h4>
            <p className="text-sm text-gray-500 m-0">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const decliningAndLow = [
    ...trendAnalysis.decliningTrend,
    ...trendAnalysis.consistentlyLow,
  ].filter(
    (resident, index, self) =>
      index === self.findIndex((r) => r.name === resident.name)
  );

  return (
    <div className="p-8 bg-gray-50">
      {/* Beta Banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-lg mb-6">
        <svg
          className="w-5 h-5 text-yellow-600 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm text-yellow-800">
          <strong>Beta Testing:</strong> This feature is currently in Research &amp; Development.
        </span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-900 m-0">Preventative Analytics &amp; Trends</h2>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">R&amp;D</span>
        </div>
        <p className="text-sm text-gray-500 m-0">
          Proactive insights to identify at-risk residents and track improvement patterns
        </p>
      </div>

      {/* At-Risk Overview */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-0">At-Risk Overview</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* High Risk Card */}
          <div
            className="bg-white rounded-xl p-5 border-l-4 border-red-500 border border-gray-200 cursor-pointer transition-all hover:shadow-md"
            onClick={() => toggleCard("highRisk")}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl font-bold text-gray-900 leading-none">
                {trendAnalysis.highRisk.length}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-1 mt-0">High Risk Residents</h4>
                <p className="text-xs text-gray-500 m-0">Requiring immediate attention</p>
              </div>
            </div>
            {expandedCard === "highRisk" && trendAnalysis.highRisk.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {trendAnalysis.highRisk.slice(0, 5).map((resident, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="text-sm font-medium text-gray-700">{resident.name}</span>
                    <span className="text-xs text-gray-500">
                      Goal: {resident.goal}ml
                    </span>
                  </div>
                ))}
                {trendAnalysis.highRisk.length > 5 && (
                  <p className="text-xs text-gray-500 mt-2 mb-0 text-center">
                    +{trendAnalysis.highRisk.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Declining & Low Card */}
          <div
            className="bg-white rounded-xl p-5 border-l-4 border-yellow-500 border border-gray-200 cursor-pointer transition-all hover:shadow-md"
            onClick={() => toggleCard("declining")}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl font-bold text-gray-900 leading-none">{decliningAndLow.length}</div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-1 mt-0">Declining &amp; Consistently Low</h4>
                <p className="text-xs text-gray-500 m-0">Below goal or declining</p>
              </div>
            </div>
            {expandedCard === "declining" && decliningAndLow.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {decliningAndLow.slice(0, 5).map((resident, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="text-sm font-medium text-gray-700">{resident.name}</span>
                    <span className="text-xs text-gray-500">
                      Goal: {resident.goal}ml
                    </span>
                  </div>
                ))}
                {decliningAndLow.length > 5 && (
                  <p className="text-xs text-gray-500 mt-2 mb-0 text-center">
                    +{decliningAndLow.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Improving Card */}
          <div
            className="bg-white rounded-xl p-5 border-l-4 border-green-500 border border-gray-200 cursor-pointer transition-all hover:shadow-md"
            onClick={() => toggleCard("improving")}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl font-bold text-gray-900 leading-none">
                {trendAnalysis.improvingTrend.length}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-1 mt-0">Improving Trend</h4>
                <p className="text-xs text-gray-500 m-0">Recent consumption increasing</p>
              </div>
            </div>
            {expandedCard === "improving" && trendAnalysis.improvingTrend.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {trendAnalysis.improvingTrend.slice(0, 5).map((resident, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="text-sm font-medium text-gray-700">{resident.name}</span>
                    <span className="text-xs text-gray-500">
                      Goal: {resident.goal}ml
                    </span>
                  </div>
                ))}
                {trendAnalysis.improvingTrend.length > 5 && (
                  <p className="text-xs text-gray-500 mt-2 mb-0 text-center">
                    +{trendAnalysis.improvingTrend.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Long-Term Trend Analysis */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-0">Long-Term Trend Analysis</h3>
        <p className="text-xs text-gray-500 -mt-2 mb-4">
          Improvement patterns over weeks and months
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Long-Term Improving */}
          <div
            className="bg-white rounded-xl p-5 border-l-4 border-green-500 border border-gray-200 cursor-pointer transition-all hover:shadow-md"
            onClick={() => toggleCard("longTerm")}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl font-bold text-gray-900 leading-none">
                {trendAnalysis.longTermImproving.length}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-1 mt-0">Long-Term Improving</h4>
                <p className="text-xs text-gray-500 m-0">2+ consecutive weeks improving</p>
              </div>
            </div>
            {expandedCard === "longTerm" && trendAnalysis.longTermImproving.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {trendAnalysis.longTermImproving.slice(0, 5).map((resident, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="text-sm font-medium text-gray-700">{resident.name}</span>
                    <span className="text-xs text-gray-500">
                      Goal: {resident.goal}ml
                    </span>
                  </div>
                ))}
                {trendAnalysis.longTermImproving.length > 5 && (
                  <p className="text-xs text-gray-500 mt-2 mb-0 text-center">
                    +{trendAnalysis.longTermImproving.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sustained Improvement */}
          <div
            className="bg-white rounded-xl p-5 border-l-4 border-green-500 border border-gray-200 cursor-pointer transition-all hover:shadow-md"
            onClick={() => toggleCard("sustained")}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl font-bold text-gray-900 leading-none">
                {trendAnalysis.sustainedImprovement.length}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-1 mt-0">Sustained Improvement</h4>
                <p className="text-xs text-gray-500 m-0">2+ weeks above goal</p>
              </div>
            </div>
            {expandedCard === "sustained" && trendAnalysis.sustainedImprovement.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                {trendAnalysis.sustainedImprovement.slice(0, 5).map((resident, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <span className="text-sm font-medium text-gray-700">{resident.name}</span>
                    <span className="text-xs text-gray-500">
                      Goal: {resident.goal}ml
                    </span>
                  </div>
                ))}
                {trendAnalysis.sustainedImprovement.length > 5 && (
                  <p className="text-xs text-gray-500 mt-2 mb-0 text-center">
                    +{trendAnalysis.sustainedImprovement.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
