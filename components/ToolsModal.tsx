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

  // 二重モーダル制御
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addCategory, setAddCategory] = useState<"Tool" | "MCP">("Tool");

  // 既存のツールを Tools と MCP に分類
  const toolList = tools.filter((t) => t.category !== "MCP");
  const mcpList = tools.filter((t) => t.category === "MCP");

  // 新規追加モーダル で作成されたツールを追加
  const handleAddNewTool = (newTool: ExtendedTool) => {
    updateTools([...tools, newTool]);
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
      title="カスタム Tools/MCP 管理"
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
          {toolList.map((tool) => {
            const originalIndex = tools.indexOf(tool);
            return (
              <li key={`tool-${originalIndex}`}>
                {editingToolIndex === originalIndex ? (
                  <ToolEditForm
                    tool={tool}
                    onSave={(editedDefinition, editedImplementation) =>
                      handleSaveEditTool(
                        originalIndex,
                        editedDefinition,
                        editedImplementation
                      )
                    }
                    onCancel={() => setEditingToolIndex(null)}
                    onDelete={() => handleDeleteTool(originalIndex)}
                  />
                ) : (
                  <ToolDisplay
                    tool={tool}
                    onCardClick={() => setEditingToolIndex(originalIndex)}
                    onToggle={(e) => handleToggleTool(originalIndex, e)}
                  />
                )}
              </li>
            );
          })}
        </ul>

        {/* MCP一覧 */}
        <h3>登録済み MCP</h3>
        <ul className="tools-list">
          {mcpList.map((tool) => {
            const originalIndex = tools.indexOf(tool);
            return (
              <li key={`mcp-${originalIndex}`}>
                {editingToolIndex === originalIndex ? (
                  <ToolEditForm
                    tool={tool}
                    onSave={(editedDefinition, editedImplementation) =>
                      handleSaveEditTool(
                        originalIndex,
                        editedDefinition,
                        editedImplementation
                      )
                    }
                    onCancel={() => setEditingToolIndex(null)}
                    onDelete={() => handleDeleteTool(originalIndex)}
                  />
                ) : (
                  <ToolDisplay
                    tool={tool}
                    onCardClick={() => setEditingToolIndex(originalIndex)}
                    onToggle={(e) => handleToggleTool(originalIndex, e)}
                  />
                )}
              </li>
            );
          })}
        </ul>

        {/* 新規追加ボタン群 */}
        <div className="add-buttons-wrapper">
          <button
            className="add-button"
            onClick={() => {
              setAddCategory("Tool");
              setIsAddModalOpen(true);
            }}
          >
            + ツールを追加
          </button>
          <button
            className="add-button"
            onClick={() => {
              setAddCategory("MCP");
              setIsAddModalOpen(true);
            }}
          >
            + MCP を追加
          </button>
        </div>

        {/* 新規追加用二重モーダル */}
        <AddToolMcpModal
          isOpen={isAddModalOpen}
          category={addCategory}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddNewTool}
        />
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

// 二重モーダル用: ツール/MCP 新規追加モーダル
interface AddToolMcpModalProps {
  isOpen: boolean;
  category: "Tool" | "MCP";
  onClose: () => void;
  onAdd: (tool: ExtendedTool) => void;
}

function AddToolMcpModal({
  isOpen,
  category,
  onClose,
  onAdd,
}: AddToolMcpModalProps) {
  const [definition, setDefinition] = useState<string>("");
  const [implementation, setImplementation] = useState<string>("");

  const handleAdd = () => {
    if (!definition.trim()) return;

    try {
      const toolData = JSON.parse(definition);
      if (toolData.type && toolData.function) {
        const newTool: ExtendedTool = {
          type: toolData.type,
          function: {
            name: toolData.function.name,
            description: toolData.function.description,
            parameters: toolData.function.parameters,
          },
          implementation:
            category === "Tool"
              ? implementation.trim() || undefined
              : undefined,
          enabled: true,
          category,
        };
        onAdd(newTool);
        setDefinition("");
        setImplementation("");
        onClose();
      } else {
        alert("ツール定義が不正です。typeとfunctionが必要です。");
      }
    } catch {
      alert("JSON形式が不正です。");
    }
  };

  const title =
    category === "Tool" ? "新しいツールを追加" : "新しい MCP を追加";

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      className="add-tool-mcp-modal"
    >
      <div className="add-tool-mcp-content">
        <div className="tool-input-section">
          <h4>定義（JSON形式）</h4>
          <textarea
            className="tool-input"
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            rows={12}
          />
        </div>
        {category === "Tool" && (
          <div className="tool-input-section">
            <h4>実行コード（JavaScript）</h4>
            <textarea
              className="tool-input"
              value={implementation}
              onChange={(e) => setImplementation(e.target.value)}
              rows={8}
            />
          </div>
        )}
        <button onClick={handleAdd} className="add-button">
          追加
        </button>
      </div>
    </BaseModal>
  );
}
