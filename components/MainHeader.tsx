"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { navigateWithTransition } from "@/utils/navigation";
import { useChatLogicContext } from "contexts/ChatLogicContext";

interface MainHeaderProps {
  onShare?: () => void;
}

export default function MainHeader({ onShare }: MainHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showBackButton, setShowBackButton] = useState(false);

  const { models, handleOpenModelModal } = useChatLogicContext();

  useEffect(() => {
    setShowBackButton(pathname !== "/" && window.innerWidth <= 768);
  }, [pathname]);

  const handleNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    navigateWithTransition(router, href);
  };

  const handleShareClick = () => {
    if (onShare) {
      onShare();
    } else {
      // デフォルトの共有機能
      console.log("Share button clicked");
    }
  };

  // 選択されているモデルの数を取得
  const selectedModelsCount =
    models?.filter((model) => model.selected).length || 0;

  return (
    <div className="main-header">
      <div className="main-header-left">
        {showBackButton && (
          <button
            className="main-header-back-button"
            onClick={(e) => handleNavigation(e, "/")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      <div className="main-header-center">
        <button
          className="main-header-models-button"
          onClick={handleOpenModelModal}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <circle cx="12" cy="3" r="1"></circle>
            <circle cx="12" cy="21" r="1"></circle>
            <circle cx="4.22" cy="10.22" r="1"></circle>
            <circle cx="19.78" cy="13.78" r="1"></circle>
            <circle cx="4.22" cy="13.78" r="1"></circle>
            <circle cx="19.78" cy="10.22" r="1"></circle>
          </svg>
          <span className="models-count">
            {selectedModelsCount} Model{selectedModelsCount !== 1 ? "s" : ""}
          </span>
        </button>
      </div>

      <div className="main-header-right">
        <button className="main-header-share-button" onClick={handleShareClick}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <span>Share</span>
        </button>
      </div>
    </div>
  );
}
