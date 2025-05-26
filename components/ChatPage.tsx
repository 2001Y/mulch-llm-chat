"use client";

import React, { useEffect, Suspense } from "react";
import "@/styles/chat.scss";
import { useParams } from "next/navigation";
import MainHeader from "./MainHeader";
import ChatResponses from "./ChatResponses";
import InputSection from "./InputSection";
import SettingsModal from "./SettingsModal";
import ModelModal from "./ModelModal";
import ModelSelectorSlideout from "./ModelSelectorSlideout";
import ToolsModal from "./ToolsModal";
import BentoFeatures from "./BentoFeatures";
import ChatList from "./ChatList";
import { useChatLogicContext } from "contexts/ChatLogicContext";

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
  } = useChatLogicContext();

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

  console.log(
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
    console.log("[DEBUG ChatPage] Current messages count:", messages.length);
    console.log(
      "[DEBUG ChatPage] Messages content:",
      JSON.stringify(messages, null, 2)
    );
  } else {
    console.log("[DEBUG ChatPage] No messages available to display");
  }

  // メッセージがある場合はチャット画面を表示するよう修正
  const isInitialScreen =
    !roomId && !isSharedView && (!messages || messages.length === 0);
  console.log(
    "[DEBUG ChatPage] isInitialScreen:",
    isInitialScreen,
    "messages.length:",
    messages?.length || 0
  );

  const handleShare = () => {
    // 共有機能の実装
    console.log("Share functionality will be implemented here");
    // TODO: 共有機能を実装
  };

  if (isInitialScreen) {
    console.log("[DEBUG ChatPage] Rendering initial screen");
    return (
      <>
        <MainHeader onShare={handleShare} />
        <BentoFeatures />
        <div className="chat-list-container">
          <Suspense fallback={<div>Loading chats...</div>}>
            <ChatList />
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
      </>
    );
  }

  // roomIdがあるか、メッセージがある場合はチャット画面を表示するよう修正
  if (roomId || isSharedView || (messages && messages.length > 0)) {
    console.log(
      "[DEBUG ChatPage] Rendering chat screen. Messages count:",
      messages.length
    );
    return (
      <>
        <MainHeader onShare={handleShare} />
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
      </>
    );
  }

  console.warn("[DEBUG ChatPage] Rendering Fallback - unexpected state");
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
