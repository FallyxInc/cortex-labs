"use client";

import React from "react";
import { FollowUpRecord } from "@/types/behaviourTypes";

interface FollowUpTableProps {
  filteredData: FollowUpRecord[];
  followUpLoading: boolean;
}

export default function BeFollowUpTable({
  filteredData,
  followUpLoading,
}: FollowUpTableProps) {
  if (followUpLoading) {
    return (
      <div style={{ textAlign: "center", padding: "20px" }}>
        Loading follow-up data...
      </div>
    );
  }

  if (filteredData.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
        No follow-up data available
      </div>
    );
  }

  return (
    <div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.tableHeader}>#</th>
            <th style={s.tableHeader}>Resident Name</th>
            <th style={s.tableHeader}>Date</th>
            <th style={s.tableHeader}>Summary</th>
            <th style={s.tableHeader}>Other Notes Included</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((item, index) => (
            <tr key={index} style={index % 2 === 1 ? s.evenRow : {}}>
              <td style={s.tableCell}>{index + 1}</td>
              <td style={s.tableCell}>{item.resident_name || ""}</td>
              <td style={s.tableCell}>{item.date || ""}</td>
              <td style={s.tableCell}>{item.summary_of_behaviour || ""}</td>
              <td style={s.tableCell}>
                {item.other_notes
                  ? item.other_notes.replace(/note text\s*:\s*/gi, "")
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "20px",
    fontSize: "13px",
    tableLayout: "auto",
  },
  tableHeader: {
    border: "1px solid #ddd",
    padding: "4px 2px",
    textAlign: "center",
    backgroundColor: "#e0f7fa",
    fontWeight: 600,
    fontSize: "13px",
  },
  tableCell: {
    border: "1px solid #ddd",
    padding: "4px 2px",
    textAlign: "left",
    fontSize: "14px",
    verticalAlign: "top",
    overflow: "hidden",
  },
  evenRow: {
    backgroundColor: "#f8f8f8",
  },
};
