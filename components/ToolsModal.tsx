import React, { useState } from "react";
import BaseModal from "./BaseModal";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import type { Tool } from "types/chat";

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ToolsModal({ isOpen, onClose }: ToolsModalProps) {
  const { tools, updateTools } = useChatLogicContext();
  const [editingToolIndex, setEditingToolIndex] = useState<number | null>(null);
  const [newToolDefinition, setNewToolDefinition] = useState("");

  // ツールの追加
  const handleAddTool = () => {
    if (!newToolDefinition.trim()) return;

    try {
      const toolData = JSON.parse(newToolDefinition);
      if (toolData.type && toolData.function) {
        const newTool: Tool = {
          type: toolData.type,
          function: {
            name: toolData.function.name,
            description: toolData.function.description,
            parameters: toolData.function.parameters,
          },
        };
        updateTools([...tools, newTool]);
        setNewToolDefinition("");
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
    }
  };

  // ツールの編集保存
  const handleSaveEditTool = (index: number, editedDefinition: string) => {
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
        </p>

        {/* ツール一覧 */}
        <h3>登録済みツール</h3>
        <ul className="tools-list">
          {tools.map((tool, index) => (
            <li key={index}>
              {editingToolIndex === index ? (
                <ToolEditForm
                  tool={tool}
                  onSave={(editedDefinition) =>
                    handleSaveEditTool(index, editedDefinition)
                  }
                  onCancel={() => setEditingToolIndex(null)}
                />
              ) : (
                <ToolDisplay
                  tool={tool}
                  onEdit={() => setEditingToolIndex(index)}
                  onDelete={() => handleDeleteTool(index)}
                />
              )}
            </li>
          ))}
        </ul>

        {/* 新しいツール追加 */}
        <h3>新しいツールを追加</h3>
        <div className="tool-input-area">
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
          <button onClick={handleAddTool} className="add-button">
            ツールを追加
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

interface ToolDisplayProps {
  tool: Tool;
  onEdit: () => void;
  onDelete: () => void;
}

function ToolDisplay({ tool, onEdit, onDelete }: ToolDisplayProps) {
  return (
    <div className="tool-display">
      <div className="tool-info">
        <h4 className="tool-name">{tool.function.name}</h4>
        <p className="tool-description">{tool.function.description}</p>
        <details className="tool-details">
          <summary>パラメーター詳細</summary>
          <pre className="tool-parameters">
            {JSON.stringify(tool.function.parameters, null, 2)}
          </pre>
        </details>
      </div>
      <div className="tool-actions">
        <button onClick={onEdit} className="edit-button">
          <svg
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
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </button>
        <button onClick={onDelete} className="delete-button">
          <svg
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
            <polyline points="3,6 5,6 21,6" />
            <path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface ToolEditFormProps {
  tool: Tool;
  onSave: (editedDefinition: string) => void;
  onCancel: () => void;
}

function ToolEditForm({ tool, onSave, onCancel }: ToolEditFormProps) {
  const [editedDefinition, setEditedDefinition] = useState(
    JSON.stringify(tool, null, 2)
  );

  return (
    <div className="tool-edit-form">
      <textarea
        className="tool-edit-input"
        value={editedDefinition}
        onChange={(e) => setEditedDefinition(e.target.value)}
        rows={10}
      />
      <div className="tool-edit-actions">
        <button
          onClick={() => onSave(editedDefinition)}
          className="save-button"
        >
          保存
        </button>
        <button onClick={onCancel} className="cancel-button">
          キャンセル
        </button>
      </div>
    </div>
  );
}
