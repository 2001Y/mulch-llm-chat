"use client";

import { useEffect, useState } from "react";
import "@/styles/chat.scss";
import InputSection from "components/InputSection";
import ModelInputModal from "components/SettingsModal";
import { storage } from "hooks/useLocalStorage";
import Header from "components/Header";
import ChatList from "components/ChatList";
import BentoFeatures from "components/BentoFeatures";
import { ChatLogicProvider, useChatLogicContext } from "contexts/ChatLogicContext";

function ChatListPageContent() {
  const { isGenerating, handleSend } = useChatLogicContext();

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
          (storage.get(key) || []).some((msg: any) =>
            msg.user?.some((u: any) => u.text?.trim())
          )
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

      <ModelInputModal />
    </>
  );
}

export default function ChatListPage() {
  return (
    <ChatLogicProvider>
      <ChatListPageContent />
    </ChatLogicProvider>
  );
}
