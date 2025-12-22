"use client";

import React from "react";
import styles from "@/styles/Behaviours.module.css";

interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  topBar?: React.ReactNode;
  children: React.ReactNode;
}

export default function DashboardLayout({
  sidebar,
  topBar,
  children,
}: DashboardLayoutProps) {
  return (
    <div className={styles.dashboard}>
      <div className={styles.dashboardLayout}>
        {sidebar}
        <div className={styles.mainContent}>
          {topBar}
          {children}
        </div>
      </div>
    </div>
  );
}
