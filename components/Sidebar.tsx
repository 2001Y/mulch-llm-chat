"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { navigateWithTransition } from "@/utils/navigation";
import { storage } from "hooks/useLocalStorage";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import ChatList from "./ChatList";
import { useChats } from "hooks/useLocalStorage";
import Logo from "./Logo";
import SettingButton from "./SettingButton";

function AuthButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { handleOpenModal } = useChatLogicContext();

  const handleLogin = () => {
    window.open(
      "https://openrouter.ai/auth?callback_url=" +
        encodeURIComponent(window.location.origin + "/api/auth/callback"),
      "_blank",
      "width=500,height=600"
    );
  };

  if (!mounted) {
    return null;
  }

  const isLoggedIn = !!storage.getAccessToken();

  return isLoggedIn ? (
    <>
      {handleOpenModal && (
        <SettingButton onClick={handleOpenModal} variant="sidebar" />
      )}
    </>
  ) : (
    <button onClick={handleLogin} className="sidebar-login-button">
      Login with OpenRouter
    </button>
  );
}

function FreeVersionBadge() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return !storage.getAccessToken() ? (
    <div className="sidebar-free-version">Free Version</div>
  ) : null;
}

export default function Sidebar() {
  const router = useRouter();

  const { chatIds } = useChats();
  const hasChats = chatIds.length > 0;

  const handleNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    navigateWithTransition(router, href);
  };

  return (
    <aside className="sidebar">
      {/* サイドバーヘッダー */}
      <div className="sidebar-header">
        <Logo onClick={(e) => handleNavigation(e, "/")} variant="sidebar" />
        <div className="sidebar-actions">
          <AuthButton />
        </div>
        <FreeVersionBadge />
      </div>

      {/* チャット一覧 */}
      <div className="sidebar-content">
        {hasChats && (
          <Suspense fallback={<div>Loading chats...</div>}>
            <ChatList />
          </Suspense>
        )}
      </div>
    </aside>
  );
}
