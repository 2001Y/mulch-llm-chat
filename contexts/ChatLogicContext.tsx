"use client";
import React, { createContext, useContext } from "react";
import { useChatLogic } from "hooks/useChatLogic";

const ChatLogicContext = createContext<ReturnType<typeof useChatLogic> | null>(null);

interface ChatLogicProviderProps {
  children: React.ReactNode;
  isShared?: boolean;
  initialMessages?: any[];
}

export function ChatLogicProvider({ 
  children, 
  isShared = false,
  initialMessages = undefined
}: ChatLogicProviderProps) {
  const chatLogic = useChatLogic({ isShared, initialMessages });

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
