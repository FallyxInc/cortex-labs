/**
 * Dashboard Types and Interfaces
 * Centralized type definitions for the behaviours dashboard components
 */

// ============================================================================
// Core Data Types
// ============================================================================

export interface BehaviourIncident {
  id: string;
  incident_number?: string;
  name: string;
  date: string;
  time?: string;
  incident_location?: string;
  location?: string;
  incident_type?: string;
  behaviour_type?: string;
  who_affected?: string;
  affected?: string;
  prn?: string;
  code_white?: string;
  summary?: string;
  triggers?: string;
  interventions?: string;
  injuries?: string;
  CI?: string;
  other_notes?: string;
  room?: string;
  homeUnit?: string;
  behaviour_subtype?: string;
  behaviourCategory?: string;
  outcome?: string;
  antipsychotic?: string;
  prescription?: string;
  behavior_change?: string;
  isInterventionsUpdated?: string;
  isPostFallNotesUpdated?: string;
  postFallNotes?: number;
  postFallNotesColor?: string;
  poaContacted?: string;
  cause?: string;
  yearMonth?: string;
}

export interface FollowUpRecord {
  id: string;
  resident_name: string;
  Name?: string;
  date: string;
  summary_of_behaviour: string;
  other_notes?: string;
  yearMonth?: string;
}

export interface OverviewMetrics {
  antipsychotics: {
    percentage: number;
    change: number;
    residents: string[];
  };
  worsened: {
    percentage: number;
    change: number;
    residents: string[];
  };
  improved: {
    percentage: number;
    change: number;
    residents: string[];
  };
}

// ============================================================================
// Dashboard Props
// ============================================================================

export interface DashboardProps {
  name: string;
  firebaseId: string;
  title: string;
  goal: number;
}

export interface DashboardPageProps {
  name: string;
  firebaseId: string;
  data: BehaviourIncident[];
  followUpData: FollowUpRecord[];
  isLoading: boolean;
  followUpLoading: boolean;
  startDate: string;
  endDate: string;
  threeMonthData: Map<string, BehaviourIncident[]>;
  overviewMetrics: OverviewMetrics;
}

// ============================================================================
// Navigation Types
// ============================================================================

export type DashboardSection = 'overview' | 'reports' | 'trends';
export type OverviewTab = 'behaviours' | 'followups';

export interface NavigationState {
  activeSection: DashboardSection;
  activeOverviewTab: OverviewTab;
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
  tab: OverviewTab;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface BehavioursFilters {
  resident: string;
  behaviorType: string;
  timeOfDay: string;
}

export interface FollowUpFilters {
  resident: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

// ============================================================================
// Chart Types
// ============================================================================

export type AnalysisType =
  | 'timeOfDay'
  | 'injuries'
  | 'behaviourType'
  | 'residents'
  | 'unit'
  | 'hour'
  | 'dayOfWeek';

export type FollowUpAnalysisType = 'residents' | 'monthly' | 'weekly';

export interface ChartData {
  labels: string[];
  datasets: {
    label?: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

// ============================================================================
// Table Types
// ============================================================================

export interface TrackingTableProps {
  filteredData: BehaviourIncident[];
  cleanDuplicateText: (text: string | undefined, field: string) => string;
  storageKey?: string;
}

export interface FollowUpTableProps {
  filteredData: FollowUpRecord[];
  followUpLoading: boolean;
}

// ============================================================================
// Component Props
// ============================================================================

export interface AnalysisChartProps {
  data: BehaviourIncident[];
  desiredYear: number;
  desiredMonth: string;
  threeMonthData: Map<string, BehaviourIncident[]>;
  getTimeOfDay: (time?: string) => string;
}

export interface FollowUpChartProps {
  data: FollowUpRecord[];
  desiredYear: number;
  desiredMonth: string;
}

export interface BehavioursReportsProps {
  name: string;
  altName: string;
  data: BehaviourIncident[];
  getTimeOfDay: (time?: string) => string;
  startDate: string;
  endDate: string;
}

export interface TrendsAndAnalysisProps {
  name: string;
  altName: string;
  data: BehaviourIncident[];
  getTimeOfDay: (time?: string) => string;
  startDate: string;
  endDate: string;
}

export interface DashboardSidebarProps {
  activeSection: DashboardSection;
  activeOverviewTab: OverviewTab;
  onSectionChange: (section: DashboardSection) => void;
  onOverviewTabChange: (tab: OverviewTab) => void;
  onLogout: () => void;
  homeId: string;
}

export interface DashboardHeaderProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  userEmail: string;
  title: string;
}

// ============================================================================
// Report Types
// ============================================================================

export interface ReportSummary {
  totalEvents: number;
  residentsAffected: number;
  unitsInvolved: number;
}

export interface ReportTableRow {
  label: string;
  count: number;
  percentage: string;
}

export interface ReportData {
  summary: ReportSummary;
  chart: {
    labels: string[];
    values: number[];
  };
  table: ReportTableRow[];
}

export type ReportType =
  | 'timeOfDay'
  | 'behaviourType'
  | 'behaviourBreakdown'
  | 'resident'
  | 'unit'
  | 'hour'
  | 'dayOfWeek';

// ============================================================================
// Trends & Analysis Types
// ============================================================================

export type ViewMode = 'holistic' | 'personalized';

export interface TrendSummary {
  totalIncidents: number;
  residentsAffected: number;
  avgPerDay: number;
  daysWithData: number;
  mostCommonType: string;
  mostCommonTypeCount: number;
  peakTime: string;
  peakTimeCount: number;
}

export interface TrendInsight {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface PersonalizedPattern {
  title: string;
  description: string;
  details?: string;
}

export interface AIRecommendation {
  title: string;
  description: string;
  rationale: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface AICarePlanSuggestion {
  category: string;
  suggestion: string;
  rationale: string;
}

export interface AIRiskFactor {
  factor: string;
  severity: 'High' | 'Medium' | 'Low';
  recommendation: string;
}

export interface AIInsights {
  clinicalAssessment?: string;
  recommendations?: AIRecommendation[];
  carePlanSuggestions?: AICarePlanSuggestion[];
  riskFactors?: AIRiskFactor[];
  interventionEffectiveness?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface MonthMapping {
  [key: string]: string;
}

export const MONTHS_FORWARD: MonthMapping = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

export const MONTHS_BACKWARD: MonthMapping = {
  January: '01',
  February: '02',
  March: '03',
  April: '04',
  May: '05',
  June: '06',
  July: '07',
  August: '08',
  September: '09',
  October: '10',
  November: '11',
  December: '12',
};

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseBehavioursDataReturn {
  data: BehaviourIncident[];
  followUpData: FollowUpRecord[];
  isLoading: boolean;
  followUpLoading: boolean;
  threeMonthData: Map<string, BehaviourIncident[]>;
  overviewMetrics: OverviewMetrics;
  availableYearMonth: Record<string, string[]>;
}

export interface UseDateRangeReturn {
  startDate: string;
  endDate: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  desiredMonth: string;
  desiredYear: number;
  setDesiredMonth: (month: string) => void;
  setDesiredYear: (year: number) => void;
}
