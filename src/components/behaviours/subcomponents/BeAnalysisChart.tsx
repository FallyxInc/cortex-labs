"use client";

import React, { useEffect, useState } from "react";
import styles from "@/styles/Behaviours.module.css";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  BehaviourIncident,
  AnalysisType,
  ChartData,
} from "@/types/behaviourTypes";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface AnalysisChartProps {
  data: BehaviourIncident[];
  desiredYear: number;
  desiredMonth: string;
  threeMonthData: Map<string, BehaviourIncident[]>;
  getTimeOfDay: (time?: string) => string;
}

type ResidentsByTimeOfDay = {
  Morning: string[];
  Evening: string[];
  Night: string[];
};

export default function AnalysisChart({
  data,
  desiredYear,
  desiredMonth,
  threeMonthData,
  getTimeOfDay,
}: AnalysisChartProps) {
  const [analysisChartData, setAnalysisChartData] = useState<ChartData>({
    labels: [],
    datasets: [],
  });
  const [analysisType, setAnalysisType] = useState<AnalysisType>("timeOfDay");
  const [analysisTimeRange, setAnalysisTimeRange] = useState<
    "current" | "3months"
  >("current");
  const [analysisUnit, setAnalysisUnit] = useState<string>("allUnits");
  const [analysisHeaderText, setAnalysisHeaderText] = useState<string>(
    "Behaviours by Time of Day",
  );
  const [residentsByTimeOfDay, setResidentsByTimeOfDay] =
    useState<ResidentsByTimeOfDay>({
      Morning: [],
      Evening: [],
      Night: [],
    });

  useEffect(() => {
    updateAnalysisChart();
  }, [analysisType, analysisTimeRange, analysisUnit, data, desiredYear]);

  const countBehavioursByType = (
    data: BehaviourIncident[],
  ): Record<string, number> => {
    const counts: Record<string, number> = {};
    data.forEach((item) => {
      const type = item.incident_type;
      if (type) {
        counts[type] = (counts[type] || 0) + 1;
      }
    });
    return counts;
  };

  const countBehavioursByUnit = (
    data: BehaviourIncident[],
  ): Record<string, number> => {
    const counts: Record<string, number> = {};
    data.forEach((item) => {
      const unit = item.room;
      if (unit) {
        counts[unit] = (counts[unit] || 0) + 1;
      }
    });
    return counts;
  };

  const countBehavioursByHour = (data: BehaviourIncident[]): number[] => {
    const counts = Array(24).fill(0);
    data.forEach((item) => {
      if (item.time) {
        const hour = new Date("1970-01-01T" + item.time).getHours();
        counts[hour]++;
      }
    });
    return counts;
  };

  const countBehavioursByTimeOfDay = (
    data: BehaviourIncident[],
  ): Record<string, number> => {
    const counts: Record<string, number> = {
      Morning: 0,
      Evening: 0,
      Night: 0,
    };

    data.forEach((item) => {
      const timeOfDay = getTimeOfDay(item.time);
      if (timeOfDay === "Morning") {
        counts.Morning++;
      } else if (timeOfDay === "Evening") {
        counts.Evening++;
      } else {
        counts.Night++;
      }
    });

    return counts;
  };

  const countResidentsByTimeOfDay = (
    data: BehaviourIncident[],
  ): ResidentsByTimeOfDay => {
    const counts: ResidentsByTimeOfDay = {
      Morning: [],
      Evening: [],
      Night: [],
    };

    data.forEach((item) => {
      const timeOfDay = getTimeOfDay(item.time);
      if (timeOfDay === "Morning") {
        counts.Morning.push(item.name);
      } else if (timeOfDay === "Evening") {
        counts.Evening.push(item.name);
      } else {
        counts.Night.push(item.name);
      }
    });

    return counts;
  };

  const countBehavioursByInjury = (
    data: BehaviourIncident[],
  ): Record<string, number> => {
    const counts: Record<string, number> = {};
    data.forEach((item) => {
      const injury = item.injuries;
      if (injury) {
        counts[injury] = (counts[injury] || 0) + 1;
      }
    });
    return counts;
  };

  const countResidentsWithRecurringBehaviours = (
    data: BehaviourIncident[],
  ): Record<string, number> => {
    const counts: Record<string, number> = {};
    data.forEach((item) => {
      if (item.name) {
        counts[item.name] = (counts[item.name] || 0) + 1;
      }
    });
    return counts;
  };

  const countBehavioursByDayOfWeek = (
    data: BehaviourIncident[],
  ): Record<string, number> => {
    const dayCounts: Record<string, number> = {
      Sunday: 0,
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
    };

    data.forEach((item) => {
      if (!item.date) {
        return;
      }

      try {
        const [year, month, day] = item.date.split("-").map(Number);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const date = new Date(year, month - 1, day);
          const dayOfWeek = date.toLocaleDateString("en-US", {
            weekday: "long",
          });
          if (dayOfWeek in dayCounts) {
            dayCounts[dayOfWeek]++;
          }
        }
      } catch (error) {
        console.error("Error parsing date:", item.date, error);
      }
    });

    return dayCounts;
  };

  const updateAnalysisChart = (): void => {
    const filteredData =
      analysisTimeRange === "3months"
        ? Array.from(threeMonthData.values()).flat()
        : data;

    let newLabels: string[] = [];
    let newData: number[] = [];

    switch (analysisType) {
      case "timeOfDay":
        setAnalysisHeaderText("Behaviours by Time of Day");
        newLabels = ["Morning", "Evening", "Night"];
        const timeOfDayCounts = countBehavioursByTimeOfDay(filteredData);
        setResidentsByTimeOfDay(countResidentsByTimeOfDay(filteredData));
        newData = [
          timeOfDayCounts.Morning,
          timeOfDayCounts.Evening,
          timeOfDayCounts.Night,
        ];
        break;

      case "injuries":
        setAnalysisHeaderText("Behaviours by Injury");
        const injuryCounts = countBehavioursByInjury(filteredData);
        const sortedInjuries = Object.entries(injuryCounts).sort(
          ([, a], [, b]) => b - a,
        );
        newLabels = sortedInjuries.map(([label]) => label);
        newData = sortedInjuries.map(([, count]) => count);
        break;

      case "behaviourType":
        setAnalysisHeaderText("Behaviours by Type");
        const typeCounts = countBehavioursByType(filteredData);
        const sortedTypes = Object.entries(typeCounts).sort(
          ([, a], [, b]) => b - a,
        );
        newLabels = sortedTypes.map(([label]) => label);
        newData = sortedTypes.map(([, count]) => count);
        break;

      case "residents":
        setAnalysisHeaderText("Behaviours by Resident Name");
        const residentCounts =
          countResidentsWithRecurringBehaviours(filteredData);
        const sortedResidents = Object.entries(residentCounts).sort(
          ([, a], [, b]) => b - a,
        );
        newLabels = sortedResidents.map(([label]) => label);
        newData = sortedResidents.map(([, count]) => count);
        break;

      case "unit":
        setAnalysisHeaderText("Behaviours by Unit");
        const unitCounts = countBehavioursByUnit(filteredData);
        const sortedUnits = Object.entries(unitCounts).sort(
          ([, a], [, b]) => b - a,
        );
        newLabels = sortedUnits.map(([label]) => label);
        newData = sortedUnits.map(([, count]) => count);
        break;

      case "hour":
        setAnalysisHeaderText("Behaviours by Hour");
        newLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
        newData = countBehavioursByHour(filteredData);
        break;

      case "dayOfWeek":
        setAnalysisHeaderText("Behaviours by Day of Week");
        const dayOfWeekCounts = countBehavioursByDayOfWeek(filteredData);
        newLabels = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        newData = newLabels.map((day) => dayOfWeekCounts[day] || 0);
        break;
    }

    setAnalysisChartData({
      labels: newLabels,
      datasets: [
        {
          data: newData,
          backgroundColor: "rgba(6, 182, 212, 0.6)",
          borderColor: "rgb(6, 182, 212)",
          borderWidth: 1,
        },
      ],
    });
  };

  const analysisChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: false,
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: function (context: {
            label?: string;
            dataset?: { label?: string };
            raw?: unknown;
          }) {
            if (
              analysisType === "timeOfDay" &&
              context.label &&
              residentsByTimeOfDay[context.label as keyof ResidentsByTimeOfDay]
            ) {
              return [
                "Residents: ",
                ...residentsByTimeOfDay[
                  context.label as keyof ResidentsByTimeOfDay
                ].map((name) => ` - ${name}`),
              ];
            }
            return `${context.dataset?.label || "Count"}: ${context.raw}`;
          },
        },
      },
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        barPercentage: 1,
        categoryPercentage: 1,
        ticks: {
          color: "#495057",
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          color: "#495057",
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div
      className={styles.chart}
      style={{
        display: "flex",
        justifyContent: "space-between",
        flexDirection: "column",
        flex: "1",
      }}
    >
      <div className={styles.topHeader} style={{ marginBottom: "12px" }}>
        <h3 style={{ margin: 0 }}>{analysisHeaderText}</h3>
        <select
          className={styles.selector}
          id="fallsAnalysisType"
          value={analysisType}
          onChange={(e) => {
            setAnalysisType(e.target.value as AnalysisType);
          }}
        >
          <option value="timeOfDay">Time of Day</option>
          <option value="injuries">Injury Breakdown</option>
          <option value="behaviourType">Behaviour Type</option>
          <option value="residents">Resident Name</option>
          <option value="unit">Unit</option>
          <option value="hour">By Hour (24hr)</option>
          <option value="dayOfWeek">Day of Week</option>
        </select>
      </div>

      <div style={{ flex: "1", height: "100%", minHeight: "200px" }}>
        {analysisChartData.datasets.length > 0 && (
          <Bar data={analysisChartData} options={analysisChartOptions} />
        )}
      </div>
    </div>
  );
}
