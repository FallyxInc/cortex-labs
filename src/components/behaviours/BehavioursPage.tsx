"use client";

import React, { useState, useRef } from "react";
import styles from "@/styles/Behaviours.module.css";
import * as Papa from "papaparse";
import { saveAs } from "file-saver";
import { trackExportButtonClick } from "@/lib/mixpanel";
import { handleSavePDF as exportToPDF } from "@/lib/utils/exportUtils";
import AnalysisChart from "./subcomponents/BeAnalysisChart";
import BeTrackingTable from "./subcomponents/BeTrackingTable";
import {
  BehaviourIncident,
  OverviewMetrics,
  BehavioursFilters,
  MONTHS_BACKWARD,
} from "@/types/behaviourTypes";

interface BehavioursPageProps {
  name: string;
  firebaseId: string;
  data: BehaviourIncident[];
  filteredData: BehaviourIncident[];
  threeMonthData: Map<string, BehaviourIncident[]>;
  overviewMetrics: OverviewMetrics;
  desiredYear: number;
  desiredMonth: string;
  filters: BehavioursFilters;
  onFilterChange: (filters: BehavioursFilters) => void;
  getTimeOfDay: (time?: string) => string;
}

export default function BehavioursPage({
  name,
  firebaseId,
  data,
  filteredData,
  threeMonthData,
  overviewMetrics,
  desiredYear,
  desiredMonth,
  filters,
  onFilterChange,
  getTimeOfDay,
}: BehavioursPageProps) {
  const [showResidentNames, setShowResidentNames] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const exportClickCountRef = useRef(0);

  const cleanDuplicateText = (
    text: string | undefined,
    field: string,
  ): string => {
    if (!text) return "";

    if (field === "interventions") {
      return text.replace(
        /No Progress Note Found Within 24hrs of RIM\s*Within 24hrs of RIM/g,
        "No Progress Note Found Within 24hrs of RIM",
      );
    } else if (field === "triggers") {
      return text.replace(
        /Within 24hrs of RIM\s*Within 24hrs of RIM\s*Within 24hrs of RIM/g,
        "Within 24hrs of RIM",
      );
    }
    return text;
  };

  const handleSaveCSV = (): void => {
    exportClickCountRef.current += 1;

    const modifiedData = data.map((item) => ({
      ...item,
      "Significant Injury Flag":
        item.injuries?.toLowerCase().includes("head injury") ||
        item.injuries?.toLowerCase().includes("fracture") ||
        item.injuries?.toLowerCase().includes("skin tear")
          ? "Yes"
          : "No",
      "Non Compliance Flag":
        item.poaContacted?.toLowerCase() === "no" ||
        item.cause === "No Fall Note" ||
        (item.postFallNotes !== undefined && item.postFallNotes < 3)
          ? "Yes"
          : "No",
    }));

    const monthNum = MONTHS_BACKWARD[desiredMonth];
    const filename = `${name}_${desiredYear}_${monthNum}_behaviours_data.csv`;

    trackExportButtonClick({
      exportType: "csv",
      pageName: `dashboard_${name}`,
      section: "overview",
      homeId: firebaseId,
      dataType: "behaviours",
      recordCount: data.length,
      clickCount: exportClickCountRef.current,
    });

    const csv = Papa.unparse(modifiedData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, filename);
  };

  const handleSavePDF = async (): Promise<void> => {
    await exportToPDF({
      tableRef,
      name,
      altName: firebaseId,
      showFollowUpTable: false,
      followUpData: [],
      filteredFollowUpData: [],
      data,
      desiredMonth,
      desiredYear,
      months_backword: MONTHS_BACKWARD,
      exportClickCountRef,
      dummyFollowUpData: [],
    });
  };

  const uniqueResidents = [...new Set(data.map((d) => d.name))];
  const uniqueTypes = [...new Set(data.map((d) => d.incident_type))];

  return (
    <div ref={tableRef}>
      <div className={styles["chart-container"]}>
        <AnalysisChart
          data={filteredData}
          desiredYear={desiredYear}
          desiredMonth={desiredMonth}
          threeMonthData={threeMonthData}
          getTimeOfDay={getTimeOfDay}
        />

        <div className={styles.chart}>
          <div className={styles["gauge-container"]}>
            <div className={styles.topHeader}>
              <h3>Behaviours Overview</h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "2px",
                }}
              >
                <label style={{ fontSize: "14px" }}>Show Resident Names:</label>
                <input
                  type="checkbox"
                  checked={showResidentNames}
                  onChange={(e) => setShowResidentNames(e.target.checked)}
                  style={{ width: "18px", height: "18px" }}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                marginTop: "20px",
              }}
            >
              {/* Antipsychotics Card */}
              <MetricCard
                value={overviewMetrics.antipsychotics.percentage}
                change={overviewMetrics.antipsychotics.change}
                title="% of Residents with Potentially Inappropriate Use of Antipsychotics"
                description="Residents receiving antipsychotics without proper documentation"
                residents={overviewMetrics.antipsychotics.residents}
                showResidentNames={showResidentNames}
              />

              {/* Behaviours Worsened Card */}
              <MetricCard
                value={overviewMetrics.worsened.percentage}
                change={overviewMetrics.worsened.change}
                title="% of Behaviours Worsened"
                description="Residents showing increased behavioral challenges"
                residents={overviewMetrics.worsened.residents}
                showResidentNames={showResidentNames}
              />

              {/* Behaviours Improved Card */}
              <MetricCard
                value={overviewMetrics.improved.percentage}
                change={overviewMetrics.improved.change}
                title="% of Behaviours Improved"
                description="Residents showing positive behavioral changes"
                residents={overviewMetrics.improved.residents}
                showResidentNames={showResidentNames}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles["table-header"]}>
        <div
          className={styles["header"]}
          style={{ marginBottom: "10px", marginLeft: "10px" }}
        >
          <h2>Behaviours Tracking Table</h2>
        </div>
      </div>

      <div className={styles["table-header"]}>
        <div className={styles["header"]}>
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              marginLeft: "10px",
            }}
          >
            <select
              className={styles.selector}
              value={filters.resident}
              onChange={(e) =>
                onFilterChange({ ...filters, resident: e.target.value })
              }
            >
              <option>Any Resident</option>
              {uniqueResidents.map((residentName) => (
                <option key={residentName}>{residentName}</option>
              ))}
            </select>

            <select
              className={styles.selector}
              value={filters.behaviorType}
              onChange={(e) =>
                onFilterChange({ ...filters, behaviorType: e.target.value })
              }
            >
              <option>All Types</option>
              {uniqueTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>

            <select
              className={styles.selector}
              value={filters.timeOfDay}
              onChange={(e) =>
                onFilterChange({ ...filters, timeOfDay: e.target.value })
              }
            >
              <option>Anytime</option>
              <option>Morning</option>
              <option>Evening</option>
              <option>Night</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className={styles["download-button"]} onClick={handleSaveCSV}>
            Download as CSV
          </button>
          <button
            className={styles["download-button"]}
            onClick={handleSavePDF}
            style={{
              background: "#ffffff",
              border: "2px solid #06b6d4",
              color: "#06b6d4",
            }}
          >
            Download as PDF
          </button>
        </div>
      </div>

      <div className={styles.tableSection}>
        <BeTrackingTable
          filteredData={filteredData}
          cleanDuplicateText={cleanDuplicateText}
          storageKey={`${name}_${desiredYear}_${desiredMonth}_behaviours_checked`}
        />
      </div>
    </div>
  );
}

