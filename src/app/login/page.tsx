'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
	signInWithEmailAndPassword,
	setPersistence,
	browserLocalPersistence,
	browserSessionPersistence,
	onAuthStateChanged,
	signOut,
} from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { db, auth } from '@/lib/firebase/firebase';
import {
	trackLogin,
	trackFormInteraction,
	trackFeatureUsage,
} from '@/lib/mixpanel';

const REMEMBER_ME_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const REMEMBER_ME_STORAGE_KEY = 'rememberMeLoginTimestamp';

export default function Login() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [rememberMe, setRememberMe] = useState(true); // Default to true for better UX
	const [checkingAuth, setCheckingAuth] = useState(true);
	const router = useRouter();
	const loginStartTime = useRef<number | null>(null);
	const formStartTime = useRef<number>(new Date().getTime());

	const loginUser = async (userId: string, userData: unknown) => {
		if (
			typeof userData !== 'object' ||
			userData === null ||
			!('role' in userData) ||
			!('loginCount' in userData)
		) {
			console.log('User data invalid:', userData);
			return;
		}

		const role = userData.role as string;
		const loginCount = userData.loginCount as number;

		// Update login count
		const updatedLoginCount = (loginCount || 0) + 1;
		await set(ref(db, `users/${userId}/loginCount`), updatedLoginCount);

		const timeToLogin = loginStartTime.current
			? Date.now() - loginStartTime.current
			: undefined;

		// Track successful login
		trackLogin({
			method: 'email',
			success: true,
			userId,
			role: role,
			loginCount: updatedLoginCount,
			timeToLogin,
		});

		// Track form completion
		const timeToComplete = Date.now() - formStartTime.current;
		trackFormInteraction({
			formName: 'login',
			action: 'submitted',
			timeToComplete,
		});
		if (role === 'admin') {
			router.push('/admin');
			return;
		} else if (role === 'homeUser') {
			if ('homeId' in userData) {
				const homeId = userData.homeId as string;
				router.push(`/${homeId}`);
				return;
			} else {
				// If homeUser doesn't have a homeId, show error
				setErrorMessage(
					'Your account is not assigned to a home. Please contact an administrator.'
				);
				trackLogin({
					method: 'email',
					success: false,
					error: 'no_home_assigned',
					userId,
					role: role,
				});
			}
		} else if (role === 'chainAdmin') {
			if ('chainId' in userData) {
				const chainId = userData.chainId as string;
				router.push(`/chain/${chainId}`);
				return;
			} else {
				// If chainAdmin doesn't have a chainId, show error
				setErrorMessage(
					'Your account is not assigned to a chain. Please contact an administrator.'
				);
				trackLogin({
					method: 'email',
					success: false,
					error: 'no_chain_assigned',
					userId,
					role: role,
				});
			}
		} else {
			// Legacy role mappings
			const roleMapping: { [key: string]: string } = {
				'niagara-ltc': 'niagara',
				generations: 'generations',
				shepherd: 'shepherd',
			};
			const mappedRole = roleMapping[role] || role;
			router.push('/' + mappedRole);
			return;
		}
	};
	useEffect(() => {
		// Check if user is already authenticated (for persisted sessions)
		onAuthStateChanged(auth, async user => {
			if (user) {
				try {
					// Check if remember me session has expired
					const rememberMeTimestamp = localStorage.getItem(
						REMEMBER_ME_STORAGE_KEY
					);
					if (rememberMeTimestamp) {
						const loginTime = parseInt(rememberMeTimestamp, 10);
						const now = Date.now();
						const timeSinceLogin = now - loginTime;

						if (timeSinceLogin > REMEMBER_ME_DURATION_MS) {
							// Session expired, sign out
							localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
							await signOut(auth);
							setCheckingAuth(false);
							return;
						}
					}

					const userSnapshot = await get(ref(db, `users/${user.uid}`));
					if (userSnapshot.exists()) {
						await loginUser(user.uid, userSnapshot.val());
					}
				} catch (error) {
					console.error('Error checking user data:', error);
				}
			} else {
				// User is not authenticated, clear remember me timestamp
				localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
			}
			// Only set checkingAuth to false if user is not authenticated
			setCheckingAuth(false);
		});
	}, [router]);

	useEffect(() => {
		if (!checkingAuth) {
			// Track form start only after auth check is complete
			trackFormInteraction({
				formName: 'login',
				action: 'started',
			});
		}
	}, [checkingAuth]);

	const handleLogin = async (event?: React.FormEvent) => {
		if (event) event.preventDefault();

		if (!email || !password) {
			setErrorMessage('Please enter both email and password');
			trackFormInteraction({
				formName: 'login',
				action: 'validated',
				validationErrors: ['missing_fields'],
			});
			return;
		}

		let loginEmail = email.trim();
		// validate email
		if (!loginEmail.includes('@')) {
			loginEmail = loginEmail + '@example.com';
		}

		// Additional email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(loginEmail)) {
			setErrorMessage('Please enter a valid email address');
			trackFormInteraction({
				formName: 'login',
				action: 'validated',
				validationErrors: ['invalid_email_format'],
			});
			return;
		}

		loginStartTime.current = Date.now();

		try {
			// Set persistence based on "Remember Me" checkbox
			// LOCAL persistence: persists until explicitly signed out (even after browser close)
			// SESSION persistence: only persists for current browser session
			await setPersistence(
				auth,
				rememberMe ? browserLocalPersistence : browserSessionPersistence
			);

			const userCredential = await signInWithEmailAndPassword(
				auth,
				loginEmail,
				password
			);
			const userId = userCredential.user.uid;

			// Store timestamp if "Remember Me" is checked, otherwise clear it
			if (rememberMe) {
				localStorage.setItem(REMEMBER_ME_STORAGE_KEY, Date.now().toString());
			} else {
				localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
			}

			const userSnapshot = await get(
				ref(db, `users/${userCredential.user.uid}`)
			);

			if (userSnapshot.exists()) {
				loginUser(userId, userSnapshot.val());
			}
		} catch (error: unknown) {
			console.error('Error during login:', error);

			// Map Firebase error codes to user-friendly messages
			let errorMessage = 'Login failed. Please check your credentials.';

			if (error && typeof error === 'object' && 'code' in error) {
				switch ((error as { code: string }).code) {
					case 'auth/invalid-credential':
					case 'auth/wrong-password':
					case 'auth/user-not-found':
						errorMessage = 'Incorrect email or password';
						break;
					case 'auth/invalid-email':
						errorMessage = 'Invalid email address';
						break;
					case 'auth/user-disabled':
						errorMessage = 'This account has been disabled';
						break;
					case 'auth/too-many-requests':
						errorMessage = 'Too many failed attempts. Please try again later';
						break;
					case 'auth/network-request-failed':
						errorMessage = 'Network error. Please check your connection.';
						break;
					default:
						// For other errors, use a generic message
						errorMessage = 'Login failed. Please check your credentials.';
				}
			} else if (error && typeof error === 'object' && 'message' in error) {
				// If there's a message but no code, check if it contains invalid-credential
				if (
					(error as { message: string }).message.includes(
						'invalid-credential'
					) ||
					(error as { message: string }).message.includes('wrong-password')
				) {
					errorMessage = 'Incorrect email or password';
				}
			}

			setErrorMessage(errorMessage);

			// Track failed login
			trackLogin({
				method: 'email',
				success: false,
				error:
					error && typeof error === 'object' && 'code' in error
						? (error as { code: string }).code
						: 'authentication_failed',
				timeToLogin: loginStartTime.current
					? Date.now() - loginStartTime.current
					: undefined,
			});

			trackFormInteraction({
				formName: 'login',
				action: 'validated',
				validationErrors: [
					error && typeof error === 'object' && 'code' in error
						? (error as { code: string }).code
						: 'authentication_failed',
				],
			});
		}
	};

	if (checkingAuth) {
		return (
			<div className="min-h-screen flex font-['Inter',Arial,Helvetica,sans-serif]">
				<div className="flex-[0.55] bg-white flex items-center justify-center p-4">
					<div className="text-center p-4">
						<div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-500 mx-auto"></div>
						<p className="mt-2 text-sm text-gray-500">Loading...</p>
					</div>
				</div>
				<div className="flex-[0.45] relative">
					<Image
						src="/assets/cortex_login.png"
						alt="Cortex Login"
						fill
						className="object-cover"
						priority
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex ">
			{/* Left side - Login Form (55%) */}
			<div className="flex-[0.55] bg-white flex items-center justify-center p-4">
				<div className="w-full max-w-md">
					<h2 className="text-xl font-extrabold text-black mb-4 text-center">
						Cortex Login
					</h2>

					<div className="w-full mt-4 flex flex-col">
						<label
							htmlFor="login-email"
							className="text-sm font-semibold text-black mb-2 block"
						>
							Email
						</label>
						<input
							id="login-email"
							type="text"
							value={email}
							onChange={e => setEmail(e.target.value)}
							placeholder="Enter your email"
							onKeyDown={e => {
								if (e.key === 'Enter') {
									document.getElementById('login-password')?.focus();
								}
							}}
							className="w-full px-4 py-3 text-sm border border-sky-100 rounded-lg outline-none transition-all duration-300 ease-in-out bg-slate-50 text-slate-900 hover:border-sky-200 hover:bg-white focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-20"
						/>
					</div>

					<div className="w-full mt-4 flex flex-col">
						<label
							htmlFor="login-password"
							className="text-sm font-semibold text-black mb-2 block"
						>
							Password
						</label>
						<div className="relative">
							<input
								id="login-password"
								type={showPassword ? 'text' : 'password'}
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="Enter your password"
								onKeyDown={e => {
									if (e.key === 'Enter') {
										handleLogin();
									}
								}}
								className="w-full px-4 py-3 pr-10 text-sm border border-sky-100 rounded-lg outline-none transition-all duration-300 ease-in-out bg-slate-50 text-slate-900 hover:border-sky-200 hover:bg-white focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-20"
							/>
							<button
								type="button"
								onClick={() => {
									setShowPassword(!showPassword);
									trackFeatureUsage({
										featureName: 'password_visibility_toggle',
										action: showPassword ? 'closed' : 'opened',
									});
								}}
								className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 flex items-center justify-center text-gray-500 text-base"
								aria-label={showPassword ? 'Hide password' : 'Show password'}
								title={showPassword ? 'Hide password' : 'Show password'}
							>
								{showPassword ? (
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
										<circle cx="12" cy="12" r="3" />
										<line x1="1" y1="1" x2="23" y2="23" />
									</svg>
								) : (
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
										<circle cx="12" cy="12" r="3" />
									</svg>
								)}
							</button>
						</div>
					</div>

					{errorMessage && (
						<p className="text-red-500 mt-3 text-center text-sm font-medium py-2 px-3 bg-red-50 rounded-lg border border-red-200 w-full">
							{errorMessage}
						</p>
					)}

					<div className="w-full mt-4 py-2">
						<label className="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={rememberMe}
								onChange={e => setRememberMe(e.target.checked)}
								className="w-4 h-4 cursor-pointer accent-cyan-500"
							/>
							<span className="text-sm text-gray-500 font-medium">
								Remember me for 7 days
							</span>
						</label>
					</div>

					<button
						className="w-full text-sm mt-4 font-semibold text-white bg-gradient-to-br from-cyan-500 to-cyan-400 border-none rounded-lg py-3 cursor-pointer block transition-all duration-300 ease-in-out shadow-md hover:-translate-y-0.5 hover:shadow-lg hover:from-cyan-600 hover:to-cyan-500 active:translate-y-0 active:shadow"
						onClick={() => handleLogin()}
					>
						Login
					</button>
				</div>
			</div>

			{/* Right side - Image (45%) */}
			<div className="flex-[0.45] relative">
				<Image
					src="/assets/cortex_login.png"
					alt="Cortex Login"
					fill
					className="object-cover"
					priority
				/>
			</div>
		</div>
	);
}
