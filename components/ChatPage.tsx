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
                return (JSON.parse(item) || []).some(
                  (msg: any) =>
                    typeof msg.user === "string" && msg.user.trim() !== ""
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

  if (isInitialScreen) {
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
          isEditMode={false}
          messageIndex={0}
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
        <Header />
        <div className="responses-container" id="responses-container">
          <ChatResponses readOnly={isSharedView} />
        </div>
        <InputSection
          mainInput={true}
          chatInput={chatInput}
          setChatInput={setChatInput}
          isEditMode={false}
          messageIndex={0}
          handleResetAndRegenerate={handleResetAndRegenerate}
          handleSaveOnly={handleSaveOnly}
          isInitialScreen={false}
          handleStopAllGeneration={handleStopAllGeneration}
          isGenerating={isGenerating}
        />
        <SettingsModal />
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
