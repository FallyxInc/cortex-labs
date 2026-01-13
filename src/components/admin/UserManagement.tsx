'use client';

import { useState, useEffect } from 'react';
import {
	HiOutlineCheckCircle,
	HiOutlineXCircle,
	HiOutlineChartBar,
	HiOutlineArrowRight,
} from 'react-icons/hi2';
import HelpIcon from './HelpIcon';
import { HomePreferences, DefaultSection } from '@/types/featureTypes';

interface User {
	id: string;
	username?: string | null;
	email?: string | null;
	role: string;
	loginCount?: number;
	createdAt?: string;
	homeId?: string;
	chainId?: string;
	preferences?: HomePreferences;
}

interface Chain {
	id: string;
	name: string;
	homes: string[];
}

interface Home {
	id: string;
	name: string;
	chainId?: string | null;
}

export default function UserManagement() {
	const [users, setUsers] = useState<User[]>([]);
	const [chains, setChains] = useState<Chain[]>([]);
	const [homes, setHomes] = useState<Home[]>([]);
	const [loading, setLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [formData, setFormData] = useState({
		username: '',
		email: '',
		password: '',
		role: 'homeUser',
		chainId: '',
		homeId: '',
	});
	const [message, setMessage] = useState('');
	const [messageType, setMessageType] = useState<'success' | 'error'>(
		'success'
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editingUserId, setEditingUserId] = useState<string | null>(null);
	const [editingUsername, setEditingUsername] = useState('');
	const [editingEmail, setEditingEmail] = useState('');
	const [filterRole, setFilterRole] = useState<string>('');
	const [filterChain, setFilterChain] = useState<string>('');
	const [filterHome, setFilterHome] = useState<string>('');
	const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
	const [isDeleting, setIsDeleting] = useState(false);
	const [showMigration, setShowMigration] = useState(false);
	const [migrationData, setMigrationData] = useState<{
		usersToMigrate: Array<{
			userId: string;
			currentData: Record<string, any>;
			proposedChanges: Record<string, any>;
			issues: string[];
		}>;
		totalUsers: number;
		usersNeedingMigration: number;
	} | null>(null);
	const [isScanning, setIsScanning] = useState(false);
	const [isMigrating, setIsMigrating] = useState(false);
	const [migrationResults, setMigrationResults] = useState<{
		updated: string[];
		failed: Array<{ userId: string; error: string }>;
		skipped: string[];
	} | null>(null);
	const [showBulkImport, setShowBulkImport] = useState(false);
	const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
	const [isImporting, setIsImporting] = useState(false);
	const [importResults, setImportResults] = useState<{
		results: Array<{
			rowNumber: number;
			username: string;
			email: string;
			success: boolean;
			userId?: string;
			error?: string;
		}>;
		summary: {
			total: number;
			succeeded: number;
			failed: number;
		};
		errors?: string[];
	} | null>(null);
	const [savingPreferences, setSavingPreferences] = useState<string | null>(
		null
	);

	useEffect(() => {
		fetchUsers();
		fetchChains();
		fetchHomes();
	}, []);

	// Clear selection when filters change
	useEffect(() => {
		setSelectedUsers(new Set());
	}, [filterRole, filterChain, filterHome]);

	const fetchChains = async () => {
		try {
			const response = await fetch('/api/admin/chains');
			const data = await response.json();

			if (data.success) {
				setChains(data.chains || []);
			}
		} catch (error) {
			console.error('Error fetching chains:', error);
		}
	};

	const fetchHomes = async () => {
		try {
			const response = await fetch('/api/admin/homes');
			const data = await response.json();

			if (data.success) {
				setHomes(data.homes || []);
			}
		} catch (error) {
			console.error('Error fetching homes:', error);
		}
	};

	const fetchUsers = async () => {
		try {
			setLoading(true);
			const response = await fetch('/api/admin/users');
			const data = await response.json();

			if (data.success) {
				setUsers(data.users || []);
			} else {
				showMessage('Failed to fetch users', 'error');
			}
		} catch (error) {
			console.error('Error fetching users:', error);
			showMessage('Failed to fetch users', 'error');
		} finally {
			setLoading(false);
		}
	};

	const showMessage = (text: string, type: 'success' | 'error') => {
		setMessage(text);
		setMessageType(type);
		setTimeout(() => setMessage(''), 5000);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (isSubmitting) return;

		setIsSubmitting(true);
		setMessage('');

		try {
			if (formData.password.length < 6) {
				showMessage('Password must be at least 6 characters', 'error');
				setIsSubmitting(false);
				return;
			}

			if (!formData.role) {
				showMessage('Please select a role', 'error');
				setIsSubmitting(false);
				return;
			}

			// Validate homeUser requirements
			if (formData.role === 'homeUser') {
				if (!formData.chainId) {
					showMessage('Please select a chain', 'error');
					setIsSubmitting(false);
					return;
				}
				if (!formData.homeId) {
					showMessage('Please select a home', 'error');
					setIsSubmitting(false);
					return;
				}
			}

			const response = await fetch('/api/admin/users/create', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showMessage('User created successfully!', 'success');
				setFormData({
					username: '',
					email: '',
					password: '',
					role: 'homeUser',
					chainId: '',
					homeId: '',
				});
				setShowForm(false);
				fetchUsers();
				fetchChains();
				fetchHomes();
			} else {
				showMessage(data.error || 'Failed to create user', 'error');
			}
		} catch (error) {
			console.error('Error creating user:', error);
			showMessage('Failed to create user', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRoleChange = async (userId: string, newRole: string) => {
		try {
			const user = users.find(u => u.id === userId);
			const response = await fetch(`/api/admin/users/${userId}/role`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ role: newRole }),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				// If changing to admin, clear home and chain
				if (newRole === 'admin' && user) {
					await handleHomeChainChange(userId, '', '');
				}
				showMessage('User role updated successfully!', 'success');
				fetchUsers();
			} else {
				showMessage(data.error || 'Failed to update user role', 'error');
			}
		} catch (error) {
			console.error('Error updating user role:', error);
			showMessage('Failed to update user role', 'error');
		}
	};

	const handleHomeChainChange = async (
		userId: string,
		homeId: string,
		chainId: string
	) => {
		try {
			const response = await fetch(`/api/admin/users/${userId}/home-chain`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ homeId, chainId }),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showMessage(data.message || 'User updated successfully!', 'success');
				fetchUsers();
			} else {
				showMessage(data.error || 'Failed to update user home/chain', 'error');
			}
		} catch (error) {
			console.error('Error updating user home/chain:', error);
			showMessage('Failed to update user home/chain', 'error');
		}
	};

	const handleDelete = async (userId: string) => {
		if (
			!confirm(
				'Are you sure you want to delete this user? This action cannot be undone.'
			)
		) {
			return;
		}

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ userId }),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showMessage(data.message || 'User deleted successfully!', 'success');
				fetchUsers();
				setSelectedUsers(new Set());
			} else {
				showMessage(data.error || 'Failed to delete user', 'error');
			}
		} catch (error) {
			console.error('Error deleting user:', error);
			showMessage('Failed to delete user', 'error');
		}
	};

	const handleBulkDelete = async () => {
		const count = selectedUsers.size;
		if (count === 0) return;

		if (
			!confirm(
				`Are you sure you want to delete ${count} user(s)? This action cannot be undone.`
			)
		) {
			return;
		}

		setIsDeleting(true);
		const userIds = Array.from(selectedUsers);
		let successCount = 0;
		let failCount = 0;

		try {
			// Delete users in parallel
			const deletePromises = userIds.map(async userId => {
				try {
					const response = await fetch(`/api/admin/users/${userId}`, {
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ userId }),
					});

					const data = await response.json();
					if (response.ok && data.success) {
						successCount++;
						return { success: true, userId };
					} else {
						failCount++;
						return { success: false, userId, error: data.error };
					}
				} catch (error) {
					failCount++;
					return { success: false, userId, error: 'Network error' };
				}
			});

			await Promise.all(deletePromises);

			if (successCount > 0) {
				showMessage(
					`Successfully deleted ${successCount} user(s)${failCount > 0 ? `. ${failCount} failed.` : ''}`,
					failCount > 0 ? 'error' : 'success'
				);
				setSelectedUsers(new Set());
				fetchUsers();
			} else {
				showMessage('Failed to delete users', 'error');
			}
		} catch (error) {
			console.error('Error during bulk delete:', error);
			showMessage('Failed to delete users', 'error');
		} finally {
			setIsDeleting(false);
		}
	};

	const handleToggleUserSelection = (userId: string) => {
		const newSelected = new Set(selectedUsers);
		if (newSelected.has(userId)) {
			newSelected.delete(userId);
		} else {
			newSelected.add(userId);
		}
		setSelectedUsers(newSelected);
	};

	// Filter users based on selected filters
	const getFilteredUsers = () => {
		return users.filter(user => {
			// Filter by role
			if (filterRole && user.role !== filterRole) {
				return false;
			}

			// Filter by chain
			if (filterChain && user.chainId !== filterChain) {
				return false;
			}

			// Filter by home
			if (filterHome && user.homeId !== filterHome) {
				return false;
			}

			return true;
		});
	};

	const filteredUsers = getFilteredUsers();

	const handleSelectAll = () => {
		if (selectedUsers.size === filteredUsers.length) {
			// Deselect all
			setSelectedUsers(new Set());
		} else {
			// Select all filtered users
			setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
		}
	};

	const isAllSelected =
		filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length;
	const isSomeSelected =
		selectedUsers.size > 0 && selectedUsers.size < filteredUsers.length;

	const handleScanMigration = async () => {
		setIsScanning(true);
		setMigrationResults(null);
		try {
			const response = await fetch('/api/admin/users/migrate');
			const data = await response.json();

			if (data.success) {
				setMigrationData(data);
				setShowMigration(true);
			} else {
				showMessage(data.error || 'Failed to scan users', 'error');
			}
		} catch (error) {
			console.error('Error scanning users:', error);
			showMessage('Failed to scan users', 'error');
		} finally {
			setIsScanning(false);
		}
	};

	const handleExecuteMigration = async () => {
		if (!migrationData || migrationData.usersToMigrate.length === 0) {
			return;
		}

		if (
			!confirm(
				`Are you sure you want to migrate ${migrationData.usersToMigrate.length} user(s)? This will update their data structure.`
			)
		) {
			return;
		}

		setIsMigrating(true);
		setMigrationResults(null);

		try {
			const userIds = migrationData.usersToMigrate.map(u => u.userId);
			const response = await fetch('/api/admin/users/migrate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ userIds }),
			});

			const data = await response.json();

			if (data.success) {
				setMigrationResults(data.results);
				showMessage(
					data.message || 'Migration completed successfully!',
					'success'
				);
				fetchUsers(); // Refresh user list
			} else {
				showMessage(data.error || 'Failed to execute migration', 'error');
			}
		} catch (error) {
			console.error('Error executing migration:', error);
			showMessage('Failed to execute migration', 'error');
		} finally {
			setIsMigrating(false);
		}
	};

	const handleBulkImport = async () => {
		if (!bulkImportFile) {
			showMessage('Please select an Excel file', 'error');
			return;
		}

		setIsImporting(true);
		setImportResults(null);

		try {
			const formData = new FormData();
			formData.append('file', bulkImportFile);

			const response = await fetch('/api/admin/users/bulk-import', {
				method: 'POST',
				body: formData,
			});

			const data = await response.json();

			if (response.ok && data.success) {
				setImportResults(data);
				showMessage(
					data.message || 'Bulk import completed successfully!',
					'success'
				);
				fetchUsers(); // Refresh user list
				setBulkImportFile(null);
			} else {
				console.error('Bulk import error response:', data);
				if (data.errors && Array.isArray(data.errors)) {
					const errorMessage = `Validation errors: ${data.errors.length} error(s) found. ${data.errors.slice(0, 3).join('; ')}${data.errors.length > 3 ? '...' : ''}`;
					showMessage(errorMessage, 'error');
					setImportResults({
						errors: data.errors,
						results: [],
						summary: {
							total: data.totalRows || 0,
							succeeded: 0,
							failed: data.errors?.length || 0,
						},
					});
				} else {
					showMessage(
						data.error || data.details || 'Failed to import users',
						'error'
					);
				}
			}
		} catch (error) {
			console.error('Error during bulk import:', error);
			showMessage('Failed to import users', 'error');
		} finally {
			setIsImporting(false);
		}
	};

	const handleStartEdit = (user: User) => {
		setEditingUserId(user.id);
		setEditingUsername(user.username || '');
		setEditingEmail(user.email || '');
	};

	const handleCancelEdit = () => {
		setEditingUserId(null);
		setEditingUsername('');
		setEditingEmail('');
	};

	const handleSaveEdit = async (userId: string) => {
		if (!editingUsername.trim()) {
			showMessage('Username is required', 'error');
			return;
		}

		if (!editingEmail.trim()) {
			showMessage('Email is required', 'error');
			return;
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(editingEmail)) {
			showMessage('Invalid email format', 'error');
			return;
		}

		try {
			const response = await fetch(`/api/admin/users/${userId}/profile`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					username: editingUsername.trim(),
					email: editingEmail.trim(),
				}),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showMessage('User profile updated successfully!', 'success');
				setEditingUserId(null);
				setEditingUsername('');
				setEditingEmail('');
				fetchUsers();
			} else {
				showMessage(data.error || 'Failed to update user profile', 'error');
			}
		} catch (error) {
			console.error('Error updating user profile:', error);
			showMessage('Failed to update user profile', 'error');
		}
	};

	// Get homes for selected chain
	const getHomesForChain = (chainId: string) => {
		if (!chainId) return [];
		return homes.filter(home => home.chainId === chainId);
	};

	// Get display name for home
	const getHomeDisplayName = (homeId: string | undefined) => {
		if (!homeId) return 'N/A';
		const home = homes.find(h => h.id === homeId);
		return home ? home.name : homeId;
	};

	// Get display name for chain
	const getChainDisplayName = (chainId: string | undefined) => {
		if (!chainId) return 'N/A';
		const chain = chains.find(c => c.id === chainId);
		return chain ? chain.name : chainId;
	};

	// Handle updating default section preference for user
	const handleDefaultSectionChange = async (
		userId: string,
		newValue: DefaultSection | ''
	) => {
		try {
			setSavingPreferences(userId);
			const response = await fetch(`/api/admin/users/${userId}/preferences`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					defaultSection: newValue === '' ? null : newValue,
				}),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				showMessage(
					`Default page ${newValue ? `set to ${newValue}` : 'cleared'} successfully!`,
					'success'
				);
				fetchUsers();
			} else {
				showMessage(data.error || 'Failed to update default page', 'error');
			}
		} catch (err) {
			console.error('Error updating default page:', err);
			showMessage('Failed to update default page', 'error');
		} finally {
			setSavingPreferences(null);
		}
	};

	if (loading && users.length === 0) {
		return (
			<div className="flex justify-center items-center h-64">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	const availableRoles = ['admin', 'homeUser', 'chainAdmin'];
	const availableHomesForChain = formData.chainId
		? getHomesForChain(formData.chainId)
		: [];

	function userCreateForm() {
		return (
			<div className="bg-white shadow rounded-lg p-6 border border-gray-200">
				<div className="flex items-center mb-4">
					<h4 className="text-lg font-medium text-gray-900">Add New User</h4>
					<HelpIcon
						title="Add New User"
						content="Create a new user account. The username will be used to generate an email address (username@example.com). Passwords must be at least 6 characters long. Home users must be assigned to a chain and home."
					/>
				</div>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<div className="flex items-center">
							<label
								htmlFor="username"
								className="block text-sm font-medium text-gray-700"
							>
								Username
							</label>
							<HelpIcon
								title="Username"
								content="The username for the account. This is a display name and will be stored separately from the email address."
							/>
						</div>
						<input
							type="text"
							id="username"
							value={formData.username}
							onChange={e =>
								setFormData({ ...formData, username: e.target.value })
							}
							className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
							placeholder="Enter username"
							required
						/>
					</div>

					<div>
						<div className="flex items-center">
							<label
								htmlFor="email"
								className="block text-sm font-medium text-gray-700"
							>
								Email
							</label>
							<HelpIcon
								title="Email"
								content="Enter the user's email address. This will be used for login. Email verification is disabled."
							/>
						</div>
						<input
							type="email"
							id="email"
							value={formData.email}
							onChange={e =>
								setFormData({ ...formData, email: e.target.value })
							}
							className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
							placeholder="Enter email address"
							required
						/>
					</div>

					<div>
						<div className="flex items-center">
							<label
								htmlFor="password"
								className="block text-sm font-medium text-gray-700"
							>
								Password
							</label>
							<HelpIcon
								title="Password"
								content="Password must be at least 6 characters long. Choose a secure password for the user account."
							/>
						</div>
						<input
							type="password"
							id="password"
							value={formData.password}
							onChange={e =>
								setFormData({ ...formData, password: e.target.value })
							}
							className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
							placeholder="Enter password (minimum 6 characters)"
							required
							minLength={6}
						/>
						{formData.password.length > 0 && formData.password.length < 6 && (
							<p className="mt-1 text-xs text-red-600">
								Password must be at least 6 characters
							</p>
						)}
					</div>

					<div>
						<div className="flex items-center">
							<label
								htmlFor="role"
								className="block text-sm font-medium text-gray-700"
							>
								Role
							</label>
							<HelpIcon
								title="User Role"
								content="• Admin: Full access to admin dashboard (home management, user management, file uploads)

• Chain Admin: Access to chain dashboard to view and compare all homes in their assigned chain

• Home User: Access only to their assigned home's dashboard to view behavioural data"
							/>
						</div>
						<select
							id="role"
							value={formData.role}
							onChange={e => {
								const newRole = e.target.value;
								setFormData({
									...formData,
									role: newRole,
									// Reset chain/home when switching to admin
									chainId: newRole === 'admin' ? '' : formData.chainId,
									homeId:
										newRole === 'admin' || newRole === 'chainAdmin'
											? ''
											: formData.homeId,
								});
							}}
							className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
							required
						>
							<option value="homeUser">homeUser</option>
							<option value="chainAdmin">chainAdmin</option>
							<option value="admin">admin</option>
						</select>
						<p className="mt-1 text-xs text-gray-500">
							{formData.role === 'admin'
								? 'Admin users have access to the admin dashboard'
								: formData.role === 'chainAdmin'
									? 'Chain Admin users have access to the chain dashboard for their assigned chain'
									: 'Home users have access to their home dashboard'}
						</p>
					</div>

					{/* Chain field - for chainAdmin and homeUser */}
					{(formData.role === 'homeUser' || formData.role === 'chainAdmin') && (
						<div className="border-t border-gray-200 pt-4">
							<div>
								<div className="flex items-center">
									<label className="block text-sm font-medium text-gray-700">
										Chain
									</label>
									<HelpIcon
										title="Chain"
										content={
											formData.role === 'chainAdmin'
												? 'Select the chain this user will manage. Chain Admins can view and compare all homes in their assigned chain.'
												: 'Select an existing chain. Chains group related care facilities together. To create a new chain, use the Tenant Management section. If you select a home first, the chain will be automatically set.'
										}
									/>
								</div>
								<select
									value={formData.chainId}
									onChange={e =>
										setFormData({
											...formData,
											chainId: e.target.value,
											// Clear home if it doesn't belong to the newly selected chain (only for homeUser)
											homeId:
												formData.role === 'homeUser' &&
												formData.homeId &&
												homes.find(h => h.id === formData.homeId)?.chainId ===
													e.target.value
													? formData.homeId
													: formData.role === 'chainAdmin'
														? ''
														: formData.homeId,
										})
									}
									className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
									required
								>
									<option value="">Select a chain</option>
									{chains.map(chain => (
										<option key={chain.id} value={chain.id}>
											{chain.name}
										</option>
									))}
								</select>
							</div>
						</div>
					)}

					{/* Home field - only for homeUser */}
					{formData.role === 'homeUser' && (
						<div className="border-t border-gray-200 pt-4">
							<div>
								<div className="flex items-center">
									<label className="block text-sm font-medium text-gray-700">
										Home
									</label>
									<HelpIcon
										title="Home"
										content="Select an existing home. The home is the specific care facility the user will have access to. If you select a home first, the chain will be automatically set. To create a new home, use the Tenant Management section."
									/>
								</div>
								<select
									value={formData.homeId}
									onChange={e => {
										const selectedHomeId = e.target.value;
										const selectedHome = homes.find(
											h => h.id === selectedHomeId
										);
										setFormData({
											...formData,
											homeId: selectedHomeId,
											// Auto-populate chain when home is selected
											chainId: selectedHome?.chainId || formData.chainId,
										});
									}}
									className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
									required
								>
									<option value="">Select a home</option>
									{/* Show all homes, but filter by chain if one is selected */}
									{(formData.chainId ? availableHomesForChain : homes).map(
										home => (
											<option key={home.id} value={home.id}>
												{home.name}{' '}
												{home.chainId
													? `(${getChainDisplayName(home.chainId)})`
													: ''}
											</option>
										)
									)}
								</select>
							</div>
						</div>
					)}

					<div className="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							onClick={() => {
								setShowForm(false);
								setFormData({
									username: '',
									email: '',
									password: '',
									role: 'homeUser',
									chainId: '',
									homeId: '',
								});
							}}
							className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={
								isSubmitting || formData.password.length < 6 || !formData.role
							}
							className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{isSubmitting ? 'Creating...' : 'Create User'}
						</button>
					</div>
				</form>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-4">
					<div className="flex items-center">
						<h3 className="text-xl font-semibold text-gray-900">
							User Management
						</h3>
						<HelpIcon
							title="User Management"
							content="Manage users and their access to the system.

• Admin Users: Have full access to the admin dashboard, including home management, user management, and file uploads.

• Home Users: Have access only to their assigned home's dashboard. They can view behavioural data for their specific care facility.

Users are automatically assigned email addresses based on their username (username@example.com). Each home user must be associated with a chain and home."
						/>
					</div>
					<div className="flex items-center gap-2">
						<span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
							{filterRole || filterChain || filterHome
								? `${filteredUsers.length} of ${users.length} users`
								: `${users.length} ${users.length === 1 ? 'user' : 'users'}`}
						</span>
						{selectedUsers.size > 0 && (
							<span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
								{selectedUsers.size} selected
							</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-3">
					{selectedUsers.size > 0 && (
						<button
							onClick={handleBulkDelete}
							disabled={isDeleting}
							className="text-white px-4 py-2 rounded-md text-sm font-medium transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
							style={{
								background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
								boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
							}}
							onMouseEnter={e => {
								if (!isDeleting) {
									e.currentTarget.style.background =
										'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
									e.currentTarget.style.transform = 'translateY(-2px)';
									e.currentTarget.style.boxShadow =
										'0 6px 20px rgba(239, 68, 68, 0.4)';
								}
							}}
							onMouseLeave={e => {
								if (!isDeleting) {
									e.currentTarget.style.background =
										'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
									e.currentTarget.style.transform = 'translateY(0)';
									e.currentTarget.style.boxShadow =
										'0 4px 12px rgba(239, 68, 68, 0.3)';
								}
							}}
						>
							{isDeleting
								? `Deleting ${selectedUsers.size}...`
								: `Delete ${selectedUsers.size} User${selectedUsers.size > 1 ? 's' : ''}`}
						</button>
					)}
					<button
						onClick={() => setShowBulkImport(!showBulkImport)}
						className="text-white px-4 py-2 rounded-md text-sm font-medium transition-all hover:shadow-lg"
						style={{
							background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
							boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
						}}
						onMouseEnter={e => {
							e.currentTarget.style.background =
								'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
							e.currentTarget.style.transform = 'translateY(-2px)';
							e.currentTarget.style.boxShadow =
								'0 6px 20px rgba(139, 92, 246, 0.4)';
						}}
						onMouseLeave={e => {
							e.currentTarget.style.background =
								'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
							e.currentTarget.style.transform = 'translateY(0)';
							e.currentTarget.style.boxShadow =
								'0 4px 12px rgba(139, 92, 246, 0.3)';
						}}
					>
						{showBulkImport ? 'Cancel Bulk Import' : 'Bulk Import Users'}
					</button>
					<button
						onClick={() => setShowForm(true)}
						className="text-white px-4 py-2 rounded-md text-sm font-medium transition-all hover:shadow-lg"
						style={{
							background: 'linear-gradient(135deg, #06b6d4 0%, #0cc7ed 100%)',
							boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
						}}
						onMouseEnter={e => {
							e.currentTarget.style.background =
								'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)';
							e.currentTarget.style.transform = 'translateY(-2px)';
							e.currentTarget.style.boxShadow =
								'0 6px 20px rgba(6, 182, 212, 0.4)';
						}}
						onMouseLeave={e => {
							e.currentTarget.style.background =
								'linear-gradient(135deg, #06b6d4 0%, #0cc7ed 100%)';
							e.currentTarget.style.transform = 'translateY(0)';
							e.currentTarget.style.boxShadow =
								'0 4px 12px rgba(6, 182, 212, 0.3)';
						}}
					>
						Add New User
					</button>
				</div>
			</div>

			{message && (
				<div
					className={`p-4 rounded-md ${
						messageType === 'error' ? 'bg-red-50 text-red-800' : ''
					}`}
					style={
						messageType !== 'error'
							? { backgroundColor: '#e0f7fa', color: '#0e7490' }
							: {}
					}
				>
					{message}
				</div>
			)}

			{showForm && userCreateForm()}

			{/* Bulk Import Section */}
			{showBulkImport && (
				<div className="bg-white shadow rounded-lg p-6 border border-gray-200">
					<div className="flex items-center mb-4">
						<h4 className="text-lg font-medium text-gray-900">
							Bulk Import Users
						</h4>
						<HelpIcon
							title="Bulk Import Users"
							content="Import multiple users at once from an Excel file (.xls or .xlsx).

Required columns:
• username (required)
• email (required)
• password (required, minimum 6 characters)
• role (required: 'admin' or 'homeUser')
• chainId or chainName (required if role is 'homeUser')
• homeId or homeName (required if role is 'homeUser')

The first row should contain column headers. Each subsequent row represents one user to import."
						/>
					</div>

					{/* Format Specification */}
					<div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
						<h5 className="font-semibold text-blue-900 mb-2">
							Excel File Format Requirements:
						</h5>
						<div className="text-sm text-blue-800 space-y-2">
							<p>
								<strong>Required Columns (case-insensitive):</strong>
							</p>
							<ul className="list-disc list-inside ml-4 space-y-1">
								<li>
									<strong>username</strong> - Display name for the user
									(required)
								</li>
								<li>
									<strong>email</strong> - User&apos;s email address (required,
									must be valid format)
								</li>
								<li>
									<strong>password</strong> - User&apos;s password (required,
									minimum 6 characters)
								</li>
								<li>
									<strong>role</strong> - User role: &quot;admin&quot; or
									&quot;homeUser&quot; (required)
								</li>
								<li>
									<strong>chainId</strong> or <strong>chainName</strong> - Chain
									ID or name (required if role is &quot;homeUser&quot;)
								</li>
								<li>
									<strong>homeId</strong> or <strong>homeName</strong> - Home ID
									or name (required if role is &quot;homeUser&quot;)
								</li>
							</ul>
							<p className="mt-2">
								<strong>Notes:</strong>
							</p>
							<ul className="list-disc list-inside ml-4 space-y-1">
								<li>First row must contain column headers</li>
								<li>Admin users do not need chainId/homeId</li>
								<li>
									You can use either IDs or names for chain/home (e.g.,
									&quot;kindera&quot; or &quot;Kindera&quot;)
								</li>
								<li>Home must belong to the specified chain</li>
								<li>Duplicate emails will be skipped</li>
							</ul>
						</div>
					</div>

					{/* File Upload */}
					<div className="mb-4">
						<label
							htmlFor="bulk-import-file"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Select Excel File (.xls or .xlsx)
						</label>
						<input
							type="file"
							id="bulk-import-file"
							accept=".xls,.xlsx"
							onChange={e => {
								const file = e.target.files?.[0];
								if (file) {
									setBulkImportFile(file);
									setImportResults(null);
								}
							}}
							className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
						/>
						{bulkImportFile && (
							<p className="mt-2 text-sm text-gray-600">
								Selected: {bulkImportFile.name}
							</p>
						)}
					</div>

					{/* Import Button */}
					<div className="flex justify-end gap-3">
						<button
							onClick={() => {
								setShowBulkImport(false);
								setBulkImportFile(null);
								setImportResults(null);
							}}
							className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
						>
							Cancel
						</button>
						<button
							onClick={handleBulkImport}
							disabled={!bulkImportFile || isImporting}
							className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{isImporting ? 'Importing...' : 'Import Users'}
						</button>
					</div>

					{/* Import Results */}
					{importResults && (
						<div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
							<h5 className="font-medium text-gray-900 mb-3">
								Import Results:
							</h5>
							<div className="mb-4 space-y-1 text-sm">
								<div className="text-green-600 flex items-center gap-2">
									<HiOutlineCheckCircle className="text-lg" />
									Succeeded: {importResults.summary.succeeded} user(s)
								</div>
								<div className="text-red-600 flex items-center gap-2">
									<HiOutlineXCircle className="text-lg" />
									Failed: {importResults.summary.failed} user(s)
								</div>
								<div className="text-gray-600 flex items-center gap-2">
									<HiOutlineChartBar className="text-lg" />
									Total: {importResults.summary.total} row(s)
								</div>
							</div>

							{/* Display validation errors if any */}
							{importResults.errors &&
								Array.isArray(importResults.errors) &&
								importResults.errors.length > 0 && (
									<div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
										<h6 className="font-medium text-red-900 mb-2">
											Validation Errors:
										</h6>
										<ul className="list-disc list-inside space-y-1 text-sm text-red-800 max-h-60 overflow-y-auto">
											{importResults.errors.map(
												(error: string, idx: number) => (
													<li key={idx}>{error}</li>
												)
											)}
										</ul>
									</div>
								)}

							{importResults.results && importResults.results.length > 0 && (
								<div className="mt-4 max-h-96 overflow-y-auto">
									<table className="min-w-full divide-y divide-gray-200 text-sm">
										<thead className="bg-gray-100 sticky top-0">
											<tr>
												<th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
													Row
												</th>
												<th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
													Username
												</th>
												<th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
													Email
												</th>
												<th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
													Status
												</th>
												<th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
													Message
												</th>
											</tr>
										</thead>
										<tbody className="bg-white divide-y divide-gray-200">
											{importResults.results.map((result, idx) => (
												<tr
													key={idx}
													className={
														result.success ? 'bg-green-50' : 'bg-red-50'
													}
												>
													<td className="px-3 py-2 whitespace-nowrap text-gray-900">
														{result.rowNumber}
													</td>
													<td className="px-3 py-2 whitespace-nowrap text-gray-900">
														{result.username}
													</td>
													<td className="px-3 py-2 whitespace-nowrap text-gray-900">
														{result.email}
													</td>
													<td className="px-3 py-2 whitespace-nowrap">
														{result.success ? (
															<span className="text-green-600 font-medium flex items-center gap-1">
																<HiOutlineCheckCircle className="text-base" />
																Success
															</span>
														) : (
															<span className="text-red-600 font-medium flex items-center gap-1">
																<HiOutlineXCircle className="text-base" />
																Failed
															</span>
														)}
													</td>
													<td className="px-3 py-2 text-gray-600">
														{result.error || 'User created successfully'}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			<div className="bg-white shadow overflow-hidden rounded-lg border border-gray-200">
				<div className="px-6 py-4 border-b border-gray-200">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center">
							<h3 className="text-lg font-medium text-gray-900">All Users</h3>
							<HelpIcon
								title="All Users"
								content="View and manage all users in the system. You can:

• Change user roles (admin/homeUser)
• Reassign homes and chains for home users
• Delete users

Note: When you change a home user's home, their chain will automatically update to match the home's chain."
							/>
						</div>
					</div>

					{/* Filter Section */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
						<div>
							<label
								htmlFor="filter-role"
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Filter by Role
							</label>
							<select
								id="filter-role"
								value={filterRole}
								onChange={e => setFilterRole(e.target.value)}
								className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
							>
								<option value="">All Roles</option>
								{availableRoles.map(role => (
									<option key={role} value={role}>
										{role}
									</option>
								))}
							</select>
						</div>

						<div>
							<label
								htmlFor="filter-chain"
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Filter by Chain
							</label>
							<select
								id="filter-chain"
								value={filterChain}
								onChange={e => {
									setFilterChain(e.target.value);
									// Clear home filter if chain changes and home doesn't belong to new chain
									if (e.target.value && filterHome) {
										const selectedHome = homes.find(h => h.id === filterHome);
										if (selectedHome?.chainId !== e.target.value) {
											setFilterHome('');
										}
									}
								}}
								className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
							>
								<option value="">All Chains</option>
								{chains.map(chain => (
									<option key={chain.id} value={chain.id}>
										{chain.name}
									</option>
								))}
							</select>
						</div>

						<div>
							<label
								htmlFor="filter-home"
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Filter by Home
							</label>
							<select
								id="filter-home"
								value={filterHome}
								onChange={e => {
									setFilterHome(e.target.value);
									// Auto-update chain filter when home is selected
									if (e.target.value) {
										const selectedHome = homes.find(
											h => h.id === e.target.value
										);
										if (selectedHome?.chainId) {
											setFilterChain(selectedHome.chainId);
										}
									}
								}}
								className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
							>
								<option value="">All Homes</option>
								{(filterChain
									? homes.filter(h => h.chainId === filterChain)
									: homes
								).map(home => (
									<option key={home.id} value={home.id}>
										{home.name}{' '}
										{home.chainId
											? `(${getChainDisplayName(home.chainId)})`
											: ''}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Filter Results Count */}
					{(filterRole || filterChain || filterHome) && (
						<div className="mt-3 text-sm text-gray-600">
							Showing {filteredUsers.length} of {users.length} users
						</div>
					)}
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
									<input
										type="checkbox"
										checked={isAllSelected}
										ref={input => {
											if (input) input.indeterminate = isSomeSelected;
										}}
										onChange={handleSelectAll}
										className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
									/>
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Username
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Email
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Role
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Home
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Chain
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Default Page
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Login Count
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Created
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{filteredUsers.length === 0 ? (
								<tr>
									<td
										colSpan={10}
										className="px-6 py-4 text-center text-sm text-gray-500"
									>
										{users.length === 0
											? 'No users found'
											: 'No users match the selected filters'}
									</td>
								</tr>
							) : (
								filteredUsers.map(user => (
									<tr
										key={user.id}
										className="hover:bg-gray-50 transition-colors"
									>
										<td className="px-6 py-4 whitespace-nowrap">
											<input
												type="checkbox"
												checked={selectedUsers.has(user.id)}
												onChange={() => handleToggleUserSelection(user.id)}
												className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
											/>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
											{editingUserId === user.id ? (
												<div className="flex items-center gap-2">
													<input
														type="text"
														value={editingUsername}
														onChange={e => setEditingUsername(e.target.value)}
														className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-32"
														autoFocus
													/>
													<button
														onClick={() => handleSaveEdit(user.id)}
														className="text-green-600 hover:text-green-800 transition-colors"
														title="Save"
													>
														<svg
															width="16"
															height="16"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															strokeWidth="2"
														>
															<path d="M20 6L9 17l-5-5" />
														</svg>
													</button>
													<button
														onClick={handleCancelEdit}
														className="text-red-600 hover:text-red-800 transition-colors"
														title="Cancel"
													>
														<svg
															width="16"
															height="16"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															strokeWidth="2"
														>
															<line x1="18" y1="6" x2="6" y2="18" />
															<line x1="6" y1="6" x2="18" y2="18" />
														</svg>
													</button>
												</div>
											) : (
												<div className="flex items-center gap-2">
													<span>{user.username || 'N/A'}</span>
													<button
														onClick={() => handleStartEdit(user)}
														className="text-gray-400 hover:text-blue-600 transition-colors"
														title="Edit username and email"
													>
														<svg
															width="14"
															height="14"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															strokeWidth="2"
														>
															<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
															<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
														</svg>
													</button>
												</div>
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{editingUserId === user.id ? (
												<input
													type="email"
													value={editingEmail}
													onChange={e => setEditingEmail(e.target.value)}
													className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-48"
												/>
											) : (
												<span>{user.email || 'N/A'}</span>
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<select
												value={user.role}
												onChange={e =>
													handleRoleChange(user.id, e.target.value)
												}
												className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
											>
												{availableRoles.map(role => (
													<option key={role} value={role}>
														{role}
													</option>
												))}
											</select>
										</td>
										{user.role !== 'admin' ? (
											<>
												<td className="px-6 py-4 whitespace-nowrap">
													<select
														value={user.homeId || ''}
														onChange={e => {
															const newHomeId = e.target.value;
															if (newHomeId) {
																const selectedHome = homes.find(
																	h => h.id === newHomeId
																);
																// Automatically set chain when home is selected
																const newChainId = selectedHome?.chainId || '';
																if (newChainId) {
																	handleHomeChainChange(
																		user.id,
																		newHomeId,
																		newChainId
																	);
																} else {
																	handleHomeChainChange(
																		user.id,
																		newHomeId,
																		user.chainId || ''
																	);
																}
															}
															// Removed else clause - users can no longer clear home assignment
														}}
														className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
														title="Select a home to assign. The chain will be automatically updated to match the home's chain."
													>
														{!user.homeId && (
															<option value="">Select home</option>
														)}
														{/* Show all homes - when a home is selected, chain will auto-update */}
														{homes.map(home => (
															<option key={home.id} value={home.id}>
																{home.name}{' '}
																{home.chainId
																	? `(${getChainDisplayName(home.chainId)})`
																	: ''}
															</option>
														))}
													</select>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<select
														value={user.chainId || ''}
														onChange={e => {
															const newChainId = e.target.value;
															if (newChainId) {
																// If current home doesn't belong to new chain, clear home selection
																const currentHome = homes.find(
																	h => h.id === user.homeId
																);
																const newHomeId =
																	currentHome?.chainId === newChainId
																		? user.homeId || ''
																		: '';
																handleHomeChainChange(
																	user.id,
																	newHomeId,
																	newChainId
																);
															} else {
																handleHomeChainChange(
																	user.id,
																	user.homeId || '',
																	''
																);
															}
														}}
														className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 min-w-[120px]"
														title="Select a chain to assign. If the current home doesn't belong to the new chain, it will be cleared."
													>
														<option value="">
															{user.chainId ? 'Remove chain' : 'Select chain'}
														</option>
														{chains.map(chain => (
															<option key={chain.id} value={chain.id}>
																{chain.name}
															</option>
														))}
													</select>
												</td>
											</>
										) : (
											<>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
													N/A
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
													N/A
												</td>
											</>
										)}
										<td className="px-6 py-4 whitespace-nowrap text-sm">
											{user.role === 'homeUser' ? (
												<select
													value={user.preferences?.defaultSection || ''}
													onChange={e =>
														handleDefaultSectionChange(
															user.id,
															e.target.value as DefaultSection | ''
														)
													}
													disabled={savingPreferences === user.id}
													className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
												>
													<option value="">None</option>
													<option value="behaviours">Behaviours</option>
													<option value="hydration">Hydration</option>
												</select>
											) : (
												<span className="text-gray-400">N/A</span>
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{user.loginCount || 0}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
											{user.createdAt
												? new Date(user.createdAt).toLocaleDateString()
												: 'N/A'}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
											<button
												onClick={() => handleDelete(user.id)}
												className="text-red-600 hover:text-red-900 transition-colors"
											>
												Delete
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{users.length > 0 && (
				<div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
					<div className="text-sm text-gray-600">
						<span className="font-medium">
							{filterRole || filterChain || filterHome
								? `Showing ${filteredUsers.length} of ${users.length} users`
								: `Total Users: ${users.length}`}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
