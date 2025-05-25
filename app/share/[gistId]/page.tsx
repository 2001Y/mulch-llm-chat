"use client";

import "@/styles/chat.scss";
import { useParams } from "next/navigation";
import ChatPage from "@/components/ChatPage";
import { ChatLogicProvider } from "contexts/ChatLogicContext";
import { useEffect, useState } from "react";
import { fetchFromGist } from "@/utils/gistUtils";

export default function SharedChatPage() {
  const params = useParams();
  const gistId = params.gistId as string;

  const [initialMessages, setInitialMessages] = useState<any[] | undefined>(
    undefined
  );
  const [initialError, setInitialError] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const loadSharedChat = async () => {
      if (!gistId) {
        setInitialError("Gist IDが指定されていません。");
        setDataLoaded(true);
        return;
      }
      try {
        const data = await fetchFromGist(gistId);
        if (data.success) {
          setInitialMessages(data.chatData);
          setInitialError(null);
        } else {
          setInitialMessages(undefined);
          setInitialError(
            data.message || "共有チャットの読み込みに失敗しました"
          );
        }
      } catch (err) {
        setInitialMessages(undefined);
        setInitialError(
          "共有チャットの読み込み中に予期せぬエラーが発生しました"
        );
        console.error("[DEBUG SharePage] fetchFromGist threw error:", err);
      } finally {
        setDataLoaded(true);
      }
    };
    loadSharedChat();
  }, [gistId]);

  if (!dataLoaded) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>共有情報を準備中...</p>
      </div>
    );
  }

  return (
    <ChatLogicProvider
      isShared={true}
      initialMessages={initialMessages}
      initialError={initialError}
    >
      <ChatPage isSharedView={true} />
    </ChatLogicProvider>
  );
}
