"use client";

import { useEffect, useState } from "react";
import ChatList from "../_components/ChatList";

export default function Sidebar() {
  const [hasChats, setHasChats] = useState(false);

  useEffect(() => {
    const checkActualChats = () => {
      const chatKeys = Object.keys(localStorage).filter(
        (key) =>
          key.startsWith("chatMessages_") &&
          key !== "chatMessages_default" &&
          JSON.parse(localStorage.getItem(key) || "[]").some((msg: any) =>
            msg.user?.some((u: any) => u.text?.trim())
          )
      );
      setHasChats(chatKeys.length > 0);
    };

    checkActualChats();
    window.addEventListener("storage", (e) => {
      if (e.key?.startsWith("chatMessages_")) {
        checkActualChats();
      }
    });
    window.addEventListener("chatListUpdate", checkActualChats);

    return () => {
      window.removeEventListener("storage", checkActualChats);
      window.removeEventListener("chatListUpdate", checkActualChats);
    };
  }, []);

  if (!hasChats) return null;

  return (
    <aside className="sidebar">
      <ChatList />
    </aside>
  );
}
