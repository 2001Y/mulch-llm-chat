"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { navigateWithTransition } from "@/utils/navigation";
import { storage } from "hooks/useLocalStorage";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import ChatList from "../components/ChatList";

function AuthButton() {
  const [mounted, setMounted] = useState(false);
  const context = useChatLogicContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const handleOpenModal = context?.handleOpenModal;
  const isLoggedIn = !!storage.getAccessToken();

  const handleLogin = () => {
    const isProduction = process.env.NODE_ENV === "production";
    const redirectUri = isProduction
      ? "https://mulch-llm-chat.vercel.app"
      : "https://3000.2001y.dev";
    const openRouterAuthUrl = `https://openrouter.ai/auth?callback_url=${redirectUri}`;
    const width = 800;
    const height = 600;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(
      openRouterAuthUrl,
      "_blank",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
  };

  return isLoggedIn ? (
    <>
      {handleOpenModal && (
        <button
          onClick={() => {
            if (handleOpenModal) {
              handleOpenModal();
            }
          }}
          className="sidebar-setting-button"
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
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
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
  const [hasChats, setHasChats] = useState(false);

  const handleNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    navigateWithTransition(router, href);
  };

  useEffect(() => {
    const checkActualChats = () => {
      const chatKeys = Object.keys(localStorage).filter(
        (key) =>
          key.startsWith("chatMessages_") &&
          key !== "chatMessages_default" &&
          (() => {
            const chatData = storage.get(key);
            if (!chatData || !Array.isArray(chatData)) return false;

            // ConversationTurn形式のデータを確認
            return chatData.some((turn: any) => {
              return (
                turn &&
                turn.userMessage &&
                typeof turn.userMessage.content === "string" &&
                turn.userMessage.content.trim() !== ""
              );
            });
          })()
      );
      setHasChats(chatKeys.length > 0);
      console.log("[Sidebar] Found chat keys:", chatKeys);
    };

    checkActualChats();
    window.addEventListener("storage", (e) => {
      if (e.key?.startsWith("chatMessages_")) {
        checkActualChats();
      }
    });
    window.addEventListener("chatListUpdate", checkActualChats);

    return () => {
      window.removeEventListener("storage", checkActualChats);
      window.removeEventListener("chatListUpdate", checkActualChats);
    };
  }, []);

  return (
    <aside className="sidebar">
      {/* サイドバーヘッダー */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Link href="/" onClick={(e) => handleNavigation(e, "/")}>
            <Image
              src="/logo.png"
              width={40}
              height={40}
              alt="Logo"
              className="logo-img"
            />
            <h1>
              Multi AI Chat
              <br />
              <small>OpenRouter Chat Client</small>
            </h1>
          </Link>
        </div>
        <div className="sidebar-actions">
          <AuthButton />
        </div>
        <FreeVersionBadge />
      </div>

      {/* チャット一覧 */}
      <div className="sidebar-content">{hasChats && <ChatList />}</div>
    </aside>
  );
}
