"use client";

import React, { useRef } from "react";
import styles from "@/styles/Behaviours.module.css";
import * as Papa from "papaparse";
import { saveAs } from "file-saver";
import { trackExportButtonClick } from "@/lib/mixpanel";
import { handleSavePDF as exportToPDF } from "@/lib/utils/exportUtils";
import FollowUpChart from "./subcomponents/BeFollowUpChart";
import BeFollowUpTable from "./subcomponents/BeFollowUpTable";
import {
  FollowUpRecord,
  FollowUpFilters,
  MONTHS_BACKWARD,
} from "@/types/behaviourTypes";

interface FollowUpPageProps {
  name: string;
  firebaseId: string;
  followUpData: FollowUpRecord[];
  filteredFollowUpData: FollowUpRecord[];
  followUpLoading: boolean;
  desiredYear: number;
  desiredMonth: string;
  filters: FollowUpFilters;
  onFilterChange: (filters: FollowUpFilters) => void;
}

export default function FollowUpPage({
  name,
  firebaseId,
  followUpData,
  filteredFollowUpData,
  followUpLoading,
  desiredYear,
  desiredMonth,
  filters,
  onFilterChange,
}: FollowUpPageProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const exportClickCountRef = useRef(0);

  const handleSaveCSV = (): void => {
    exportClickCountRef.current += 1;

    const dataToExport = followUpData.length > 0 ? filteredFollowUpData : [];
    const modifiedData = dataToExport.map((item, index) => ({
      "Follow-up Number": String(index + 1),
      "Resident Name": item.resident_name || "Unknown Resident",
      Date: item.date || "Unknown Date",
      "Summary of Behaviour":
        item.summary_of_behaviour || "No summary available",
      "Other Notes Included": item.other_notes || "No notes available",
    }));

    const monthNum = MONTHS_BACKWARD[desiredMonth];
    const filename = `${name}_${desiredYear}_${monthNum}_follow_ups.csv`;

    trackExportButtonClick({
      exportType: "csv",
      pageName: `dashboard_${name}`,
      section: "follow_up",
      homeId: firebaseId,
      dataType: "follow_up",
      recordCount: dataToExport.length,
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
      showFollowUpTable: true,
      followUpData,
      filteredFollowUpData,
      data: [],
      desiredMonth,
      desiredYear,
      months_backword: MONTHS_BACKWARD,
      exportClickCountRef,
      dummyFollowUpData: [],
    });
  };

  const uniqueResidents = [
    ...new Set(followUpData.map((d) => d.resident_name)),
  ];

  return (
    <div ref={tableRef}>
      <div className={styles["chart-container"]}>
        <FollowUpChart
          data={followUpData.length > 0 ? filteredFollowUpData : []}
          desiredYear={desiredYear}
          desiredMonth={desiredMonth}
        />
      </div>

      <div className={styles["table-header"]}>
        <div
          className={styles["header"]}
          style={{ marginBottom: "10px", marginLeft: "10px" }}
        >
          <h2>Behaviour Follow-ups</h2>
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
              style={{ padding: "8px 32px 8px 12px", height: "36px" }}
            >
              <option>Any Resident</option>
              {uniqueResidents.map((residentName) => (
                <option key={residentName}>{residentName}</option>
              ))}
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
        <BeFollowUpTable
          filteredData={filteredFollowUpData}
          followUpLoading={followUpLoading}
        />
      </div>
    </div>
  );
}
