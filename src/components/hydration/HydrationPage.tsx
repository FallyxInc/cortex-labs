"use client";
import HydrationStats from "./HydrationStats";
import HydrationTable from "./HydrationTable";
import { useHydrationData } from "@/hooks/useHydrationData";

interface HydrationPageProps {
  name: string;
  firebaseId: string;
  startDate: string;
  endDate: string;
}

export default function HydrationPage({
  firebaseId,
  startDate,
  endDate,
}: HydrationPageProps) {
  const { residents, isLoading, error, metrics, dateColumns } = useHydrationData({
    homeId: firebaseId,
    startDate,
    endDate,
    enabled: true,
  });

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
            <h4 className="text-lg font-semibold text-gray-700 mb-2 mt-0">Error loading hydration data</h4>
            <p className="text-sm text-gray-500 m-0">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50">
      <HydrationStats
        totalResidents={metrics.totalResidents}
        goalMetCount={metrics.goalMetCount}
        goalMetPercentage={metrics.goalMetPercentage}
        missed3DaysCount={metrics.missed3DaysCount}
        isLoading={isLoading}
      />
      <HydrationTable
        residents={residents}
        dateColumns={dateColumns}
        isLoading={isLoading}
      />
    </div>
  );
}
