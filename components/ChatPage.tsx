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
  const { isGenerating, handleSend } = useChatLogicContext();
  const params = useParams();

  const [chatInput, setChatInput] = useState<
    { type: string; text?: string; image_url?: { url: string } }[]
  >([{ type: "text", text: "" }]);
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
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  console.log(
    "[DEBUG ChatPage] Rendering. params.id:",
    params.id,
    "isSharedView:",
    isSharedView,
    "isMobile:",
    isMobile,
    "hasActualChats:",
    hasActualChats
  );

  if (!params.id && !isSharedView) {
    console.log(
      "[DEBUG ChatPage] Rendering initial screen (no params.id AND not isSharedView)"
    );
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
          handleStopAllGeneration={() => {}}
          isInitialScreen={!hasActualChats}
        />
        <SettingsModal />
      </>
    );
  }

  console.log(
    "[DEBUG ChatPage] Rendering chat screen. Preparing to render ChatResponses."
  );
  return (
    <>
      <Header />
      <SettingsModal />
      <ChatResponses readOnly={false} />
    </>
  );
}
