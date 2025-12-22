// Main dashboard components
export { default as UserDashboard } from "./UserDashboard";

// Backwards compatibility - Dashboard is now UserDashboard
export { default as Dashboard } from "./UserDashboard";

// Dashboard sub-components
export { default as DashboardSidebar } from "./DashboardSidebar";
export { default as DashboardHeader } from "./DashboardHeader";

// Layout components
export { DashboardLayout, Sidebar, TopBar } from "./layout";
export type { SidebarNavItem } from "./layout";
