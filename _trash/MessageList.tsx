import React, { useRef, useEffect, useState } from "react";
import Message from "./Message";
import type { Message as MessageType } from "../hooks/useMessages";

interface MessageListProps {
  messages: MessageType[];
  isGenerating: boolean;
  onRegenerate: (
    messageIndex: number,
    responseIndex: number,
    model: string
  ) => void;
  onStop: (messageIndex: number, responseIndex: number) => void;
  onToggleSelect: (messageIndex: number, responseIndex: number) => void;
  onEdit: (
    messageIndex: number,
    responseIndex: number | null,
    newContent: string
  ) => void;
}

export default function MessageList({
  messages,
  isGenerating,
  onRegenerate,
  onStop,
  onToggleSelect,
  onEdit,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
      setIsAutoScroll(isAtBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      const container = containerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isAutoScroll]);

  return (
    <div className="message-list" ref={containerRef}>
      {messages.map((message, index) => (
        <Message
          key={index}
          message={message}
          messageIndex={index}
          onRegenerate={onRegenerate}
          onStop={onStop}
          onToggleSelect={onToggleSelect}
          onEdit={onEdit}
        />
      ))}
      {isGenerating && (
        <div className="generating-indicator">Generating...</div>
      )}
    </div>
  );
}
