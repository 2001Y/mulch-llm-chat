import { useMemo } from "react";
import type { ModelItem } from "./useChatLogic";

interface ModelCategory {
  name: string;
  description: string;
  models: string[];
}

interface UseModelTabsProps {
  categories: Record<string, ModelCategory>;
  activeCategory: string;
  models: ModelItem[];
  getValidCategoryModelCount: (categoryKey: string) => number;
  customSelectedModelIds?: string[];
  AllModels?: ModelItem[];
}

export function useModelTabs({
  categories,
  activeCategory,
  models,
  getValidCategoryModelCount,
  customSelectedModelIds,
  AllModels,
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

    // カスタムカテゴリの表示判定
    let shouldShowCustom = false;
    let customCount = 0;

    if (
      customSelectedModelIds &&
      customSelectedModelIds.length > 0 &&
      AllModels
    ) {
      // AllModelsに存在するカスタムモデルIDのみをフィルタリング
      const validCustomIds = customSelectedModelIds.filter((id) =>
        AllModels.some((m) => m.id === id)
      );

      if (validCustomIds.length > 0) {
        // 有効なカスタムモデルIDをソート
        const sortedCustomIds = [...validCustomIds].sort();

        // デフォルトカテゴリと比較して、同じ内容でないことを確認
        let isUniqueCustom = true;
        for (const [categoryKey, category] of Object.entries(categories)) {
          if (categoryKey === "カスタム") continue;

          const sortedCategoryIds = [...category.models].sort();

          if (
            sortedCustomIds.length === sortedCategoryIds.length &&
            sortedCustomIds.every(
              (id, index) => id === sortedCategoryIds[index]
            )
          ) {
            isUniqueCustom = false;
            break;
          }
        }

        // ユニークなカスタム選択の場合のみ表示
        if (isUniqueCustom) {
          shouldShowCustom = true;
          customCount = validCustomIds.length;
        }
      }
    }

    // アクティブカテゴリがカスタムの場合は常に表示
    if (activeCategory === "カスタム") {
      shouldShowCustom = true;
      customCount = models?.filter((m) => m.selected).length || 0;
    }

    if (shouldShowCustom) {
      allTabs.unshift({
        key: "カスタム",
        label: "カスタム",
        count: customCount,
      });
    }

    return allTabs;
  }, [
    categories,
    activeCategory,
    models,
    getValidCategoryModelCount,
    customSelectedModelIds,
    AllModels,
  ]);

  return tabs;
}
