"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import defaultValues from "../config/localStorage.json";

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

interface StorageState {
  accessToken: string;
  tools: any[];
  models: {
    login: Array<{ name: string; selected: boolean }>;
    noLogin: Array<{ name: string; selected: boolean }>;
  };
  toolFunctions: Record<string, (args: any) => any>;
  chats: string[];
  [key: `chatMessages_${string}`]: any[];
}

export default function useStorageState<K extends keyof StorageState>(
  key: K
): [StorageState[K], (value: StorageState[K]) => void] {
  const [storedValue, setStoredValue] = useState<StorageState[K]>(() => {
    // デフォルト値を取得
    const defaultValue = (defaultValues as any)[key];

    // クライアントサイドでない場合はデフォルト値を返す
    if (typeof window === "undefined") return defaultValue;

    // ログイン状態に依存するデータかどうかを確認
    const requiresLoginState =
      defaultValue &&
      typeof defaultValue === "object" &&
      "login" in defaultValue &&
      "noLogin" in defaultValue;

    if (requiresLoginState) {
      // ログイン状態に応じたキーを生成
      const hasToken = !!storage.getAccessToken();
      const storageKey = `${key}_${hasToken ? "login" : "noLogin"}`;

      // ストレージから値を取得
      const storedData = storage.get(storageKey);

      // ストレージに値がない場合、デフォルト値を使用
      if (!storedData) {
        const defaultStateData = defaultValue[hasToken ? "login" : "noLogin"];
        storage.set(storageKey, defaultStateData);
        return defaultValue;
      }

      return {
        login: hasToken ? storedData : defaultValue.login,
        noLogin: !hasToken ? storedData : defaultValue.noLogin,
      };
    }

    // 通常のデータの場合
    const storedData = storage.get(key as string);
    return storedData !== undefined ? storedData : defaultValue;
  });

  // クライアントサイドでの初期化とアクセストークンの監視
  useEffect(() => {
    if (typeof window === "undefined") return;

    // データを取得する関数
    const getStorageData = (baseKey: string, login: boolean) => {
      const storageKey = `${baseKey}_${login ? "login" : "noLogin"}`;
      return storage.get(storageKey);
    };

    const defaultValue = (defaultValues as any)[key];
    const requiresLoginState =
      defaultValue &&
      typeof defaultValue === "object" &&
      "login" in defaultValue &&
      "noLogin" in defaultValue;

    if (requiresLoginState) {
      // ログイン状態に応じて適切な値を設定
      const currentValue = !!getAccessToken()
        ? getStorageData(key as string, true)
        : getStorageData(key as string, false);
      setStoredValue(currentValue);

      // 現在の状態のデータを保存
      const currentStorageKey = `${key}_${
        !!getAccessToken() ? "login" : "noLogin"
      }`;
      if (!localStorage.getItem(currentStorageKey)) {
        localStorage.setItem(currentStorageKey, JSON.stringify(currentValue));
      }
    } else {
      // ログイン状態に依存しないデータの場合
      const data = getStorageData(key as string, false);
      setStoredValue(data);

      // データが存在しない場合、デフォルト値を保存
      if (!localStorage.getItem(key as string)) {
        localStorage.setItem(key as string, JSON.stringify(defaultValue));
      }
    }

    // アクセストークンの変更を監視
    const handleTokenChange = () => {
      if (requiresLoginState) {
        const loginData = getStorageData(key as string, true);
        const noLoginData = getStorageData(key as string, false);
        setStoredValue(!!getAccessToken() ? loginData : noLoginData);
      } else {
        const data = getStorageData(key as string, false);
        setStoredValue(data);
      }
    };

    // 両方のイベントをリッスン
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
  }, [key]);

  const setValue = useCallback(
    (value: StorageState[K]) => {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" && Object.keys(value).length === 0)
      ) {
        storage.remove(`${key}_login`);
        storage.remove(`${key}_noLogin`);
        storage.remove(key as string);
        setStoredValue(undefined as any);
        return;
      }

      setStoredValue(value);
      const storageKey = generateStorageKey(key as string);
      storage.set(storageKey, value);
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
