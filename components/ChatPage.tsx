"use client";

import React, { useEffect, Suspense } from "react";
import "@/styles/chat.scss";
import MainHeader from "./MainHeader";
import ChatResponses from "./ChatResponses";
import InputSection from "./InputSection";
import SettingsModal from "./SettingsModal";
import ModelModal from "./ModelModal";
import ModelSelectorSlideout from "./ModelSelectorSlideout";
import ToolsModal from "./ToolsModal";
import ShareChatModal from "./ShareChatModal";
import GistConnectionModal from "./GistConnectionModal";
import {
  getShareStatus,
  publishChat,
  updateChatGist,
} from "@/utils/shareChatUtils";
import type { ShareStatus } from "@/utils/shareChatUtils";
import BentoFeatures from "./BentoFeatures";
import ChatList from "./ChatList";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import { logger } from "@/utils/logger";
import { storage } from "hooks/useLocalStorage";

interface ChatPageProps {
  isSharedView?: boolean;
}

export default function ChatPage({ isSharedView = false }: ChatPageProps) {
  const {
    messages,
    isGenerating,
    handleSend,
    initialLoadComplete,
    error,
    apiKeyError,
    roomId,
    chatInput,
    setChatInput,
    handleStopAllGeneration,
    handleResetAndRegenerate,
    handleSaveOnly,
    isModelModalOpen,
    handleCloseModelModal,
    isModelSelectorSlideoutOpen,
    handleCloseModelSelectorSlideout,
    isToolsModalOpen,
    handleCloseToolsModal,
    handleOpenModal,
  } = useChatLogicContext();

  // --- シェア機能用 state ---
  const [shareStatus, setShareStatus] = React.useState<ShareStatus | null>(
    null
  );
  const [isShareModalOpen, setShareModalOpen] = React.useState(false);
  const [showGistModal, setShowGistModal] = React.useState(false);

  const openShareModal = async (targetChatId?: string) => {
    const chatId = targetChatId || roomId || "default";
    const key = `chatMessages_${chatId}`;
    const chatData = storage.get(key) || [];

    if (chatData.length === 0) {
      alert("シェアするチャットデータがありません");
      return;
    }

    const status = await getShareStatus(chatId, chatData);
    setShareStatus(status);
    setShareModalOpen(true);
  };

  // GitHub OAuth メッセージ監視
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      const { type, token, error } = event.data;

      if (type === "github_oauth_success" && token) {
        storage.set("gistToken", token);
        storage.set("gistOAuthSuccess", "true");
        setShowGistModal(false);
        alert(
          "GitHubアカウントとの連携に成功しました。再度シェアを実行してください。"
        );
      } else if (type === "github_oauth_error") {
        console.error("GitHub OAuthエラー (postMessage):", error);
        alert(`GitHub連携エラー: ${error || "不明なエラー"}`);
        setShowGistModal(false);
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, []);

  // MainHeader から渡される onShare 用
  const handleShare = () => {
    const gistToken = storage.getGistToken();
    if (!gistToken) {
      setShowGistModal(true);
      return;
    }
    openShareModal();
  };

  const handlePublish = async () => {
    const chatId = roomId || "default";
    const key = `chatMessages_${chatId}`;
    const chatData = storage.get(key) || [];
    const result = await publishChat(chatId, chatData);
    if (result.success) {
      setShareStatus({
        isPublished: true,
        gistId: result.gistId,
        shareUrl: result.shareUrl,
        needsUpdate: false,
      });
    } else {
      alert(result.message || "共有エラー");
    }
  };

  const handleUpdate = async () => {
    if (!shareStatus?.gistId) return;
    const chatId = roomId || "default";
    const key = `chatMessages_${chatId}`;
    const chatData = storage.get(key) || [];
    const result = await updateChatGist(chatId, chatData, shareStatus.gistId);
    if (result.success) {
      setShareStatus({
        ...shareStatus,
        shareUrl: result.shareUrl,
        needsUpdate: false,
      });
    } else {
      alert(result.message || "更新エラー");
    }
  };

  // チャットリストの有無をbodyクラスで管理
  useEffect(() => {
    const checkAndSetChatClass = () => {
      const chatKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith("chatMessages_")
      );

      let hasValidChats = false;
      for (const key of chatKeys) {
        const item = localStorage.getItem(key);
        if (item && item !== "undefined") {
          try {
            const parsed = JSON.parse(item);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // ConversationTurn形式またはAppMessage形式の有効なデータがあるかチェック
              const hasData = parsed.some((item: any) => {
                if (item.userMessage && item.assistantResponses) {
                  // ConversationTurn形式
                  return true;
                } else if (
                  item.role === "user" &&
                  typeof item.content === "string" &&
                  item.content.trim() !== ""
                ) {
                  // AppMessage形式
                  return true;
                }
                return false;
              });
              if (hasData) {
                hasValidChats = true;
                break;
              }
            }
          } catch (e) {
            // 無効なデータは無視
          }
        }
      }

      if (hasValidChats) {
        document.body.classList.add("has-chats");
      } else {
        document.body.classList.remove("has-chats");
      }
    };

    if (!roomId && !isSharedView) {
      checkAndSetChatClass();
      window.addEventListener("storage", checkAndSetChatClass);
      window.addEventListener("chatListUpdate", checkAndSetChatClass);

      return () => {
        window.removeEventListener("storage", checkAndSetChatClass);
        window.removeEventListener("chatListUpdate", checkAndSetChatClass);
      };
    }
  }, [roomId, isSharedView]);

  logger.debug(
    "[DEBUG ChatPage] Rendering. roomId:",
    roomId,
    "isSharedView:",
    isSharedView,
    "initialLoadComplete:",
    initialLoadComplete,
    "error:",
    error
  );

  // メッセージの詳細ログを追加
  if (messages && messages.length > 0) {
    logger.debug("[DEBUG ChatPage] Current messages count:", messages.length);
    logger.debug(
      "[DEBUG ChatPage] Messages content:",
      JSON.stringify(messages, null, 2)
    );
  } else {
    logger.debug("[DEBUG ChatPage] No messages available to display");
  }

  // メッセージがある場合はチャット画面を表示するよう修正
  const isInitialScreen =
    !roomId && !isSharedView && (!messages || messages.length === 0);
  logger.debug(
    "[DEBUG ChatPage] isInitialScreen:",
    isInitialScreen,
    "messages.length:",
    messages?.length || 0
  );

  if (isInitialScreen) {
    logger.debug("[DEBUG ChatPage] Rendering initial screen");
    return (
      <>
        <MainHeader onShare={handleShare} />
        <BentoFeatures />
        <div className="chat-list-container">
          <Suspense fallback={<div>Loading chats...</div>}>
            <ChatList onRequestShare={openShareModal} />
          </Suspense>
        </div>
        <InputSection
          mainInput={true}
          chatInput={chatInput}
          setChatInput={setChatInput}
          isEditMode={false}
          messageId=""
          handleResetAndRegenerate={async (
            messageId: string,
            newContent: string
          ) => {
            console.warn(
              "handleResetAndRegenerate called on initial screen input."
            );
          }}
          handleSaveOnly={(messageId: string, newContent: string) => {
            console.warn("handleSaveOnly called on initial screen input.");
          }}
          isInitialScreen={true}
          handleStopAllGeneration={handleStopAllGeneration}
          isGenerating={isGenerating}
        />
        <SettingsModal />
        <ModelModal isOpen={isModelModalOpen} onClose={handleCloseModelModal} />
        <ModelSelectorSlideout
          isOpen={isModelSelectorSlideoutOpen}
          onClose={handleCloseModelSelectorSlideout}
        />
        <ToolsModal isOpen={isToolsModalOpen} onClose={handleCloseToolsModal} />
        {showGistModal && (
          <GistConnectionModal
            closeModal={() => setShowGistModal(false)}
            onSuccess={() => {
              setShowGistModal(false);
              openShareModal();
            }}
          />
        )}
        {/* シェアモーダル */}
        {isShareModalOpen && shareStatus && (
          <ShareChatModal
            isOpen={isShareModalOpen}
            onClose={() => setShareModalOpen(false)}
            isPublished={shareStatus.isPublished}
            shareUrl={shareStatus.shareUrl}
            needsUpdate={shareStatus.needsUpdate}
            onPublish={handlePublish}
            onUpdate={handleUpdate}
          />
        )}
      </>
    );
  }

  // roomIdがあるか、メッセージがある場合はチャット画面を表示するよう修正
  if (roomId || isSharedView || (messages && messages.length > 0)) {
    logger.debug(
      "[DEBUG ChatPage] Rendering chat screen. Messages count:",
      messages.length
    );
    return (
      <>
        <MainHeader onShare={handleShare} />

        {/* APIキーエラー表示 */}
        {apiKeyError && !isSharedView && (
          <div className="api-key-error-banner">
            <div className="error-content">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{apiKeyError}</span>
              <button onClick={handleOpenModal} className="error-action-button">
                設定を開く
              </button>
            </div>
          </div>
        )}

        <div className="responses-container" id="responses-container">
          <ChatResponses readOnly={isSharedView} />
        </div>
        <InputSection
          mainInput={true}
          chatInput={chatInput}
          setChatInput={setChatInput}
          isEditMode={false}
          messageId=""
          handleResetAndRegenerate={handleResetAndRegenerate}
          handleSaveOnly={handleSaveOnly}
          isInitialScreen={false}
          handleStopAllGeneration={handleStopAllGeneration}
          isGenerating={isGenerating}
        />
        <SettingsModal />
        <ModelModal isOpen={isModelModalOpen} onClose={handleCloseModelModal} />
        <ModelSelectorSlideout
          isOpen={isModelSelectorSlideoutOpen}
          onClose={handleCloseModelSelectorSlideout}
        />
        <ToolsModal isOpen={isToolsModalOpen} onClose={handleCloseToolsModal} />
        {showGistModal && (
          <GistConnectionModal
            closeModal={() => setShowGistModal(false)}
            onSuccess={() => {
              setShowGistModal(false);
              openShareModal();
            }}
          />
        )}
        {/* シェアモーダル */}
        {isShareModalOpen && shareStatus && (
          <ShareChatModal
            isOpen={isShareModalOpen}
            onClose={() => setShareModalOpen(false)}
            isPublished={shareStatus.isPublished}
            shareUrl={shareStatus.shareUrl}
            needsUpdate={shareStatus.needsUpdate}
            onPublish={handlePublish}
            onUpdate={handleUpdate}
          />
        )}
      </>
    );
  }

  logger.warn("[DEBUG ChatPage] Rendering Fallback - unexpected state");
  return (
    <>
      <MainHeader onShare={handleShare} />
      <SettingsModal />
      <ModelModal isOpen={isModelModalOpen} onClose={handleCloseModelModal} />
      <ModelSelectorSlideout
        isOpen={isModelSelectorSlideoutOpen}
        onClose={handleCloseModelSelectorSlideout}
      />
      <ToolsModal isOpen={isToolsModalOpen} onClose={handleCloseToolsModal} />
      <div className="error-container">
        <p>問題が発生しました。ページをリロードしてみてください。</p>
      </div>
    </>
  );
}
