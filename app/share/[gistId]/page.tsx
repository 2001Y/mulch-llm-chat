"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchFromGist } from "@/utils/gistUtils";
import ChatResponses from "@/components/ChatResponses";
import Header from "@/components/Header";
import { ChatLogicProvider } from "contexts/ChatLogicContext";

function SharedChatPageContent() {
  const params = useParams();
  const gistId = params.gistId as string;
  const [chatData, setChatData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSharedChat = async () => {
      try {
        setLoading(true);
        const data = await fetchFromGist(gistId);
        if (data.success) {
          setChatData(data.chatData);
        } else {
          setError(data.message || "共有チャットの読み込みに失敗しました");
        }
      } catch (err) {
        console.error("共有チャットの読み込みエラー:", err);
        setError("共有チャットの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };

    if (gistId) {
      loadSharedChat();
    }
  }, [gistId]);

  return (
    <div className="chat-container">
      <Header />
      <div className="chat-content">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>共有チャットを読み込み中...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <p>
              このチャットは削除されたか、アクセス権限がない可能性があります。
            </p>
          </div>
        ) : chatData ? (
          <ChatResponses readOnly={true} initialMessages={chatData} />
        ) : null}
      </div>
    </div>
  );
}

export default function SharedChatPage() {
  return (
    <ChatLogicProvider>
      <SharedChatPageContent />
    </ChatLogicProvider>
  );
}
