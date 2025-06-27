import React, { useState } from "react";
import BaseModal from "./BaseModal";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import type { ExtendedTool } from "types/chat";

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ToolsModal({ isOpen, onClose }: ToolsModalProps) {
  const { tools, updateTools } = useChatLogicContext();
  const [editingToolIndex, setEditingToolIndex] = useState<number | null>(null);
  const [newToolDefinition, setNewToolDefinition] = useState("");
  const [newToolImplementation, setNewToolImplementation] = useState("");

  // ツールの追加
  const handleAddTool = () => {
    if (!newToolDefinition.trim()) return;

    try {
      const toolData = JSON.parse(newToolDefinition);
      if (toolData.type && toolData.function) {
        const newTool: ExtendedTool = {
          type: toolData.type,
          function: {
            name: toolData.function.name,
            description: toolData.function.description,
            parameters: toolData.function.parameters,
          },
          implementation: newToolImplementation.trim() || undefined,
          enabled: true,
          category: toolData.category || "カスタム",
        };
        updateTools([...tools, newTool]);
        setNewToolDefinition("");
        setNewToolImplementation("");
      } else {
        alert("ツール定義が不正です。typeとfunctionが必要です。");
      }
    } catch (error) {
      alert("JSON形式が不正です。");
    }
  };

  // ツールの削除
  const handleDeleteTool = (index: number) => {
    if (confirm("このツールを削除しますか？")) {
      const newTools = tools.filter((_, i) => i !== index);
      updateTools(newTools);
      setEditingToolIndex(null);
    }
  };

  // ツールの有効/無効を切り替え
  const handleToggleTool = (index: number, event: React.MouseEvent) => {
    console.log("Toggle clicked for tool index:", index);
    event.stopPropagation(); // カードのクリックイベントを止める
    const newTools = [...tools];
    newTools[index] = {
      ...newTools[index],
      enabled: !newTools[index].enabled,
    };
    console.log("Tool enabled state changed to:", !tools[index].enabled);
    updateTools(newTools);
  };

  // ツールの編集保存
  const handleSaveEditTool = (
    index: number,
    editedDefinition: string,
    editedImplementation: string
  ) => {
    try {
      const toolData = JSON.parse(editedDefinition);
      if (toolData.type && toolData.function) {
        const newTools = [...tools];
        newTools[index] = {
          type: toolData.type,
          function: {
            name: toolData.function.name,
            description: toolData.function.description,
            parameters: toolData.function.parameters,
          },
          implementation: editedImplementation.trim() || undefined,
          enabled: toolData.enabled !== false,
          category: toolData.category || "カスタム",
        };
        updateTools(newTools);
        setEditingToolIndex(null);
      } else {
        alert("ツール定義が不正です。typeとfunctionが必要です。");
      }
    } catch (error) {
      alert("JSON形式が不正です。");
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="カスタムツール管理"
      className="tools-modal"
    >
      <div className="tools-modal-content">
        <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "1rem" }}>
          AI が使用可能なカスタムツール（Function Calling）を管理します。
          各ツールには定義（スキーマ）と実行コードの両方が必要です。
        </p>

        {/* ツール一覧 */}
        <h3>登録済みツール</h3>
        <ul className="tools-list">
          {tools.map((tool, index) => (
            <li key={index}>
              {editingToolIndex === index ? (
                <ToolEditForm
                  tool={tool}
                  onSave={(editedDefinition, editedImplementation) =>
                    handleSaveEditTool(
                      index,
                      editedDefinition,
                      editedImplementation
                    )
                  }
                  onCancel={() => setEditingToolIndex(null)}
                  onDelete={() => handleDeleteTool(index)}
                />
              ) : (
                <ToolDisplay
                  tool={tool}
                  onCardClick={() => setEditingToolIndex(index)}
                  onToggle={(e) => handleToggleTool(index, e)}
                />
              )}
            </li>
          ))}
        </ul>

        {/* 新しいツール追加 */}
        <h3>新しいツールを追加</h3>
        <div className="tool-input-area">
          <div className="tool-input-section">
            <h4>ツール定義（JSON形式）</h4>
            <textarea
              className="tool-input"
              placeholder={`ツール定義をJSON形式で入力してください。例:
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "指定された場所の天気を取得する",
    "parameters": {
      "type": "object",
      "properties": {
        "location": {
          "type": "string",
          "description": "都市名"
        }
      },
      "required": ["location"]
    }
  }
}`}
              value={newToolDefinition}
              onChange={(e) => setNewToolDefinition(e.target.value)}
              rows={12}
            />
          </div>

          <div className="tool-input-section">
            <h4>実行コード（JavaScript関数）</h4>
            <textarea
              className="tool-input"
              placeholder={`実行可能なJavaScript関数を入力してください。例:
function(args) {
  // args.location には都市名が入る
  const location = args.location;
  
  // 実際のAPI呼び出しや処理をここに記述
  return {
    location: location,
    weather: "晴れ",
    temperature: "25°C",
    timestamp: new Date().toISOString()
  };
}`}
              value={newToolImplementation}
              onChange={(e) => setNewToolImplementation(e.target.value)}
              rows={8}
            />
          </div>

          <button onClick={handleAddTool} className="add-button">
            ツールを追加
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

interface ToolDisplayProps {
  tool: ExtendedTool;
  onCardClick: () => void;
  onToggle: (e: React.MouseEvent) => void;
}

function ToolDisplay({ tool, onCardClick, onToggle }: ToolDisplayProps) {
  return (
    <div className="tool-display" onClick={onCardClick}>
      <div className="tool-info">
        <h4 className="tool-name">{tool.function.name}</h4>
        <p className="tool-description">{tool.function.description}</p>
        <svg
          className="edit-indicator"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
      <div className="tool-actions">
        <div className="toggle-switch" onClick={onToggle}>
          <input type="checkbox" checked={tool.enabled !== false} readOnly />
          <span className="toggle-slider"></span>
        </div>
      </div>
    </div>
  );
}

interface ToolEditFormProps {
  tool: ExtendedTool;
  onSave: (editedDefinition: string, editedImplementation: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}

function ToolEditForm({ tool, onSave, onCancel, onDelete }: ToolEditFormProps) {
  const [editedDefinition, setEditedDefinition] = useState(
    JSON.stringify(
      {
        type: tool.type,
        function: tool.function,
        enabled: tool.enabled,
      },
      null,
      2
    )
  );
  const [editedImplementation, setEditedImplementation] = useState(
    tool.implementation || ""
  );

  return (
    <div className="tool-edit-form">
      <div className="tool-edit-section">
        <h4>ツール定義</h4>
        <textarea
          className="tool-edit-input"
          value={editedDefinition}
          onChange={(e) => setEditedDefinition(e.target.value)}
          rows={12}
        />
      </div>

      <div className="tool-edit-section">
        <h4>実行コード</h4>
        <textarea
          className="tool-edit-input"
          value={editedImplementation}
          onChange={(e) => setEditedImplementation(e.target.value)}
          rows={8}
        />
      </div>

      <div className="tool-edit-actions">
        <button
          onClick={() => onSave(editedDefinition, editedImplementation)}
          className="save-button"
        >
          保存
        </button>
        <button onClick={onCancel} className="cancel-button">
          キャンセル
        </button>
      </div>

      <div className="tool-delete-section">
        <button onClick={onDelete} className="delete-button">
          このツールを削除
        </button>
      </div>
    </div>
  );
}
