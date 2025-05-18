"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "@/styles/ChatList.module.scss";
import { useChats } from "hooks/useLocalStorage";
import { storage } from "hooks/useLocalStorage";
import { navigateWithTransition } from "@/utils/navigation";
import GistConnectionModal from "./GistConnectionModal";
import { saveToGist } from "@/utils/gistUtils";

interface ChatItem {
  id: string;
  title: string;
  firstMessage: string;
  timestamp: number;
}

export default function ChatList() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const { chatIds } = useChats();
  const [showGistModal, setShowGistModal] = useState<boolean>(false);
  const [selectedChatForSharing, setSelectedChatForSharing] = useState<
    string | null
  >(null);

  useEffect(() => {
    const loadChats = () => {
      const chatItems: ChatItem[] = [];
      chatIds.forEach((chatId) => {
        const key = `chatMessages_${chatId}`;
        const chatData = storage.get(key) || [];
        if (chatData.length > 0) {
          const firstMessage = chatData[0];

          // タイムスタンプを後ろから順に探索
          let timestamp = null;
          for (let j = chatData.length - 1; j >= 0; j--) {
            if (chatData[j].timestamp) {
              timestamp = chatData[j].timestamp;
              break;
            }
          }

          chatItems.push({
            id: chatId,
            title: chatId,
            firstMessage:
              firstMessage.user[0]?.text?.slice(0, 20) || "No messages",
            timestamp: timestamp || -1,
          });
        }
      });
      setChats(chatItems.sort((a, b) => b.timestamp - a.timestamp));
    };
    loadChats();
  }, [chatIds]);

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
        alert(`エラー: ${result.message || "不明なエラー"}`);
      }
    } catch (error) {
      console.error("共有中にエラーが発生しました:", error);
      alert("共有中にエラーが発生しました");
    }

    setActiveMenu(null);
  };

  const handleGistConnectSuccess = () => {
    if (selectedChatForSharing) {
      shareChat(selectedChatForSharing);
    }
  };

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
            <div className={styles.chatItemContent}>
              <div className={styles.chatItemFirstMessage}>
                {chat.firstMessage}
              </div>
              <div className={styles.chatItemMeta}>
                <div className={styles.chatItemTimestamp}>
                  {chat.timestamp === -1
                    ? "0000/00/00"
                    : new Date(chat.timestamp).toLocaleString(undefined, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </div>
                <div className={styles.chatItemTitle}>{chat.title}</div>
              </div>
            </div>
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
