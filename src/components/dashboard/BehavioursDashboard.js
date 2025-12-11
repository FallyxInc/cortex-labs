'use client';

// this is legacy from the old dashboard
// everything related to the behaviour dashboard might be a bit of a mess
// TODO: rewrite in typescript and clean up the code

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/styles/Behaviours.module.css';
import * as Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { Chart, ArcElement, PointElement, LineElement } from 'chart.js';
import { ref, onValue, off, get, update, child, set, serverTimestamp } from 'firebase/database';
import { db, auth } from '@/lib/firebase/firebase';
import { 
  trackPageVisit, 
  trackExportButtonClick, 
  trackTableEdit, 
  trackDashboardInteraction,
  trackTimeOnPage
} from '@/lib/mixpanel';
import { handleSavePDF as exportToPDF } from '@/lib/utils/exportUtils';
import AnalysisChart from './subcomponents/BeAnalysisChart.js';
import BeTrackingTable from './subcomponents/BeTrackingTable.js';
import FollowUpChart from './subcomponents/BeFollowUpChart.js';
import BeFollowUpTable from './subcomponents/BeFollowUpTable.js';
import BehavioursReports from './subcomponents/BehavioursReports.js';
import TrendsAndAnalysis from './subcomponents/TrendsAndAnalysis.js';

Chart.register(ArcElement, PointElement, LineElement);

export default function BehavioursDashboard({ name, firebaseId, title, goal} ) {
  const router = useRouter();
  
  const altName = firebaseId;
  const months_forward = {
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

  const months_backword = {
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

  // Dummy follow-up data when Firebase data unavailable
  const DUMMY_FOLLOW_UP_DATA = [
    {
      id: '1',
      resident_name: 'ANDERSON, GEORGE',
      date: '2025-01-15',
      summary_of_behaviour: 'Increased agitation during evening hours, refusing medication and care',
      other_notes: 'Physician Note'
    },
    {
      id: '2',
      resident_name: 'BRYMER, WENDY',
      date: '2025-01-14',
      summary_of_behaviour: 'Wandering behavior, attempting to leave facility and enter other residents\' rooms',
      other_notes: 'Progress Note'
    },
    {
      id: '3',
      resident_name: 'CLELAND, AILEEN',
      date: '2025-01-13',
      summary_of_behaviour: 'Verbal aggression towards staff and other residents, increased paranoia',
      other_notes: 'Resident/Family Follow Up'
    },
    {
      id: '4',
      resident_name: 'COX, CICELY (001106)',
      date: '2025-01-12',
      summary_of_behaviour: 'Depression symptoms, social withdrawal, refusing meals and activities',
      other_notes: ''
    },
    {
      id: '5',
      resident_name: 'ANDERSON, GEORGE',
      date: '2025-01-11',
      summary_of_behaviour: 'Sleep disturbances, nighttime confusion, calling out for assistance',
      other_notes: ''
    }
  ];

  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [threeMonthData, setThreeMonthData] = useState(new Map());
  const [followUpData, setFollowUpData] = useState([]);
  const [activeSection, setActiveSection] = useState('overview'); // 'overview', 'reports', 'trends'
  const [activeOverviewTab, setActiveOverviewTab] = useState('behaviours'); // 'behaviours', 'followups'
  const [showFollowUpTable, setShowFollowUpTable] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showTrendsAndAnalysis, setShowTrendsAndAnalysis] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(true);
  const getCurrentMonth = () => {
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');  // Convert 1-12 to "01"-"12"
    return months_forward[month];  // Convert "01" to "January" etc.
  };
  const [desiredMonth, setDesiredMonth] = useState(getCurrentMonth());
  const [desiredYear, setDesiredYear] = useState(new Date().getFullYear());
  
  // Universal date range picker - default to current month
  const getCurrentMonthRange = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0]
    };
  };
  const [startDate, setStartDate] = useState(getCurrentMonthRange().startDate);
  const [endDate, setEndDate] = useState(getCurrentMonthRange().endDate);
  
  const [filterResident, setFilterResident] = useState("Any Resident");
