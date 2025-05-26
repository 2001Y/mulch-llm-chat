import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import BaseModal from "./BaseModal";
import { useChatLogicContext } from "contexts/ChatLogicContext";
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

// コンテキスト長を簡潔に表示するヘルパー関数
const formatContextLength = (contextLength?: number): string => {
  if (!contextLength || contextLength === 0) return "";

  if (contextLength >= 1000000) {
    return `${(contextLength / 1000000).toFixed(1)}M`;
  } else if (contextLength >= 1000) {
    return `${(contextLength / 1000).toFixed(0)}K`;
  } else {
    return `${contextLength}`;
  }
};

export default function ModelModal({ isOpen, onClose }: ModelModalProps) {
  const { models, updateModels, AllModels } = useChatLogicContext();
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

    // 選択されたモデルを上部に移動
    const selectedModels = filtered.filter((model) =>
      selectedModelIds.has(model.id)
    );
    const unselectedModels = filtered.filter(
      (model) => !selectedModelIds.has(model.id)
    );

    setFilteredModels([...selectedModels, ...unselectedModels]);
    setHighlightedIndex(-1);
  }, [searchInput, AllModels, selectedModelIds]);

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
    [filteredModels, highlightedIndex]
  );

  // モデルの選択/選択解除
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
  }, [isOpen]);

  // 選択されたモデルを直接削除する関数
  const handleDeleteModel = useCallback(
    (modelId: string) => {
      const updatedModels = models.filter(
        (model: ModelItem) => model.id !== modelId
      );
      updateModels(updatedModels);
    },
    [models, updateModels]
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="モデル管理"
      className="model-modal"
    >
      <div className="model-modal-content">
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
          <div className="model-search-results">
            <ul ref={listRef} className="model-suggestions-list">
              {filteredModels.map((model, index) => {
                const isSelected = selectedModelIds.has(model.id);
                const isHighlighted = index === highlightedIndex;
                const contextText = formatContextLength(model.context_length);

                return (
                  <li
                    key={model.id}
                    className={`model-suggestion-item ${
                      isSelected ? "selected" : ""
                    } ${isHighlighted ? "highlighted" : ""}`}
                    onClick={() => handleToggleModel(model)}
                  >
                    <div className="model-info">
                      <span className="model-name">{model.name}</span>
                      {contextText && (
                        <span className="model-context">{contextText}</span>
                      )}
                    </div>
                    <div className="model-indicators">
                      {isSelected && <span className="checkmark">✅</span>}
                      {isSelected && (
                        <button
                          className="delete-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModel(model.id);
                          }}
                          title="削除"
                        >
                          ×
                        </button>
                      )}
                      {isHighlighted && (
                        <span className="keyboard-indicator">⌨️</span>
                      )}
                    </div>
                  </li>
                );
              })}
              {filteredModels.length === 0 && searchInput.trim() !== "" && (
                <li className="no-results">該当するモデルが見つかりません</li>
              )}
              {filteredModels.length === 0 && searchInput.trim() === "" && (
                <li className="loading">モデルを読み込み中...</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
