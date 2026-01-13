import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { getHomeNameAdmin } from '@/lib/homeMappings';
import { getLegacyHydrationData } from '@/app/api/hydration/hydration-legacy';

interface HomeMetrics {
	homeId: string;
	homeName: string;
	chainId: string;
	totalIncidents: number;
	incidentRate: number; // per resident or per day
	followUpCompletionRate: number; // percentage
	criticalBehaviours: number; // aggressive behaviours
	behaviourTypes: Record<string, number>;
	monthlyLogins: number;
	lastUpdated: string;
	hydrationMissed3Days?: number;
	averageIntake?: number;
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ chainId: string }> }
) {
	try {
		const { chainId } = await params;
		const { searchParams } = new URL(request.url);
		const startDate = searchParams.get('startDate');
		const endDate = searchParams.get('endDate');

		if (!chainId) {
			return NextResponse.json(
				{ error: 'Chain ID is required' },
				{ status: 400 }
			);
		}

		// Verify chain exists
		const chainRef = adminDb.ref(`/chains/${chainId}`);
		const chainSnapshot = await chainRef.once('value');

		if (!chainSnapshot.exists()) {
			return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
		}

		const chainData = chainSnapshot.val();
		const homeIds = chainData.homes || [];

		// Fetch all homes data
		const homesMetrics: HomeMetrics[] = [];

		for (const homeId of homeIds) {
			try {
				const homeRef = adminDb.ref(`/${homeId}`);
				const homeSnapshot = await homeRef.once('value');

				if (!homeSnapshot.exists()) {
					continue;
				}

				const homeData = homeSnapshot.val();
				const behaviours = homeData.behaviours || {};

				// Get all behavior entries
				let allBehaviours: any[] = [];
				for (const key in behaviours) {
					if (key === 'createdAt' || key === 'updatedAt') continue;
					const behaviourData = behaviours[key];
					if (Array.isArray(behaviourData)) {
						allBehaviours = allBehaviours.concat(behaviourData);
					} else if (behaviourData && typeof behaviourData === 'object') {
						// Handle nested structure
						for (const subKey in behaviourData) {
							if (Array.isArray(behaviourData[subKey])) {
								allBehaviours = allBehaviours.concat(behaviourData[subKey]);
							}
						}
					}
				}

				// Filter by date range if provided
				if (startDate && endDate) {
					allBehaviours = allBehaviours.filter((behaviour: any) => {
						if (!behaviour.date) return false;
						const behaviourDate = new Date(behaviour.date);
						const start = new Date(startDate);
						const end = new Date(endDate);
						return behaviourDate >= start && behaviourDate <= end;
					});
				}

				// Calculate metrics
				const totalIncidents = allBehaviours.length;

				// Calculate behaviour types
				const behaviourTypes: Record<string, number> = {};
				let criticalBehaviours = 0;
				let followUpsCompleted = 0;
				let totalFollowUps = 0;

				allBehaviours.forEach((behaviour: any) => {
					// Count by incident type
					const incidentType = behaviour.incident_type || 'Unknown';
					behaviourTypes[incidentType] =
						(behaviourTypes[incidentType] || 0) + 1;

					// Count critical behaviours (aggressive, physical, etc.)
					const type = (incidentType || '').toLowerCase();
					if (
						type.includes('aggressive') ||
						type.includes('physical') ||
						type.includes('violent')
					) {
						criticalBehaviours++;
					}

					// Count follow-ups
					if (behaviour.follow_up_date || behaviour.follow_up_notes) {
						totalFollowUps++;
						if (
							behaviour.follow_up_completed === 'yes' ||
							behaviour.follow_up_date
						) {
							followUpsCompleted++;
						}
					}
				});

				// Calculate follow-up completion rate
				const followUpCompletionRate =
					totalFollowUps > 0
						? Math.round((followUpsCompleted / totalFollowUps) * 100)
						: 0;

				// Calculate incident rate (simplified - could be per resident or per day)
				// For now, using total incidents as rate (can be enhanced later)
				const incidentRate = totalIncidents;

				// Get monthly logins (placeholder - would need to track this separately)
				const monthlyLogins = 0; // TODO: Implement login tracking per home

				// Get last updated
				const lastUpdated =
					homeData.updatedAt ||
					homeData.behaviours?.updatedAt ||
					homeData.createdAt ||
					'';

				// Calculate hydration metrics
				let hydrationMissed3Days = 0;
				let averageIntake = 0;

				if (startDate && endDate) {
					try {
						const allIntakeValues: number[] = [];
						const residentsWithMissed3Days = new Set<string>();

						// 1. Process Default Hydration Data (Realtime DB)
						const hydration = homeData.hydration || {};
						
						// Iterate through hydration data structure: /{homeId}/hydration/{year}/{month} -> { "DD": { "residentName": {...} } }
						for (const year in hydration) {
							if (year === 'createdAt' || year === 'updatedAt') continue;
							const yearData = hydration[year];
							if (!yearData || typeof yearData !== 'object') continue;

							for (const month in yearData) {
								const monthData = yearData[month];
								if (!monthData || typeof monthData !== 'object') continue;

								// monthData structure: { "DD": { "residentName": { intake, goal, ... } } }
								for (const day in monthData) {
									const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
									const date = new Date(dateStr);
									const start = new Date(startDate);
									const end = new Date(endDate);

									// Check if date is in range
									if (date >= start && date <= end) {
										const dayData = monthData[day];
										if (dayData && typeof dayData === 'object') {
											for (const residentKey in dayData) {
												const resident = dayData[residentKey];
												if (resident && typeof resident === 'object') {
													// Collect intake values
													if (
														typeof resident.intake === 'number' &&
														resident.intake > 0
													) {
														allIntakeValues.push(resident.intake);
													}
													// Count residents who missed 3 days
													if (resident.missed3Days === 'yes') {
														residentsWithMissed3Days.add(
															resident.name || residentKey
														);
													}
												}
											}
										}
									}
								}
							}
						}

						// 2. Process Legacy Hydration Data (Firestore)
						if (homeData.hydrationId) {
							try {
								// Fetch legacy data (this fetches all history for the home)
								const legacyResidents = await getLegacyHydrationData('home_manager', homeData.hydrationId) as any[];
								
								for (const resident of legacyResidents) {
									let isResidentActiveInRange = false;

									// Check dateData to see if resident has data in range
									if (resident.dateData) {
										for (const [dateStr, value] of Object.entries(resident.dateData)) {
											// dateStr is MM/DD/YYYY
											const parts = dateStr.split('/');
											if (parts.length === 3) {
												// Note: month is 0-indexed in Date constructor
												const date = new Date(
													parseInt(parts[2]), 
													parseInt(parts[0]) - 1, 
													parseInt(parts[1])
												);
												const start = new Date(startDate);
												const end = new Date(endDate);

												if (date >= start && date <= end) {
													isResidentActiveInRange = true;
													// Add intake value
													if (typeof value === 'number' && value > 0) {
														allIntakeValues.push(value);
													}
												}
											}
										}
									}

									// If resident is active in this range, include their missed3Days status
									// Note: legacy missed3Days is aggregated, so we assume if they are active and have the flag, it counts.
									if (isResidentActiveInRange && resident.missed3Days === 'yes') {
										residentsWithMissed3Days.add(resident.name);
									}
								}
							} catch (legacyError) {
								console.error(`Error processing legacy hydration for ${homeId}:`, legacyError);
							}
						}

						hydrationMissed3Days = residentsWithMissed3Days.size;
						averageIntake =
							allIntakeValues.length > 0
								? Math.round(
										allIntakeValues.reduce((sum, val) => sum + val, 0) /
											allIntakeValues.length
									)
								: 0;
					} catch (error) {
						console.error(
							`Error calculating hydration metrics for ${homeId}:`,
							error
						);
					}
				}

				const displayName = (await getHomeNameAdmin(homeId)) || homeId;

				homesMetrics.push({
					homeId,
					homeName: displayName,
					chainId,
					totalIncidents,
					incidentRate,
					followUpCompletionRate,
					criticalBehaviours,
					behaviourTypes,
					monthlyLogins,
					lastUpdated,
					hydrationMissed3Days,
					averageIntake,
				});
			} catch (error) {
				console.error(`Error processing home ${homeId}:`, error);
				// Continue with other homes
			}
		}

		return NextResponse.json({
			success: true,
			chainId,
			chainName: chainData.name || chainId,
			homes: homesMetrics.sort((a, b) => a.homeName.localeCompare(b.homeName)),
		});
	} catch (error) {
		console.error('Error fetching chain homes:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch chain homes',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}