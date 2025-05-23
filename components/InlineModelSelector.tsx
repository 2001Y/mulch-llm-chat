import React, { useState, useRef, useEffect, useCallback } from "react";
import type { ModelItem } from "hooks/useChatLogic";

interface InlineModelSelectorProps {
  models: ModelItem[];
  allModels: ModelItem[];
  onUpdateModels: (newModels: ModelItem[]) => void;
  className?: string;
}

export default function InlineModelSelector({
  models,
  allModels,
  onUpdateModels,
  className = "",
}: InlineModelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  // 検索結果をフィルタリング
  const filteredModels = allModels.filter((model) => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase();
    return (
      model.name.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query)
    );
  });

  // 選択されているモデルの数を表示
  const selectedCount = models.filter((m) => m.selected).length;

  // モデルの選択/選択解除
  const toggleModel = useCallback(
    (targetModel: ModelItem) => {
      const updatedModels = models.map((model) =>
        model.id === targetModel.id
          ? { ...model, selected: !model.selected }
          : model
      );

      // 新しいモデルの場合は追加（nameをidと同じハイフン形式に設定）
      if (!models.find((m) => m.id === targetModel.id)) {
        updatedModels.push({
          id: targetModel.id,
          name: targetModel.id, // 表示名もIDと同じハイフン形式にする
          selected: true,
        });
      }

      onUpdateModels(updatedModels);
    },
    [models, onUpdateModels]
  );

  // キーボード操作
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isInputFocused || filteredModels.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredModels.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredModels.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < filteredModels.length) {
            toggleModel(filteredModels[selectedIndex]);
            setSearchQuery("");
            setSelectedIndex(-1);
            inputRef.current?.blur();
          }
          break;
        case "Escape":
          e.preventDefault();
          setSearchQuery("");
          setSelectedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [filteredModels, selectedIndex, isInputFocused, toggleModel]
  );

  // 既存モデルの選択解除
  const removeModel = useCallback(
    (modelId: string) => {
      const updatedModels = models.map((model) =>
        model.id === modelId ? { ...model, selected: false } : model
      );
      onUpdateModels(updatedModels);
    },
    [models, onUpdateModels]
  );

  // 検索クエリが変更されたときに選択インデックスをリセット
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery]);

  // 選択されたアイテムをビューにスクロール
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [selectedIndex]);

  return (
    <div className={`inline-model-selector ${className}`}>
      {/* 現在選択されているモデルのリスト */}
      <ul className="selected-models-list">
        {models
          .filter((model) => model.selected)
          .map((model) => (
            <li key={model.id} className="selected-model-item">
              <span className="model-name">
                {model.name.includes("/")
                  ? model.name.split("/")[1]
                  : model.name}
              </span>
              <button
                type="button"
                onClick={() => removeModel(model.id)}
                className="remove-model-button"
                title="Remove model"
              >
                ×
              </button>
            </li>
          ))}

        {/* 検索・追加用のインプット */}
        <li className="model-input-item">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => {
              // 少し遅延させてクリックイベントを許可
              setTimeout(() => {
                setIsInputFocused(false);
                setSelectedIndex(-1);
              }, 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedCount === 0 ? "モデルを追加..." : "モデルを追加..."
            }
            className="model-search-input"
          />
        </li>
      </ul>

      {/* モデル選択候補のドロップダウン */}
      {isInputFocused && filteredModels.length > 0 && (
        <ul ref={suggestionsRef} className="model-suggestions">
          {filteredModels.slice(0, 8).map((model, index) => {
            const isSelected = models.find((m) => m.id === model.id)?.selected;
            return (
              <li
                key={model.id}
                className={`model-suggestion-item ${
                  index === selectedIndex ? "highlighted" : ""
                } ${isSelected ? "already-selected" : ""}`}
                onClick={() => {
                  toggleModel(model);
                  setSearchQuery("");
                  setSelectedIndex(-1);
                  inputRef.current?.blur();
                }}
              >
                <div className="model-info">
                  <span className="model-display-name">
                    {model.name.includes("/")
                      ? model.name.split("/")[1]
                      : model.name}
                  </span>
                  <span className="model-id">{model.id}</span>
                </div>
                {isSelected && <span className="selected-indicator">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
