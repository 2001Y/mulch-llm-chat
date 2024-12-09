"use client";
import "@/styles/chat.scss";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Responses from "components/ChatResponses";
import useStorageState from "hooks/useLocalStorage";
import useAccessToken from "hooks/useAccessToken";
import { useOpenAI } from "hooks/useOpenAI";
import Header from "components/Header";
import { useChatLogic, ToolFunction } from "hooks/useChatLogic";
import SettingsModal from "components/SettingsModal";

export default function ChatPage() {
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
    toolFunctions,
  } = useChatLogic();

  const [models, setModels] = useStorageState("models");

  const [accessToken, setAccessToken] = useAccessToken();
  const [demoAccessToken] = useState(process.env.NEXT_PUBLIC_DEMO || "");
  const openai = useOpenAI(
    (typeof accessToken === "string" ? accessToken : "") || demoAccessToken
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const router = useRouter();

  useEffect(() => {
    setIsLoggedIn(!!accessToken);
  }, [accessToken]);

  const handleLogout = () => {
    setAccessToken("");
    setSelectedModels([]);
  };

  return (
    <>
      <Header setIsModalOpen={handleOpenModal} isLoggedIn={isLoggedIn} />
      <SettingsModal
        models={models}
        setModels={setModels}
        isModalOpen={isModalOpen}
        closeModal={handleCloseModal}
      />
      <Responses
        openai={openai}
        models={models}
        selectedModels={selectedModels}
        setSelectedModels={setSelectedModels}
        messages={messages}
        setMessages={setMessages}
      />
    </>
  );
}
