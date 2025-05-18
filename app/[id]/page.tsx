"use client";
import "@/styles/chat.scss";
import ChatPage from "components/ChatPage";
import { ChatLogicProvider } from "contexts/ChatLogicContext";

export default function IndividualChatPage() {
  return (
    <ChatLogicProvider isShared={false}>
      <ChatPage isSharedView={false} />
    </ChatLogicProvider>
  );
}
