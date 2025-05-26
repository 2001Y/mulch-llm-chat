import React from "react";
import styles from "@/styles/ChatList.module.scss";

interface ChatItemContentProps {
  firstMessage: string;
  timestamp: number;
  title: string;
  variant?: "list" | "header";
}

export default function ChatItemContent({
  firstMessage,
  timestamp,
  title,
  variant = "list",
}: ChatItemContentProps) {
  const formatTimestamp = (ts: number) => {
    if (ts === -1) return "0000/00/00";
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={`${styles.chatItemContent} ${
        variant === "header" ? styles.chatItemContentHeader : ""
      }`}
    >
      <div className={styles.chatItemFirstMessage}>{firstMessage}</div>
      <div className={styles.chatItemMeta}>
        <div className={styles.chatItemTimestamp}>
          {formatTimestamp(timestamp)}
        </div>
        <div className={styles.chatItemTitle}>{title}</div>
      </div>
    </div>
  );
}
