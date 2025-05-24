import React, { useState, useEffect, useRef } from "react";
import BaseModal from "./BaseModal";
import useStorageState from "hooks/useLocalStorage";
import { useChatLogicContext } from "contexts/ChatLogicContext";

interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export default function SettingsModal() {
  const {
    isModalOpen,
    handleCloseModal: closeModal,
    resetCurrentChat,
  } = useChatLogicContext();

  // API Keys State
  const [openRouterApiKey, setOpenRouterApiKey] =
    useStorageState<string>("openrouter_api_key");
  const [tempOpenRouterApiKey, setTempOpenRouterApiKey] = useState<string>("");

  // Load API key into temp state when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setTempOpenRouterApiKey(openRouterApiKey || "");
    }
  }, [isModalOpen, openRouterApiKey]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingToolDefinition, setEditingToolDefinition] = useState("");
  const [editingToolFunction, setEditingToolFunction] = useState("");

  const [storedTools, setStoredTools] = useStorageState("tools");
  const tools: Tool[] = storedTools || [];
  const setTools = (newTools: Tool[]) => {
    setStoredTools(newTools);
  };

  const [toolFunctions, setToolFunctions] = useStorageState("toolFunctions");

  const handleSaveApiKeys = () => {
    setOpenRouterApiKey(tempOpenRouterApiKey);

    // 保存完了を表示
    const saveSuccessMessage = document.createElement("div");
    saveSuccessMessage.innerText = "APIキーを保存しました";
    saveSuccessMessage.className = "save-success-message";
    saveSuccessMessage.style.position = "absolute";
    saveSuccessMessage.style.bottom = "10px";
    saveSuccessMessage.style.left = "50%";
    saveSuccessMessage.style.transform = "translateX(-50%)";
    saveSuccessMessage.style.backgroundColor = "rgba(0, 255, 0, 0.2)";
    saveSuccessMessage.style.color = "#00ff00";
    saveSuccessMessage.style.padding = "8px 16px";
    saveSuccessMessage.style.borderRadius = "4px";
    saveSuccessMessage.style.zIndex = "9999";

    document.body.appendChild(saveSuccessMessage);
    setTimeout(() => {
      document.body.removeChild(saveSuccessMessage);
    }, 3000);
  };

  const handleResetChat = () => {
    if (
      window.confirm(
        "現在のチャット履歴を本当にリセットしますか？この操作は元に戻せません。"
      )
    ) {
      resetCurrentChat();
      closeModal();
    }
  };

  return (
    <BaseModal
      isOpen={isModalOpen}
      onClose={closeModal}
      title="設定"
      className="settings-modal"
    >
      <div className="settings-modal-content">
        {/* API Keys Section */}
        <h3>API Keys</h3>
        <div className="api-keys-section settings-input-area">
          <label htmlFor="openrouter-api-key">OpenRouter API Key:</label>
          <input
            type="password"
            id="openrouter-api-key"
            className="model-input"
            placeholder="sk-or-xxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={tempOpenRouterApiKey}
            onChange={(e) => setTempOpenRouterApiKey(e.target.value)}
          />
          <button onClick={handleSaveApiKeys} className="add-button">
            Save API Key
          </button>
        </div>

        {/* Danger Zone - Chat Reset */}
        <h3>Danger Zone</h3>
        <div className="danger-zone-section settings-input-area">
          <p
            style={{
              flexBasis: "100%",
              color: "rgba(255,255,255,0.7)",
              fontSize: "0.9em",
              marginBottom: "0.5em",
            }}
          >
            現在のチャットスレッドの全メッセージ履歴をクリアします。この操作は取り消せません。
          </p>
          <button
            onClick={handleResetChat}
            className="delete-button"
            style={{
              backgroundColor: "rgba(255, 59, 48, 0.2)",
              color: "#ff3b30",
              borderColor: "rgba(255, 59, 48, 0.4)",
            }}
          >
            現在のチャットをリセット
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
