"use client";

import React from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Behaviours.module.css";
import { trackDashboardInteraction } from "@/lib/mixpanel";
import {
	DashboardSection,
	BehavioursTab,
	HydrationTab,
} from "@/types/behaviourTypes";
import { HomeFeatureFlags } from "@/types/featureTypes";

interface DashboardSidebarProps {
	activeSection: DashboardSection;
	activeBehavioursTab: BehavioursTab;
	activeHydrationTab: HydrationTab;
	onSectionChange: (section: DashboardSection) => void;
	onBehavioursTabChange: (tab: BehavioursTab) => void;
	onHydrationTabChange: (tab: HydrationTab) => void;
	onLogout: () => void;
	homeId: string;
	features: HomeFeatureFlags;
	chainId?: string; // When provided, shows back button to chain admin page
	featureFlagsLoading: boolean;
}

export default function DashboardSidebar({
	activeSection,
	activeBehavioursTab,
	activeHydrationTab,
	onSectionChange,
	onBehavioursTabChange,
	onHydrationTabChange,
	onLogout,
	homeId,
	features,
	chainId,
	featureFlagsLoading,
}: DashboardSidebarProps) {
	const router = useRouter();
	const handleSectionClick = (
		section: DashboardSection,
		dashboardType:
			| "behaviours"
			| "follow_up"
			| "trends"
			| "reports"
			| "hydration",
	): void => {
		onSectionChange(section);
		const action =
			section === "behaviours"
				? "view_table"
				: section === "hydration"
					? "view_hydration"
					: "view_trends";
		trackDashboardInteraction({
			action,
			dashboardType,
			homeId,
		});
	};

	const handleBackToChain = () => {
		if (chainId) {
			router.push(`/chain/${chainId}`);
		}
	};

	return (
		<div className={styles.sidebar}>
			<div className={styles.sidebarHeader}>
				<div className={styles.sidebarTitle}>Cortex</div>
			</div>

			{/* Back to Chain button - shown when viewing as chain admin */}
			{chainId && (
				<button
					onClick={handleBackToChain}
					className={styles.backToChainButton}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						style={{ marginRight: "8px" }}
					>
						<path
							d="M10 12L6 8L10 4"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					Back to Chain
				</button>
			)}

			<nav className={styles.sidebarNav}>
				{featureFlagsLoading && (
					<div className="flex justify-center items-center ">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
					</div>
				)}
				{/* Behaviours Section with Sub-items */}
				{!featureFlagsLoading && features.behaviours && (
					<div className={styles.navSection}>
						<button
							onClick={() => handleSectionClick("behaviours", "behaviours")}
							className={`${styles.navMainItem} ${activeSection === "behaviours" ? styles.navMainItemActive : ""}`}
						>
							<div className={styles.navItemContent}>
								<svg
									className={styles.navIcon}
									width="20"
									height="20"
									viewBox="0 0 20 20"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
									aria-valuetext="range"
								>
									<rect
										x="3"
										y="3"
										width="14"
										height="14"
										rx="1"
										stroke="currentColor"
										strokeWidth="1.5"
										fill="none"
									/>
									<path d="M3 7H17" stroke="currentColor" strokeWidth="1.5" />
									<path d="M7 3V17" stroke="currentColor" strokeWidth="1.5" />
								</svg>
								<span>Behaviours</span>
							</div>
							{activeSection === "behaviours" && (
								<span className={styles.navArrow}>▼</span>
							)}
						</button>
						{activeSection === "behaviours" && (
							<div className={styles.navSubItems}>
								<button
									onClick={() => onBehavioursTabChange("dashboard")}
									className={`${styles.navSubItem} ${activeBehavioursTab === "dashboard" ? styles.navSubItemActive : ""}`}
								>
									<div className={styles.navSubItemContent}>
										<div className={styles.navSubItemIndicator}></div>
										<svg
											className={styles.navSubIcon}
											width="16"
											height="16"
											viewBox="0 0 16 16"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M2 4H14M2 8H14M2 12H10"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
											/>
											<circle cx="12" cy="4" r="1.5" fill="currentColor" />
											<circle cx="12" cy="8" r="1.5" fill="currentColor" />
										</svg>
										<span>Dashboard</span>
									</div>
								</button>
								<button
									onClick={() => onBehavioursTabChange("followups")}
									className={`${styles.navSubItem} ${activeBehavioursTab === "followups" ? styles.navSubItemActive : ""}`}
								>
									<div className={styles.navSubItemContent}>
										<div className={styles.navSubItemIndicator}></div>
										<svg
											className={styles.navSubIcon}
											width="16"
											height="16"
											viewBox="0 0 16 16"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M2 4L8 10L14 4"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												fill="none"
											/>
											<circle cx="3" cy="12" r="1.5" fill="currentColor" />
											<path
												d="M6 12H14"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
											/>
										</svg>
										<span>Follow-ups</span>
									</div>
								</button>
								<button
									onClick={() => onBehavioursTabChange("reports")}
									className={`${styles.navSubItem} ${activeBehavioursTab === "reports" ? styles.navSubItemActive : ""}`}
								>
									<div className={styles.navSubItemContent}>
										<div className={styles.navSubItemIndicator}></div>
										<svg
											className={styles.navSubIcon}
											width="16"
											height="16"
											viewBox="0 0 16 16"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<rect
												x="2"
												y="2"
												width="12"
												height="12"
												rx="1"
												stroke="currentColor"
												strokeWidth="1.5"
												fill="none"
											/>
											<path
												d="M4 10L6 7L9 10L12 6"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												fill="none"
											/>
										</svg>
										<span>Reports</span>
									</div>
								</button>
								<button
									onClick={() => onBehavioursTabChange("trends")}
									className={`${styles.navSubItem} ${activeBehavioursTab === "trends" ? styles.navSubItemActive : ""}`}
								>
									<div className={styles.navSubItemContent}>
										<div className={styles.navSubItemIndicator}></div>
										<svg
											className={styles.navSubIcon}
											width="16"
											height="16"
											viewBox="0 0 16 16"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M2 12L5 7L8 10L14 3"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												fill="none"
											/>
											<circle cx="5" cy="7" r="1.5" fill="currentColor" />
											<circle cx="8" cy="10" r="1.5" fill="currentColor" />
											<circle cx="14" cy="3" r="1.5" fill="currentColor" />
										</svg>
										<span>Trends</span>
									</div>
								</button>
							</div>
						)}
					</div>
				)}

				{/* Hydration Section - Only show when feature flag is enabled */}
				{!featureFlagsLoading && features.hydration && (
					<div className={styles.navSection}>
						<button
							onClick={() => handleSectionClick("hydration", "hydration")}
							className={`${styles.navMainItem} ${activeSection === "hydration" ? styles.navMainItemActive : ""}`}
						>
							<div className={styles.navItemContent}>
								<svg
									className={styles.navIcon}
									width="20"
									height="20"
									viewBox="0 0 20 20"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M10 2C10 2 4 8 4 12C4 15.3137 6.68629 18 10 18C13.3137 18 16 15.3137 16 12C16 8 10 2 10 2Z"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
										fill="none"
									/>
									<path
										d="M7 13C7 14.6569 8.34315 16 10 16"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										fill="none"
									/>
								</svg>
								<span>Hydration</span>
							</div>
							{activeSection === "hydration" && (
								<span className={styles.navArrow}>▼</span>
							)}
						</button>
						{activeSection === "hydration" && (
							<div className={styles.navSubItems}>
								<button
									onClick={() => onHydrationTabChange("dashboard")}
									className={`${styles.navSubItem} ${activeHydrationTab === "dashboard" ? styles.navSubItemActive : ""}`}
								>
									<div className={styles.navSubItemContent}>
										<div className={styles.navSubItemIndicator}></div>
										<svg
											className={styles.navSubIcon}
											width="16"
											height="16"
											viewBox="0 0 16 16"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M2 4H14M2 8H14M2 12H10"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
											/>
											<circle cx="12" cy="4" r="1.5" fill="currentColor" />
											<circle cx="12" cy="8" r="1.5" fill="currentColor" />
										</svg>
										<span>Dashboard</span>
									</div>
								</button>
								<button
									onClick={() => onHydrationTabChange("analytics")}
									className={`${styles.navSubItem} ${activeHydrationTab === "analytics" ? styles.navSubItemActive : ""}`}
								>
									<div className={styles.navSubItemContent}>
										<div className={styles.navSubItemIndicator}></div>
										<svg
											className={styles.navSubIcon}
											width="16"
											height="16"
											viewBox="0 0 16 16"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M2 13L6 7L10 10L14 3"
												stroke="currentColor"
												strokeWidth="1.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												fill="none"
											/>
											<circle cx="6" cy="7" r="1.5" fill="currentColor" />
											<circle cx="10" cy="10" r="1.5" fill="currentColor" />
											<circle cx="14" cy="3" r="1.5" fill="currentColor" />
										</svg>
										<span>Analytics</span>
									</div>
								</button>
							</div>
						)}
					</div>
				)}
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
				<button className={styles.sidebarLogout} onClick={onLogout}>
					<svg
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						style={{ marginRight: "8px" }}
					>
						<path
							d="M6 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2H6"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
						<path
							d="M10 11L13 8L10 5"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M13 8H6"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</svg>
					Logout
				</button>
			</div>
		</div>
	);
}
