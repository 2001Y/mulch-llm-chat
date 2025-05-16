"use client";
import React, { createContext, useContext } from "react";
import { useChatLogic } from "hooks/useChatLogic";

const ChatLogicContext = createContext<ReturnType<typeof useChatLogic> | null>(null);

export function ChatLogicProvider({ children }: { children: React.ReactNode }) {
  const chatLogic = useChatLogic();

  return (
    <ChatLogicContext.Provider value={chatLogic}>
      {children}
    </ChatLogicContext.Provider>
  );
}

export function useChatLogicContext() {
  const context = useContext(ChatLogicContext);
  if (!context) {
    throw new Error("useChatLogicContext must be used within a ChatLogicProvider");
  }
  return context;
}
