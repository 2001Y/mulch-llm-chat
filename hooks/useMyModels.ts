import { useState, useEffect, useCallback } from "react";
import type { ModelItem } from "./useChatLogic";

const MY_MODELS_STORAGE_KEY = "my-models";

export function useMyModels() {
  const [myModels, setMyModels] = useState<ModelItem[]>([]);

  // ローカルストレージからMyモデルを読み込み
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MY_MODELS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setMyModels(parsed);
      }
    } catch (error) {
      console.error("Failed to load my models from localStorage:", error);
    }
  }, []);

  // Myモデルをローカルストレージに保存
  const saveMyModels = useCallback((models: ModelItem[]) => {
    try {
      localStorage.setItem(MY_MODELS_STORAGE_KEY, JSON.stringify(models));
      setMyModels(models);
    } catch (error) {
      console.error("Failed to save my models to localStorage:", error);
    }
  }, []);

  // Myモデルを更新
  const updateMyModels = useCallback(
    (models: ModelItem[]) => {
      saveMyModels(models);
    },
    [saveMyModels]
  );

  // Myモデルにモデルを追加
  const addToMyModels = useCallback(
    (model: ModelItem) => {
      setMyModels((prev) => {
        const exists = prev.some((m) => m.id === model.id);
        if (exists) return prev;

        const newModels = [...prev, model];
        saveMyModels(newModels);
        return newModels;
      });
    },
    [saveMyModels]
  );

  // Myモデルからモデルを削除
  const removeFromMyModels = useCallback(
    (modelId: string) => {
      setMyModels((prev) => {
        const newModels = prev.filter((m) => m.id !== modelId);
        saveMyModels(newModels);
        return newModels;
      });
    },
    [saveMyModels]
  );

  return {
    myModels,
    updateMyModels,
    addToMyModels,
    removeFromMyModels,
  };
}
