import React, { useState, useEffect, useRef } from "react";
import ModelSuggestions from "./ModelSuggestions";
import useStorageState from "hooks/useLocalStorage";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import type { ModelItem } from "hooks/useChatLogic";

interface ModelInputModalProps {
  closeModal: () => void;
}

interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

interface OpenRouterModel {
  id: string;
  name: string;
}

export default function ModelInputModal() {
  const { isModalOpen, handleCloseModal: closeModal } = useChatLogicContext();

  // デバッグ用ログの追加
  useEffect(() => {
    console.log("[DEBUG] SettingsModal - isModalOpen:", isModalOpen);
  }, [isModalOpen]);

  const [storedModels, setStoredModels] = useStorageState("models");
  const models: ModelItem[] = storedModels || [];
  const setModels = (newModels: ModelItem[]) => {
    setStoredModels(newModels);
  };

  const [newModel, setNewModel] = useState<string>("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(
    null
  );
  const [editingModel, setEditingModel] = useState<string>("");
  const [editingToolDefinition, setEditingToolDefinition] = useState("");
  const [editingToolFunction, setEditingToolFunction] = useState("");
  const [suggestions, setSuggestions] = useState<OpenRouterModel[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] =
    useState<number>(-1);
  const [isFocused, setIsFocused] = useState(false);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const newModelInputRef = useRef<HTMLInputElement>(null);

  const [storedTools, setStoredTools] = useStorageState("tools");
  const tools: Tool[] = storedTools || [];
  const setTools = (newTools: Tool[]) => {
    setStoredTools(newTools);
  };

  const [toolFunctions, setToolFunctions] = useStorageState("toolFunctions");

  useEffect(() => {
    if (newModel.length > 0) {
      fetchSuggestions(newModel);
    } else {
      setSuggestions([]);
    }
  }, [newModel]);

  const fetchSuggestions = async (query: string) => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models");
      const data = await response.json();
      const filteredModels = data.data.filter((model: OpenRouterModel) =>
        model.id.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filteredModels);
    } catch (error) {
      console.error("モデルの取得に失敗しました:", error);
    }
  };

  const handleSelectSuggestion = (modelId: string) => {
    setNewModel(modelId);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  };

  const handleSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    handleAddModel();
  };

  const handleAddModel = () => {
    const currentModels = models || [];
    if (
      newModel &&
      !currentModels.some((m: ModelItem) => m.name === newModel)
    ) {
      setModels([...currentModels, { name: newModel, selected: true }]);
      setNewModel("");
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  };

  const handleAddNewTool = () => {
    const newTool: Tool = {
      type: "function",
      function: {
        name: "new_function",
        description: "新しい関数の説明",
        parameters: {},
      },
    };
    setTools([...(tools || []), newTool]);
    setToolFunctions({
      ...(toolFunctions || {}),
      new_function: () => console.log("新しい関数"),
    });
    setEditingIndex((tools || []).length);
    setEditingToolDefinition(JSON.stringify(newTool, null, 2));
    setEditingToolFunction("() => console.log('新しい関数')");
  };

  const handleEditModel = (index: number) => {
    setEditingModelIndex(index);
    if (models[index]) {
      setEditingModel(models[index].name);
    }
  };

  const handleSaveEditedModel = () => {
    if (editingModelIndex !== null && editingModel) {
      const updatedModels = [...models];
      if (updatedModels[editingModelIndex]) {
        updatedModels[editingModelIndex] = {
          name: editingModel,
          selected: models[editingModelIndex].selected,
        };
        setModels(updatedModels);
      }
      setEditingModelIndex(null);
      setEditingModel("");
    }
  };

  const handleCancelModelEdit = () => {
    setEditingModelIndex(null);
    setEditingModel("");
  };

  const handleDeleteModel = (modelToDelete: ModelItem) => {
    setModels(
      models.filter((model: ModelItem) => model.name !== modelToDelete.name)
    );
  };

  const handleDeleteTool = (index: number) => {
    const updatedTools = tools.filter((_: Tool, i: number) => i !== index);
    setTools(updatedTools);
    const currentToolFunctions = toolFunctions || {};
    const deletedTool = tools[index];
    if (deletedTool?.function?.name) {
      const updatedToolFunctions = { ...currentToolFunctions };
      delete updatedToolFunctions[deletedTool.function.name];
      setToolFunctions(updatedToolFunctions);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      console.log("[DEBUG] Close button clicked");
      closeModal();
    }
  };

  const handleEditTool = (index: number) => {
    setEditingIndex(index);
    const currentTool = tools[index];
    if (currentTool) {
      setEditingToolDefinition(JSON.stringify(currentTool, null, 2));
      const funcString =
        (toolFunctions || {})[currentTool.function.name] || "() => {}";
      setEditingToolFunction(funcString);
    }
  };

  const handleSaveEditedTool = () => {
    if (editingIndex !== null) {
      try {
        const parsedTool = JSON.parse(editingToolDefinition);

        // ツール定義の構造を検証
        if (
          !parsedTool.type ||
          !parsedTool.function ||
          !parsedTool.function.name ||
          !parsedTool.function.description ||
          !parsedTool.function.parameters
        ) {
          throw new Error("ツール定義の構造が不正です。");
        }

        // 関数の構文チックと変換
        let functionImplementation;
        try {
          functionImplementation = new Function(
            `return ${editingToolFunction}`
          )();
          if (typeof functionImplementation !== "function") {
            throw new Error("関数として評価できません。");
          }
        } catch (functionError: any) {
          throw new Error(
            "ツール関数の構文が不正です: " + functionError.message
          );
        }

        // 更新処理
        const updatedTools = [...tools];
        updatedTools[editingIndex] = parsedTool;
        setTools(updatedTools);

        const updatedToolFunctions = {
          ...(toolFunctions || {}),
        };
        updatedToolFunctions[parsedTool.function.name] = functionImplementation;
        setToolFunctions(updatedToolFunctions);

        // イベントを発火して関数の更新を通知
        window.dispatchEvent(new Event("toolFunctionsUpdated"));

        setEditingIndex(null);
        setEditingToolDefinition("");
        setEditingToolFunction("");
      } catch (error: any) {
        console.error("ツールの編集エラー:", error);
        alert(`ツールの編集に失敗しました: ${error.message}`);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingToolDefinition("");
    setEditingToolFunction("");
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLLIElement>,
    position: number
  ) => {
    dragItem.current = position;
    e.currentTarget.classList.add("dragging");
  };

  const handleDragEnter = (
    e: React.DragEvent<HTMLLIElement>,
    position: number
  ) => {
    dragOverItem.current = position;
    const listItems = document.querySelectorAll(".model-list li");
    listItems.forEach((item, index) => {
      if (index === position) {
        const insertLine = document.createElement("div");
        insertLine.className = "insert-line";
        if (position < (dragItem.current || 0)) {
          item.insertAdjacentElement("beforebegin", insertLine);
        } else {
          item.insertAdjacentElement("afterend", insertLine);
        }
      }
    });
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
    const insertLines = document.querySelectorAll(".insert-line");
    insertLines.forEach((line) => line.remove());
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    e.currentTarget.classList.remove("dragging");
    const insertLines = document.querySelectorAll(".insert-line");
    insertLines.forEach((line) => line.remove());
    const copyListItems = [...models];
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const draggedItemContent = copyListItems[dragItem.current];
      copyListItems.splice(dragItem.current, 1);
      copyListItems.splice(dragOverItem.current, 0, draggedItemContent);
      dragItem.current = null;
      dragOverItem.current = null;
      setModels(copyListItems);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddModel();
    }
  };

  return (
    <>
      {isModalOpen && (
        <div className="model-input-modal-overlay" onClick={handleOverlayClick}>
          <div className="model-input-modal">
            <div className="modal-header">
              <h2>Settings</h2>
              <span
                className="close-button"
                onClick={() => {
                  console.log("[DEBUG] Close button clicked");
                  closeModal();
                }}
              >
                ×
              </span>
            </div>
            <div className="modal-content">
              <h3>Model</h3>
              <ul className="model-list">
                {models.map((model: ModelItem, index: number) => (
                  <li
                    key={model.name}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragLeave={handleDragLeave}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={editingModelIndex === index ? "model-edit" : ""}
                  >
                    {editingModelIndex === index ? (
                      <>
                        <input
                          type="text"
                          value={editingModel}
                          onChange={(e) => setEditingModel(e.target.value)}
                          className="model-input"
                        />
                        <div className="model-edit-buttons">
                          <button
                            onClick={handleSaveEditedModel}
                            className="save-button"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                              <polyline points="17 21 17 13 7 13 7 21"></polyline>
                              <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                          </button>
                          <button
                            onClick={handleCancelModelEdit}
                            className="cancel-button"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="15" y1="9" x2="9" y2="15"></line>
                              <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="model-name">{model.name}</span>
                        <div className="model-buttons">
                          <button
                            onClick={() => handleEditModel(index)}
                            className="edit-button"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteModel(model)}
                            className="delete-button"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <div className="settings-input-area">
                <input
                  ref={newModelInputRef}
                  type="text"
                  className="model-input"
                  placeholder="モデル名を入力 (例: gpt-4)"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setIsFocused(false), 100)}
                  onKeyDown={handleKeyDown}
                />
                <button onClick={handleSubmit} className="add-button">
                  追加
                </button>
                {isFocused && suggestions.length > 0 && (
                  <ModelSuggestions
                    inputValue={newModel}
                    onSelectSuggestion={handleSelectSuggestion}
                    show={isFocused && suggestions.length > 0}
                    cursorRect={null}
                    className="settings-modal-suggestions"
                  />
                )}
              </div>
              <h3>Function Calls</h3>
              <ul className="function-call-list">
                {(tools || []).map((tool: Tool, index: number) => (
                  <li key={index}>
                    {editingIndex === index ? (
                      <div className="tool-edit">
                        <textarea
                          value={editingToolDefinition}
                          onChange={(e) =>
                            setEditingToolDefinition(e.target.value)
                          }
                          className="tool-input"
                          placeholder="ツール定義 (JSON形式)"
                        />
                        <textarea
                          value={editingToolFunction}
                          onChange={(e) =>
                            setEditingToolFunction(e.target.value)
                          }
                          className="tool-input"
                          placeholder="ツール関数 (JavaScript関数)"
                        />
                        <div className="tool-edit-buttons">
                          <button
                            onClick={handleSaveEditedTool}
                            className="save-button"
                          >
                            Save
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                              <polyline points="17 21 17 13 7 13 7 21"></polyline>
                              <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="cancel-button"
                          >
                            Cancel
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="15" y1="9" x2="9" y2="15"></line>
                              <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="tool-name">{tool.function.name}</span>
                        <div className="tool-buttons">
                          <button
                            onClick={() => handleEditTool(index)}
                            className="edit-button"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTool(index)}
                            className="delete-button"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <button onClick={handleAddNewTool} className="add-button">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                新しいツールを追加
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
