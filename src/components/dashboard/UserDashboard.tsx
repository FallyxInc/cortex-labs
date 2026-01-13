'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/styles/Behaviours.module.css';
import { Chart, ArcElement, PointElement, LineElement } from 'chart.js';
import { auth, db } from '@/lib/firebase/firebase';
import { ref, get } from 'firebase/database';
import { trackPageVisit, trackTimeOnPage } from '@/lib/mixpanel';

import DashboardSidebar from './DashboardSidebar';
import DashboardHeader from './DashboardHeader';
import BehavioursPage from '../behaviours/BehavioursPage';
import FollowUpPage from '../behaviours/FollowUpPage';
import { HydrationPage, HydrationAnalytics } from '../hydration';
import { useBehavioursData } from '@/hooks/useBehavioursData';
import { useDateRange } from '@/hooks/useDateRange';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useHomePreferences } from '@/hooks/useHomePreferences';
import BehavioursReports from '../behaviours/BehavioursReports';
import TrendsAndAnalysis from '../behaviours/TrendsAndAnalysis';
import {
	DashboardProps,
	DashboardSection,
	BehavioursTab,
	HydrationTab,
	BehavioursFilters,
	FollowUpFilters,
	BehaviourIncident,
	FollowUpRecord,
	MONTHS_FORWARD,
} from '@/types/behaviourTypes';
import { onAuthStateChanged } from 'firebase/auth';

Chart.register(ArcElement, PointElement, LineElement);

export default function UserDashboard({
	name,
	firebaseId,
	title,
	goal,
	chainId,
}: DashboardProps) {
	const router = useRouter();

	// Navigation state
	const [activeSection, setActiveSection] =
		useState<DashboardSection>('behaviours');
	const [activeBehavioursTab, setActiveBehavioursTab] =
		useState<BehavioursTab>('dashboard');
	const [activeHydrationTab, setActiveHydrationTab] =
		useState<HydrationTab>('dashboard');

	// Date range
	const {
		startDate,
		endDate,
		desiredMonth,
		desiredYear,
		handleStartDateChange,
		handleEndDateChange,
	} = useDateRange();

	// Feature flags
	const { features, isLoading: featureFlagsLoading } = useFeatureFlags({
		homeId: firebaseId,
	});
	// User preferences (default page)
	const { preferences } = useHomePreferences();
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
			resident: 'Any Resident',
			behaviorType: 'All Types',
			timeOfDay: 'Anytime',
		}
	);

	const [followUpFilters, setFollowUpFilters] = useState<FollowUpFilters>({
		resident: 'Any Resident',
	});

	// On features/preferences load, set active section based on defaultSection or first available
	useEffect(() => {
		const { behaviours, hydration } = features;
		const { defaultSection } = preferences;

		// use defaultSection if set and feature is enabled
		setTimeout(() => {
			if (defaultSection === 'hydration' && hydration) {
				setActiveSection('hydration');
				setActiveHydrationTab('dashboard');
			} else if (defaultSection === 'behaviours' && behaviours) {
				setActiveSection('behaviours');
				setActiveBehavioursTab('dashboard');
			} else if (hydration) {
				setActiveSection('hydration');
				setActiveHydrationTab('dashboard');
			} else if (behaviours) {
				// fallback: first available feature
				setActiveSection('behaviours');
				setActiveBehavioursTab('dashboard');
			}
		}, 0);
	}, [features, preferences]);

	// Tracking refs
	const pageVisitCountRef = useRef(0);
	const lastVisitTimeRef = useRef<number | null>(null);
	const pageStartTimeRef = useRef(new Date().getTime());

	// Helper function
	const getTimeOfDay = useCallback((time?: string): string => {
		if (!time) return 'Anytime';
		const hour = new Date('1970-01-01T' + time).getHours();
		if (hour >= 6 && hour < 12) return 'Morning';
		if (hour >= 12 && hour < 20) return 'Evening';
		return 'Night';
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
				(Date.now() - pageStartTimeRef.current) / 1000
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
			behavioursFilters.resident !== 'Any Resident' &&
			item.name !== behavioursFilters.resident
		)
			return false;

		// Behavior type filter
		if (
			behavioursFilters.behaviorType !== 'All Types' &&
			item.incident_type !== behavioursFilters.behaviorType
		)
			return false;

		// Time of day filter
		if (behavioursFilters.timeOfDay !== 'Anytime') {
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
			followUpFilters.resident !== 'Any Resident' &&
			item.resident_name !== followUpFilters.resident
		)
			return false;

		return true;
	});

	const handleLogout = async (): Promise<void> => {
		try {
			await auth.signOut();
			router.push('/login');
		} catch (error) {
			console.error('Error logging out:', error);
		}
	};

	const handleSectionChange = (section: DashboardSection): void => {
		setActiveSection(section);
	};

	const handleBehavioursTabChange = (tab: BehavioursTab): void => {
		setActiveBehavioursTab(tab);
	};

	const handleHydrationTabChange = (tab: HydrationTab): void => {
		setActiveHydrationTab(tab);
	};

	const renderMainContent = () => {
		if (featureFlagsLoading) {
			return (
				<div className="flex justify-center items-center h-full">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
				</div>
			);
		}

		// Hydration section
		if (features.hydration) {
			if (activeSection === 'hydration') {
				if (activeHydrationTab === 'analytics') {
					return (
						<HydrationAnalytics
							firebaseId={firebaseId}
							startDate={startDate}
							endDate={endDate}
						/>
					);
				}
				return (
					<HydrationPage
						name={name}
						firebaseId={firebaseId}
						startDate={startDate}
						endDate={endDate}
					/>
				);
			}
		}

		if (features.behaviours) {
			if (activeSection === 'behaviours') {
				if (activeBehavioursTab === 'dashboard') {
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
				}
				// Behaviours section
				if (activeBehavioursTab === 'trends') {
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

				if (activeBehavioursTab === 'reports') {
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

				if (activeBehavioursTab === 'followups') {
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
			}
			// Default: Blank Page
			return <></>;
		}
	};

	return (
		<div className={styles.dashboard}>
			<div className={styles.dashboardLayout}>
				<DashboardSidebar
					activeSection={activeSection}
					activeBehavioursTab={activeBehavioursTab}
					activeHydrationTab={activeHydrationTab}
					onSectionChange={handleSectionChange}
					onBehavioursTabChange={handleBehavioursTabChange}
					onHydrationTabChange={handleHydrationTabChange}
					onLogout={handleLogout}
					homeId={firebaseId}
					features={features}
					featureFlagsLoading={featureFlagsLoading}
					chainId={chainId}
				/>

				<div className={styles.mainContent}>
					<DashboardHeader
						startDate={startDate}
						endDate={endDate}
						onStartDateChange={handleStartDateChange}
						onEndDateChange={handleEndDateChange}
						userEmail={auth.currentUser?.email || 'User'}
						title={title}
						activeSection={activeSection}
					/>

					{renderMainContent()}
				</div>
			</div>
		</div>
	);
}
