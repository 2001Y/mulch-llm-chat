import React, { useState, useEffect, useRef } from "react";
import BaseModal from "./BaseModal";
import useStorageState from "hooks/useLocalStorage";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import { storage } from "hooks/useLocalStorage";

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

  const [mounted, setMounted] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingToolDefinition, setEditingToolDefinition] = useState("");
  const [editingToolFunction, setEditingToolFunction] = useState("");

  const [storedTools, setStoredTools] = useStorageState("tools");
  const tools: Tool[] = storedTools || [];
  const setTools = (newTools: Tool[]) => {
    setStoredTools(newTools);
  };

  const [toolFunctions, setToolFunctions] = useStorageState("toolFunctions");

  // OpenRouter ログイン処理
  const handleOpenRouterLogin = () => {
    window.open(
      "https://openrouter.ai/auth?callback_url=" +
        encodeURIComponent(window.location.origin + "/api/auth/callback"),
      "_blank",
      "width=500,height=600"
    );
  };

  // OpenRouter ログアウト処理
  const handleOpenRouterLogout = () => {
    storage.remove("accessToken");
    window.dispatchEvent(new Event("tokenChange"));
    window.location.reload();
  };

  // GitHub ログイン処理
  const handleGitHubLogin = () => {
    setIsGitHubLoading(true);
    setAuthError("");
    const githubAuthUrl = "/api/auth/github/login";
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const oauthWindow = window.open(
      githubAuthUrl,
      "githubOAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    if (
      !oauthWindow ||
      oauthWindow.closed ||
      typeof oauthWindow.closed === "undefined"
    ) {
      setAuthError(
        "GitHub認証ウィンドウを開けませんでした。ポップアップがブロックされていないか確認してください。"
      );
      setIsGitHubLoading(false);
      return;
    }

    // ウィンドウが閉じられたかチェック
    const checkClosed = setInterval(() => {
      if (oauthWindow.closed) {
        setIsGitHubLoading(false);
        clearInterval(checkClosed);
      }
    }, 1000);
  };

  // GitHub ログアウト処理
  const handleGitHubLogout = () => {
    storage.remove("gistToken");
    storage.remove("gistOAuthSuccess");
    window.dispatchEvent(new Event("storage"));
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

  if (!mounted) {
    return null;
  }

  const isOpenRouterLoggedIn = !!storage.getAccessToken();
  const isGitHubLoggedIn = !!storage.getGistToken();

  return (
    <BaseModal
      isOpen={isModalOpen}
      onClose={closeModal}
      title="設定"
      className="settings-modal"
    >
      <div className="settings-modal-content">
        {/* Authentication Section */}
        <h3>認証設定</h3>

        {/* OpenRouter Authentication */}
        <div className="auth-section settings-input-area">
          <div className="auth-item">
            <div className="auth-info">
              <h4>OpenRouter</h4>
              <p>AI モデルへのアクセスに必要です</p>
              <div className="auth-status">
                ステータス:{" "}
                {isOpenRouterLoggedIn ? (
                  <span style={{ color: "#00ff00" }}>✓ 認証済み</span>
                ) : (
                  <span style={{ color: "#ff6b6b" }}>未認証</span>
                )}
              </div>
            </div>
            <div className="auth-actions">
              {isOpenRouterLoggedIn ? (
                <button
                  onClick={handleOpenRouterLogout}
                  className="logout-button"
                  style={{
                    backgroundColor: "rgba(255, 59, 48, 0.2)",
                    color: "#ff3b30",
                    borderColor: "rgba(255, 59, 48, 0.4)",
                  }}
                >
                  ログアウト
                </button>
              ) : (
                <button
                  onClick={handleOpenRouterLogin}
                  className="login-button add-button"
                >
                  OpenRouterでログイン
                </button>
              )}
            </div>
          </div>
        </div>

        {/* GitHub Gist Authentication */}
        <div className="auth-section settings-input-area">
          <div className="auth-item">
            <div className="auth-info">
              <h4>GitHub Gist</h4>
              <p>チャット履歴の共有とバックアップに必要です</p>
              <div className="auth-status">
                ステータス:{" "}
                {isGitHubLoggedIn ? (
                  <span style={{ color: "#00ff00" }}>✓ 認証済み</span>
                ) : (
                  <span style={{ color: "#ff6b6b" }}>未認証</span>
                )}
              </div>
            </div>
            <div className="auth-actions">
              {isGitHubLoggedIn ? (
                <button
                  onClick={handleGitHubLogout}
                  className="logout-button"
                  style={{
                    backgroundColor: "rgba(255, 59, 48, 0.2)",
                    color: "#ff3b30",
                    borderColor: "rgba(255, 59, 48, 0.4)",
                  }}
                >
                  ログアウト
                </button>
              ) : (
                <button
                  onClick={handleGitHubLogin}
                  className="login-button add-button"
                  disabled={isGitHubLoading}
                >
                  {isGitHubLoading ? "認証中..." : "GitHubでログイン"}
                </button>
              )}
            </div>
          </div>
          {authError && (
            <div
              className="error-message"
              style={{
                color: "#ff6b6b",
                fontSize: "0.9rem",
                marginTop: "0.5rem",
              }}
            >
              {authError}
            </div>
          )}
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
