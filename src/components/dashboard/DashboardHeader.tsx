'use client';

import React from 'react';
import styles from '@/styles/Behaviours.module.css';
import { DashboardSection } from '@/types/behaviourTypes';

interface DashboardHeaderProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  userEmail: string;
  title: string;
  activeSection: DashboardSection;
}

export default function DashboardHeader({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  userEmail,
  title,
  activeSection,
}: DashboardHeaderProps) {
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;

    onStartDateChange(newStartDate);

    // check if new start date is before end date
    if (newStartDate > endDate) {
      onEndDateChange(newStartDate);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value;

    onEndDateChange(newEndDate);

    // check if new end date is after start date
    if (newEndDate < startDate) {
      onStartDateChange(newEndDate);
    }
  };

  return (
    <div className={styles.topHeaderBar}>
      <div className={styles.topHeaderLeft}>
        {/* Universal Date Range Picker */}
        <div className={styles.universalDateRangePicker}>
          {activeSection === "behaviours" && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                className={styles.dateRangeInput}
                title="Start Date"
              />
              <span className={styles.dateRangeSeparator}>to</span>
            </>
          )}
          <input
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            className={styles.dateRangeInput}
            title="End Date"
            // min={startDate}
          />
        </div>
      </div>
      <div className={styles.topHeaderRight}>
        <div className={styles.userInfo}>
          <span className={styles.welcomeText}>
            Welcome, {userEmail || 'User'} ({title})
          </span>
        </div>
      </div>
    </div>
  );
}
