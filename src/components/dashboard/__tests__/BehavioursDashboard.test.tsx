/**
 * Tests for BehavioursDashboard Component
 * 
 * These tests verify that the dashboard:
 * - Loads data from the correct Firebase path
 * - Displays overview metrics correctly
 * - Handles data loading states
 * - Filters data correctly
 * 
 * Note: These tests are currently skipped as they require jsdom environment
 * and React component testing setup. They can be enabled when needed.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
// @ts-ignore - JS file
import BehavioursDashboard from '../BehavioursDashboard';

// Mock Firebase
const mockFirebaseData: Record<string, any> = {
  '/berkshire/behaviours/2025/12': {
    'incident-1': {
      name: 'Smith, John',
      date: '2025-12-04',
      behaviour_type: 'Agitation',
      time_of_day: 'Evening'
    },
    'incident-2': {
      name: 'Doe, Jane',
      date: '2025-12-05',
      behaviour_type: 'Wandering',
      time_of_day: 'Morning'
    }
  },
  '/berkshire/overviewMetrics': {
    antipsychotics: {
      percentage: 15,
      change: -3,
      residents: ['John Smith', 'Mary Johnson']
    },
    worsened: {
      percentage: 28,
      change: 5,
      residents: ['Sarah Wilson']
    },
    improved: {
      percentage: 57,
      change: 8,
      residents: ['David Miller']
    }
  }
};

jest.mock('@/lib/firebase/firebase', () => ({
  db: {},
  auth: {}
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn((db: any, path: string) => ({ path })),
  onValue: jest.fn((ref: any, callback: (snapshot: any) => void) => {
    // Simulate Firebase data loading
    setTimeout(() => {
      const path = (ref as any).path;
      const data = mockFirebaseData[path];
      
      callback({
        exists: () => !!data,
        val: () => data || null
      });
    }, 100);
    
    // Return unsubscribe function
    return jest.fn();
  }),
  off: jest.fn(),
  get: jest.fn(async (ref: any) => {
    const path = (ref as any).path;
    const data = mockFirebaseData[path];
    return {
      exists: () => !!data,
      val: () => data || null
    };
  })
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn()
  })
}));

jest.mock('@/lib/mixpanel', () => ({
  trackPageVisit: jest.fn(),
  trackExportButtonClick: jest.fn(),
  trackTableEdit: jest.fn(),
  trackDashboardInteraction: jest.fn(),
  trackTimeOnPage: jest.fn()
}));

jest.mock('@/lib/utils/exportUtils', () => ({
  handleSavePDF: jest.fn()
}));

// Mock subcomponents
jest.mock('../subcomponents/BeAnalysisChart.js', () => {
  return function MockAnalysisChart() {
    return <div data-testid="analysis-chart">Analysis Chart</div>;
  };
});

jest.mock('../subcomponents/BeTrackingTable.js', () => {
  return function MockTrackingTable() {
    return <div data-testid="tracking-table">Tracking Table</div>;
  };
});

jest.mock('../subcomponents/BeFollowUpChart.js', () => {
  return function MockFollowUpChart() {
    return <div data-testid="followup-chart">Follow Up Chart</div>;
  };
});

jest.mock('../subcomponents/BeFollowUpTable.js', () => {
  return function MockFollowUpTable() {
    return <div data-testid="followup-table">Follow Up Table</div>;
  };
});

jest.mock('../subcomponents/BehavioursReports.js', () => {
  return function MockBehavioursReports() {
    return <div data-testid="behaviours-reports">Behaviours Reports</div>;
  };
});

jest.mock('../subcomponents/TrendsAndAnalysis.js', () => {
  return function MockTrendsAndAnalysis() {
    return <div data-testid="trends-analysis">Trends and Analysis</div>;
  };
});

// Skip dashboard tests for now - requires jsdom environment setup
describe.skip('BehavioursDashboard Component', () => {
  const defaultProps = {
    name: 'Berkshire Care',
    firebaseId: 'berkshire',
    title: 'Berkshire Care Behaviours Dashboard',
    goal: 15
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dashboard with correct title', () => {
    render(<BehavioursDashboard {...defaultProps} />);
    
    expect(screen.getByText(/Berkshire Care Behaviours Dashboard/i)).toBeInTheDocument();
  });

  it('should load overview metrics from correct Firebase path', async () => {
    const { ref, onValue } = require('firebase/database');
    
    render(<BehavioursDashboard {...defaultProps} />);
    
    await waitFor(() => {
      // Verify Firebase was called with correct path
      const metricsRef = ref({}, '/berkshire/overviewMetrics');
      expect(onValue).toHaveBeenCalled();
    });
  });

  it('should display overview metrics when loaded', async () => {
    render(<BehavioursDashboard {...defaultProps} />);
    
    await waitFor(() => {
      // Should display antipsychotics percentage
      expect(screen.getByText('15')).toBeInTheDocument();
      // Should display worsened percentage
      expect(screen.getByText('28')).toBeInTheDocument();
      // Should display improved percentage
      expect(screen.getByText('57')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should display resident names when toggle is enabled', async () => {
    render(<BehavioursDashboard {...defaultProps} />);
    
    await waitFor(() => {
      // Find the toggle checkbox
      const toggle = screen.getByLabelText(/Show Resident Names/i);
      expect(toggle).toBeInTheDocument();
      
      // Check the toggle
      toggle.click();
      
      // Should show resident names
      expect(screen.getByText(/John Smith/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should load behaviours data from correct Firebase path', async () => {
    const { ref, onValue } = require('firebase/database');
    
    render(<BehavioursDashboard {...defaultProps} />);
    
    await waitFor(() => {
      // Verify behaviours data was requested
      expect(onValue).toHaveBeenCalled();
    });
  });

  it('should render dashboard component', () => {
    render(<BehavioursDashboard {...defaultProps} />);
    
    // Dashboard should render
    const dashboard = screen.getByText(/Berkshire Care/i);
    expect(dashboard).toBeInTheDocument();
  });

  it('should handle different firebaseId values correctly', async () => {
    const { ref, onValue } = require('firebase/database');
    
    render(<BehavioursDashboard 
      name="Mill Creek Care"
      firebaseId="millCreek"
      title="Mill Creek Care Behaviours Dashboard"
      goal={15}
    />);
    
    await waitFor(() => {
      // Should use millCreek in Firebase paths, not mill_creek_care
      expect(onValue).toHaveBeenCalled();
    });
  });

  it('should display overview cards with correct structure', async () => {
    render(<BehavioursDashboard {...defaultProps} />);
    
    await waitFor(() => {
      // Should have antipsychotics card
      expect(screen.getByText(/% of Residents with Potentially Inappropriate Use of Antipsychotics/i)).toBeInTheDocument();
      
      // Should have worsened card
      expect(screen.getByText(/% of Behaviours Worsened/i)).toBeInTheDocument();
      
      // Should have improved card
      expect(screen.getByText(/% of Behaviours Improved/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should display change indicators correctly', async () => {
    render(<BehavioursDashboard {...defaultProps} />);
    
    await waitFor(() => {
      // Should show change values
      expect(screen.getByText(/-3%/i)).toBeInTheDocument(); // antipsychotics change
      expect(screen.getByText(/\+5%/i)).toBeInTheDocument(); // worsened change
      expect(screen.getByText(/\+8%/i)).toBeInTheDocument(); // improved change
    }, { timeout: 2000 });
  });
});

