import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { navigateWithTransition } from "@/utils/navigation";
import { storage } from "hooks/useLocalStorage";
import Image from "next/image";
import { useChatLogic } from "hooks/useChatLogic";
import { useEffect, useState } from "react";
import ClientOnlyWrapper from "./ClientOnlyWrapper";

function AuthButton() {
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { handleOpenModal } = useChatLogic();

  useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!storage.getAccessToken());
  }, []);

  const handleLogout = () => {
    storage.remove("accessToken");
    setIsLoggedIn(false);
    window.dispatchEvent(new Event("tokenChange"));
  };

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

  return (
    <ClientOnlyWrapper>
      <div className="auth-button">
        {mounted && isLoggedIn ? (
          <button onClick={handleLogout}>Logout</button>
        ) : (
          <button onClick={handleLogin} className="login">
            Login with OpenRouter
          </button>
        )}
      </div>
      <div
        onClick={() => {
          console.log("[DEBUG] Settings icon clicked");
          console.log("[DEBUG] handleOpenModal:", handleOpenModal);
          handleOpenModal();
          console.log("[DEBUG] After handleOpenModal called");
        }}
        className="setting"
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
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 .33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </div>
    </ClientOnlyWrapper>
  );
}

function FreeVersionBadge() {
  const [mounted, setMounted] = useState(false);
  const [isFreeVersion, setIsFreeVersion] = useState(true);

  useEffect(() => {
    setMounted(true);
    setIsFreeVersion(!storage.getAccessToken());
  }, []);

  return (
    <ClientOnlyWrapper>
      {isFreeVersion && <div className="free-version">Free Version</div>}
    </ClientOnlyWrapper>
  );
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [showBackButton, setShowBackButton] = useState(false);

  useEffect(() => {
    setShowBackButton(pathname !== "/" && window.innerWidth <= 768);
  }, [pathname]);

  const handleNavigation = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    navigateWithTransition(router, href);
  };

  return (
    <header>
      {showBackButton && (
        <button
          className="back-button"
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
      <div className="logo">
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
      <div className="header-side">
        <AuthButton />
      </div>
      <FreeVersionBadge />
    </header>
  );
}

export const dynamic = "force-dynamic";
export const runtime = "edge";
