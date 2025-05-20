"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import defaultValues from "../config/localStorage.json";
import type { Message, ModelItem } from "hooks/useChatLogic";

// ストレージユーティリティ関数
export const storage = {
  get: (key: string) => {
    if (typeof window === "undefined") return null;
    const item = localStorage.getItem(key);
    if (
      !item ||
      item === '""' ||
      item === "null" ||
      item === "undefined" ||
      item === ""
    ) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(item);
      if (
        parsed === null ||
        parsed === "" ||
        parsed === undefined ||
        (Array.isArray(parsed) && parsed.length === 0) ||
        (typeof parsed === "object" && Object.keys(parsed).length === 0)
      ) {
        return undefined;
      }
      return parsed;
    } catch (error) {
      console.error(`Failed to parse stored data for ${key}:`, error);
      return undefined;
    }
  },

  set: (key: string, value: any) => {
    if (typeof window === "undefined") return;
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "object" && Object.keys(value).length === 0)
    ) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove: (key: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  },

  getAccessToken: () => {
    if (typeof window === "undefined") return null;
    const token = storage.get("accessToken");
    return token && token !== "" ? token : null;
  },

  getGistToken: () => {
    if (typeof window === "undefined") return null;
    const token = storage.get("gistToken");
    return token && token !== "" ? token : null;
  },
};

// アクセストークンの状態を取得する関数
const getAccessToken = () => storage.getAccessToken();

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

export interface StorageState {
  accessToken: string;
  tools: any[];
  models: ModelItem[];
  toolFunctions: Record<string, (args: any) => any>;
  chats: string[];
  [key: `chatMessages_${string}`]: Message[] | undefined;
}

export default function useStorageState<V = any>(
  key: string | undefined
): [V | undefined, (value: V | undefined) => void] {
  const [storedValue, setStoredValue] = useState<V | undefined>(() => {
    if (typeof window === "undefined" || key === undefined) {
      return (defaultValues as any)[key || ""] || undefined;
    }
    const storedData = storage.get(key);
    return storedData !== undefined
      ? storedData
      : (defaultValues as any)[key] || undefined;
  });

  useEffect(() => {
    if (typeof window === "undefined" || key === undefined) return;

    if (key === "models") {
      const hasToken = !!getAccessToken();
      const storageKey = `${key}_${hasToken ? "login" : "noLogin"}`;
      const data = storage.get(storageKey);
      setStoredValue(data);

      const handleTokenChange = () => {
        const newHasToken = !!getAccessToken();
        const newStorageKey = `${key}_${newHasToken ? "login" : "noLogin"}`;
        const newData = storage.get(newStorageKey);
        setStoredValue(newData);
      };

      window.addEventListener("storage", (e) => {
        if (e.key === "accessToken") {
          handleTokenChange();
        }
      });
      window.addEventListener("tokenChange", handleTokenChange);

      return () => {
        window.removeEventListener("storage", handleTokenChange);
        window.removeEventListener("tokenChange", handleTokenChange);
      };
    } else {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key) {
          const newValue = e.newValue ? JSON.parse(e.newValue) : undefined;
          setStoredValue(newValue);
        }
      };

      window.addEventListener("storage", handleStorageChange);
      return () => {
        window.removeEventListener("storage", handleStorageChange);
      };
    }
  }, [key]);

  const setValue = useCallback(
    (value: V | undefined) => {
      if (typeof window === "undefined" || key === undefined) return;

      if (value === undefined) {
        storage.remove(key as string);
        setStoredValue(undefined);
        return;
      }
      setStoredValue(value);
      storage.set(key as string, value);
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
