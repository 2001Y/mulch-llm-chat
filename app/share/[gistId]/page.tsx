"use client";

import "@/styles/chat.scss";
import { useParams } from "next/navigation";
import ChatPage from "@/components/ChatPage"; // ChatPage をインポート
import { ChatLogicProvider } from "contexts/ChatLogicContext";
import { useEffect, useState } from "react";
import { fetchFromGist } from "@/utils/gistUtils";
import Header from "@/components/Header";
// import ChatResponses from "@/components/ChatResponses"; // ChatPage を使うので不要

export default function SharedChatPage() {
  const params = useParams();
  const gistId = params.gistId as string;
  const [chatData, setChatData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSharedChat = async () => {
      console.log("[DEBUG SharePage] loadSharedChat started. gistId:", gistId);
      if (!gistId) {
        console.log("[DEBUG SharePage] gistId is missing");
        setError("Gist IDが指定されていません。");
        setIsLoading(false);
        return;
      }
      try {
        console.log("[DEBUG SharePage] Calling fetchFromGist");
        const data = await fetchFromGist(gistId);
        console.log("[DEBUG SharePage] fetchFromGist response:", data);
        if (data.success) {
          console.log(
            "[DEBUG SharePage] fetchFromGist success. Setting chatData:",
            data.chatData
          );
          setChatData(data.chatData);
        } else {
          console.log(
            "[DEBUG SharePage] fetchFromGist failed. Setting error:",
            data.message
          );
          setError(data.message || "共有チャットの読み込みに失敗しました");
        }
      } catch (err) {
        console.error("[DEBUG SharePage] fetchFromGist threw error:", err);
        setError("共有チャットの読み込みに失敗しました");
      } finally {
        console.log(
          "[DEBUG SharePage] loadSharedChat finally block. Setting isLoading to false."
        );
        setIsLoading(false);
      }
    };
    loadSharedChat();
  }, [gistId]);

  console.log(
    "[DEBUG SharePage] Rendering. isLoading:",
    isLoading,
    "error:",
    error,
    "chatData:",
    chatData
  );

  return (
    <ChatLogicProvider isShared={true} initialMessages={chatData || undefined}>
      <div className="chat-container">
        {/* Header は ChatPage の中に含まれるので、ここでは不要 */}
        {/* <Header /> */}
        <div className="chat-content">
          {isLoading ? (
            <>
              <Header /> {/* ローディング中でもヘッダーは表示 */}
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>共有チャットを読み込み中...</p>
              </div>
            </>
          ) : error ? (
            <>
              <Header /> {/* エラー時もヘッダーは表示 */}
              <div className="error-container">
                <p className="error-message">{error}</p>
                <p>
                  このチャットは削除されたか、アクセス権限がない可能性があります。
                </p>
              </div>
            </>
          ) : !chatData ? (
            <>
              <Header /> {/* データなしの場合もヘッダーは表示 */}
              <div className="error-container">
                <p className="error-message">
                  チャットデータが見つかりません。
                </p>
              </div>
            </>
          ) : (
            // 正常に読み込めた場合は ChatPage を表示
            // ChatPage 内部で Header もレンダリングされる
            <ChatPage isSharedView={true} />
          )}
        </div>
      </div>
    </ChatLogicProvider>
  );
}