const [filterBehaviorType, setFilterBehaviorType] = useState("All Types");
const [filterTimeOfDay, setFilterTimeOfDay] = useState("Anytime");
  
  // Follow-up specific filters
  const [filterFollowUpResident, setFilterFollowUpResident] = useState("Any Resident");
  // const [desiredMonth, setDesiredMonth] = useState('January');
  // const [desiredYear, setDesiredYear] = useState(2025);
  const [availableYearMonth, setAvailableYearMonth] = useState({});
  // console.log('year month');
  // console.log(desiredYear);
  // console.log(desiredMonth);
  // console.log('availableYearMonth');
  // console.log(availableYearMonth);

  // console.log('data');
  // console.log(data);
  // console.log(currentMonth);
  // console.log('threeMonthData');
  // console.log(threeMonthData);

  const [gaugeChart, setGaugeChart] = useState(true);
  const [fallsTimeRange, setFallsTimeRange] = useState('current');

  const [currentIntervention, setCurrentIntervention] = useState('');
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showResidentNames, setShowResidentNames] = useState(false);

  // Overview metrics state
  const [overviewMetrics, setOverviewMetrics] = useState({
    antipsychotics: { percentage: 15, change: -3, residents: ['John Smith', 'Mary Johnson', 'Robert Davis'] },
    worsened: { percentage: 28, change: 5, residents: ['Sarah Wilson', 'Michael Brown', 'Lisa Anderson'] },
    improved: { percentage: 57, change: 8, residents: ['David Miller', 'Jennifer Taylor', 'Thomas White'] }
  });

  const [currentPostFallNotes, setCurrentPostFallNotes] = useState('');
  const [currentPostFallNotesRowIndex, setCurrentPostFallNotesRowIndex] = useState(null);
  // Track page visits with count
  const pageVisitCountRef = useRef(0);
  const lastVisitTimeRef = useRef(null);
  const exportClickCountRef = useRef(0);
  const tableEditCountsRef = useRef({});
  const pageStartTimeRef = useRef(Date.now());

  // Track page visit on mount
  useEffect(() => {
    pageVisitCountRef.current += 1;
    const timeSinceLastVisit = lastVisitTimeRef.current 
      ? Math.floor((Date.now() - lastVisitTimeRef.current) / 1000)
      : undefined;
    
    trackPageVisit({
      pageName: `dashboard_${name}`,
      visitCount: pageVisitCountRef.current,
      homeId: altName,
      timeSinceLastVisit,
    });
    
    lastVisitTimeRef.current = Date.now();
  }, [name, altName]);

  // Track time on page periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSpent = Math.floor((Date.now() - pageStartTimeRef.current) / 1000);
      if (timeSpent > 0 && timeSpent % 30 === 0) {
        trackTimeOnPage({
          pageName: `dashboard_${name}`,
          timeSpent,
          homeId: altName,
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [name, altName]);



  const getTimeOfDay = (time) => {
    if (!time) return "Anytime";
    const hour = new Date("1970-01-01T" + time).getHours();
    if (hour >= 6 && hour < 12) return "Morning";
    if (hour >= 12 && hour < 20) return "Evening";
    return "Night";
  };

  const handleSubmitIntervention = () => {
    if (currentIntervention === data[currentRowIndex].interventions) {
      setIsModalOpen(false);
      return;
    }

    const updatedData = [...data];
    updatedData[currentRowIndex].interventions = currentIntervention;
    updatedData[currentRowIndex].isInterventionsUpdated = 'yes';

    const rowRef = ref(db, `/${altName}/${desiredYear}/${months_backword[desiredMonth]}/row-${data[currentRowIndex].id}`);
    update(rowRef, {
      interventions: currentIntervention,
      isInterventionsUpdated: 'yes',
    })
      .then(() => {
        console.log('Intervention updated successfully');
        setData(updatedData);
        setIsModalOpen(false);
      })
      .catch((error) => {
        console.error('Error updating intervention:', error);
      });
  };

  const filteredData = data.filter((item) => {
  // Date range filter
  if (startDate && endDate && item.date) {
    const itemDate = new Date(item.date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    if (itemDate < start || itemDate > end) return false;
  }

  // Resident filter
  if (filterResident !== "Any Resident" && item.name !== filterResident) return false;

  // Behavior type filter
  if (filterBehaviorType !== "All Types" && item.incident_type !== filterBehaviorType)
    return false;

  // Time of day filter
  if (filterTimeOfDay !== "Anytime") {
    const tod = getTimeOfDay(item.time);
    if (tod !== filterTimeOfDay) return false;
  }

  return true;
});

  // Filter follow-up data
  const filteredFollowUpData = followUpData.filter((item) => {
    // Date range filter
    if (startDate && endDate && item.date) {
      const itemDate = new Date(item.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (itemDate < start || itemDate > end) return false;
    }

    // Resident filter for follow-ups
    if (filterFollowUpResident !== "Any Resident" && item.resident_name !== filterFollowUpResident) return false;

    return true;
  });
  const updateFallsChart = () => {
    const timeRange = fallsTimeRange;
    const currentBehaviours = countTotalBehaviours();
    let newData;

    if (currentBehaviours >= goal) {
      newData = [goal, 0];
    } else {
      newData = [currentBehaviours, goal - currentBehaviours];
    }

    let threeMonthX = [];
    let threeMonthY = [];

    // Special handling for specific homes
    switch(name) {
      case 'vmltc':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [39, 27, 33];  // Replace with your desired values
        break;
      case 'bonairltc':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [8, 6, 7];
        break;
      case 'oneill':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [15, 12, 13];
        break;
      case 'lancaster':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [7, 11, 9];
        break;
      case 'champlain':
        threeMonthX = ['October', 'November', 'December'];
        threeMonthY = [19, 14, 11];
        break;
      default:
        // Original logic for other homes
        for (const [key, value] of threeMonthData) {
          threeMonthX.push(months_forward[key]);
          threeMonthY.push(value.length);
        }
    }
  };

  function countTotalBehaviours() {
    return data.length;
  }

  const tableRef = useRef(null);

  const handleSavePDF = async () => {
    await exportToPDF({
      tableRef,
      name,
      altName,
      showFollowUpTable,
      followUpData,
      filteredFollowUpData,
      data,
      desiredMonth,
      desiredYear,
      months_backword,
      exportClickCountRef,
      dummyFollowUpData: DUMMY_FOLLOW_UP_DATA,
    });
  };

  const handleSaveCSV = () => {
    exportClickCountRef.current += 1;
    // trackInteraction();
    
    let modifiedData;
    let filename;
    
    if (showFollowUpTable) {
      // Export follow-up data
      const dataToExport = followUpData.length > 0 ? filteredFollowUpData : DUMMY_FOLLOW_UP_DATA;
      modifiedData = dataToExport.map((item, index) => ({
        'Follow-up Number': String(index + 1),
        'Resident Name': item.resident_name || 'Unknown Resident',
        'Date': item.date || 'Unknown Date',
        'Summary of Behaviour': item.summary_of_behaviour || 'No summary available',
        'Other Notes Included': item.other_notes || 'No notes available'
      }));
      
      const monthNum = months_backword[desiredMonth];
      filename = `${name}_${desiredYear}_${monthNum}_follow_ups.csv`;
      
      // Track export click
      trackExportButtonClick({
        exportType: 'csv',
        pageName: `dashboard_${name}`,
        section: 'follow_up',
        homeId: altName,
        dataType: 'follow_up',
        recordCount: dataToExport.length,
        clickCount: exportClickCountRef.current,
      });
    } else {
      // Export behaviors data
      modifiedData = data.map(item => ({
        ...item,
        'Significant Injury Flag': 
          item.injuries?.toLowerCase().includes('head injury') || 
          item.injuries?.toLowerCase().includes('fracture') || 
          item.injuries?.toLowerCase().includes('skin tear') 
            ? 'Yes' 
            : 'No',
        'Non Compliance Flag':
          item.poaContacted?.toLowerCase() === 'no' ||
          item.cause === 'No Fall Note' ||
          (item.postFallNotes < 3)
            ? 'Yes'
            : 'No'
      }));
      
      const monthNum = months_backword[desiredMonth];
      filename = `${name}_${desiredYear}_${monthNum}_behaviours_data.csv`;
      
      // Track export click
      trackExportButtonClick({
        exportType: 'csv',
        pageName: `dashboard_${name}`,
        section: 'overview',
        homeId: altName,
        dataType: 'behaviours',
        recordCount: data.length,
        clickCount: exportClickCountRef.current,
      });
    }
    
    const csv = Papa.unparse(modifiedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    
    saveAs(blob, filename);
  };


  useEffect(() => {
    if (!startDate || !endDate) {
      setData([]);
      setFollowUpData([]);
      setIsLoading(false);
      setFollowUpLoading(false);
      return;
    }

    setIsLoading(true);
    setFollowUpLoading(true);

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Generate list of all year-month combinations between start and end dates
    const dateRanges = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    let endMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    
    while (current <= endMonth) {
      dateRanges.push({
        year: current.getFullYear(),
        month: String(current.getMonth() + 1).padStart(2, '0')
      });
      current.setMonth(current.getMonth() + 1);
    }

    console.log("Fetching behaviours data for date range:", startDate, "to", endDate);
    console.log("Date ranges to fetch:", dateRanges);

    const allBehavioursData = data;
    const allFollowUpData = followUpData;
    const listeners = [];
    
    let completedBehavioursFetches = 0;
    let completedFollowUpFetches = 0;
    const totalBehavioursFetches = dateRanges.length;
    const totalFollowUpFetches = dateRanges.length;

    dateRanges.forEach(({ year, month }) => {
      // Fetch behaviours data
      const behavioursRef = ref(db, `/${altName}/behaviours/${year}/${month}`);
      console.log("Fetching behaviours data for", `/${altName}/behaviours/${year}/${month}`);
      
      const behavioursListener = onValue(behavioursRef, (snapshot) => {
        if (snapshot.exists()) {
          const behavioursData = snapshot.val();
          const monthData = Object.values(behavioursData).map(item => ({
            ...item,
            id: item.id || '',
            yearMonth: `${year}-${month}`
          }));
          
          // Filter by actual date range
          const filteredData = monthData.filter(item => {
            if (!item.date) return false;
            const itemDate = new Date(item.date);
            return itemDate >= start && itemDate <= end;
          });
          
          allBehavioursData.push(...filteredData);
        }
        
        completedBehavioursFetches++;
        if (completedBehavioursFetches === totalBehavioursFetches) {
          // Sort by date descending
          const sortedData = allBehavioursData.sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
          setData(sortedData);
          setIsLoading(false);
        }
      });
      listeners.push({ ref: behavioursRef, listener: behavioursListener });

      // Fetch follow-up data
      const followUpRef = ref(db, `/${altName}/follow/${year}/${month}`);
      console.log("Fetching follow-up data for", `/${altName}/follow/${year}/${month}`);
      
      const followUpListener = onValue(followUpRef, (snapshot) => {
        if (snapshot.exists()) {
          const followUpData = snapshot.val();
          const monthFollowUpData = Object.values(followUpData).map((item, index) => ({
            ...item,
            id: item.id || `${year}-${month}-${index}`,
            resident_name: item.resident_name || item.Name || 'Unknown Resident',
            date: item.date || 'Unknown Date',
            summary_of_behaviour: item.summary_of_behaviour || 'No summary available',
            other_notes: item.other_notes || 'No notes available',
            yearMonth: `${year}-${month}`
          }));
          
          // Filter by actual date range
          const filteredFollowUpData = monthFollowUpData.filter(item => {
            if (!item.date || item.date === 'Unknown Date') return false;
            const itemDate = new Date(item.date);
            return itemDate >= start && itemDate <= end;
          });
          
          allFollowUpData.push(...filteredFollowUpData);
        }
        
        completedFollowUpFetches++;
        if (completedFollowUpFetches === totalFollowUpFetches) {
          // Sort by date descending
          const sortedFollowUpData = allFollowUpData.sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
          setFollowUpData(sortedFollowUpData);
          setFollowUpLoading(false);
        }
      });
      listeners.push({ ref: followUpRef, listener: followUpListener });
    });

    // Also fetch past three months data for trends (relative to end date)
    const endYear = end.getFullYear();
    endMonth = end.getMonth() + 1;
    const pastThreeMonths = [];

    for (let i = 3; i >= 1; i--) {
      const month = endMonth - i;
      if (month > 0) {
        pastThreeMonths.push({ year: endYear, month: String(month).padStart(2, '0') });
      } else {
        pastThreeMonths.push({ year: endYear - 1, month: String(12 + month).padStart(2, '0') });
      }
    }

    const allThreeMonthData = new Map();
    pastThreeMonths.forEach(({ year, month }) => {
      allThreeMonthData.set(month, []);
      
      const monthRef = ref(db, `/${altName}/behaviours/${year}/${month}`);
      console.log("Fetching three-month trend data for", `/${altName}/behaviours/${year}/${month}`);
      
      const listener = onValue(monthRef, (snapshot) => {
        if (snapshot.exists()) {
          const behavioursData = snapshot.val();
          const monthData = Object.keys(behavioursData).map((key) => behavioursData[key]);
          allThreeMonthData.set(month, monthData);
          setThreeMonthData(new Map(allThreeMonthData));
        }
      });
      listeners.push({ ref: monthRef, listener });
    });

    return () => {
      listeners.forEach(({ ref: listenerRef, listener }) => {
        off(listenerRef, listener);
      });
    };
  }, [startDate, endDate, altName]);

  // Fetch overview metrics from Firebase
  useEffect(() => {
    const metricsRef = ref(db, `/${altName}/overviewMetrics`);
    const metricsListener = onValue(metricsRef, (snapshot) => {
      if (snapshot.exists()) {
        const metricsData = snapshot.val();
        // Default values if not present
        const defaultMetrics = {
          antipsychotics: { percentage: 15, change: -3, residents: ['John Smith', 'Mary Johnson', 'Robert Davis'] },
          worsened: { percentage: 28, change: 5, residents: ['Sarah Wilson', 'Michael Brown', 'Lisa Anderson'] },
          improved: { percentage: 57, change: 8, residents: ['David Miller', 'Jennifer Taylor', 'Thomas White'] }
        };
        setOverviewMetrics({
          antipsychotics: metricsData.antipsychotics || defaultMetrics.antipsychotics,
          worsened: metricsData.worsened || defaultMetrics.worsened,
          improved: metricsData.improved || defaultMetrics.improved
        });
      }
      // If no data exists, keep the default values (no error)
    });

    return () => {
      off(metricsRef, metricsListener);
    };
  }, [altName]);

  useEffect(() => {
    updateFallsChart();
    // console.log('Falls Chart');
  }, [fallsTimeRange, data, desiredMonth]);

  useEffect(() => {
    if (data.length > 0) {
      const processedData = data.map((item, index) => {
        
        // Determine color based on post-fall notes count and existing update status
        const postFallNotesColor = 
          item.isPostFallNotesUpdated !== 'yes' && item.postFallNotes < 3 ? 'red' : 'inherit';
        
        return {
          ...item,
          postFallNotesColor,
        };
      });
  
      // Only update if there's a change to prevent unnecessary re-renders
      const dataChanged = JSON.stringify(processedData) !== JSON.stringify(data);
      if (dataChanged) {
        setData(processedData);
      }
    }
  }, [data]);

  // Calculate behavior metrics for overview
  const calculateBehaviorMetrics = () => {
    if (!data || data.length === 0) return { antipsychotics: 0, worsened: 0, improved: 0 };
    
    let antipsychoticsCount = 0;
    let worsenedCount = 0;
    let improvedCount = 0;
    let totalCount = data.length;
    
    data.forEach(item => {
      // Check for antipsychotics without prescription
      if (item.antipsychotic === 'yes' && (!item.prescription || item.prescription === 'no')) {
        antipsychoticsCount++;
      }
      
      // Check for behaviors worsened
      if (item.behavior_change === 'worsened' || item.behavior_change === 'worse') {
        worsenedCount++;
      }
      
      // Check for behaviors improved
      if (item.behavior_change === 'improved' || item.behavior_change === 'better') {
        improvedCount++;
      }
    });
    
    return {
      antipsychotics: totalCount > 0 ? Math.round((antipsychoticsCount / totalCount) * 100) : 0,
      worsened: totalCount > 0 ? Math.round((worsenedCount / totalCount) * 100) : 0,
      improved: totalCount > 0 ? Math.round((improvedCount / totalCount) * 100) : 0
    };
  };

  useEffect(() => {
    let yearsRef;
    yearsRef = ref(db, `/${altName}/behaviours`);
    
    onValue(yearsRef, (snapshot) => {
      const yearMonthMapping = {};
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        Object.keys(data).forEach(year => {
          if (!yearMonthMapping[year]) {
            yearMonthMapping[year] = [];
          }
          
          Object.keys(data[year] || {}).forEach(month => {
            if (data[year][month]) {
              yearMonthMapping[year].push(months_forward[month]);
            }
          });
          
          yearMonthMapping[year].sort((a, b) => {
            return months_backword[a] - months_backword[b];
          });
        });
        

        const sortedYears = Object.keys(yearMonthMapping).sort((a, b) => b - a);
        const sortedMapping = {};
        sortedYears.forEach(year => {
          sortedMapping[year] = yearMonthMapping[year];
        });

        setAvailableYearMonth(sortedMapping);

        const today = new Date();
        const currentYear = today.getFullYear().toString();
        const currentMonth = getCurrentMonth();
        
        let yearToUse = currentYear;
        let monthToUse = currentMonth;
        
        if (!sortedMapping[yearToUse]?.includes(monthToUse)) {
          if (sortedMapping[yearToUse]?.length > 0) {
            const currentMonthNum = months_backword[currentMonth];
            const availableMonths = sortedMapping[yearToUse].map(m => months_backword[m]);
            const closestMonth = availableMonths.reduce((prev, curr) => {
              return Math.abs(curr - currentMonthNum) < Math.abs(prev - currentMonthNum) ? curr : prev;
            });
            monthToUse = months_forward[closestMonth];
          } else {
            yearToUse = sortedYears[0];
            monthToUse = sortedMapping[yearToUse][sortedMapping[yearToUse].length - 1];
          }
        }
        
        setDesiredYear(parseInt(yearToUse));
        setDesiredMonth(monthToUse);
      }
    });
  }, []);

  const checkForUnreviewedResidents = async () => {
    const fallsRef = ref(db, `/${altName}/${desiredYear}/${months_backword[desiredMonth]}`);
    const reviewsRef = ref(db, `/reviews/${altName}/${desiredYear}/${months_backword[desiredMonth]}`);
    
    const [fallsSnapshot, reviewsSnapshot] = await Promise.all([
      get(fallsRef),
      get(reviewsRef)
    ]);

    const fallsData = fallsSnapshot.val();
    const reviewsData = reviewsSnapshot.val() || {};

    if (fallsData) {
      const fallCounts = {};
      Object.values(fallsData).forEach(fall => {
        if (fall.name) {
          fallCounts[fall.name] = (fallCounts[fall.name] || 0) + 1;
        }
      });

      const needReview = Object.entries(fallCounts)
        .filter(([residentName, count]) => {
          const review = reviewsData[residentName];
          if (!review) return count >= 3;
          
          if (review.needsReminder && review.lastReminderTime) {
            const reminderTime = new Date(review.lastReminderTime);
            const now = new Date();
            return count >= 3 && (now - reminderTime) >= 86400000;
          }
          
          return false;
        })
        .map(([residentName]) => ({
          name: residentName
        }));

      setResidentsNeedingReview(needReview);
      if (needReview.length > 0) {
        setCurrentResidentIndex(0);
        setShowModal(true);
      }
    }
  };

  useEffect(() => {
    checkForUnreviewedResidents();
    const interval = setInterval(checkForUnreviewedResidents, 10000);
    
    return () => clearInterval(interval);
  }, [altName, desiredMonth]);


  // useEffect(() => {
  //   const loadInsightData = async () => {
  //     const insightsRef = ref(db, `/${altName}/insights/${desiredYear}/${months_backword[desiredMonth]}`);
  //     const snapshot = await get(insightsRef);
      
  //     if (snapshot.exists()) {
  //       const data = snapshot.val();
  //       const outcomes = {};
  //       const reviewed = {};
  //       const insightsList = [];
        
  //       Object.entries(data).forEach(([id, insight]) => {
  //         if (typeof insight === 'string') {
  //           insightsList.push({
  //             id,
  //             emoji: '📊',
  //             content: insight
  //           });
  //         } else if (insight.content) {
  //           insightsList.push({
  //             id,
  //             emoji: insight.emoji || '📊',
  //             content: insight.content
  //           });
  //         }
          
  //         if (insight.outcome) outcomes[id] = insight;
  //         if (insight.reviewed) reviewed[id] = true;
  //       });
        
  //       // setInsights(insightsList);
  //       setInsightOutcomes(outcomes);
  //       setReviewedInsights(reviewed);
  //     } else {
  //       // setInsights([]);
  //       setInsightOutcomes({});
  //       setReviewedInsights({});
  //     }
  //   };
  //   loadInsightData();
  // }, [altName, desiredYear, desiredMonth]);


  const cleanDuplicateText = (text, field) => {
    if (!text) return text;
    
    if (field === 'interventions') {
      // Clean up the specific pattern in interventions
      return text.replace(/No Progress Note Found Within 24hrs of RIM\s*Within 24hrs of RIM/g, 'No Progress Note Found Within 24hrs of RIM');
    } else if (field === 'triggers') {
      // Clean up the specific pattern in triggers
      return text.replace(/Within 24hrs of RIM\s*Within 24hrs of RIM\s*Within 24hrs of RIM/g, 'Within 24hrs of RIM');
    }
    return text;
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Update showFollowUpTable, showReports based on activeSection and activeOverviewTab
  useEffect(() => {
    if (activeSection === 'overview') {
      setShowFollowUpTable(activeOverviewTab === 'followups');
      setShowReports(false);
      setShowTrendsAndAnalysis(false);
    } else if (activeSection === 'reports') {
      setShowFollowUpTable(false);
      setShowReports(true);
      setShowTrendsAndAnalysis(false);
    } else if (activeSection === 'trends') {
      setShowFollowUpTable(false);
      setShowReports(false);
      setShowTrendsAndAnalysis(true);
    }
  }, [activeSection, activeOverviewTab]);

  return (
    <div className={styles.dashboard}>
      <div className={styles.dashboardLayout}>
        {/* Left Sidebar Navigation */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>Behaviours</div>
          </div>
          
          <nav className={styles.sidebarNav}>
            {/* Overview Section with Sub-items */}
            <div className={styles.navSection}>
              <button
                onClick={() => {
                  setActiveSection('overview');
                  trackDashboardInteraction({
                    action: 'view_table',
                    dashboardType: 'behaviours',
                    homeId: altName,
                  });
                }}
                className={`${styles.navMainItem} ${activeSection === 'overview' ? styles.navMainItemActive : ''}`}
              >
                <div className={styles.navItemContent}>
                  <svg className={styles.navIcon} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    <path d="M3 7H17" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 3V17" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <span>Overview</span>
                </div>
                {activeSection === 'overview' && <span className={styles.navArrow}>▼</span>}
              </button>
              {activeSection === 'overview' && (
                <div className={styles.navSubItems}>
                  <button
                    onClick={() => setActiveOverviewTab('behaviours')}
                    className={`${styles.navSubItem} ${activeOverviewTab === 'behaviours' ? styles.navSubItemActive : ''}`}
                  >
                    <div className={styles.navSubItemContent}>
                      <div className={styles.navSubItemIndicator}></div>
                      <svg className={styles.navSubIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 4H14M2 8H14M2 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
                        <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
                      </svg>
                      <span>Behaviours</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveOverviewTab('followups')}
                    className={`${styles.navSubItem} ${activeOverviewTab === 'followups' ? styles.navSubItemActive : ''}`}
                  >
                    <div className={styles.navSubItemContent}>
                      <div className={styles.navSubItemIndicator}></div>
                      <svg className={styles.navSubIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 4L8 10L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        <circle cx="3" cy="12" r="1.5" fill="currentColor"/>
                        <path d="M6 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
                onClick={() => {
                  setActiveSection('reports');
                  trackDashboardInteraction({
                    action: 'view_report',
                    dashboardType: 'reports',
                    homeId: altName,
                  });
                }}
                className={`${styles.navMainItem} ${activeSection === 'reports' ? styles.navMainItemActive : ''}`}
              >
                <div className={styles.navItemContent}>
                  <svg className={styles.navIcon} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    <path d="M5 12L8 9L11 12L15 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M15 8V14H5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                  <span>Reports</span>
                </div>
              </button>
            </div>

            {/* Trends and Analysis Section */}
            <div className={styles.navSection}>
              <button
                onClick={() => {
                  setActiveSection('trends');
                  trackDashboardInteraction({
                    action: 'view_trends',
                    dashboardType: 'trends',
                    homeId: altName,
                  });
                }}
                className={`${styles.navMainItem} ${activeSection === 'trends' ? styles.navMainItemActive : ''}`}
              >
                <div className={styles.navItemContent}>
                  <svg className={styles.navIcon} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 15L6 9L10 12L18 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <circle cx="6" cy="9" r="2" fill="currentColor"/>
                    <circle cx="10" cy="12" r="2" fill="currentColor"/>
                    <circle cx="18" cy="4" r="2" fill="currentColor"/>
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
            <button className={styles.sidebarLogout} onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                <path d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 11L13 8L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className={styles.mainContent} ref={tableRef}>
          {/* Top Header Bar */}
          <div className={styles.topHeaderBar}>
            <div className={styles.topHeaderLeft}>
              {/* Universal Date Range Picker */}
              <div className={styles.universalDateRangePicker}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const newStartDate = e.target.value;
                    setStartDate(newStartDate);
                    // If end date is before new start date, update end date
                    if (endDate && newStartDate > endDate) {
                      setEndDate(newStartDate);
                    }
                  }}
                  className={styles.dateRangeInput}
                  title="Start Date"
                />
                <span className={styles.dateRangeSeparator}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    const newEndDate = e.target.value;
                    setEndDate(newEndDate);
                    // If start date is after new end date, update start date
                    if (startDate && newEndDate < startDate) {
                      setStartDate(newEndDate);
                    }
                  }}
                  className={styles.dateRangeInput}
                  title="End Date"
                  min={startDate}
                />
              </div>
            </div>
            <div className={styles.topHeaderRight}>
              <div className={styles.userInfo}>
                <span className={styles.welcomeText}>
                  Welcome, {auth.currentUser?.email || 'User'} ({title})
                </span>
              </div>
            </div>
          </div>

      {showTrendsAndAnalysis ? (
        <TrendsAndAnalysis 
          name={name}
          altName={altName}
          data={data}
          getTimeOfDay={getTimeOfDay}
          startDate={startDate}
          endDate={endDate}
        />
      ) : showReports ? (
        <BehavioursReports 
          name={name}
          altName={altName}
          data={data}
          getTimeOfDay={getTimeOfDay}
          startDate={startDate}
          endDate={endDate}
        />
      ) : (
        <React.Fragment key="main-content">
          <div className={styles['chart-container']}>
            {/* {analysisChartData.datasets.length > 0 && <Bar data={analysisChartData} options={analysisChartOptions} />} */}
            {showFollowUpTable &&
              <FollowUpChart
                data={(followUpData.length > 0 ? filteredFollowUpData : [])}
                desiredYear={desiredYear}
                desiredMonth={desiredMonth}
              />
            }
            
            { !showFollowUpTable &&
              <AnalysisChart 
                data={filteredData} 
                desiredYear={desiredYear} 
                desiredMonth={desiredMonth}
                threeMonthData={threeMonthData}
                getTimeOfDay={getTimeOfDay}
                />
            }

        <div className={styles.chart}>
          <div className={styles['gauge-container']}>
            <div className={styles.topHeader}>
              
              <h3>Behaviours Overview</h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom:'2px'}}>
                <label style={{ fontSize: '14px'}}>
                  Show Resident Names:
                </label>
                <input
                  type="checkbox"
                  checked={showResidentNames}
                  onChange={(e) => setShowResidentNames(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
      
              <div style={{ 
                backgroundColor: '#F8F9FA', 
                border: '2px solid #06b6d4', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 4px 8px rgba(6, 182, 212, 0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ 
                    backgroundColor: '#06b6d4', 
                    borderRadius: '20%', 
                    padding: '10px',
                    minWidth: '60px', 
                    width: '60px',
                    height: '60px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                    boxSizing: 'border-box'
                  }}>
                    {overviewMetrics.antipsychotics.percentage}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0D0E10', marginBottom: '5px' }}>
                      % of Residents with Potentially Inappropriate Use of Antipsychotics
                    </h3>
                    <p style={{ fontSize: '14px', color: '#676879', margin: 0 }}>
                      Residents receiving antipsychotics without proper documentation
                    </p>
                    {showResidentNames && (
                      <div style={{ marginTop: '10px', fontSize: '18px', color: '#676879' }}>
                        <strong>Residents:</strong> {overviewMetrics.antipsychotics.residents.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#06b6d4' }}>
                    {overviewMetrics.antipsychotics.change > 0 ? '+' : ''}{overviewMetrics.antipsychotics.change}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#676879' }}>vs last month</div>
                </div>
              </div>

              {/* Behaviours Worsened Card */}
              <div style={{ 
                backgroundColor: '#F8F9FA', 
                border: '2px solid #06b6d4', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 4px 8px rgba(6, 182, 212, 0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ 
                    backgroundColor: '#06b6d4', 
                    borderRadius: '20%', 
                    padding: '10px',
                    minWidth: '60px', 
                    width: '60px',
                    height: '60px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                    boxSizing: 'border-box'
                  }}>
                    {overviewMetrics.worsened.percentage}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0D0E10', marginBottom: '5px' }}>
                      % of Behaviours Worsened
                    </h3>
                    <p style={{ fontSize: '14px', color: '#676879', margin: 0 }}>
                      Residents showing increased behavioral challenges
                    </p>
                    {showResidentNames && (
                      <div style={{ marginTop: '10px', fontSize: '18px', color: '#676879' }}>
                        <strong>Residents:</strong> {overviewMetrics.worsened.residents.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#06b6d4' }}>
                    {overviewMetrics.worsened.change > 0 ? '+' : ''}{overviewMetrics.worsened.change}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#676879' }}>vs last month</div>
                </div>
              </div>

              {/* Behaviours Improved Card */}
              <div style={{ 
                backgroundColor: '#F8F9FA', 
                border: '2px solid #06b6d4', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 4px 8px rgba(6, 182, 212, 0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ 
                    backgroundColor: '#06b6d4', 
                    borderRadius: '20%', 
                    padding: '10px',
                    minWidth: '60px', 
                    width: '60px',
                    height: '60px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                    boxSizing: 'border-box'
                  }}>
                    {overviewMetrics.improved.percentage}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0D0E10', marginBottom: '5px' }}>
                      % of Behaviours Improved
                    </h3>
                    <p style={{ fontSize: '14px', color: '#676879', margin: 0 }}>
                      Residents showing positive behavioral changes
                    </p>
                    {showResidentNames && (
                      <div style={{ marginTop: '10px', fontSize: '18px', color: '#676879' }}>
                        <strong>Residents:</strong> {overviewMetrics.improved.residents.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#06b6d4' }}>
                    {overviewMetrics.improved.change > 0 ? '+' : ''}{overviewMetrics.improved.change}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#676879' }}>vs last month</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles['table-header']}>
        <div className={styles['header']} style={{marginBottom: '10px', marginLeft: '10px'}}>
          <h2>
            {showFollowUpTable ? 'Behaviour Follow-ups' : 'Behaviours Tracking Table'}
          </h2>
        </div>
      </div>
      
      <div className={styles['table-header']}>
        <div className={styles['header']}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '10px' }}>
        {!showFollowUpTable ? (
          <React.Fragment key="behaviours-filters">
            {/* Behavior Tracking Filters */}
            <select className={styles.selector}value={filterResident} onChange={(e) => setFilterResident(e.target.value)}>
                <option>Any Resident</option>
                {[...new Set(data.map((d) => d.name))].map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>

              {/* Behavior Type Filter */}
              <select className={styles.selector} value={filterBehaviorType} onChange={(e) => setFilterBehaviorType(e.target.value)}>
                <option>All Types</option>
                {[...new Set(data.map((d) => d.incident_type))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>

              {/* Time of Day Filter */}
              <select className={styles.selector} value={filterTimeOfDay} onChange={(e) => setFilterTimeOfDay(e.target.value)}>
                <option>Anytime</option>
                <option>Morning</option>
                <option>Evening</option>
                <option>Night</option>
              </select>
          </React.Fragment>
        ) : (
          <React.Fragment key="followup-filters">
            {/* Follow-up Filters - Aligned horizontally */}
            <select 
              className={styles.selector} 
              value={filterFollowUpResident} 
              onChange={(e) => setFilterFollowUpResident(e.target.value)}
              style={{ padding: '8px 32px 8px 12px', height: '36px' }}
            >
              <option>Any Resident</option>
              {[...new Set(followUpData.map((d) => d.resident_name))].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </React.Fragment>
        )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className={styles['download-button']} onClick={handleSaveCSV}>
            Download as CSV
          </button>
          <button 
            className={styles['download-button']} 
            onClick={handleSavePDF}
            style={{
              background: '#ffffff',
              border: '2px solid #06b6d4',
              color: '#06b6d4'
            }}
          >
            Download as PDF
          </button>
        </div>
      </div>

                  <div className={styles.tableSection}>
                    
        {!showFollowUpTable ? (
          <BeTrackingTable
            filteredData={filteredData} 
            cleanDuplicateText={cleanDuplicateText} 
            storageKey={`${name}_${desiredYear}_${desiredMonth}_behaviours_checked`}
          />
                    ) : (
          <BeFollowUpTable
            filteredData={filteredFollowUpData}
            followUpLoading={followUpLoading}
          />
        )}
      </div>
        </React.Fragment>
      )}
          {isModalOpen && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div>
              <h2>Edit Interventions</h2>
              <textarea value={currentIntervention} onChange={(e) => setCurrentIntervention(e.target.value)} />
              <br />
              <button onClick={handleSubmitIntervention}>Submit</button>
              <button onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}