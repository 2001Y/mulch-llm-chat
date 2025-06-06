"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import styles from "@/styles/ChatList.module.scss";
import { useChats } from "hooks/useLocalStorage";
import { storage } from "hooks/useLocalStorage";
import { navigateWithTransition } from "@/utils/navigation";
import GistConnectionModal from "./GistConnectionModal";
import ChatItemContent from "./ChatItemContent";
import { saveToGist } from "@/utils/gistUtils";

interface ChatItem {
  id: string;
  title: string;
  firstMessage: string;
  timestamp: number;
}

export default function ChatList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const { chatIds } = useChats();
  const [showGistModal, setShowGistModal] = useState<boolean>(false);
  const [selectedChatForSharing, setSelectedChatForSharing] = useState<
    string | null
  >(null);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  const clearUrlQuery = useCallback(() => {
    const newUrl = pathname;
    window.history.replaceState(
      { ...window.history.state, as: newUrl, url: newUrl },
      "",
      newUrl
    );
  }, [pathname]);

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      const { type, token, error } = event.data;

      if (type === "github_oauth_success" && token) {
        console.log("GitHub OAuth成功 (postMessage):");
        storage.set("gistToken", token);
        storage.set("gistOAuthSuccess", "true");
        setShowGistModal(false);
        alert("GitHubアカウントとの連携に成功しました。");

        if (selectedChatForSharing) {
          console.log(
            `OAuth成功後、チャット ${selectedChatForSharing} の共有を再試行します。`
          );
          shareChat(selectedChatForSharing);
          setSelectedChatForSharing(null);
        }
      } else if (type === "github_oauth_error") {
        console.error("GitHub OAuthエラー (postMessage):", error);
        alert(`GitHub連携エラー: ${error || "不明なエラー"}`);
        setShowGistModal(false);
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => {
      window.removeEventListener("message", handleAuthMessage);
    };
  }, [selectedChatForSharing]);

  const loadChats = useCallback(() => {
    setIsLoadingChats(true);
    const chatItems: ChatItem[] = [];
    chatIds.forEach((chatId) => {
      const key = `chatMessages_${chatId}`;
      const chatData = storage.get(key) || [];
      if (chatData.length > 0) {
        // ConversationTurn形式のデータから最初のメッセージを取得
        const firstTurn = chatData[0];

        // タイムスタンプを後ろから順に探索（ConversationTurn形式に対応）
        let timestamp = null;
        for (let j = chatData.length - 1; j >= 0; j--) {
          const turn = chatData[j];
          if (turn && turn.userMessage && turn.userMessage.timestamp) {
            timestamp = turn.userMessage.timestamp;
            break;
          }
        }

        // 最初のユーザーメッセージを取得
        const firstMessage =
          firstTurn && firstTurn.userMessage && firstTurn.userMessage.content
            ? firstTurn.userMessage.content.slice(0, 50) +
              (firstTurn.userMessage.content.length > 50 ? "..." : "")
            : "No messages";

        chatItems.push({
          id: chatId,
          title: chatId,
          firstMessage: firstMessage,
          timestamp: timestamp || -1,
        });
      }
    });
    setChats(chatItems.sort((a, b) => b.timestamp - a.timestamp));
    setIsLoadingChats(false);
    console.log("[ChatList] Loaded chats:", chatItems);
  }, [chatIds]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const handleDelete = (chatId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    storage.remove(`chatMessages_${chatId}`);
    setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
    setActiveMenu(null);
    window.dispatchEvent(new Event("chatListUpdate"));
  };

  const handleOpenMenu = (chatId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveMenu(activeMenu === chatId ? null : chatId);
  };

  const handleChatClick = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    navigateWithTransition(router, `/${chatId}`);
  };

  const handleShare = async (chatId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const gistToken = storage.getGistToken();
    if (!gistToken) {
      setSelectedChatForSharing(chatId);
      setShowGistModal(true);
      return;
    }

    await shareChat(chatId);
  };

  const shareChat = async (chatId: string) => {
    const key = `chatMessages_${chatId}`;
    const chatData = storage.get(key) || [];

    if (chatData.length === 0) {
      alert("シェアするチャットデータがありません");
      return;
    }

    try {
      const result = await saveToGist(chatId, chatData);
      if (result.success && result.url) {
        alert(`チャットを共有しました: ${result.url}`);
        navigator.clipboard.writeText(result.url).catch(console.error);
      } else {
        if (result.reauthRequired) {
          setSelectedChatForSharing(chatId);
          setShowGistModal(true);
          console.warn(
            "GitHub認証が必要です。モーダルを表示します。",
            result.message
          );
        } else {
          alert(`共有エラー: ${result.message || "不明なエラー"}`);
        }
      }
    } catch (error) {
      console.error("共有中に予期せぬエラーが発生しました:", error);
      alert("共有中に予期せぬエラーが発生しました");
    }
    setActiveMenu(null);
  };

  const handleGistConnectSuccess = () => {
    setShowGistModal(false);
    if (selectedChatForSharing) {
      console.log(
        "OAuth成功後、再度共有処理を実行します。",
        selectedChatForSharing
      );
      shareChat(selectedChatForSharing);
    }
  };

  if (isLoadingChats && chatIds.length > 0) {
    return (
      <div className={styles.chatList}>
        <Link
          href="/"
          className={styles.newChatButton}
          onClick={(e) => {
            e.preventDefault();
            navigateWithTransition(router, "/");
          }}
        >
          Start New Chat
          <span className={styles.shortcut}>⌘N</span>
        </Link>
        {Array.from({ length: Math.min(chatIds.length, 5) }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className={`${styles.chatItem} ${styles.skeletonItem}`}
          >
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonTextShort}></div>
              <div className={styles.skeletonTextLong}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={styles.chatList}>
        <Link
          href="/"
          className={styles.newChatButton}
          onClick={(e) => {
            e.preventDefault();
            navigateWithTransition(router, "/");
          }}
        >
          Start New Chat
          <span className={styles.shortcut}>⌘N</span>
        </Link>
        {chats.map((chat) => (
          <Link
            href={`/${chat.id}`}
            key={chat.id}
            className={`${styles.chatItem} ${
              activeMenu === chat.id ? styles.menuActive : ""
            }`}
            onClick={(e) => handleChatClick(e, chat.id)}
          >
            <ChatItemContent
              firstMessage={chat.firstMessage}
              timestamp={chat.timestamp}
              title={chat.title}
              variant="list"
            />
            <div className={styles.chatItemActions}>
              <button
                className={styles.menuButton}
                onClick={(e) => handleOpenMenu(chat.id, e)}
              >
                ⋮
              </button>
              {activeMenu === chat.id && (
                <div className={styles.menuDropdown}>
                  <button onClick={(e) => handleShare(chat.id, e)}>
                    シェア
                  </button>
                  <button onClick={(e) => handleDelete(chat.id, e)}>
                    削除
                  </button>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
      {showGistModal && (
        <GistConnectionModal
          closeModal={() => setShowGistModal(false)}
          onSuccess={handleGistConnectSuccess}
        />
      )}
    </>
  );
}
