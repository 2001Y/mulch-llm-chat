"use client";
import "@/styles/chat.scss";

import Responses from "components/ChatResponses";
import Header from "components/Header";
import { ChatLogicProvider } from "contexts/ChatLogicContext";

export default function SharePage() {
  return (
    <ChatLogicProvider>
      <Header />
      <Responses readonly={true} />
    </ChatLogicProvider>
  );
}
