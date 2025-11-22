import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
  mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: false, // We'll track pageviews manually with more context
    persistence: 'localStorage',
    ignore_dnt: false,
  });
}

// User identification and properties
export const identifyUser = (userId: string, userProperties?: {
  username?: string;
  email?: string;
  role?: string;
  homeId?: string;
  chainId?: string;
  loginCount?: number;
  createdAt?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.identify(userId);
  
  if (userProperties) {
    mixpanel.people.set({
      $email: userProperties.email,
      $name: userProperties.username,
      role: userProperties.role,
      homeId: userProperties.homeId,
      chainId: userProperties.chainId,
      loginCount: userProperties.loginCount,
      createdAt: userProperties.createdAt,
      lastSeen: new Date().toISOString(),
    });
  }
};

// Reset user on logout
export const resetUser = () => {
  if (typeof window === 'undefined') return;
  mixpanel.reset();
};

// Track page views with detailed context
export const trackPageView = (pageName: string, properties?: {
  homeId?: string;
  chainId?: string;
  role?: string;
  path?: string;
  referrer?: string;
  timestamp?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Page Viewed', {
    page_name: pageName,
    page_path: properties?.path || window.location.pathname,
    referrer: properties?.referrer || document.referrer,
    home_id: properties?.homeId,
    chain_id: properties?.chainId,
    user_role: properties?.role,
    timestamp: properties?.timestamp || new Date().toISOString(),
    screen_width: window.innerWidth,
    screen_height: window.innerHeight,
  });
};

// Authentication Events
export const trackLogin = (properties: {
  method: 'email' | 'username';
  success: boolean;
  error?: string;
  userId?: string;
  role?: string;
  loginCount?: number;
  timeToLogin?: number; // milliseconds
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Login Attempt', {
    login_method: properties.method,
    login_success: properties.success,
    login_error: properties.error,
    user_id: properties.userId,
    user_role: properties.role,
    login_count: properties.loginCount,
    time_to_login_ms: properties.timeToLogin,
    timestamp: new Date().toISOString(),
  });
};

export const trackLogout = (properties?: {
  userId?: string;
  role?: string;
  sessionDuration?: number; // seconds
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Logout', {
    user_id: properties?.userId,
    user_role: properties?.role,
    session_duration_seconds: properties?.sessionDuration,
    timestamp: new Date().toISOString(),
  });
};

export const trackPasswordReset = (properties: {
  success: boolean;
  error?: string;
  userId?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Password Reset', {
    reset_success: properties.success,
    reset_error: properties.error,
    user_id: properties.userId,
    timestamp: new Date().toISOString(),
  });
};

// Dashboard Events
export const trackDashboardInteraction = (properties: {
  action: 'view_chart' | 'filter_data' | 'export_data' | 'change_date_range' | 'view_table' | 'view_report' | 'view_trends';
  dashboardType: 'behaviours' | 'follow_up' | 'trends' | 'reports';
  homeId?: string;
  chartType?: string;
  filterType?: string;
  dateRange?: string;
  exportFormat?: 'csv' | 'pdf' | 'excel';
  dataPoints?: number;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Dashboard Interaction', {
    interaction_action: properties.action,
    dashboard_type: properties.dashboardType,
    home_id: properties.homeId,
    chart_type: properties.chartType,
    filter_type: properties.filterType,
    date_range: properties.dateRange,
    export_format: properties.exportFormat,
    data_points: properties.dataPoints,
    timestamp: new Date().toISOString(),
  });
};

export const trackDateRangeChange = (properties: {
  homeId?: string;
  startDate: string;
  endDate: string;
  previousStartDate?: string;
  previousEndDate?: string;
  daysDifference: number;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Date Range Changed', {
    home_id: properties.homeId,
    start_date: properties.startDate,
    end_date: properties.endDate,
    previous_start_date: properties.previousStartDate,
    previous_end_date: properties.previousEndDate,
    days_difference: properties.daysDifference,
    timestamp: new Date().toISOString(),
  });
};

export const trackChartView = (properties: {
  chartType: string;
  homeId?: string;
  dataPoints: number;
  chartCategory?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Chart Viewed', {
    chart_type: properties.chartType,
    home_id: properties.homeId,
    data_points: properties.dataPoints,
    chart_category: properties.chartCategory,
    timestamp: new Date().toISOString(),
  });
};