interface MetricCardProps {
  value: number;
  change: number;
  title: string;
  description: string;
  residents: string[];
  showResidentNames: boolean;
}

function MetricCard({
  value,
  change,
  title,
  description,
  residents,
  showResidentNames,
}: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#F8F9FA",
        border: "2px solid #06b6d4",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 4px 8px rgba(6, 182, 212, 0.15)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <div
          style={{
            backgroundColor: "#06b6d4",
            borderRadius: "20%",
            padding: "10px",
            minWidth: "60px",
            width: "60px",
            height: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          {value}
        </div>
        <div style={{ textAlign: "left" }}>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "#0D0E10",
              marginBottom: "5px",
            }}
          >
            {title}
          </h3>
          <p style={{ fontSize: "14px", color: "#676879", margin: 0 }}>
            {description}
          </p>
          {showResidentNames && (
            <div
              style={{ marginTop: "10px", fontSize: "18px", color: "#676879" }}
            >
              <strong>Residents:</strong> {residents.join(", ")}
            </div>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "24px", fontWeight: "bold", color: "#06b6d4" }}>
          {change > 0 ? "+" : ""}
          {change}%
        </div>
        <div style={{ fontSize: "12px", color: "#676879" }}>vs last month</div>
      </div>
    </div>
  );
}
