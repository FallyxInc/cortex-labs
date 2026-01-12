"use client";

import React from "react";
import styles from "@/styles/Behaviours.module.css";

export interface SidebarNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
}

interface SidebarProps {
  title?: string;
  navItems?: SidebarNavItem[];
  footerContent?: React.ReactNode;
  onLogout?: () => void;
  children?: React.ReactNode;
}

export default function Sidebar({
  title = "Cortex Pilot",
  navItems = [],
  footerContent,
  onLogout,
  children,
}: SidebarProps) {
  const renderNavItem = (item: SidebarNavItem) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = item.isActive;

    return (
      <div key={item.id} className={styles.navSection}>
        <button
          onClick={item.onClick}
          className={`${styles.navMainItem} ${item.isActive ? styles.navMainItemActive : ""}`}
        >
          <div className={styles.navItemContent}>
            {item.icon && <span className={styles.navIcon}>{item.icon}</span>}
            <span>{item.label}</span>
          </div>
          {hasSubItems && isExpanded && (
            <span className={styles.navArrow}>▼</span>
          )}
        </button>

        {hasSubItems && isExpanded && (
          <div className={styles.navSubItems}>
            {item.subItems!.map((subItem) => (
              <button
                key={subItem.id}
                onClick={subItem.onClick}
                className={`${styles.navSubItem} ${subItem.isActive ? styles.navSubItemActive : ""}`}
              >
                <div className={styles.navSubItemContent}>
                  <div className={styles.navSubItemIndicator}></div>
                  {subItem.icon && (
                    <span className={styles.navSubIcon}>{subItem.icon}</span>
                  )}
                  <span>{subItem.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitle}>{title}</div>
      </div>

      <nav className={styles.sidebarNav}>
        {navItems.map(renderNavItem)}
        {children}
      </nav>

      <div className={styles.sidebarFooter}>
        {footerContent ? (
          footerContent
        ) : (
          <>
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
            {onLogout && (
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
