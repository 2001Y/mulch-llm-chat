import React from "react";

interface ModelListProps {
  models: Array<{
    id: string;
    name: string;
    context_length?: number;
  }>;
  selectedModelIds: Set<string>;
  highlightedIndex: number;
  onToggleModel: (model: any) => void;
  onDeleteModel: (modelId: string) => void;
  searchInput: string;
  listRef?: React.RefObject<HTMLUListElement | null>;
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

export default function ModelList({
  models,
  selectedModelIds,
  highlightedIndex,
  onToggleModel,
  onDeleteModel,
  searchInput,
  listRef,
}: ModelListProps) {
  return (
    <div className="model-search-results">
      <ul ref={listRef} className="model-suggestions-list">
        {models.map((model, index) => {
          const isSelected = selectedModelIds.has(model.id);
          const isHighlighted = index === highlightedIndex;
          const contextText = formatContextLength(model.context_length);

          return (
            <li
              key={model.id}
              className={`model-suggestion-item ${
                isSelected ? "selected" : ""
              } ${isHighlighted ? "highlighted" : ""}`}
              onClick={() => onToggleModel(model)}
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
                      onDeleteModel(model.id);
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
        {models.length === 0 && searchInput.trim() !== "" && (
          <li className="no-results">該当するモデルが見つかりません</li>
        )}
        {models.length === 0 && searchInput.trim() === "" && (
          <li className="loading">モデルを読み込み中...</li>
        )}
      </ul>
    </div>
  );
}
