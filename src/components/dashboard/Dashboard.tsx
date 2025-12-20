"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Behaviours.module.css";
import { Chart, ArcElement, PointElement, LineElement } from "chart.js";
import { auth } from "@/lib/firebase/firebase";
import { trackPageVisit, trackTimeOnPage } from "@/lib/mixpanel";

import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";
import BehavioursPage from "../behaviours/BehavioursPage";
import FollowUpPage from "../behaviours/FollowUpPage";
import { useBehavioursData } from "@/hooks/useBehavioursData";
import { useDateRange } from "@/hooks/useDateRange";
import BehavioursReports from "../behaviours/BehavioursReports";
import TrendsAndAnalysis from "../behaviours/TrendsAndAnalysis";
import {
  DashboardProps,
  DashboardSection,
  OverviewTab,
  BehavioursFilters,
  FollowUpFilters,
  BehaviourIncident,
  FollowUpRecord,
  MONTHS_FORWARD,
} from "@/types/behaviourTypes";

Chart.register(ArcElement, PointElement, LineElement);

export default function Dashboard({
  name,
  firebaseId,
  title,
  goal,
}: DashboardProps) {
  const router = useRouter();

  // Navigation state
  const [activeSection, setActiveSection] =
    useState<DashboardSection>("overview");
  const [activeOverviewTab, setActiveOverviewTab] =
    useState<OverviewTab>("behaviours");

  // Date range
  const {
    startDate,
    endDate,
    desiredMonth,
    desiredYear,
    handleStartDateChange,
    handleEndDateChange,
  } = useDateRange();

  // Fetch data
  const {
    data,
    followUpData,
    isLoading,
    followUpLoading,
    threeMonthData,
    overviewMetrics,
  } = useBehavioursData({
    firebaseId,
    startDate,
    endDate,
  });

  // Filters
  const [behavioursFilters, setBehavioursFilters] = useState<BehavioursFilters>(
    {
      resident: "Any Resident",
      behaviorType: "All Types",
      timeOfDay: "Anytime",
    },
  );

  const [followUpFilters, setFollowUpFilters] = useState<FollowUpFilters>({
    resident: "Any Resident",
  });

  // Tracking refs
  const pageVisitCountRef = useRef(0);
  const lastVisitTimeRef = useRef<number | null>(null);
  const pageStartTimeRef = useRef(Date.now());

  // Helper function
  const getTimeOfDay = useCallback((time?: string): string => {
    if (!time) return "Anytime";
    const hour = new Date("1970-01-01T" + time).getHours();
    if (hour >= 6 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 20) return "Evening";
    return "Night";
  }, []);

  // Track page visit on mount
  useEffect(() => {
    pageVisitCountRef.current += 1;
    const timeSinceLastVisit = lastVisitTimeRef.current
      ? Math.floor((Date.now() - lastVisitTimeRef.current) / 1000)
      : undefined;

    trackPageVisit({
      pageName: `dashboard_${name}`,
      visitCount: pageVisitCountRef.current,
      homeId: firebaseId,
      timeSinceLastVisit,
    });

    lastVisitTimeRef.current = Date.now();
  }, [name, firebaseId]);

  // Track time on page periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSpent = Math.floor(
        (Date.now() - pageStartTimeRef.current) / 1000,
      );
      if (timeSpent > 0 && timeSpent % 30 === 0) {
        trackTimeOnPage({
          pageName: `dashboard_${name}`,
          timeSpent,
          homeId: firebaseId,
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [name, firebaseId]);

  // Filter behaviours data
  const filteredData = data.filter((item: BehaviourIncident) => {
    // Date range filter
    if (startDate && endDate && item.date) {
      const itemDate = new Date(item.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (itemDate < start || itemDate > end) return false;
    }

    // Resident filter
    if (
      behavioursFilters.resident !== "Any Resident" &&
      item.name !== behavioursFilters.resident
    )
      return false;

    // Behavior type filter
    if (
      behavioursFilters.behaviorType !== "All Types" &&
      item.incident_type !== behavioursFilters.behaviorType
    )
      return false;

    // Time of day filter
    if (behavioursFilters.timeOfDay !== "Anytime") {
      const tod = getTimeOfDay(item.time);
      if (tod !== behavioursFilters.timeOfDay) return false;
    }

    return true;
  });

  // Filter follow-up data
  const filteredFollowUpData = followUpData.filter((item: FollowUpRecord) => {
    // Date range filter
    if (startDate && endDate && item.date) {
      const itemDate = new Date(item.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (itemDate < start || itemDate > end) return false;
    }

    // Resident filter for follow-ups
    if (
      followUpFilters.resident !== "Any Resident" &&
      item.resident_name !== followUpFilters.resident
    )
      return false;

    return true;
  });

  const handleLogout = async (): Promise<void> => {
    try {
      await auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleSectionChange = (section: DashboardSection): void => {
    setActiveSection(section);
  };

  const handleOverviewTabChange = (tab: OverviewTab): void => {
    setActiveOverviewTab(tab);
  };

  const renderMainContent = () => {
    if (activeSection === "trends") {
      return (
        <TrendsAndAnalysis
          name={name}
          altName={firebaseId}
          data={data}
          getTimeOfDay={getTimeOfDay}
          startDate={startDate}
          endDate={endDate}
        />
      );
    }

    if (activeSection === "reports") {
      return (
        <BehavioursReports
          name={name}
          altName={firebaseId}
          data={data}
          getTimeOfDay={getTimeOfDay}
          startDate={startDate}
          endDate={endDate}
        />
      );
    }

    // Overview section
    if (activeOverviewTab === "followups") {
      return (
        <FollowUpPage
          name={name}
          firebaseId={firebaseId}
          followUpData={followUpData}
          filteredFollowUpData={filteredFollowUpData}
          followUpLoading={followUpLoading}
          desiredYear={desiredYear}
          desiredMonth={desiredMonth}
          filters={followUpFilters}
          onFilterChange={setFollowUpFilters}
        />
      );
    }

    return (
      <BehavioursPage
        name={name}
        firebaseId={firebaseId}
        data={data}
        filteredData={filteredData}
        threeMonthData={threeMonthData}
        overviewMetrics={overviewMetrics}
        desiredYear={desiredYear}
        desiredMonth={desiredMonth}
        filters={behavioursFilters}
        onFilterChange={setBehavioursFilters}
        getTimeOfDay={getTimeOfDay}
      />
    );
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.dashboardLayout}>
        <DashboardSidebar
          activeSection={activeSection}
          activeOverviewTab={activeOverviewTab}
          onSectionChange={handleSectionChange}
          onOverviewTabChange={handleOverviewTabChange}
          onLogout={handleLogout}
          homeId={firebaseId}
        />

        <div className={styles.mainContent}>
          <DashboardHeader
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            userEmail={auth.currentUser?.email || "User"}
            title={title}
          />

          {renderMainContent()}
        </div>
      </div>
    </div>
  );
}
