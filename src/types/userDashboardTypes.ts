/**
 * User Dashboard Navigation Types
 * Type definitions for dashboard navigation and sidebar components
 */

import React from 'react';

// ============================================================================
// Navigation Types
// ============================================================================

export type DashboardSection = 'behaviours' | 'hydration';
export type BehavioursTab = 'dashboard' | 'followups' | 'reports' | 'trends';
export type HydrationTab = 'dashboard' | 'analytics';

export interface NavigationState {
  activeSection: DashboardSection;
  activeBehavioursTab: BehavioursTab;
  activeHydrationTab: HydrationTab;
}

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  section: DashboardSection;
  subItems?: SidebarSubNavItem[];
}

export interface SidebarSubNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  tab: BehavioursTab | HydrationTab;
}

