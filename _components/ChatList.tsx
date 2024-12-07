"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/_styles/ChatList.module.scss";
import { useChats } from "_hooks/useLocalStorage";

interface ChatItem {
  id: string;
  title: string;
  firstMessage: string;
  timestamp: number;
}

export default function ChatList() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const { chatIds } = useChats();

  const loadChats = () => {
    const chatItems: ChatItem[] = [];
    chatIds.forEach((chatId) => {
      const key = `chatMessages_${chatId}`;
      const chatData = JSON.parse(localStorage.getItem(key) || "[]");
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

  useEffect(() => {
    loadChats();
  }, [chatIds]);

  const handleDelete = (chatId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    localStorage.removeItem(`chatMessages_${chatId}`);
    setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
    setActiveMenu(null);
    window.dispatchEvent(new Event("chatListUpdate"));
  };

  const handleOpenMenu = (chatId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveMenu(activeMenu === chatId ? null : chatId);
  };

  return (
    <div className={styles.chatList}>
      <Link href="/" className={styles.newChatButton}>
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
                <button onClick={(e) => handleDelete(chat.id, e)}>削除</button>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
