"use client";

import React from "react";

interface HydrationStatsProps {
  totalResidents: number;
  goalMetCount: number;
  goalMetPercentage: number;
  missed3DaysCount: number;
  isLoading: boolean;
}

export default function HydrationStats({
  totalResidents,
  goalMetCount,
  goalMetPercentage,
  missed3DaysCount,
  isLoading,
}: HydrationStatsProps) {
  const getPercentageColor = (percentage: number): string => {
    if (percentage < 20) return "#ef4444"; // red
    if (percentage < 40) return "#f59e0b"; // yellow
    if (percentage < 60) return "#eab308"; // yellow-400
    if (percentage < 80) return "#22c55e"; // green-400
    return "#16a34a"; // green-500
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-center w-full h-[60px]">
              <div className="w-full h-10 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 transition-shadow hover:shadow-md">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-sky-100">
          <svg
            className="w-6 h-6 text-sky-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-500">Total Residents</span>
          <span className="text-2xl font-bold text-gray-900">{totalResidents}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 transition-shadow hover:shadow-md">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-100">
          <svg
            className="w-6 h-6 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-500">Goal Met Today</span>
          <span className="text-2xl font-bold text-gray-900">{goalMetCount}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 transition-shadow hover:shadow-md">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-100">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-500">Missed 3 Days</span>
          <span className="text-2xl font-bold text-gray-900">{missed3DaysCount}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 transition-shadow hover:shadow-md">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-100">
          <svg
            className="w-6 h-6 text-orange-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-500">Goal Met %</span>
          <span
            className="text-2xl font-bold"
            style={{ color: getPercentageColor(goalMetPercentage) }}
          >
            {goalMetPercentage}%
          </span>
        </div>
      </div>
    </div>
  );
}
