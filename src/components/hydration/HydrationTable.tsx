'use client';

import { useState, useMemo, useEffect } from 'react';
import { HydrationResident } from '@/types/hydrationTypes';
import {
	loadSavedComments,
	saveCommentsToStorage,
	getComment,
	setComment,
	deleteComment as deleteCommentUtil,
} from '@/lib/utils/commentUtils';

interface HydrationTableProps {
	residents: HydrationResident[];
	dateColumns: string[];
	isLoading: boolean;
	homeId?: string;
	refetch?: () => Promise<void>;
}

type SortField =
	| 'name'
	| 'goal'
	| 'maximum'
	| 'average'
	| 'status'
	| 'missed3Days';
type SortDirection = 'asc' | 'desc';
/**
 * Parse legacy date format (MM/DD/YYYY) to Date object
 */
function parseLegacyDate(dateStr: string): Date {
	const parts = dateStr.split('/');
	return new Date(
		parseInt(parts[2]),
		parseInt(parts[0]) - 1,
		parseInt(parts[1])
	);
}

/**
 * Format date without year (MM/DD)
 */
function formatDateWithoutYear(dateStr: string): string {
	const parts = dateStr.split('/');
	return `${parts[0]}/${parts[1]}`;
}

/**
 * Extract unit from source filename
 */
function extractUnit(source: string): string {
	if (!source) return 'Unknown';
	const filename = source.replace(/\.pdf.*$/i, '');
	return filename || 'Unknown';
}

/**
 * Calculate average intake from dateData
 */
// function calculateAverageIntakeExcludeZero(
// 	dateData: Record<string, number>
// ): number {
// 	const values = Object.values(dateData).filter(v => v > 0);
// 	if (values.length === 0) return 0;
// 	return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
// }

function calculateAverageIntake(
	dateData: Record<string, number>,
	dateColumns?: string[]
): number {
	if (dateColumns) {
		const values = dateColumns.map(date => dateData[date] || 0);
		return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
	}

	return Math.round(
		Object.values(dateData).reduce((sum, v) => sum + v, 0) /
			Object.values(dateData).length
	);
}

/**
 * Get most recent date value for a resident
 */
function getMostRecentValue(
	resident: HydrationResident,
	dateColumns: string[]
): number {
	if (!resident.dateData || dateColumns.length === 0) return 0;
	const mostRecentDate = dateColumns[dateColumns.length - 1];
	return resident.dateData[mostRecentDate] || 0;
}

/**
 * Calculate if missed 3 consecutive days below goal
 */
