import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import BaseModal from "./BaseModal";
import ModelList from "./shared/ModelList";
import TabNavigation from "./shared/TabNavigation";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import { useMyModels } from "hooks/useMyModels";
import { useModelTabs } from "hooks/useModelTabs";
import type { ModelItem } from "hooks/useChatLogic";

interface ModelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
}

interface ModelCategory {
  name: string;
  description: string;
  models: string[];
}

export default function ModelModal({ isOpen, onClose }: ModelModalProps) {
  const {
    models,
    updateModels,
    AllModels,
    categories,
    activeCategory,
    applyCategoryToModels,
    getCurrentMatchingCategory,
    getValidCategoryModelCount,
    customCategoryModels,
    getSelectedModelIds,
  } = useChatLogicContext();
  const { myModels } = useMyModels();
  const [searchInput, setSearchInput] = useState<string>("");
  const [filteredModels, setFilteredModels] = useState<OpenRouterModel[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isFocused, setIsFocused] = useState(false); // キーボード操作の有効化に使用

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // 選択されたモデルのIDセット（メモ化して無限ループを防ぐ）
  const selectedModelIds = useMemo(() => {
    return new Set(models?.map((m) => m.id) || []);
  }, [models]);

  // 検索とフィルタリング
  useEffect(() => {
    if (!AllModels) {
      setFilteredModels([]);
      return;
    }

    // AllModelsの重複チェック
    const duplicateIds = AllModels.filter(
      (model, index, self) => self.findIndex((m) => m.id === model.id) !== index
    );

    if (duplicateIds.length > 0) {
      console.warn(
        "[ModelModal] Found duplicate IDs in AllModels:",
        duplicateIds
      );
    }

    let filtered: OpenRouterModel[] = [];

    // 検索フィルタリング（重複を排除）
    if (searchInput.trim() === "") {
      // 未入力時は全てのモデルを表示（重複を排除）
      filtered = AllModels.filter(
        (model, index, self) =>
          index === self.findIndex((m) => m.id === model.id)
      );
    } else {
      // 入力がある場合はフィルタリング（重複を排除）
      const query = searchInput.toLowerCase();
      filtered = AllModels.filter((model, index, self) => {
        const isUnique = index === self.findIndex((m) => m.id === model.id);
        if (!isUnique) return false;

        const modelName = model.name.toLowerCase();
        const modelId = model.id.toLowerCase();
        const shortId = model.id.split("/").pop()?.toLowerCase() || "";

        return (
          modelName.includes(query) ||
          modelId.includes(query) ||
          shortId.includes(query)
        );
      });
    }

    // 送信用モデルの選択されたモデルを上部に移動
    const selectedModels = filtered.filter((model) =>
      selectedModelIds.has(model.id)
    );
    const unselectedModels = filtered.filter(
      (model) => !selectedModelIds.has(model.id)
    );

    setFilteredModels([...selectedModels, ...unselectedModels]);
    setHighlightedIndex(-1);
  }, [searchInput, AllModels, selectedModelIds]);

  // モデルの選択/選択解除（送信用モデル）
  const handleToggleModel = useCallback(
    (model: OpenRouterModel) => {
      const currentModels = models || [];
      const isSelected = currentModels.some((m) => m.id === model.id);

      if (isSelected) {
        // 選択解除
        const updatedModels = currentModels.filter((m) => m.id !== model.id);
        updateModels(updatedModels);
      } else {
        // 選択
        const newModel: ModelItem = {
          id: model.id,
          name: model.name,
          selected: true,
        };
        updateModels([...currentModels, newModel]);
        // モデル選択時に検索入力をクリア
        setSearchInput("");
      }
    },
    [models, updateModels]
  );

  // キーボード操作の処理
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!filteredModels.length) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredModels.length - 1 ? prev + 1 : 0
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredModels.length - 1
          );
          break;

        case "Enter":
          e.preventDefault();
          if (
            highlightedIndex >= 0 &&
            highlightedIndex < filteredModels.length
          ) {
            handleToggleModel(filteredModels[highlightedIndex]);
          }
          break;

        case "Escape":
          e.preventDefault();
          setSearchInput("");
          setHighlightedIndex(-1);
          break;
      }
    },
    [filteredModels, highlightedIndex, handleToggleModel]
  );

  // ハイライトされた項目をスクロール表示
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [highlightedIndex]);

  // モーダルが開いたときにフォーカス
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, activeCategory]);

  // 選択されたモデルを直接削除する関数（送信用モデル）
  const handleDeleteModel = useCallback(
    (modelId: string) => {
      const updatedModels = models.filter(
        (model: ModelItem) => model.id !== modelId
      );
      updateModels(updatedModels);
    },
    [models, updateModels]
  );

  // タブ設定（共通フックを使用）
  const tabs = useModelTabs({
    categories,
    activeCategory,
    models: models || [],
    getValidCategoryModelCount,
    customCategoryModels,
    AllModels,
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="モデル管理"
      className="model-modal"
    >
      <div className="model-modal-content">
        {/* タブナビゲーション */}
        <TabNavigation
          tabs={tabs}
          activeTab={activeCategory}
          onTabChange={applyCategoryToModels}
        />

        {/* 共通の検索・モデル選択エリア */}
        <div className="model-search-area">
          <div className="search-input-container">
            <input
              ref={searchInputRef}
              type="text"
              className="model-search-input"
              placeholder="🔍 モデルを検索または全て表示"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* 検索結果・モデルリスト - 常時表示 */}
          <ModelList
            models={filteredModels}
            selectedModelIds={selectedModelIds}
            highlightedIndex={highlightedIndex}
            onToggleModel={handleToggleModel}
            onDeleteModel={handleDeleteModel}
            searchInput={searchInput}
            listRef={listRef}
          />
        </div>
      </div>
    </BaseModal>
  );
}
