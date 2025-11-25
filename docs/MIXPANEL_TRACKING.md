# Mixpanel Tracking Implementation

This document outlines the comprehensive Mixpanel tracking implementation for the Fallyx Behaviours Dashboard.

## Overview

Mixpanel has been integrated throughout the application to provide detailed insights into user behavior, feature usage, and system performance. This enables data-driven decision making and identification of areas for improvement.

## Setup

### Environment Variable

The Mixpanel token is configured via environment variable:
```
NEXT_PUBLIC_MIXPANEL_TOKEN=your_token_here
```

### Initialization

Mixpanel is initialized in `src/lib/mixpanel.ts` and automatically tracks:
- User identification on login
- Page views with detailed context
- User properties (role, homeId, chainId, etc.)

## Tracked Events

### Authentication Events

#### Login Attempt
- **Event**: `Login Attempt`
- **Properties**:
  - `login_method`: 'email' | 'username'
  - `login_success`: boolean
  - `login_error`: string (if failed)
  - `user_id`: string
  - `user_role`: string
  - `login_count`: number
  - `time_to_login_ms`: number

#### Logout
- **Event**: `Logout`
- **Properties**:
  - `user_id`: string
  - `user_role`: string
  - `session_duration_seconds`: number

#### Password Reset
- **Event**: `Password Reset`
- **Properties**:
  - `reset_success`: boolean
  - `reset_error`: string (if failed)
  - `user_id`: string

### Page Views

#### Page Viewed
- **Event**: `Page Viewed`
- **Properties**:
  - `page_name`: string
  - `page_path`: string
  - `referrer`: string
  - `home_id`: string (if applicable)
  - `chain_id`: string (if applicable)
  - `user_role`: string
  - `screen_width`: number
  - `screen_height`: number

#### Time on Page
- **Event**: `Time on Page`
- **Properties**:
  - `page_name`: string
  - `time_spent_seconds`: number
  - `home_id`: string (if applicable)
  - `interactions_count`: number

### Dashboard Interactions

#### Dashboard Interaction
- **Event**: `Dashboard Interaction`
- **Properties**:
  - `interaction_action`: 'view_chart' | 'filter_data' | 'export_data' | 'change_date_range' | 'view_table' | 'view_report' | 'view_trends'
  - `dashboard_type`: 'behaviours' | 'follow_up' | 'trends' | 'reports'
  - `home_id`: string
  - `chart_type`: string (if applicable)
  - `filter_type`: string (if applicable)
  - `date_range`: string (if applicable)
  - `export_format`: 'csv' | 'pdf' | 'excel' (if applicable)
  - `data_points`: number (if applicable)

#### Date Range Changed
- **Event**: `Date Range Changed`
- **Properties**:
  - `home_id`: string
  - `start_date`: string
  - `end_date`: string
  - `previous_start_date`: string
  - `previous_end_date`: string
  - `days_difference`: number

#### Chart Viewed
- **Event**: `Chart Viewed`
- **Properties**:
  - `chart_type`: string
  - `home_id`: string
  - `data_points`: number
  - `chart_category`: string

#### Data Exported
- **Event**: `Data Exported`
- **Properties**:
  - `export_type`: 'csv' | 'pdf' | 'excel' | 'report'
  - `home_id`: string
  - `data_type`: 'behaviours' | 'follow_up' | 'trends' | 'all'
  - `record_count`: number
  - `file_size_bytes`: number
  - `time_to_generate_ms`: number

### File Upload & Processing

#### File Uploaded
- **Event**: `File Uploaded`
- **Properties**:
  - `home_id`: string
  - `file_type`: 'pdf' | 'excel' | 'xls' | 'xlsx'
  - `file_name`: string
  - `file_size_bytes`: number
  - `chain_id`: string (if applicable)

#### File Processed
- **Event**: `File Processed`
- **Properties**:
  - `home_id`: string
  - `processing_success`: boolean
  - `file_type`: 'pdf' | 'excel'
  - `processing_time_ms`: number
  - `records_extracted`: number
  - `processing_errors`: string[]
  - `chain_id`: string (if applicable)

#### Bulk Files Processed
- **Event**: `Bulk Files Processed`
- **Properties**:
  - `home_id`: string
  - `total_files`: number
  - `success_count`: number
  - `failure_count`: number
  - `total_processing_time_ms`: number
  - `total_records_extracted`: number
  - `chain_id`: string (if applicable)
  - `success_rate`: number (percentage)

### Admin Actions

#### User Created
- **Event**: `User Created`
- **Properties**:
  - `new_user_id`: string
  - `new_username`: string
  - `new_user_role`: 'admin' | 'homeUser'
  - `new_user_home_id`: string (if applicable)
  - `new_user_chain_id`: string (if applicable)
  - `created_by`: string (admin userId)

#### User Updated
- **Event**: `User Updated`
- **Properties**:
  - `user_id`: string
  - `updated_fields`: string[]
  - `updated_by`: string
  - `changes`: object (field changes)

#### User Deleted
- **Event**: `User Deleted`
- **Properties**:
  - `deleted_user_id`: string
  - `deleted_username`: string
  - `deleted_user_role`: string
  - `deleted_by`: string

#### Home Created
- **Event**: `Home Created`
- **Properties**:
  - `home_id`: string
  - `home_name`: string
  - `chain_id`: string (if applicable)
  - `created_by`: string

#### Home Deleted
- **Event**: `Home Deleted`
- **Properties**:
  - `deleted_home_id`: string
  - `deleted_home_name`: string
  - `deleted_by`: string