function calculateMissed3Days(
	resident: HydrationResident,
	dateColumns: string[]
): boolean {
	if (!resident.dateData || dateColumns.length < 3 || resident.goal === 0) {
		return false;
	}

	const sortedDates = [...dateColumns].sort((a, b) => {
		const dateA = parseLegacyDate(a);
		const dateB = parseLegacyDate(b);
		return dateA.getTime() - dateB.getTime();
	});

	for (let i = 0; i <= sortedDates.length - 3; i++) {
		const date1 = sortedDates[i];
		const date2 = sortedDates[i + 1];
		const date3 = sortedDates[i + 2];

		const date1Obj = parseLegacyDate(date1);
		const date2Obj = parseLegacyDate(date2);
		const date3Obj = parseLegacyDate(date3);

		const daysDiff1 = Math.abs(
			(date2Obj.getTime() - date1Obj.getTime()) / (1000 * 60 * 60 * 24)
		);
		const daysDiff2 = Math.abs(
			(date3Obj.getTime() - date2Obj.getTime()) / (1000 * 60 * 60 * 24)
		);

		if (daysDiff1 === 1 && daysDiff2 === 1) {
			const val1 = resident.dateData[date1] || 0;
			const val2 = resident.dateData[date2] || 0;
			const val3 = resident.dateData[date3] || 0;

			if (
				val1 < resident.goal &&
				val2 < resident.goal &&
				val3 < resident.goal
			) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Clean resident name (remove "No Middle Name")
 */
function cleanResidentName(name: string): string {
	return name.replace(/\s+No Middle Name\s*/gi, ' ').trim();
}

export default function HydrationTable({
	residents,
	dateColumns,
	isLoading,
	homeId,
	refetch,
}: HydrationTableProps) {
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedUnit, setSelectedUnit] = useState<string>('all');
	const [dateRange, setDateRange] = useState<number>(7);
	const [sortField, setSortField] = useState<SortField | null>(null);
	const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

	// Edit mode state
	const [editMode, setEditMode] = useState(false);
	const [selectedResidents, setSelectedResidents] = useState<Set<string>>(
		new Set()
	);
	const [deletingResident, setDeletingResident] = useState<string | null>(null);
	const [deletingUnit, setDeletingUnit] = useState<string | null>(null);
	const [bulkDeleting, setBulkDeleting] = useState(false);
	const [error, setError] = useState('');

	// Comments state
	const [residentComments, setResidentComments] = useState<
		Record<string, string>
	>({});
	const [editingComments, setEditingComments] = useState<
		Record<string, string>
	>({});
	const [savingComments, setSavingComments] = useState<Record<string, boolean>>(
		{}
	);

	// Load comments on mount
	useEffect(() => {
		const comments = loadSavedComments();
		setResidentComments(comments);
	}, []);

	// Get unique units
	const units = useMemo(() => {
		const unitSet = new Set<string>();
		residents.forEach(r => {
			const unit = extractUnit(r.source);
			if (unit !== 'Unknown') {
				unitSet.add(unit);
			}
		});
		return Array.from(unitSet).sort();
	}, [residents]);

	// Filter date columns by range
	const sortedDateColumns = useMemo(() => {
		if (dateColumns.length === 0) return [];

		const sortedDates = [...dateColumns].sort((a, b) => {
			const dateA = parseLegacyDate(a);
			const dateB = parseLegacyDate(b);
			return dateA.getTime() - dateB.getTime();
		});

		return sortedDates;
	}, [dateColumns]);

	// Get visible date columns filtered by date range (backwards from most recent date)
	const filteredDateColumns = useMemo(() => {
		if (sortedDateColumns.length === 0) return [];

		// get the last N dates where N is the dateRange
		// get most recent dates regardless of whether they're consecutive
		const startIndex = Math.max(0, sortedDateColumns.length - dateRange);
		return sortedDateColumns.slice(startIndex);
	}, [sortedDateColumns, dateRange]);

	// Check if goal column should be visible (at least one resident has a non-null, non-zero goal)
	const showGoalColumn = useMemo(() => {
		return residents.some(r => r.goal != null && r.goal > 0);
	}, [residents]);

	// Check if maximum column should be visible (at least one resident has a non-null, non-zero maximum)
	const showMaximumColumn = useMemo(() => {
		return residents.some(r => r.maximum != null && r.maximum > 0);
	}, [residents]);

	// Filter and sort residents
	const filteredResidents = useMemo(() => {
		const filtered = residents.filter(resident => {
			// Search filter
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				const name = cleanResidentName(resident.name).toLowerCase();
				if (!name.includes(query)) return false;
			}

			// Unit filter
			if (selectedUnit !== 'all') {
				const unit = extractUnit(resident.source);
				if (unit !== selectedUnit) return false;
			}

			return true;
		});

		// Sort
		if (sortField) {
			filtered.sort((a, b) => {
				let aValue: number | string;
				let bValue: number | string;

				switch (sortField) {
					case 'name':
						aValue = cleanResidentName(a.name).toLowerCase();
						bValue = cleanResidentName(b.name).toLowerCase();
						break;
					case 'goal':
						aValue = a.goal;
						bValue = b.goal;
						break;
					case 'maximum':
						aValue = a.maximum ?? 0;
						bValue = b.maximum ?? 0;
						break;
					case 'average':
						aValue = calculateAverageIntake(a.dateData);
						bValue = calculateAverageIntake(b.dateData);
						break;
					case 'status':
						aValue =
							a.goal > 0
								? (getMostRecentValue(a, filteredDateColumns) / a.goal) * 100
								: -1;
						bValue =
							b.goal > 0
								? (getMostRecentValue(b, filteredDateColumns) / b.goal) * 100
								: -1;
						break;
					case 'missed3Days':
						aValue = calculateMissed3Days(a, filteredDateColumns) ? 1 : 0;
						bValue = calculateMissed3Days(b, filteredDateColumns) ? 1 : 0;
						break;
					default:
						return 0;
				}

				if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
				if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
				return 0;
			});
		}

		return filtered;
	}, [
		residents,
		searchQuery,
		selectedUnit,
		sortField,
		sortDirection,
		filteredDateColumns,
	]);

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			if (sortDirection === 'asc') {
				setSortDirection('desc');
			} else {
				setSortField(null);
				setSortDirection('asc');
			}
		} else {
			setSortField(field);
			setSortDirection('asc');
		}
	};

	const getSortIndicator = (field: SortField) => {
		if (sortField !== field) return null;
		return sortDirection === 'asc' ? ' ↑' : ' ↓';
	};

	// Comments handlers
	const handleCommentChange = (residentName: string, comment: string) => {
		setEditingComments(prev => ({
			...prev,
			[residentName]: comment,
		}));
	};

	const handleSaveComment = async (residentName: string) => {
		setSavingComments(prev => ({ ...prev, [residentName]: true }));

		try {
			await new Promise(resolve => setTimeout(resolve, 300));

			const newComments = setComment(
				residentName,
				editingComments[residentName] || '',
				residentComments
			);

			setResidentComments(newComments);
			saveCommentsToStorage(newComments);

			setEditingComments(prev => {
				const updated = { ...prev };
				delete updated[residentName];
				return updated;
			});
		} catch (error) {
			console.error('Error saving comment:', error);
		} finally {
			setSavingComments(prev => ({ ...prev, [residentName]: false }));
		}
	};

	const handleEditComment = (residentName: string) => {
		setEditingComments(prev => ({
			...prev,
			[residentName]: getComment(residentName, residentComments),
		}));
	};

	const handleCancelEdit = (residentName: string) => {
		setEditingComments(prev => {
			const updated = { ...prev };
			delete updated[residentName];
			return updated;
		});
	};

	const handleDeleteComment = (residentName: string) => {
		const newComments = deleteCommentUtil(residentName, residentComments);
		setResidentComments(newComments);
		saveCommentsToStorage(newComments);
	};

	// Delete handlers
	const handleDeleteResident = async (residentName: string) => {
		if (
			!confirm(
				`Are you sure you want to delete all data for "${residentName}"? This action cannot be undone.`
			)
		) {
			return;
		}

		setDeletingResident(residentName);
		setError('');

		try {
			const response = await fetch('/api/hydration/delete-resident', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					homeId,
					residentName,
				}),
			});

			const result = await response.json();

			if (response.ok) {
				console.log('✅ [DELETE RESIDENT] Resident deleted successfully');
				if (refetch) {
					await refetch();
				}
			} else {
				console.error('❌ [DELETE RESIDENT] Error:', result.error);
				setError(result.error || 'Failed to delete resident');
			}
		} catch (error) {
			console.error('💥 [DELETE RESIDENT] Network error:', error);
			setError('Failed to delete resident');
		} finally {
			setDeletingResident(null);
		}
	};

	const handleBulkDeleteResidents = async () => {
		if (selectedResidents.size === 0) {
			setError('Please select at least one resident to delete');
			return;
		}

		const residentNames = Array.from(selectedResidents);
		if (
			!confirm(
				`Are you sure you want to delete ${residentNames.length} resident(s)? This action cannot be undone.\n\nResidents: ${residentNames.slice(0, 5).join(', ')}${residentNames.length > 5 ? ` and ${residentNames.length - 5} more...` : ''}`
			)
		) {
			return;
		}

		setBulkDeleting(true);
		setError('');

		try {
			const response = await fetch('/api/hydration/delete-residents-bulk', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					homeId,
					residentNames,
				}),
			});

			const result = await response.json();

			if (response.ok) {
				console.log('✅ [BULK DELETE] Residents deleted successfully');
				setSelectedResidents(new Set());
				if (refetch) {
					await refetch();
				}
			} else {
				console.error('❌ [BULK DELETE] Error:', result.error);
				setError(result.error || 'Failed to delete residents');
			}
		} catch (error) {
			console.error('💥 [BULK DELETE] Network error:', error);
			setError('Failed to delete residents');
		} finally {
			setBulkDeleting(false);
		}
	};

	const handleDeleteUnit = async (unit: string) => {
		if (
			!confirm(
				`Are you sure you want to delete all data for "${unit}"? This will remove all residents in this unit. This action cannot be undone.`
			)
		) {
			return;
		}

		setDeletingUnit(unit);
		setError('');

		try {
			const response = await fetch('/api/hydration/delete-unit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					homeId,
					unit,
				}),
			});

			const result = await response.json();

			if (response.ok) {
				console.log('✅ [DELETE UNIT] Unit deleted successfully');
				if (refetch) {
					await refetch();
				}
			} else {
				console.error('❌ [DELETE UNIT] Error:', result.error);
				setError(result.error || 'Failed to delete unit');
			}
		} catch (error) {
			console.error('💥 [DELETE UNIT] Network error:', error);
			setError('Failed to delete unit');
		} finally {
			setDeletingUnit(null);
		}
	};

	const handleToggleResidentSelection = (residentName: string) => {
		setSelectedResidents(prev => {
			const newSet = new Set(prev);
			if (newSet.has(residentName)) {
				newSet.delete(residentName);
			} else {
				newSet.add(residentName);
			}
			return newSet;
		});
	};

	const handleSelectAllResidents = () => {
		if (selectedResidents.size === filteredResidents.length) {
			setSelectedResidents(new Set());
		} else {
			setSelectedResidents(new Set(filteredResidents.map(r => r.name)));
		}
	};

	if (isLoading) {
		return (
			<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
				<div className="py-12 px-6 flex justify-center items-center">
					<div className="w-12 h-12 border-4 border-gray-200 border-t-cyan-500 rounded-full animate-spin" />
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
			{error && (
				<div className="bg-red-50 border-b border-red-200 px-6 py-3">
					<div className="text-red-800 text-sm">{error}</div>
				</div>
			)}
			{/* ----- HEADER ----- */}
			<div className="p-6 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
				<div>
					<h3 className="text-lg font-semibold text-gray-900 m-0">
						Resident Hydration Data
					</h3>
					<p className="text-sm text-gray-500 mt-1 mb-0">
						Showing {filteredResidents.length} of {residents.length} residents
					</p>
				</div>
				<div className="flex items-center justify-center align-middle gap-3 flex-wrap ">
					<button
						onClick={() => {
							setEditMode(!editMode);
							if (editMode) {
								setSelectedResidents(new Set());
							}
						}}
						className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 ${
							editMode
								? 'bg-red-500 hover:bg-red-600 text-white'
								: 'bg-gray-200 hover:bg-gray-300 text-gray-700'
						}`}
					>
						<svg
							className="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d={
									editMode
										? 'M6 18L18 6M6 6l12 12'
										: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
								}
							/>
						</svg>
						<span>{editMode ? 'Exit Edit Mode' : 'Edit Mode'}</span>
					</button>
					{editMode && selectedResidents.size > 0 && (
						<button
							onClick={handleBulkDeleteResidents}
							disabled={bulkDeleting}
							className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{bulkDeleting ? (
								<>
									<svg
										className="animate-spin h-4 w-4"
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										></circle>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									<span>Deleting {selectedResidents.size}...</span>
								</>
							) : (
								<>
									<svg
										className="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
									<span>Delete Selected ({selectedResidents.size})</span>
								</>
							)}
						</button>
					)}
					<input
						type="text"
						placeholder="Search residents..."
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						className="px-3 py-2 border h-10 border-gray-300 rounded-lg text-sm outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
					/>
					<select
						value={selectedUnit}
						onChange={e => {
							setSelectedUnit(e.target.value);
							if (editMode) {
								setSelectedResidents(new Set());
							}
						}}
						className="px-3 py-2 border h-10  mt-2 border-gray-300 rounded-lg text-sm cursor-pointer appearance-none pr-8 outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 "
					>
						<option value="all">All Units</option>
						{units.map(unit => (
							<option key={unit} value={unit}>
								Unit {unit}
							</option>
						))}
					</select>
					<select
						value={dateRange}
						onChange={e => setDateRange(parseInt(e.target.value))}
						className="px-3 py-2 border h-10 mt-2 border-gray-300 rounded-lg text-sm bg-white cursor-pointer appearance-none pr-8 outline-none transition-colors focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
					>
						<option value={3}>Last 3 Days</option>
						<option value={5}>Last 5 Days</option>
						<option value={7}>Last 7 Days</option>
						<option value={14}>Last 14 Days</option>
					</select>
				</div>
			</div>

			{/* ----- UNIT DELETE SECTION ----- */}
			{editMode && (
				<div className="px-6 py-4 border-b border-gray-200 bg-red-50">
					<label className="block text-sm font-medium text-red-700 mb-3">
						Delete Units
					</label>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
						{units.map(unit => (
							<div
								key={unit}
								className="flex items-center justify-between bg-white border border-red-200 rounded-lg p-2"
							>
								<span className="text-sm text-gray-700">Unit {unit}</span>
								<button
									onClick={() => handleDeleteUnit(unit)}
									disabled={deletingUnit === unit}
									className="px-2 py-1 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
								>
									{deletingUnit === unit ? (
										<>
											<svg
												className="animate-spin h-3 w-3"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle
													className="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													strokeWidth="4"
												></circle>
												<path
													className="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												></path>
											</svg>
											<span>Deleting...</span>
										</>
									) : (
										<>
											<svg
												className="w-4 h-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
											<span>Delete</span>
										</>
									)}
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* ----- HYDRATION TABLE ----- */}
			{filteredResidents.length === 0 ? (
				<div className="py-12 px-6 text-center">
					<svg
						className="w-16 h-16 mx-auto mb-4 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
						/>
					</svg>
					<h4 className="text-lg font-semibold text-gray-700 mb-2 mt-0">
						No hydration data found
					</h4>
					<p className="text-sm text-gray-500 m-0">
						{searchQuery || selectedUnit !== 'all'
							? 'Try adjusting your filters'
							: 'Hydration data will appear here once available'}
					</p>
				</div>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						{/* ----- TABLE HEADER ----- */}
						<thead>
							<tr>
								{editMode && (
									<th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap">
										<input
											type="checkbox"
											checked={
												selectedResidents.size === filteredResidents.length &&
												filteredResidents.length > 0
											}
											onChange={handleSelectAllResidents}
											className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
											title="Select/Deselect all"
										/>
									</th>
								)}
								<th
									className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
									onClick={() => handleSort('name')}
								>
									Resident Name{getSortIndicator('name')}
								</th>
								{showGoalColumn && (
									<th
										className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
										onClick={() => handleSort('goal')}
									>
										Goal (mL){getSortIndicator('goal')}
									</th>
								)}
								{showMaximumColumn && (
									<th
										className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
										onClick={() => handleSort('maximum')}
									>
										Maximum (mL){getSortIndicator('maximum')}
									</th>
								)}
								<th
									className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
									onClick={() => handleSort('average')}
								>
									Average (mL){getSortIndicator('average')}
								</th>
								<th
									className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
									onClick={() => handleSort('status')}
								>
									Status{getSortIndicator('status')}
								</th>
								{filteredDateColumns.map(date => (
									<th
										key={date}
										className="px-4 py-3 text-center text-sm font-semibold text-cyan-500 whitespace-nowrap"
									>
										{formatDateWithoutYear(date)}
									</th>
								))}
								<th
									className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-gray-100"
									onClick={() => handleSort('missed3Days')}
								>
									Missed 3 Days{getSortIndicator('missed3Days')}
								</th>
								<th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap">
									Comments
								</th>
								{editMode && (
									<th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 whitespace-nowrap">
										Actions
									</th>
								)}
							</tr>
						</thead>

						{/* ----- TABLE BODY ----- */}
						<tbody>
							{filteredResidents.map((resident, index) => {
								const unit = extractUnit(resident.source);
								const average = calculateAverageIntake(
									resident.dateData,
									filteredDateColumns
								);
								const goal = resident.goal > 0 ? resident.goal : 1000;
								let hasGoal = true;
								if (resident.goal <= 0) {
									hasGoal = false;
								}
								const statusPercent = Math.min(
									Math.round((average / goal) * 100),
									100
								);
								const missed = calculateMissed3Days(
									resident,
									filteredDateColumns
								);

								const comment = getComment(resident.name, residentComments);
								const isEditing = editingComments.hasOwnProperty(resident.name);

								return (
									<tr
										key={`${resident.name}-${index}`}
										className={`border-b border-gray-200 transition-colors ${
											missed
												? 'bg-red-50 hover:bg-red-100'
												: selectedResidents.has(resident.name)
													? 'bg-cyan-50 hover:bg-cyan-100'
													: 'hover:bg-gray-50'
										}`}
									>
										{editMode && (
											<td className="px-4 py-3 text-center">
												<input
													type="checkbox"
													checked={selectedResidents.has(resident.name)}
													onChange={() =>
														handleToggleResidentSelection(resident.name)
													}
													className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
												/>
											</td>
										)}
										<td className="px-4 py-3 text-sm text-gray-700">
											<div className="flex items-center gap-2">
												<div>
													<div className="font-medium text-gray-900">
														{cleanResidentName(resident.name)}
														{resident.ipc_found === 'yes' && (
															<span
																className="inline-block w-6 h-6 cursor-help ml-1"
																title={`IPC Alert - Infection: ${resident.infection || '-'}, Type: ${resident.infection_type || '-'}`}
															>
																⚠️
															</span>
														)}
													</div>
													<div className="text-xs text-gray-500">
														{unit}
														{resident.hasFeedingTube && (
															<span
																className="inline-flex items-center justify-center w-5 h-5 bg-yellow-100 rounded-full text-xs cursor-help ml-1"
																title="Has feeding tube"
															>
																🥤
															</span>
														)}
													</div>
												</div>
											</div>
										</td>
										{showGoalColumn && (
											<td className="px-4 py-3 text-sm text-gray-700 text-center">
												{goal + (hasGoal ? '' : ' (No Goal)')}
											</td>
										)}
										{showMaximumColumn && (
											<td className="px-4 py-3 text-sm text-gray-700 text-center">
												{resident.maximum ?? 0}
											</td>
										)}
										<td className="px-4 py-3 text-sm text-gray-700 text-center">
											{average}
										</td>
										<td className="px-4 py-3 text-sm text-gray-700">
											<div className="w-full max-w-[120px]">
												<div className="h-2 bg-gray-200 rounded-full overflow-hidden">
													<div
														className="h-full bg-gradient-to-r from-cyan-300 to-cyan-500 rounded-full transition-all duration-300"
														style={{ width: `${statusPercent}%` }}
													/>
												</div>
												<div className="text-xs text-gray-500 mt-1 text-center">
													{`${statusPercent}%`}
												</div>
											</div>
										</td>
										{filteredDateColumns.map(date => (
											<td
												key={date}
												className="px-4 py-3 text-sm text-gray-700 text-center tabular-nums"
											>
												{resident.dateData[date] || 0}
											</td>
										))}
										<td className="px-4 py-3 text-sm text-center">
											<span
												className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
													missed
														? 'bg-red-100 text-red-800'
														: 'bg-green-100 text-green-800'
												}`}
											>
												{missed ? 'Yes' : 'No'}
											</span>
										</td>
										<td
											className="px-4 py-3 text-sm text-gray-700"
											style={{ minWidth: '150px', maxWidth: '200px' }}
										>
											<div className="space-y-1">
												{!comment && !isEditing ? (
													<button
														onClick={() => handleEditComment(resident.name)}
														className="w-full px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded hover:border-gray-400 transition-colors"
														title="Add comment"
													>
														+ Add comment
													</button>
												) : comment && !isEditing ? (
													<div className="p-2 bg-gray-50 rounded text-xs text-gray-700 min-h-[40px] relative group wrap-break-word overflow-hidden">
														<div
															className="max-h-12 overflow-hidden"
															style={{
																display: '-webkit-box',
																WebkitLineClamp: 3,
																WebkitBoxOrient: 'vertical',
															}}
														>
															{comment}
														</div>
														<div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex space-x-1 transition-opacity">
															<button
																onClick={() => handleEditComment(resident.name)}
																className="text-cyan-600 hover:text-cyan-700 text-xs"
																title="Edit comment"
															>
																✏️
															</button>
															<button
																onClick={() =>
																	handleDeleteComment(resident.name)
																}
																className="text-red-500 hover:text-red-600 text-xs"
																title="Delete comment"
															>
																🗑️
															</button>
														</div>
													</div>
												) : (
													<div className="relative">
														<textarea
															value={editingComments[resident.name] || ''}
															onChange={e =>
																handleCommentChange(
																	resident.name,
																	e.target.value
																)
															}
															placeholder="Add comment..."
															className="w-full px-2 py-1 pr-16 border border-gray-300 rounded text-xs resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 wrap-break-word bg-white text-gray-900 placeholder-gray-500"
															rows={2}
															maxLength={200}
														/>
														<div className="absolute top-1 right-1 flex space-x-1">
															{isEditing && (
																<button
																	onClick={() =>
																		handleCancelEdit(resident.name)
																	}
																	className="w-5 h-5 bg-gray-300 hover:bg-gray-400 text-white text-xs rounded flex items-center justify-center transition-colors"
																	title="Cancel"
																>
																	✕
																</button>
															)}
															<button
																onClick={() => handleSaveComment(resident.name)}
																disabled={
																	savingComments[resident.name] ||
																	!editingComments[resident.name]?.trim()
																}
																className="w-5 h-5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-300 text-white text-xs rounded flex items-center justify-center transition-colors"
																title="Save comment"
															>
																{savingComments[resident.name] ? '⏳' : '✓'}
															</button>
														</div>
													</div>
												)}
											</div>
										</td>
										{editMode && (
											<td className="px-4 py-3 text-center">
												<button
													onClick={() => handleDeleteResident(resident.name)}
													disabled={deletingResident === resident.name}
													className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
												>
													{deletingResident === resident.name ? (
														<>
															<svg
																className="animate-spin h-3 w-3"
																xmlns="http://www.w3.org/2000/svg"
																fill="none"
																viewBox="0 0 24 24"
															>
																<circle
																	className="opacity-25"
																	cx="12"
																	cy="12"
																	r="10"
																	stroke="currentColor"
																	strokeWidth="4"
																></circle>
																<path
																	className="opacity-75"
																	fill="currentColor"
																	d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
																></path>
															</svg>
															<span>Deleting...</span>
														</>
													) : (
														<>
															<svg
																className="w-4 h-4"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
																/>
															</svg>
															<span>Delete</span>
														</>
													)}
												</button>
											</td>
										)}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
