import React from "react";

interface TabItem {
  key: string;
  label: string;
  count?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
  className?: string;
}

export default function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: TabNavigationProps) {
  return (
    <div className={`tab-navigation ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tab-button ${activeTab === tab.key ? "active" : ""}`}
          onClick={() => {
            if (tab.onClick) {
              tab.onClick();
            } else {
              onTabChange(tab.key);
            }
          }}
          onDoubleClick={() => {
            if (tab.onDoubleClick) {
              tab.onDoubleClick();
            }
          }}
        >
          {tab.label}
          {tab.count !== undefined && ` (${tab.count})`}
        </button>
      ))}
    </div>
  );
}
