import React, { useState, useRef, useEffect, useCallback } from "react";
import type { ModelItem } from "hooks/useChatLogic";

interface InlineModelSelectorProps {
  models: ModelItem[];
  allModels: ModelItem[];
  onUpdateModels: (newModels: ModelItem[]) => void;
  onOpenModelModal?: () => void;
  className?: string;
}

export default function InlineModelSelector({
  models,
  allModels,
  onUpdateModels,
  onOpenModelModal,
  className = "",
}: InlineModelSelectorProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  // モバイル判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 選択済みモデルのみを取得
  const selectedModels = models.filter((model) => model.selected);

  // モデルを削除
  const removeModel = useCallback(
    (modelId: string) => {
      const updatedModels = models.map((model) =>
        model.id === modelId ? { ...model, selected: false } : model
      );
      onUpdateModels(updatedModels);
    },
    [models, onUpdateModels]
  );

  // モデルの順序を変更
  const reorderModels = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const reorderedSelected = [...selectedModels];
      const [movedModel] = reorderedSelected.splice(fromIndex, 1);
      reorderedSelected.splice(toIndex, 0, movedModel);

      // 元のmodels配列を更新（順序を保持）
      const updatedModels = models.map((model) => ({
        ...model,
        selected: false,
      }));

      // 新しい順序で選択状態を設定
      reorderedSelected.forEach((selectedModel) => {
        const index = updatedModels.findIndex((m) => m.id === selectedModel.id);
        if (index !== -1) {
          updatedModels[index].selected = true;
        }
      });

      onUpdateModels(updatedModels);
    },
    [selectedModels, models, onUpdateModels]
  );

  // ドラッグ開始
  const handleDragStart = (e: React.DragEvent, modelId: string) => {
    setDraggedModelId(modelId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", modelId);
  };

  // ドラッグオーバー
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  // ドラッグリーブ
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // ドロップ
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    const dragIndex = selectedModels.findIndex((m) => m.id === draggedId);

    if (dragIndex !== -1) {
      reorderModels(dragIndex, dropIndex);
    }

    setDraggedModelId(null);
    setDragOverIndex(null);
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setDraggedModelId(null);
    setDragOverIndex(null);
  };

  // 長押し開始（モバイル用）
  const handleTouchStart = (modelId: string) => {
    if (!isMobile) return;

    const timer = setTimeout(() => {
      setIsDragMode(true);
      // 軽微な触覚フィードバック
      if ("vibrate" in navigator) {
        navigator.vibrate(100);
      }
    }, 800); // 800ms長押しで並び替えモード

    setLongPressTimer(timer);
  };

  // 長押し終了
  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // 並び替えモード終了
  const exitDragMode = () => {
    setIsDragMode(false);
    setDraggedModelId(null);
    setDragOverIndex(null);
  };

  // タッチでの並び替え（簡易実装）
  const handleModelTap = (index: number) => {
    if (!isDragMode) return;

    if (draggedModelId === null) {
      // 最初のタップ：ドラッグするモデルを選択
      setDraggedModelId(selectedModels[index].id);
    } else {
      // 2回目のタップ：ドロップ位置を決定
      const dragIndex = selectedModels.findIndex(
        (m) => m.id === draggedModelId
      );
      reorderModels(dragIndex, index);
      setDraggedModelId(null);
    }
  };

  return (
    <div
      className={`inline-model-selector unified ${className} ${
        isDragMode ? "drag-mode" : ""
      }`}
    >
      <div className="selected-models-display">
        <ul className="selected-models-list">
          <li>
            <button
              type="button"
              className="add-models-button"
              onClick={onOpenModelModal}
              title="モデルを追加"
            >
              <span className="button-icon">+</span>
              <span className="button-text">モデルを追加</span>
            </button>
          </li>

          {selectedModels.map((model, index) => (
            <li
              key={model.id}
              className={`selected-model-item ${
                draggedModelId === model.id ? "dragging" : ""
              } ${dragOverIndex === index ? "drag-over" : ""}`}
              draggable={!isMobile || isDragMode}
              onDragStart={(e) => handleDragStart(e, model.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onTouchStart={() => handleTouchStart(model.id)}
              onTouchEnd={handleTouchEnd}
              onClick={() => handleModelTap(index)}
            >
              <span className="model-name">
                {model.name.includes("/")
                  ? model.name.split("/")[1]
                  : model.name}
              </span>

              {/* 削除ボタン */}
              <button
                type="button"
                className="remove-model-button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeModel(model.id);
                }}
                title={`${model.name}を削除`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {/* 並び替えモード用の操作パネル（モバイルのみ） */}
        {isMobile && isDragMode && (
          <div className="drag-mode-panel">
            <span className="drag-mode-text">
              {draggedModelId
                ? "ドロップ位置をタップ"
                : "モデルをタップして選択"}
            </span>
            <button
              type="button"
              className="exit-drag-mode"
              onClick={exitDragMode}
            >
              完了
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
