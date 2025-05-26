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
  count: number;
  models: string[];
}

export default function ModelModal({ isOpen, onClose }: ModelModalProps) {
  const { models, updateModels, AllModels } = useChatLogicContext();
  const { myModels, updateMyModels, addToMyModels, removeFromMyModels } =
    useMyModels();
  const [searchInput, setSearchInput] = useState<string>("");
  const [filteredModels, setFilteredModels] = useState<OpenRouterModel[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [isFocused, setIsFocused] = useState(false); // キーボード操作の有効化に使用
  const [activeTab, setActiveTab] = useState<string>("models"); // "models" or category name
  const [categories, setCategories] = useState<Record<string, ModelCategory>>(
    {}
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // カテゴリ情報を取得
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/defaults");
        const data = await response.json();
        if (data.categories) {
          setCategories(data.categories);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };

    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  // 選択されたモデルのIDセット（メモ化して無限ループを防ぐ）
  const selectedModelIds = useMemo(() => {
    return new Set(models?.map((m) => m.id) || []);
  }, [models]);

  // Myモデルの選択されたIDセット
  const mySelectedModelIds = useMemo(() => {
    return new Set(myModels?.map((m) => m.id) || []);
  }, [myModels]);

  // カテゴリプリセットを送信用モデルに適用する関数
  const applyCategoryToSendingModels = useCallback(
    async (categoryKey: string) => {
      const category = categories[categoryKey];
      if (!category) return;

      try {
        // AllModelsから該当するモデルを検索
        const categoryModels: ModelItem[] = [];

        for (const modelId of category.models) {
          const foundModel = AllModels?.find((m) => m.id === modelId);
          if (foundModel) {
            categoryModels.push({
              id: foundModel.id,
              name: foundModel.name,
              selected: true,
            });
          } else {
            // AllModelsにない場合はIDから名前を生成
            categoryModels.push({
              id: modelId,
              name: modelId.split("/").pop() || modelId,
              selected: true,
            });
          }
        }

        // 送信用モデルリストを更新（既存のモデルをリセット）
        updateModels(categoryModels);

        console.log(
          `Applied category "${category.name}" with ${categoryModels.length} models to sending models`
        );
      } catch (error) {
        console.error("Failed to apply category:", error);
      }
    },
    [categories, AllModels, updateModels]
  );

  // 検索とフィルタリング
  useEffect(() => {
    if (activeTab !== "models" || !AllModels) {
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

    // Myモデルの選択されたモデルを上部に移動
    const selectedModels = filtered.filter((model) =>
      mySelectedModelIds.has(model.id)
    );
    const unselectedModels = filtered.filter(
      (model) => !mySelectedModelIds.has(model.id)
    );

    setFilteredModels([...selectedModels, ...unselectedModels]);
    setHighlightedIndex(-1);
  }, [searchInput, AllModels, mySelectedModelIds, activeTab]);

  // キーボード操作の処理
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (activeTab !== "models" || !filteredModels.length) return;

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
    [filteredModels, highlightedIndex, activeTab]
  );

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

  // Myモデルの選択/選択解除
  const handleToggleMyModel = useCallback(
    (model: OpenRouterModel) => {
      const isSelected = mySelectedModelIds.has(model.id);

      if (isSelected) {
        // 選択解除
        removeFromMyModels(model.id);
      } else {
        // 選択
        const newModel: ModelItem = {
          id: model.id,
          name: model.name,
          selected: true,
        };
        addToMyModels(newModel);
        // モデル選択時に検索入力をクリア
        setSearchInput("");
      }
    },
    [mySelectedModelIds, addToMyModels, removeFromMyModels]
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
    if (isOpen && searchInputRef.current && activeTab === "models") {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, activeTab]);

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

  // Myモデルを直接削除する関数
  const handleDeleteMyModel = useCallback(
    (modelId: string) => {
      removeFromMyModels(modelId);
    },
    [removeFromMyModels]
  );

  // タブ設定
  const tabs = useMemo(() => {
    const baseTabs = [
      {
        key: "models",
        label: "My モデル",
        count: myModels?.length || 0,
      },
    ];

    const categoryTabs = Object.entries(categories).map(([key, category]) => ({
      key,
      label: category.name,
      count: category.count,
      onClick: () => {
        applyCategoryToSendingModels(key); // シングルクリックで送信用モデルに適用
        onClose(); // モーダルを閉じる
      },
      onDoubleClick: () => setActiveTab(key), // ダブルクリックでタブ切り替え
    }));

    return [...baseTabs, ...categoryTabs];
  }, [myModels, categories, applyCategoryToSendingModels]);

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
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* モデル選択タブ */}
        {activeTab === "models" && (
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

            {/* 検索結果・全モデルリスト - 常時表示 */}
            <ModelList
              models={filteredModels}
              selectedModelIds={mySelectedModelIds}
              highlightedIndex={highlightedIndex}
              onToggleModel={handleToggleMyModel}
              onDeleteModel={handleDeleteMyModel}
              searchInput={searchInput}
              listRef={listRef}
            />
          </div>
        )}

        {/* カテゴリタブ */}
        {activeTab !== "models" && categories[activeTab] && (
          <div className="category-content">
            <div className="category-info">
              <h3>{categories[activeTab].name}</h3>
              <p>{categories[activeTab].description}</p>
            </div>

            <div className="category-models">
              <h4>含まれるモデル ({categories[activeTab].count}個)</h4>
              <ul className="category-model-list">
                {categories[activeTab].models.map((modelId) => {
                  const model = AllModels?.find((m) => m.id === modelId);
                  const displayName =
                    model?.name || modelId.split("/").pop() || modelId;

                  return (
                    <li key={modelId} className="category-model-item">
                      <span className="model-name">{displayName}</span>
                      <span className="model-id">{modelId}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
