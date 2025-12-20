"use client";

import React from "react";
import styles from "@/styles/Behaviours.module.css";
import { trackDashboardInteraction } from "@/lib/mixpanel";
import { DashboardSection, OverviewTab } from "@/types/behaviourTypes";

interface DashboardSidebarProps {
  activeSection: DashboardSection;
  activeOverviewTab: OverviewTab;
  onSectionChange: (section: DashboardSection) => void;
  onOverviewTabChange: (tab: OverviewTab) => void;
  onLogout: () => void;
  homeId: string;
}

export default function DashboardSidebar({
  activeSection,
  activeOverviewTab,
  onSectionChange,
  onOverviewTabChange,
  onLogout,
  homeId,
}: DashboardSidebarProps) {
  const handleSectionClick = (
    section: DashboardSection,
    dashboardType: "behaviours" | "follow_up" | "trends" | "reports",
  ) => {
    onSectionChange(section);
    const action =
      section === "overview"
        ? "view_table"
        : section === "reports"
          ? "view_report"
          : "view_trends";
    trackDashboardInteraction({
      action,
      dashboardType,
      homeId,
    });
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitle}>Behaviours</div>
      </div>

      <nav className={styles.sidebarNav}>
        {/* Overview Section with Sub-items */}
        <div className={styles.navSection}>
          <button
            onClick={() => handleSectionClick("overview", "behaviours")}
            className={`${styles.navMainItem} ${activeSection === "overview" ? styles.navMainItemActive : ""}`}
          >
            <div className={styles.navItemContent}>
              <svg
                className={styles.navIcon}
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-valuetext="range"
              >
                <rect
                  x="3"
                  y="3"
                  width="14"
                  height="14"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path d="M3 7H17" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 3V17" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span>Overview</span>
            </div>
            {activeSection === "overview" && (
              <span className={styles.navArrow}>▼</span>
            )}
          </button>
          {activeSection === "overview" && (
            <div className={styles.navSubItems}>
              <button
                onClick={() => onOverviewTabChange("behaviours")}
                className={`${styles.navSubItem} ${activeOverviewTab === "behaviours" ? styles.navSubItemActive : ""}`}
              >
                <div className={styles.navSubItemContent}>
                  <div className={styles.navSubItemIndicator}></div>
                  <svg
                    className={styles.navSubIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 4H14M2 8H14M2 12H10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="4" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="8" r="1.5" fill="currentColor" />
                  </svg>
                  <span>Behaviours</span>
                </div>
              </button>
              <button
                onClick={() => onOverviewTabChange("followups")}
                className={`${styles.navSubItem} ${activeOverviewTab === "followups" ? styles.navSubItemActive : ""}`}
              >
                <div className={styles.navSubItemContent}>
                  <div className={styles.navSubItemIndicator}></div>
                  <svg
                    className={styles.navSubIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 4L8 10L14 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <circle cx="3" cy="12" r="1.5" fill="currentColor" />
                    <path
                      d="M6 12H14"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Follow-ups</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Reports Section */}
        <div className={styles.navSection}>
          <button
            onClick={() => handleSectionClick("reports", "reports")}
            className={`${styles.navMainItem} ${activeSection === "reports" ? styles.navMainItemActive : ""}`}
          >
            <div className={styles.navItemContent}>
              <svg
                className={styles.navIcon}
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="3"
                  y="3"
                  width="14"
                  height="14"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M5 12L8 9L11 12L15 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path
                  d="M15 8V14H5V8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span>Reports</span>
            </div>
          </button>
        </div>

        {/* Trends and Analysis Section */}
        <div className={styles.navSection}>
          <button
            onClick={() => handleSectionClick("trends", "trends")}
            className={`${styles.navMainItem} ${activeSection === "trends" ? styles.navMainItemActive : ""}`}
          >
            <div className={styles.navItemContent}>
              <svg
                className={styles.navIcon}
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 15L6 9L10 12L18 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <circle cx="6" cy="9" r="2" fill="currentColor" />
                <circle cx="10" cy="12" r="2" fill="currentColor" />
                <circle cx="18" cy="4" r="2" fill="currentColor" />
              </svg>
              <span>Trends and Analysis</span>
            </div>
          </button>
        </div>
      </nav>

      {/* Support Section */}
      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarFooterTitle}>Support</div>
        <a
          href="https://drive.google.com/file/d/1zcHk-ieWInvWwgw1tILMqLCXovh-SeIP/view"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sidebarFooterItem}
        >
          <span>Privacy Policy</span>
        </a>
        <div className={styles.sidebarFooterItem}>
          <span>info@fallyx.com</span>
        </div>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLScBz8aYbjqQfc_exkvGPG86S9dTdfHA84MWxEynPgiJGSe6Mg/viewform"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sidebarFooterItem}
        >
          <span>Report A Problem</span>
        </a>
        <button className={styles.sidebarLogout} onClick={onLogout}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ marginRight: "8px" }}
          >
            <path
              d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M10 11L13 8L10 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13 8H6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}
