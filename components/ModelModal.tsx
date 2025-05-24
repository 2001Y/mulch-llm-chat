import React, { useState, useRef } from "react";
import BaseModal from "./BaseModal";
import ModelSuggestions from "./ModelSuggestions";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import type { ModelItem } from "hooks/useChatLogic";

interface ModelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModelModal({ isOpen, onClose }: ModelModalProps) {
  const { models, updateModels } = useChatLogicContext();
  const [newModel, setNewModel] = useState<string>("");
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(
    null
  );
  const [editingModel, setEditingModel] = useState<string>("");
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

  const handleDeleteModel = (modelToDelete: ModelItem) => {
    updateModels(
      models.filter((model: ModelItem) => model.name !== modelToDelete.name)
    );
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="モデル管理"
      className="model-modal"
    >
      <div className="model-modal-content">
        <ul className="model-list">
          {models.map((model: ModelItem, index: number) => (
            <li key={model.name}>
              <span className="model-name">{model.name}</span>
              <button
                onClick={() => handleDeleteModel(model)}
                className="delete-button"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="settings-input-area">
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
            className="settings-modal-suggestions"
          />
        </div>
      </div>
    </BaseModal>
  );
}
