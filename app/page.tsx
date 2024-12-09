"use client";

import { useEffect, useState } from "react";
import "@/styles/chat.scss";
import { useChatLogic } from "hooks/useChatLogic";
import InputSection from "components/InputSection";
import { useRouter } from "next/navigation";
import useAccessToken from "hooks/useAccessToken";
import ModelInputModal from "components/SettingsModal";
import useStorageState from "hooks/useLocalStorage";
import Header from "components/Header";
import ChatList from "components/ChatList";
import BentoFeatures from "components/BentoFeatures";

export default function ChatListPage() {
  const {
    selectedModels,
    setSelectedModels,
    messages,
    setMessages,
    isGenerating,
    setIsGenerating,
    isModalOpen,
    handleOpenModal,
    handleCloseModal,
    handleNewChat,
    handleSend,
  } = useChatLogic();

  const [accessToken, setAccessToken] = useAccessToken();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tools, setTools] = useStorageState("tools");
  const [models, setModels] = useStorageState("models");
  const [toolFunctions, setToolFunctions] = useStorageState("toolFunctions");
  const [chatInput, setChatInput] = useState<
    { type: string; text?: string; image_url?: { url: string } }[]
  >([{ type: "text", text: "" }]);
  const [hasActualChats, setHasActualChats] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!accessToken);
  }, [accessToken]);

  useEffect(() => {
    const checkActualChats = () => {
      const chatKeys = Object.keys(localStorage).filter(
        (key) =>
          key.startsWith("chatMessages_") &&
          key !== "chatMessages_default" &&
          JSON.parse(localStorage.getItem(key) || "[]").some((msg: any) =>
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

  const handleLogout = () => {
    setAccessToken("");
    setSelectedModels([]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewChat]);

  return (
    <>
      <Header setIsModalOpen={handleOpenModal} isLoggedIn={isLoggedIn} />

      {(!isMobile || (isMobile && !hasActualChats)) && <BentoFeatures />}

      {hasActualChats && (
        <div className="chat-list-container">
          <ChatList />
        </div>
      )}

      <InputSection
        mainInput={true}
        models={models}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleSend={handleSend}
        selectedModels={selectedModels}
        setSelectedModels={setSelectedModels}
        isEditMode={false}
        messageIndex={0}
        handleResetAndRegenerate={() => {}}
        handleSaveOnly={() => {}}
        isGenerating={isGenerating}
        handleStopAllGeneration={() => {}}
        isInitialScreen={!hasActualChats}
      />

      <ModelInputModal
        models={models}
        setModels={setModels}
        isModalOpen={isModalOpen}
        closeModal={handleCloseModal}
        // tools={tools}
        // setTools={setTools}
        // toolFunctions={toolFunctions}
        // setToolFunctions={setToolFunctions}
      />
    </>
  );
}
