"use client";
import "@/styles/chat.scss";

import Responses from "components/ChatResponses";
import Header from "components/Header";
import SettingsModal from "components/SettingsModal";

export default function ChatPage() {
  return (
    <>
      <Header />
      <SettingsModal />
      <Responses />
    </>
  );
}
