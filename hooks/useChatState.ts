"use client";
import { useState, useEffect } from "react";
import { storage } from "./useLocalStorage";

export const useChatState = (chatId: string) => {
  const [state, setState] = useState(() => {
    console.log("Initializing chat state for:", chatId);
    return storage.get(`chatMessages_${chatId}`) || [];
  });

  const debugStateUpdate = (newState: any) => {
    console.log("Chat state update:", {
      chatId,
      previousState: state,
      newState,
      timestamp: Date.now(),
      stack: new Error().stack,
    });
    setState(newState);
  };

  useEffect(() => {
    return () => {
      console.log("Chat state cleanup:", {
        chatId,
        finalState: state,
        timestamp: Date.now(),
      });
    };
  }, [chatId, state]);

  return [state, debugStateUpdate];
};