export const trackDataExport = (properties: {
  exportType: 'csv' | 'pdf' | 'excel' | 'report';
  homeId?: string;
  dataType: 'behaviours' | 'follow_up' | 'trends' | 'all';
  recordCount?: number;
  fileSize?: number; // bytes
  timeToGenerate?: number; // milliseconds
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Data Exported', {
    export_type: properties.exportType,
    home_id: properties.homeId,
    data_type: properties.dataType,
    record_count: properties.recordCount,
    file_size_bytes: properties.fileSize,
    time_to_generate_ms: properties.timeToGenerate,
    timestamp: new Date().toISOString(),
  });
};

// File Upload & Processing Events
export const trackFileUpload = (properties: {
  homeId: string;
  fileType: 'pdf' | 'excel' | 'xls' | 'xlsx';
  fileName: string;
  fileSize: number; // bytes
  chainId?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('File Uploaded', {
    home_id: properties.homeId,
    file_type: properties.fileType,
    file_name: properties.fileName,
    file_size_bytes: properties.fileSize,
    chain_id: properties.chainId,
    timestamp: new Date().toISOString(),
  });
};

export const trackFileProcessing = (properties: {
  homeId: string;
  success: boolean;
  fileType: 'pdf' | 'excel';
  processingTime?: number; // milliseconds
  recordsExtracted?: number;
  errors?: string[];
  chainId?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('File Processed', {
    home_id: properties.homeId,
    processing_success: properties.success,
    file_type: properties.fileType,
    processing_time_ms: properties.processingTime,
    records_extracted: properties.recordsExtracted,
    processing_errors: properties.errors,
    chain_id: properties.chainId,
    timestamp: new Date().toISOString(),
  });
};

export const trackBulkFileProcessing = (properties: {
  homeId: string;
  totalFiles: number;
  successCount: number;
  failureCount: number;
  totalProcessingTime: number; // milliseconds
  totalRecordsExtracted: number;
  chainId?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Bulk Files Processed', {
    home_id: properties.homeId,
    total_files: properties.totalFiles,
    success_count: properties.successCount,
    failure_count: properties.failureCount,
    total_processing_time_ms: properties.totalProcessingTime,
    total_records_extracted: properties.totalRecordsExtracted,
    chain_id: properties.chainId,
    success_rate: properties.totalFiles > 0 
      ? (properties.successCount / properties.totalFiles) * 100 
      : 0,
    timestamp: new Date().toISOString(),
  });
};

// Admin Actions
export const trackUserCreated = (properties: {
  userId: string;
  username: string;
  role: 'admin' | 'homeUser';
  homeId?: string;
  chainId?: string;
  createdBy: string; // admin userId
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('User Created', {
    new_user_id: properties.userId,
    new_username: properties.username,
    new_user_role: properties.role,
    new_user_home_id: properties.homeId,
    new_user_chain_id: properties.chainId,
    created_by: properties.createdBy,
    timestamp: new Date().toISOString(),
  });
};

export const trackUserUpdated = (properties: {
  userId: string;
  updatedFields: string[];
  updatedBy: string;
  changes?: Record<string, { from: any; to: any }>;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('User Updated', {
    user_id: properties.userId,
    updated_fields: properties.updatedFields,
    updated_by: properties.updatedBy,
    changes: properties.changes,
    timestamp: new Date().toISOString(),
  });
};

export const trackUserDeleted = (properties: {
  userId: string;
  username?: string;
  role?: string;
  deletedBy: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('User Deleted', {
    deleted_user_id: properties.userId,
    deleted_username: properties.username,
    deleted_user_role: properties.role,
    deleted_by: properties.deletedBy,
    timestamp: new Date().toISOString(),
  });
};

export const trackHomeCreated = (properties: {
  homeId: string;
  homeName: string;
  chainId?: string;
  createdBy: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Home Created', {
    home_id: properties.homeId,
    home_name: properties.homeName,
    chain_id: properties.chainId,
    created_by: properties.createdBy,
    timestamp: new Date().toISOString(),
  });
};

export const trackHomeDeleted = (properties: {
  homeId: string;
  homeName: string;
  deletedBy: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Home Deleted', {
    deleted_home_id: properties.homeId,
    deleted_home_name: properties.homeName,
    deleted_by: properties.deletedBy,
    timestamp: new Date().toISOString(),
  });
};

export const trackChainCreated = (properties: {
  chainId: string;
  chainName: string;
  extractionType: string;
  createdBy: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Chain Created', {
    chain_id: properties.chainId,
    chain_name: properties.chainName,
    extraction_type: properties.extractionType,
    created_by: properties.createdBy,
    timestamp: new Date().toISOString(),
  });
};

// AI & Trends Events
export const trackAIInsightGenerated = (properties: {
  homeId?: string;
  insightType: 'trend' | 'pattern' | 'recommendation' | 'summary';
  generationTime?: number; // milliseconds
  promptTokens?: number;
  completionTokens?: number;
  success: boolean;
  error?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('AI Insight Generated', {
    home_id: properties.homeId,
    insight_type: properties.insightType,
    generation_time_ms: properties.generationTime,
    prompt_tokens: properties.promptTokens,
    completion_tokens: properties.completionTokens,
    success: properties.success,
    error: properties.error,
    timestamp: new Date().toISOString(),
  });
};

export const trackTrendsViewed = (properties: {
  homeId?: string;
  trendType: string;
  dateRange: string;
  dataPoints: number;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Trends Viewed', {
    home_id: properties.homeId,
    trend_type: properties.trendType,
    date_range: properties.dateRange,
    data_points: properties.dataPoints,
    timestamp: new Date().toISOString(),
  });
};

// Table & Data Interactions
export const trackTableInteraction = (properties: {
  tableType: 'behaviours' | 'follow_up' | 'users' | 'homes' | 'chains';
  action: 'sort' | 'filter' | 'search' | 'paginate' | 'row_click' | 'edit' | 'delete';
  columnName?: string;
  sortDirection?: 'asc' | 'desc';
  searchTerm?: string;
  pageNumber?: number;
  rowId?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Table Interaction', {
    table_type: properties.tableType,
    interaction_action: properties.action,
    column_name: properties.columnName,
    sort_direction: properties.sortDirection,
    search_term: properties.searchTerm,
    page_number: properties.pageNumber,
    row_id: properties.rowId,
    timestamp: new Date().toISOString(),
  });
};

