"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { navigateWithTransition } from "@/utils/navigation";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import Logo from "./Logo";
import SettingButton from "./SettingButton";
import ChatItemContent from "./ChatItemContent";

interface MainHeaderProps {
  onShare?: () => void;
}

export default function MainHeader({ onShare }: MainHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { handleOpenModal, openRouterApiKey, getCurrentChatInfo } =
    useChatLogicContext();

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

  const isHomePage = pathname === "/";
  const currentChatInfo = getCurrentChatInfo();

  return (
    <div className="main-header">
      <div className="main-header-left">
        {isHomePage ? (
          // トップページではロゴを表示（スマホでのみ表示されるため、PCでは見えない）
          <Logo onClick={(e) => handleNavigation(e, "/")} variant="header" />
        ) : (
          // 個別ページでは現在のチャット情報または戻るボタンを表示
          <>
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
            {currentChatInfo && (
              <div className="main-header-chat-info">
                <ChatItemContent
                  firstMessage={currentChatInfo.firstMessage}
                  timestamp={currentChatInfo.timestamp}
                  title={currentChatInfo.title}
                  variant="header"
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="main-header-center"></div>

      <div className="main-header-right">
        {isHomePage ? (
          // トップページでは設定ボタンを表示
          <SettingButton onClick={handleOpenModal} variant="header" />
        ) : (
          // 個別ページでは共有ボタンを表示
          <button
            className="main-header-share-button"
            onClick={handleShareClick}
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
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <span>Share</span>
          </button>
        )}
      </div>
    </div>
  );
}
