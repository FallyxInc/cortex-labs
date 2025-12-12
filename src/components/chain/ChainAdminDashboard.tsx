'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bar } from 'react-chartjs-2';
import { auth } from '@/lib/firebase/firebase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface HomeMetrics {
  homeId: string;
  homeName: string;
  chainId: string;
  totalIncidents: number;
  incidentRate: number;
  followUpCompletionRate: number;
  criticalBehaviours: number;
  behaviourTypes: Record<string, number>;
  monthlyLogins: number;
  lastUpdated: string;
}

interface ChainAdminDashboardProps {
  chainId: string;
}

type MetricType = 'totalIncidents' | 'criticalBehaviours' | 'followUpCompletionRate';
type SortField = 'totalIncidents' | 'incidentRate' | 'followUpCompletionRate' | 'criticalBehaviours' | 'homeName';

export default function ChainAdminDashboard({ chainId }: ChainAdminDashboardProps) {
  const router = useRouter();
  const [homes, setHomes] = useState<HomeMetrics[]>([]);
  const [filteredHomes, setFilteredHomes] = useState<HomeMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainName, setChainName] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('totalIncidents');
  const [sortField, setSortField] = useState<SortField>('totalIncidents');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    fetchChainData();
  }, [chainId, startDate, endDate]);

  useEffect(() => {
    sortHomes();
  }, [homes, sortField, sortDirection]);

  const fetchChainData = async () => {
    try {
      setLoading(true);
      
      const url = `/api/chain/${chainId}/homes${startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chain data');
      }

      const data = await response.json();
      setHomes(data.homes || []);
      setChainName(data.chainName || chainId);
    } catch (error) {
      console.error('Error fetching chain data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortHomes = () => {
    const sorted = [...homes].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'totalIncidents':
          aValue = a.totalIncidents;
          bValue = b.totalIncidents;
          break;
        case 'incidentRate':
          aValue = a.incidentRate;
          bValue = b.incidentRate;
          break;
        case 'followUpCompletionRate':
          aValue = a.followUpCompletionRate;
          bValue = b.followUpCompletionRate;
          break;
        case 'criticalBehaviours':
          aValue = a.criticalBehaviours;
          bValue = b.criticalBehaviours;
          break;
        case 'homeName':
          aValue = a.homeName;
          bValue = b.homeName;
          break;
        default:
          aValue = a.totalIncidents;
          bValue = b.totalIncidents;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    setFilteredHomes(sorted);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getChartData = () => {
    const labels = filteredHomes.map(home => home.homeName);
    const data = filteredHomes.map(home => {
      switch (selectedMetric) {
        case 'totalIncidents':
          return home.totalIncidents;
        case 'criticalBehaviours':
          return home.criticalBehaviours;
        case 'followUpCompletionRate':
          return home.followUpCompletionRate;
        default:
          return home.totalIncidents;
      }
    });

    return {
      labels,
      datasets: [{
        label: getMetricLabel(selectedMetric),
        data,
        backgroundColor: filteredHomes.map((_, index) => {
          // Use only blue and green colors, alternating
          return index % 2 === 0 
            ? 'rgba(6, 182, 212, 0.7)'   // Cyan/Blue
            : 'rgba(34, 197, 94, 0.7)';   // Green
        }),
        borderColor: filteredHomes.map((_, index) => {
          return index % 2 === 0 
            ? 'rgb(6, 182, 212)'   // Cyan/Blue
            : 'rgb(34, 197, 94)';   // Green
        }),
        borderWidth: 1.5,
      }],
    };
  };

  const getMetricLabel = (metric: MetricType): string => {
    switch (metric) {
      case 'totalIncidents':
        return 'Total Behavioural Incidents';
      case 'criticalBehaviours':
        return 'Critical Behaviours';
      case 'followUpCompletionRate':
        return 'Follow-up Completion Rate (%)';
      default:
        return 'Count';
    }
  };

  const calculateStepSize = (maxValue: number): number => {
    const targetTicks = 8;
    const rawStep = maxValue / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    
    let step;
    if (normalized <= 1) step = 1;
    else if (normalized <= 2) step = 2;
    else if (normalized <= 5) step = 5;
    else step = 10;
    
    return step * magnitude;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 13 },
        callbacks: {
          title: function(context: any) {
            return context[0].label;
          },
          label: function(context: any) {
            return `${getMetricLabel(selectedMetric)}: ${context.parsed.y}`;
          }
        }
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Home Name',
          font: { size: 13, weight: 'bold' as const },
          color: '#374151'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 20,
          font: { size: 11 },
          color: '#6b7280'
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.08)',
          drawBorder: true,
          borderColor: '#e5e7eb'
        }
      },
      y: {
        display: true,
        beginAtZero: true,
        title: {
          display: true,
          text: getMetricLabel(selectedMetric),
          font: { size: 13, weight: 'bold' as const },
          color: '#374151'
        },
        ticks: {
          stepSize: (() => {
            const maxValue = Math.max(...filteredHomes.map(h => {
              switch (selectedMetric) {
                case 'totalIncidents': return h.totalIncidents;
                case 'criticalBehaviours': return h.criticalBehaviours;
                case 'followUpCompletionRate': return h.followUpCompletionRate;
                default: return 0;
              }
            }), 1);
            return calculateStepSize(maxValue);
          })(),
          font: { size: 11 },
          color: '#6b7280'
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.08)',
          drawBorder: true,
          borderColor: '#e5e7eb'
        }
      },
    },
    layout: {
      padding: {
        left: 15,
        right: 15,
        top: 15,
        bottom: 30
      }
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Home Name', 'Total Incidents', 'Critical Behaviours', 'Follow-up Completion Rate (%)', 'Monthly Logins'];
    const rows = filteredHomes.map(home => [
      home.homeName,
      home.totalIncidents,
      home.criticalBehaviours,
      home.followUpCompletionRate,
      home.monthlyLogins
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chainName}_behavioural_data_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleHomeClick = (homeId: string) => {
    // Encode the homeId to handle special characters in URLs
    const encodedHomeId = encodeURIComponent(homeId);
    router.push(`/chain/${chainId}/home/${encodedHomeId}`);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2" style={{ borderColor: '#06b6d4' }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar - Separated */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Management Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">{chainName}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleDownloadCSV}
                className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors shadow-sm font-medium"
              >
                Download CSV
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors shadow-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Bar Chart with Filters Merged */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* Chart Title */}
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {getMetricLabel(selectedMetric)} by Home
          </h2>
          
          {/* Filters below title */}
          <div className="flex items-center gap-4 mb-4">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  setStartDate(newStartDate);
                  if (endDate && newStartDate > endDate) {
                    setEndDate(newStartDate);
                  }
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                title="Start Date"
              />
              <span className="text-sm text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  const newEndDate = e.target.value;
                  setEndDate(newEndDate);
                  if (startDate && newEndDate < startDate) {
                    setStartDate(newEndDate);
                  }
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                title="End Date"
                min={startDate}
              />
            </div>

            {/* Metric Toggle Buttons - Slightly bigger */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedMetric('totalIncidents')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedMetric === 'totalIncidents'
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Total Incidents
              </button>
              <button
                onClick={() => setSelectedMetric('criticalBehaviours')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedMetric === 'criticalBehaviours'
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Critical Behaviours
              </button>
              <button
                onClick={() => setSelectedMetric('followUpCompletionRate')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedMetric === 'followUpCompletionRate'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Follow-up Rate
              </button>
            </div>
          </div>

          {/* Chart */}
          <div style={{ height: '400px', position: 'relative' }}>
            {filteredHomes.length > 0 ? (
              <Bar data={getChartData()} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Behaviour Summary Cards */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Behaviour Summary</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSort('totalIncidents')}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'totalIncidents'
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                    : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span>↓↑</span>
                <span>Total Incidents</span>
              </button>
              <button
                onClick={() => handleSort('followUpCompletionRate')}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  sortField === 'followUpCompletionRate'
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                    : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span>↓↑</span>
                <span>Follow-up Rate</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-x-auto pb-4">
            {filteredHomes.map((home, index) => {
              // Color coding based on performance
              const getCardColor = () => {
                const avgIncidents = homes.reduce((sum, h) => sum + h.totalIncidents, 0) / homes.length;
                if (home.totalIncidents > avgIncidents * 1.5) return 'border-l-4 border-l-red-500';
                if (home.totalIncidents > avgIncidents) return 'border-l-4 border-l-yellow-500';
                return 'border-l-4 border-l-green-500';
              };

              return (
                <div
                  key={home.homeId}
                  onClick={() => handleHomeClick(home.homeId)}
                  className={`bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all ${getCardColor()}`}
                >
                  <h3 className="font-semibold text-gray-900 text-sm mb-3">{home.homeName}</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {home.totalIncidents}
                  </div>
                  <div className="text-xs text-gray-600 mb-3">Behavioural Incidents</div>
                  <div className="space-y-2 text-xs border-t border-gray-100 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Follow-up Rate:</span>
                      <span className="font-semibold text-blue-600">{home.followUpCompletionRate}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Critical Behaviours:</span>
                      <span className="font-semibold text-green-600">{home.criticalBehaviours}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Monthly logins:</span>
                      <span className="font-semibold text-gray-700">{home.monthlyLogins}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredHomes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No homes available
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

