"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import defaultValues from "../config/localStorage.json";

// アクセストークンの状態を取得する関数
const getAccessToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
};

// キーを生成する関数
const generateStorageKey = (baseKey: string) => {
  // デフォルト値を確認して、login/noLoginの切り替えが必要かどうかを判断
  const defaultValue = (defaultValues as any)[baseKey];
  const requiresLoginState =
    defaultValue &&
    typeof defaultValue === "object" &&
    "login" in defaultValue &&
    "noLogin" in defaultValue;

  if (!requiresLoginState) return baseKey;

  const hasToken = !!getAccessToken();
  return `${baseKey}_${hasToken ? "login" : "noLogin"}`;
};

// データを取得する関数
const getStorageData = (baseKey: string) => {
  const storageKey = generateStorageKey(baseKey);
  const item = localStorage.getItem(storageKey);

  if (item) {
    const parsedItem = JSON.parse(item);
    const defaultValue = (defaultValues as any)[baseKey];

    // login/noLoginの切り替えが必要な場合のみ、状態に応じた値を返す
    if (
      defaultValue &&
      typeof defaultValue === "object" &&
      "login" in defaultValue &&
      "noLogin" in defaultValue
    ) {
      return !!getAccessToken() ? defaultValue.login : defaultValue.noLogin;
    }

    return parsedItem;
  }
  return null;
};

interface StorageState {
  accessToken: string;
  tools: any[];
  models: string[];
  toolFunctions: Record<string, (args: any) => any>;
  chats: string[];
  [key: `chatMessages_${string}`]: any[];
}

export default function useStorageState<K extends keyof StorageState>(
  key: K
): [StorageState[K], (value: StorageState[K]) => void] {
  const [storedValue, setStoredValue] = useState<StorageState[K]>(() => {
    // サーバーサイドでもクライアントサイドと同じロジックを使用
    const defaultValue = (defaultValues as any)[key];

    if (
      defaultValue &&
      typeof defaultValue === "object" &&
      "login" in defaultValue &&
      "noLogin" in defaultValue
    ) {
      // サーバーサイドではデフォルトでnoLoginの値を使用
      return defaultValue.noLogin;
    }

    return defaultValue;
  });

  const isInitialized = useRef(false);

  // クライアントサイドでの初期化
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const data = getStorageData(key as string);
      if (data !== null) {
        setStoredValue(data);
      }
    } catch (error) {
      console.error(`🚨 [useLocalStorage] 初期化エラー:`, error);
    }
  }, [key]);

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }

    try {
      if (typeof window !== "undefined") {
        const storageKey = generateStorageKey(key as string);
        if (storedValue === undefined || storedValue === null) {
          localStorage.removeItem(storageKey);
          console.log(
            `🗑️ [useLocalStorage] キー "${storageKey}" を削除しました`
          );
        } else {
          localStorage.setItem(storageKey, JSON.stringify(storedValue));
          console.log(
            `📝 [useLocalStorage] キー "${storageKey}" の値を保存しました:`,
            storedValue
          );
        }
      }
    } catch (error) {
      console.error(
        `🚨 [useLocalStorage] ローカルストレージへの書き込みエラー:`,
        error
      );
    }
  }, [key, storedValue]);

  // アクセストークンの変更を監視
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "accessToken") {
        // アクセストークンが変更された場合、値を再読み込み
        const data = getStorageData(key as string);
        if (data !== null) {
          setStoredValue(data);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key]);

  const setValue = useCallback(
    (value: StorageState[K]) => {
      const storageKey = generateStorageKey(key as string);
      const defaultValue = (defaultValues as any)[key];
      const requiresLoginState =
        defaultValue &&
        typeof defaultValue === "object" &&
        "login" in defaultValue &&
        "noLogin" in defaultValue;

      setStoredValue(value);

      if (value === undefined || value === null) {
        localStorage.removeItem(storageKey);
      } else {
        // login/noLoginの切り替えが必要な場合のみ、現在の状態を維持
        if (requiresLoginState) {
          const currentValue = localStorage.getItem(storageKey);
          const parsedCurrentValue = currentValue
            ? JSON.parse(currentValue)
            : {};
          const newValue = {
            ...parsedCurrentValue,
            [!!getAccessToken() ? "login" : "noLogin"]: value,
          };
          localStorage.setItem(storageKey, JSON.stringify(newValue));
        } else {
          localStorage.setItem(storageKey, JSON.stringify(value));
        }
      }
    },
    [key]
  );

  return [storedValue, setValue];
}

export function useChats() {
  const [chatIds, setChatIds] = useState<string[]>([]);

  const loadChats = useCallback(() => {
    const ids = Object.keys(localStorage)
      .filter(
        (key) =>
          key.startsWith("chatMessages_") && key !== "chatMessages_default"
      )
      .map((key) => key.replace("chatMessages_", ""));
    setChatIds(ids);
    return ids.length > 0;
  }, []);

  useEffect(() => {
    loadChats();

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("chatMessages_")) {
        loadChats();
      }
    };

    const handleChatListUpdate = () => {
      loadChats();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("chatListUpdate", handleChatListUpdate);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("chatListUpdate", handleChatListUpdate);
    };
  }, [loadChats]);

  return {
    chatIds,
    hasChats: chatIds.length > 0,
    loadChats,
  };
}
