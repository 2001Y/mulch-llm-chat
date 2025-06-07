import { useMemo } from "react";
import type { ModelItem } from "./useChatLogic";

interface ModelCategory {
  name: string;
  description: string;
  count: number;
  models: string[];
}

interface UseModelTabsProps {
  categories: Record<string, ModelCategory>;
  activeCategory: string;
  models: ModelItem[];
  getValidCategoryModelCount: (categoryKey: string) => number;
}

export function useModelTabs({
  categories,
  activeCategory,
  models,
  getValidCategoryModelCount,
}: UseModelTabsProps) {
  const tabs = useMemo(() => {
    // 既定カテゴリを処理
    const allTabs = Object.entries(categories)
      .filter(([key]) => key !== "カスタム") // カスタムカテゴリは除外
      .map(([key, category]) => ({
        key,
        label: category.name,
        count: getValidCategoryModelCount(key),
      }));

    // カスタムカテゴリを動的に追加（条件: アクティブまたはモデル数が0より大きい）
    const customCount = models?.filter((m) => m.selected).length || 0;
    const shouldShowCustom =
      activeCategory === "カスタム" ||
      (activeCategory && !categories[activeCategory] && customCount > 0) ||
      (categories[activeCategory] &&
        getValidCategoryModelCount(activeCategory) !== customCount);

    if (shouldShowCustom) {
      allTabs.push({
        key: "カスタム",
        label: "カスタム",
        count: customCount,
      });
    }

    return allTabs;
  }, [categories, activeCategory, models, getValidCategoryModelCount]);

  return tabs;
}
