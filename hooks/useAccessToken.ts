"use client";
import { useState, useEffect } from "react";
import useStorageState from "./useLocalStorage";

export default function useAccessToken() {
  const [accessToken, setAccessToken] = useStorageState("accessToken");
  const [previousAccessToken, setPreviousAccessToken] = useState(accessToken);

  useEffect(() => {
    if (accessToken !== previousAccessToken) {
      setPreviousAccessToken(accessToken);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tokenChange", { detail: { accessToken } })
        );
        console.log("[useAccessToken] Dispatched tokenChange event.");
      }
    }
  }, [accessToken, previousAccessToken]);

  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (typeof window === "undefined") {
      return; // Skip on server-side rendering
    }

    const fetchAccessToken = async (code: string) => {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
        if (!response.ok) {
          throw new Error(`🚨 HTTPエラー! ステータス: ${response.status}`);
        }
        const data = await response.json();
        setAccessToken(data.key);

        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState({}, document.title, url.toString());
      } catch (error) {
        console.error("🔑 アクセストークンの取得エラー:", error);
        if (error instanceof Error) {
          alert(`🚫 アクセストークンの取得に失敗しました: ${error.message}`);
        } else {
          alert("🚫 アクセストークンの取得に失敗しました: 不明なエラー");
        }
      }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const ssnb = urlParams.get("ssnb");

    if (code && !accessToken) {
      fetchAccessToken(code);
    }

    const isVercelPreview = window.location.hostname.includes("vercel.app");

    if (ssnb || isDevelopment || isVercelPreview) {
      const newAccessToken = process.env.NEXT_PUBLIC_SSNB;
      if (typeof newAccessToken === "string") {
        setAccessToken(newAccessToken);
      }
    }
  }, [accessToken, setAccessToken]);

  return [accessToken, setAccessToken, previousAccessToken] as const;
}
