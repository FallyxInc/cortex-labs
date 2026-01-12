"use client";

import React from "react";
import styles from "@/styles/Behaviours.module.css";

interface TopBarProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  userEmail?: string;
  title?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  showDatePicker?: boolean;
}

export default function TopBar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  userEmail,
  title,
  leftContent,
  rightContent,
  showDatePicker = true,
}: TopBarProps) {
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onStartDateChange) {
      onStartDateChange(e.target.value);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onEndDateChange) {
      onEndDateChange(e.target.value);
    }
  };

  return (
    <div className={styles.topHeaderBar}>
      <div className={styles.topHeaderLeft}>
        {leftContent ? (
          leftContent
        ) : showDatePicker && startDate && endDate ? (
          <div className={styles.universalDateRangePicker}>
            <input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className={styles.dateRangeInput}
              title="Start Date"
            />
            <span className={styles.dateRangeSeparator}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className={styles.dateRangeInput}
              title="End Date"
              min={startDate}
            />
          </div>
        ) : null}
      </div>
      <div className={styles.topHeaderRight}>
        {rightContent ? (
          rightContent
        ) : (
          <div className={styles.userInfo}>
            <span className={styles.welcomeText}>
              {userEmail && title
                ? `Welcome, ${userEmail} (${title})`
                : userEmail
                  ? `Welcome, ${userEmail}`
                  : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