// Error Tracking
export const trackError = (properties: {
  errorType: 'api_error' | 'processing_error' | 'auth_error' | 'validation_error' | 'unknown';
  errorMessage: string;
  errorStack?: string;
  page?: string;
  userId?: string;
  homeId?: string;
  context?: Record<string, any>;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Error Occurred', {
    error_type: properties.errorType,
    error_message: properties.errorMessage,
    error_stack: properties.errorStack,
    page: properties.page || window.location.pathname,
    user_id: properties.userId,
    home_id: properties.homeId,
    context: properties.context,
    timestamp: new Date().toISOString(),
  });
};

// Feature Usage
export const trackFeatureUsage = (properties: {
  featureName: string;
  action: 'opened' | 'closed' | 'used' | 'configured';
  homeId?: string;
  metadata?: Record<string, any>;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Feature Used', {
    feature_name: properties.featureName,
    feature_action: properties.action,
    home_id: properties.homeId,
    ...properties.metadata,
    timestamp: new Date().toISOString(),
  });
};

// Time Tracking
export const trackTimeOnPage = (properties: {
  pageName: string;
  timeSpent: number; // seconds
  homeId?: string;
  interactions?: number;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Time on Page', {
    page_name: properties.pageName,
    time_spent_seconds: properties.timeSpent,
    home_id: properties.homeId,
    interactions_count: properties.interactions,
    timestamp: new Date().toISOString(),
  });
};

// Navigation Tracking
export const trackNavigation = (properties: {
  fromPage: string;
  toPage: string;
  navigationMethod: 'click' | 'back' | 'forward' | 'direct' | 'redirect';
  homeId?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Navigation', {
    from_page: properties.fromPage,
    to_page: properties.toPage,
    navigation_method: properties.navigationMethod,
    home_id: properties.homeId,
    timestamp: new Date().toISOString(),
  });
};

// Form Interactions
export const trackFormInteraction = (properties: {
  formName: string;
  action: 'started' | 'field_focused' | 'field_blurred' | 'validated' | 'submitted' | 'cancelled';
  fieldName?: string;
  fieldValue?: string;
  validationErrors?: string[];
  timeToComplete?: number; // milliseconds
  homeId?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Form Interaction', {
    form_name: properties.formName,
    form_action: properties.action,
    field_name: properties.fieldName,
    field_value: properties.fieldValue ? properties.fieldValue.substring(0, 100) : undefined, // Limit length
    validation_errors: properties.validationErrors,
    time_to_complete_ms: properties.timeToComplete,
    home_id: properties.homeId,
    timestamp: new Date().toISOString(),
  });
};

// Page Visit Tracking (with count)
export const trackPageVisit = (properties: {
  pageName: string;
  visitCount: number; // Total number of times user has visited this page
  homeId?: string;
  timeSinceLastVisit?: number; // seconds since last visit
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Page Visited', {
    page_name: properties.pageName,
    visit_count: properties.visitCount,
    home_id: properties.homeId,
    time_since_last_visit_seconds: properties.timeSinceLastVisit,
    timestamp: new Date().toISOString(),
  });
  
  // Also increment user property for page visit count
  mixpanel.people.increment(`page_visits_${properties.pageName.replace(/\s+/g, '_').toLowerCase()}`);
};

