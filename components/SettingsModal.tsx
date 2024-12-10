import React, { useState, useEffect, useRef } from "react";
import ModelSuggestions from "./ModelSuggestions";
import useStorageState from "hooks/useLocalStorage";
import { useChatLogic } from "hooks/useChatLogic";

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
  const { isModalOpen, handleCloseModal: closeModal } = useChatLogic();

  const [storedModels, setStoredModels] = useStorageState("models");
  const models = storedModels
    ? [
        ...(storedModels.login?.map((m) => m.name) || []),
        ...(storedModels.noLogin?.map((m) => m.name) || []),
      ]
    : [];
  const setModels = (newModels: string[]) => {
    const loginModels = newModels.map((name) => ({ name, selected: true }));
    setStoredModels({ login: loginModels, noLogin: [] });
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

  const [tools, setTools] = useStorageState("tools");
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

  const handleAddModel = () => {
    if (newModel && !models.includes(newModel)) {
      setModels([...models, newModel]);
      setNewModel("");
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
    setTools([...tools, newTool]);
    setToolFunctions({
      ...toolFunctions,
      new_function: () => console.log("新しい関数"),
    });
    setEditingIndex(tools.length);
    setEditingToolDefinition(JSON.stringify(newTool, null, 2));
    setEditingToolFunction("() => console.log('新しい関数')");
  };

  const handleEditModel = (index: number) => {
    setEditingModelIndex(index);
    setEditingModel(models[index]);
  };

  const handleSaveEditedModel = () => {
    if (editingModelIndex !== null && editingModel) {
      const updatedModels = [...models];
      updatedModels[editingModelIndex] = editingModel;
      setModels(updatedModels);
      setEditingModelIndex(null);
      setEditingModel("");
    }
  };

  const handleCancelModelEdit = () => {
    setEditingModelIndex(null);
    setEditingModel("");
  };

  const handleDeleteModel = (modelToDelete: string) => {
    setModels(models.filter((model) => model !== modelToDelete));
  };

  const handleDeleteTool = (index: number) => {
    const updatedTools = tools.filter((_, i) => i !== index);
    setTools(updatedTools);
    const deletedTool = tools[index];
    const updatedToolFunctions = {
      ...toolFunctions,
    };
    delete updatedToolFunctions[deletedTool.function.name];
    setToolFunctions(updatedToolFunctions);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleAddModel();
  };

  const handleEditTool = (index: number) => {
    setEditingIndex(index);
    const tool = tools[index];
    setEditingToolDefinition(JSON.stringify(tool, null, 2));
    const functionString = toolFunctions[tool.function.name] || "() => {}";
    setEditingToolFunction(functionString);
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
          ...toolFunctions,
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

  if (!isModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <button className="close-button" onClick={closeModal}>
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
        <h2>Settings</h2>
        <h3>Model</h3>
        <ul className="model-list">
          {models.map((model, index) => (
            <li
              key={model}
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
                  <span className="model-name">{model}</span>
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
        <form onSubmit={handleSubmit} className="settings-input-area">
          <input
            ref={newModelInputRef}
            type="text"
            value={newModel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewModel(e.target.value)
            }
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="New models added"
            className="model-input"
          />
          <button type="submit" className="add-button">
            追加
          </button>
          {isFocused && (
            <ModelSuggestions
              inputValue={newModel}
              onSelectSuggestion={handleSelectSuggestion}
              inputRef={newModelInputRef}
              className="settings-modal-suggestions"
            />
          )}
        </form>
        <h3>Function Calls</h3>
        <ul className="function-call-list">
          {tools.map((tool, index) => (
            <li key={index}>
              {editingIndex === index ? (
                <div className="tool-edit">
                  <textarea
                    value={editingToolDefinition}
                    onChange={(e) => setEditingToolDefinition(e.target.value)}
                    className="tool-input"
                    placeholder="ツール定義 (JSON形式)"
                  />
                  <textarea
                    value={editingToolFunction}
                    onChange={(e) => setEditingToolFunction(e.target.value)}
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
  );
}
