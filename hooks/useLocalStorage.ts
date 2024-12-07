"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export function useStorageState<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      if (typeof window !== "undefined") {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsedItem = JSON.parse(item);
            setStoredValue(parsedItem);
            console.log(
              `💾 [useLocalStorage] キー "${key}" の値を読み込みました:`,
              parsedItem
            );
          } else {
            // 初期値は状態としてのみ保持し、ストレージには保存しない
            setStoredValue(initialValue);
            console.log(
              `ℹ️ [useLocalStorage] キー "${key}" の初期値を状態として設定:`,
              initialValue
            );
          }
        } catch (error) {
          console.error(
            `🚨 [useLocalStorage] ローカルストレージの操作エラー:`,
            error
          );
        } finally {
          setIsLoaded(true);
        }
      }
      isInitialized.current = true;
    }
  }, [key, initialValue]);

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== "undefined") {
        // 空の配列または空の文字列の場合は項目を削除
        if (
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === "string" && value === "") ||
          value === null ||
          value === undefined
        ) {
          localStorage.removeItem(key);
          console.log(`🗑️ [useLocalStorage] キー "${key}" を削除しました`);
        } else {
          localStorage.setItem(key, JSON.stringify(value));
          console.log(
            `📝 [useLocalStorage] キー "${key}" の値を保存しました:`,
            value
          );
        }
      }
    } catch (error) {
      console.error(
        `🚨 [useLocalStorage] ローカルストレージへの書き込みエラー:`,
        error
      );
    }
  };

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

export default useStorageState;
