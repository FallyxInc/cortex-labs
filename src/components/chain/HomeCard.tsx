"use client";

import React from "react";

export interface HomeCardMetrics {
  homeId: string;
  homeName: string;
  totalIncidents: number;
  followUpCompletionRate: number;
  criticalBehaviours: number;
  hydrationGoalMet?: number;
  hydrationMissed3Days?: number;
  monthlyLogins?: number;
}

interface HomeCardProps {
  home: HomeCardMetrics;
  onClick: (homeId: string) => void;
  colorIndex?: number;
}

export default function HomeCard({ home, onClick, colorIndex = 0 }: HomeCardProps) {
  const borderColor = colorIndex % 2 === 0 ? "border-l-cyan-500" : "border-l-green-500";

  return (
    <div
      onClick={() => onClick(home.homeId)}
      className={`bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 border-l-4 ${borderColor}`}
    >
      <h3 className="font-semibold text-gray-900 text-sm mb-3 truncate" title={home.homeName}>
        {home.homeName}
      </h3>

      <div className="text-3xl font-bold text-gray-900 mb-1">
        {home.totalIncidents}
      </div>
      <div className="text-xs text-gray-600 mb-3">Behavioural Incidents</div>

      <div className="space-y-2 text-xs border-t border-gray-100 pt-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Follow-up Rate:</span>
          <span className="font-semibold text-blue-600">{home.followUpCompletionRate}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Critical Behaviours:</span>
          <span className="font-semibold text-green-600">{home.criticalBehaviours}</span>
        </div>
        {home.hydrationGoalMet !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Hydration Goal Met:</span>
            <span className="font-semibold text-cyan-600">{home.hydrationGoalMet}%</span>
          </div>
        )}
        {home.hydrationMissed3Days !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Missed 3 Days:</span>
            <span className={`font-semibold ${home.hydrationMissed3Days > 0 ? "text-red-600" : "text-gray-600"}`}>
              {home.hydrationMissed3Days}
            </span>
          </div>
        )}
        {home.monthlyLogins !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Monthly logins:</span>
            <span className="font-semibold text-gray-700">{home.monthlyLogins}</span>
          </div>
        )}
      </div>
    </div>
  );
}