// Export Button Click Tracking
export const trackExportButtonClick = (properties: {
  exportType: 'csv' | 'pdf' | 'excel';
  pageName: string;
  section?: string; // 'overview', 'reports', 'follow_up', etc.
  homeId?: string;
  dataType?: 'behaviours' | 'follow_up' | 'reports' | 'all';
  recordCount?: number;
  clickCount?: number; // Total number of times user has clicked export
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Export Button Clicked', {
    export_type: properties.exportType,
    page_name: properties.pageName,
    section: properties.section,
    home_id: properties.homeId,
    data_type: properties.dataType,
    record_count: properties.recordCount,
    click_count: properties.clickCount,
    timestamp: new Date().toISOString(),
  });
  
  // Increment user property for export clicks
  mixpanel.people.increment('total_export_clicks');
  mixpanel.people.increment(`export_clicks_${properties.exportType}`);
};

// Click Tracking on Reports Page
export const trackReportsPageClick = (properties: {
  elementType: 'tab' | 'filter' | 'chart' | 'button' | 'table' | 'selector' | 'other';
  elementName: string; // Specific name/ID of the element
  elementId?: string;
  homeId?: string;
  clickCount?: number; // Total clicks on this specific element
  metadata?: Record<string, any>; // Additional context
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Reports Page Clicked', {
    element_type: properties.elementType,
    element_name: properties.elementName,
    element_id: properties.elementId,
    home_id: properties.homeId,
    click_count: properties.clickCount,
    ...properties.metadata,
    timestamp: new Date().toISOString(),
  });
  
  // Increment user property for this specific element
  const elementKey = `${properties.elementType}_${properties.elementName.replace(/\s+/g, '_').toLowerCase()}`;
  mixpanel.people.increment(`reports_clicks_${elementKey}`);
};

// Chart Hover/Interaction Tracking
export const trackChartInteraction = (properties: {
  chartType: string;
  chartName: string;
  interactionType: 'hover' | 'click' | 'zoom' | 'filter';
  dataPoint?: string; // What data point they're hovering over
  homeId?: string;
  interactionCount?: number; // Total interactions with this chart
  hoverDuration?: number; // milliseconds spent hovering
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Chart Interacted', {
    chart_type: properties.chartType,
    chart_name: properties.chartName,
    interaction_type: properties.interactionType,
    data_point: properties.dataPoint,
    home_id: properties.homeId,
    interaction_count: properties.interactionCount,
    hover_duration_ms: properties.hoverDuration,
    timestamp: new Date().toISOString(),
  });
  
  // Increment user property for chart interactions
  mixpanel.people.increment('total_chart_interactions');
  const chartKey = `${properties.chartType}_${properties.chartName.replace(/\s+/g, '_').toLowerCase()}`;
  mixpanel.people.increment(`chart_interactions_${chartKey}`);
};

// Table Edit Tracking
export const trackTableEdit = (properties: {
  tableType: 'behaviours' | 'follow_up' | 'reports';
  fieldName: string; // Name of the field being edited
  fieldType: string; // Type of field (text, dropdown, date, etc.)
  rowId?: string;
  oldValue?: any;
  newValue?: any;
  homeId?: string;
  editCount?: number; // Total edits to this field
  residentName?: string;
}) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track('Table Field Edited', {
    table_type: properties.tableType,
    field_name: properties.fieldName,
    field_type: properties.fieldType,
    row_id: properties.rowId,
    old_value: properties.oldValue ? String(properties.oldValue).substring(0, 100) : undefined,
    new_value: properties.newValue ? String(properties.newValue).substring(0, 100) : undefined,
    home_id: properties.homeId,
    edit_count: properties.editCount,
    resident_name: properties.residentName,
    timestamp: new Date().toISOString(),
  });
  
  // Increment user property for table edits
  mixpanel.people.increment('total_table_edits');
  mixpanel.people.increment(`table_edits_${properties.tableType}`);
  mixpanel.people.increment(`field_edits_${properties.fieldName.replace(/\s+/g, '_').toLowerCase()}`);
};

// Custom event tracking
export const track = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  
  mixpanel.track(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
};

// Set super properties (sent with every event)
export const setSuperProperties = (properties: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  mixpanel.register(properties);
};

// Increment user properties
export const incrementUserProperty = (property: string, value: number = 1) => {
  if (typeof window === 'undefined') return;
  mixpanel.people.increment(property, value);
};

export default mixpanel;

