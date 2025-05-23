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

    let initialValue: V | undefined;
    if (key === "models") {
      const hasToken = !!getAccessToken();
      const storageKey = `${key}_${hasToken ? "login" : "noLogin"}`;
      initialValue = storage.get(storageKey) as V | undefined;
      if (initialValue === undefined) {
        // 動的キーで取得できなかった場合、localStorage.jsonのトップレベル"models"から取得試行
        const defaultModelsObject = (defaultValues as any)[key];
        if (defaultModelsObject && typeof defaultModelsObject === "object") {
          initialValue = (
            hasToken ? defaultModelsObject.login : defaultModelsObject.noLogin
          ) as V | undefined;
        }
      }
    } else {
      initialValue = storage.get(key) as V | undefined;
    }

    return initialValue !== undefined
      ? initialValue
      : (defaultValues as any)[key] || undefined; // 通常のキーでのデフォルト値フォールバック
  });

  useEffect(() => {
    if (typeof window === "undefined" || key === undefined) return;

    // models の場合はアクセストークンの変更を監視して再読み込み
    if (key === "models") {
      const handleTokenChange = () => {
        const hasToken = !!getAccessToken();
        const storageKey = `${key}_${hasToken ? "login" : "noLogin"}`;
        let newData = storage.get(storageKey) as V | undefined;
        if (newData === undefined) {
          const defaultModelsObject = (defaultValues as any)[key];
          if (defaultModelsObject && typeof defaultModelsObject === "object") {
            newData = (
              hasToken ? defaultModelsObject.login : defaultModelsObject.noLogin
            ) as V | undefined;
          }
        }
        setStoredValue(newData);
      };

      // storageイベントは他のタブでの変更を検知するが、accessTokenの変更は別イベントで検知
      // window.addEventListener("storage", (e) => { ... });
      window.addEventListener("tokenChange", handleTokenChange); // accessToken変更時に再読み込み
      // 初期ロード時にも一度実行 (useStateの初期化後、トークン状態が確定してから)
      handleTokenChange();

      return () => {
        window.removeEventListener("tokenChange", handleTokenChange);
      };
    } else {
      // その他のキーは通常のstorageイベントを監視
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key) {
          const newValue = e.newValue ? JSON.parse(e.newValue) : undefined;
          setStoredValue(newValue as V | undefined);
        }
      };
      window.addEventListener("storage", handleStorageChange);
      return () => {
        window.removeEventListener("storage", handleStorageChange);
      };
    }
  }, [key]); // 依存配列は key のみで良い (handleTokenChangeは内部で最新のtokenを取得するため)

  const setValue = useCallback(
    (value: V | undefined) => {
      if (typeof window === "undefined" || key === undefined) return;

      let storageKeyToSet = key;
      if (key === "models") {
        const hasToken = !!getAccessToken();
        storageKeyToSet = `${key}_${hasToken ? "login" : "noLogin"}`;
      }

      if (value === undefined) {
        storage.remove(storageKeyToSet as string);
        setStoredValue(undefined);
        return;
      }
      setStoredValue(value); // コンポーネントのstateを更新
      storage.set(storageKeyToSet as string, value); // ローカルストレージを更新

      // modelsが更新されたら、useChatLogic側で再読み込みを促すイベントを発行しても良いかもしれない
      // if (key === "models") window.dispatchEvent(new Event("modelsUpdated"));
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
