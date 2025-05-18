"use client";

import React, { useState, useEffect } from "react";
import "@/styles/chat.scss";
import { useParams } from "next/navigation";
import Header from "./Header";
import ChatResponses from "./ChatResponses";
import InputSection from "./InputSection";
import SettingsModal from "./SettingsModal";
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
  } = useChatLogicContext();

  const [hasActualChats, setHasActualChats] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkActualChats = () => {
      const chatKeys = Object.keys(localStorage).filter(
        (key) =>
          key.startsWith("chatMessages_") &&
          key !== "chatMessages_default" &&
          (() => {
            const item = localStorage.getItem(key);
            if (item && item !== "undefined") {
              try {
                return (JSON.parse(item) || []).some((msg: any) =>
                  msg.user?.some((u: any) => u.text?.trim())
                );
              } catch (e) {
                console.error(`Failed to parse localStorage item ${key}:`, e);
                return false;
              }
            }
            return false;
          })()
      );
      setHasActualChats(chatKeys.length > 0);
    };

    if (!roomId && !isSharedView) {
      checkActualChats();
      window.addEventListener("storage", (e) => {
        if (e.key?.startsWith("chatMessages_")) {
          checkActualChats();
        }
      });
      window.addEventListener("chatListUpdate", checkActualChats);

      return () => {
        window.removeEventListener("storage", checkActualChats);
        window.removeEventListener("chatListUpdate", checkActualChats);
      };
    }
  }, [roomId, isSharedView]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  if (!initialLoadComplete && !error) {
    console.log("[DEBUG ChatPage] Rendering Loading State");
    return (
      <>
        <Header />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>
            {isSharedView
              ? "共有チャットを読み込み中..."
              : "チャットを読み込み中..."}
          </p>
        </div>
        <SettingsModal />
      </>
    );
  }

  if (error) {
    console.log("[DEBUG ChatPage] Rendering Error State. Error:", error);
    return (
      <>
        <Header />
        <div className="error-container">
          <p className="error-message">{error}</p>
          {isSharedView && (
            <p>
              このチャットは削除されたか、アクセス権限がない可能性があります。
            </p>
          )}
        </div>
        <SettingsModal />
      </>
    );
  }

  const isInitialScreen = !roomId && !isSharedView;

  if (isInitialScreen && initialLoadComplete) {
    console.log("[DEBUG ChatPage] Rendering initial screen");
    return (
      <>
        <Header />
        {(!isMobile || (isMobile && !hasActualChats)) && <BentoFeatures />}
        {hasActualChats && (
          <div className="chat-list-container">
            <ChatList />
          </div>
        )}
        <InputSection
          mainInput={true}
          chatInput={chatInput}
          setChatInput={setChatInput}
          handleSend={handleSend}
          isEditMode={false}
          messageIndex={0}
          handleResetAndRegenerate={() => {}}
          handleSaveOnly={() => {}}
          isGenerating={isGenerating}
          handleStopAllGeneration={handleStopAllGeneration}
          isInitialScreen={true}
        />
        <SettingsModal />
      </>
    );
  }

  if ((roomId || isSharedView) && initialLoadComplete) {
    console.log("[DEBUG ChatPage] Rendering chat screen.");
    return (
      <>
        <Header />
        <SettingsModal />
        <ChatResponses readOnly={isSharedView} />
        {!isSharedView && (
          <InputSection
            mainInput={true}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSend={handleSend}
            isEditMode={false}
            messageIndex={messages.length}
            handleResetAndRegenerate={handleResetAndRegenerate}
            handleSaveOnly={handleSaveOnly}
            isGenerating={isGenerating}
            handleStopAllGeneration={handleStopAllGeneration}
            isInitialScreen={false}
          />
        )}
      </>
    );
  }

  console.warn("[DEBUG ChatPage] Rendering Fallback - unexpected state");
  return (
    <>
      <Header />
      <SettingsModal />
      <div className="error-container">
        <p>問題が発生しました。ページをリロードしてみてください。</p>
      </div>
    </>
  );
}
