"use client";
import "@/styles/chat.scss";

import Responses from "components/ChatResponses";
import Header from "components/Header";
import SettingsModal from "components/SettingsModal";
import { ChatLogicProvider } from "contexts/ChatLogicContext";

export default function ChatPage() {
  return (
    <ChatLogicProvider>
      <Header />
      <SettingsModal />
      <Responses />
    </ChatLogicProvider>
  );
}