#### Chain Created
- **Event**: `Chain Created`
- **Properties**:
  - `chain_id`: string
  - `chain_name`: string
  - `extraction_type`: string
  - `created_by`: string

### AI & Trends

#### AI Insight Generated
- **Event**: `AI Insight Generated`
- **Properties**:
  - `home_id`: string (if applicable)
  - `insight_type`: 'trend' | 'pattern' | 'recommendation' | 'summary'
  - `generation_time_ms`: number
  - `prompt_tokens`: number
  - `completion_tokens`: number
  - `success`: boolean
  - `error`: string (if failed)

#### Trends Viewed
- **Event**: `Trends Viewed`
- **Properties**:
  - `home_id`: string (if applicable)
  - `trend_type`: string
  - `date_range`: string
  - `data_points`: number

### Table Interactions

#### Table Interaction
- **Event**: `Table Interaction`
- **Properties**:
  - `table_type`: 'behaviours' | 'follow_up' | 'users' | 'homes' | 'chains'
  - `interaction_action`: 'sort' | 'filter' | 'search' | 'paginate' | 'row_click' | 'edit' | 'delete'
  - `column_name`: string (if applicable)
  - `sort_direction`: 'asc' | 'desc' (if applicable)
  - `search_term`: string (if applicable)
  - `page_number`: number (if applicable)
  - `row_id`: string (if applicable)

### Form Interactions

#### Form Interaction
- **Event**: `Form Interaction`
- **Properties**:
  - `form_name`: string
  - `form_action`: 'started' | 'field_focused' | 'field_blurred' | 'validated' | 'submitted' | 'cancelled'
  - `field_name`: string (if applicable)
  - `field_value`: string (truncated to 100 chars, if applicable)
  - `validation_errors`: string[] (if applicable)
  - `time_to_complete_ms`: number (if applicable)
  - `home_id`: string (if applicable)

### Error Tracking

#### Error Occurred
- **Event**: `Error Occurred`
- **Properties**:
  - `error_type`: 'api_error' | 'processing_error' | 'auth_error' | 'validation_error' | 'unknown'
  - `error_message`: string
  - `error_stack`: string (if available)
  - `page`: string
  - `user_id`: string (if available)
  - `home_id`: string (if applicable)
  - `context`: object (additional context)

### Feature Usage

#### Feature Used
- **Event**: `Feature Used`
- **Properties**:
  - `feature_name`: string
  - `feature_action`: 'opened' | 'closed' | 'used' | 'configured'
  - `home_id`: string (if applicable)
  - Additional metadata as needed

### Navigation

#### Navigation
- **Event**: `Navigation`
- **Properties**:
  - `from_page`: string
  - `to_page`: string
  - `navigation_method`: 'click' | 'back' | 'forward' | 'direct' | 'redirect'
  - `home_id`: string (if applicable)

## User Properties

The following user properties are automatically set when a user logs in:

- `$email`: User's email address
- `$name`: User's username
- `role`: User's role (admin, homeUser)
- `homeId`: Associated home ID (if applicable)
- `chainId`: Associated chain ID (if applicable)
- `loginCount`: Number of times user has logged in
- `createdAt`: Account creation timestamp
- `lastSeen`: Last activity timestamp

## Implementation Details

### Core Files

1. **`src/lib/mixpanel.ts`**: Core Mixpanel utility with all tracking functions
2. **`src/components/MixpanelProvider.tsx`**: React provider that initializes Mixpanel and tracks page views
3. **`src/hooks/useTimeTracking.ts`**: Hook for tracking time spent on pages

### Integration Points

- **Layout**: `src/app/layout.tsx` - Wraps app with MixpanelProvider
- **Login**: `src/app/login/page.tsx` - Tracks login attempts and form interactions
- **File Upload**: `src/components/admin/FileUpload.tsx` - Tracks file uploads and processing

### Usage Examples

```typescript
import { trackDashboardInteraction, trackDataExport } from '@/lib/mixpanel';

// Track dashboard interaction
trackDashboardInteraction({
  action: 'view_chart',
  dashboardType: 'behaviours',
  homeId: 'home123',
  chartType: 'time_of_day',
  dataPoints: 150,
});

// Track data export
trackDataExport({
  exportType: 'pdf',
  homeId: 'home123',
  dataType: 'behaviours',
  recordCount: 150,
  fileSize: 1024000,
  timeToGenerate: 2500,
});
```

## Analytics Insights

With this implementation, you can analyze:

1. **User Engagement**:
   - Login frequency and patterns
   - Time spent on different pages
   - Feature adoption rates

2. **Workflow Efficiency**:
   - File processing times
   - Form completion rates
   - Error rates and types

3. **Feature Usage**:
   - Most used dashboard features
   - Export preferences
   - Chart viewing patterns

4. **User Behavior**:
   - Navigation patterns
   - Date range selection habits
   - Table interaction patterns

5. **System Performance**:
   - Processing times
   - Error rates
   - Success/failure rates

## Best Practices

1. **Privacy**: User data is tracked but sensitive information (like passwords) is never logged
2. **Performance**: Tracking is non-blocking and won't impact user experience
3. **Error Handling**: All tracking functions check for window availability (SSR safety)
4. **Context**: Every event includes relevant context (homeId, role, etc.) for better segmentation

## Future Enhancements

Potential additions:
- A/B testing integration
- Funnel analysis for key workflows
- Cohort analysis
- Custom dashboards in Mixpanel
- Real-time alerts for critical errors

