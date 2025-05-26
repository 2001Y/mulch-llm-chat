import React, { useState, useRef } from "react";
import ModelSuggestions from "./ModelSuggestions";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import type { ModelItem } from "hooks/useChatLogic";

interface ModelSelectorSlideoutProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModelSelectorSlideout({
  isOpen,
  onClose,
}: ModelSelectorSlideoutProps) {
  const { models, updateModels } = useChatLogicContext();
  const [newModel, setNewModel] = useState<string>("");
  const [isFocused, setIsFocused] = useState(false);
  const newModelInputRef = useRef<HTMLInputElement>(null);

  const handleAddModel = () => {
    const currentModels = models || [];
    if (
      newModel &&
      !currentModels.some((m: ModelItem) => m.name === newModel)
    ) {
      updateModels([
        ...currentModels,
        { id: newModel, name: newModel, selected: true },
      ]);
      setNewModel("");
      setIsFocused(false);
    }
  };

  const handleToggleModel = (model: ModelItem) => {
    const updatedModels = models.map((m: ModelItem) =>
      m.id === model.id ? { ...m, selected: !m.selected } : m
    );
    updateModels(updatedModels);
  };

  const handleDeleteModel = (modelToDelete: ModelItem) => {
    updateModels(
      models.filter((model: ModelItem) => model.name !== modelToDelete.name)
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="slideout-overlay" onClick={onClose} />

      {/* Slideout Panel */}
      <div className="model-selector-slideout">
        <div className="slideout-header">
          <h3>モデル選択</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="slideout-content">
          {/* Selected Models */}
          <div className="selected-models-section">
            <h4>選択済みモデル</h4>
            <ul className="model-list">
              {models
                .filter((model: ModelItem) => model.selected)
                .map((model: ModelItem) => (
                  <li key={model.id} className="model-item selected">
                    <span className="model-name">{model.name}</span>
                    <div className="model-actions">
                      <button
                        onClick={() => handleToggleModel(model)}
                        className="toggle-button"
                        title="選択解除"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleDeleteModel(model)}
                        className="delete-button"
                        title="削除"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>

          {/* Available Models */}
          <div className="available-models-section">
            <h4>利用可能モデル</h4>
            <ul className="model-list">
              {models
                .filter((model: ModelItem) => !model.selected)
                .map((model: ModelItem) => (
                  <li key={model.id} className="model-item">
                    <span className="model-name">{model.name}</span>
                    <div className="model-actions">
                      <button
                        onClick={() => handleToggleModel(model)}
                        className="toggle-button"
                        title="選択"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleDeleteModel(model)}
                        className="delete-button"
                        title="削除"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>

          {/* Add New Model */}
          <div className="add-model-section">
            <h4>新しいモデルを追加</h4>
            <div className="input-area">
              <input
                ref={newModelInputRef}
                type="text"
                className="model-input"
                placeholder="モデル名を入力"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), handleAddModel())
                }
              />
              <button onClick={handleAddModel} className="add-button">
                追加
              </button>
              <ModelSuggestions
                inputValue={newModel}
                onSelectSuggestion={setNewModel}
                show={isFocused && newModel.trim().length > 0}
                parentRef={newModelInputRef}
                className="slideout-suggestions"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
