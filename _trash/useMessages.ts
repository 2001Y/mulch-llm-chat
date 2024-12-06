import { useState, useEffect } from "react";
import useStorageState from "./useLocalStorage";

export type Message = {
  user: { type: string; text?: string; image_url?: { url: string } }[];
  llm: {
    model: string;
    text: string;
    isGenerating: boolean;
    selected?: boolean;
    selectedOrder?: number;
  }[];
  edited?: boolean;
};

export function useMessages(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [storedMessages, setStoredMessages] = useStorageState<Message[]>(
    `chatMessages_${roomId}`,
    []
  );
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    if (storedMessages.length > 0 && !initialLoadComplete) {
      console.log(`[useMessages] ルーム ${roomId} のメッセージを復元:`, {
        messageCount: storedMessages.length,
        messages: storedMessages,
      });
      setMessages(storedMessages);
      setInitialLoadComplete(true);
    }
  }, [storedMessages, roomId, initialLoadComplete]);

  useEffect(() => {
    if (initialLoadComplete) {
      console.log(`[useMessages] メッセージをストレージに保存:`, {
        messageCount: messages.length,
        messages: messages,
      });
      setStoredMessages(messages);
    }
  }, [messages, initialLoadComplete, setStoredMessages]);

  const updateMessage = (
    messageIndex: number,
    responseIndex: number | null,
    content?: any,
    toggleSelected?: boolean,
    saveOnly?: boolean
  ) => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages];
      const message = { ...newMessages[messageIndex] };

      if (responseIndex === null) {
        if (content !== undefined) {
          message.user =
            typeof content === "function" ? content(message.user) : content;
          message.edited =
            JSON.stringify(storedMessages[messageIndex]?.user) !==
            JSON.stringify(message.user);
        }
      } else {
        const llmResponse = { ...message.llm[responseIndex] };
        if (content !== undefined) {
          if (typeof content === "function") {
            const updatedContent = content(llmResponse.text);
            llmResponse.text = Array.isArray(updatedContent)
              ? updatedContent.map((c: any) => c.text).join("")
              : updatedContent;
          } else if (Array.isArray(content)) {
            llmResponse.text = content.map((c: any) => c.text).join("");
          }
        }
        if (toggleSelected) {
          if (llmResponse.selected) {
            llmResponse.selected = false;
            delete llmResponse.selectedOrder;
            message.llm = message.llm.map((resp) => {
              if (
                resp.selected &&
                resp.selectedOrder > llmResponse.selectedOrder!
              ) {
                return { ...resp, selectedOrder: resp.selectedOrder! - 1 };
              }
              return resp;
            });
          } else {
            const selectedCount = message.llm.filter((r) => r.selected).length;
            llmResponse.selected = true;
            llmResponse.selectedOrder = selectedCount + 1;
          }
        }
        message.llm[responseIndex] = llmResponse;
      }
      newMessages[messageIndex] = message;
      if (saveOnly) setStoredMessages(newMessages);
      return newMessages;
    });
  };

  return {
    messages,
    setMessages,
    updateMessage,
    initialLoadComplete,
  };
}
