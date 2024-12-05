import React from "react";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import type { Message } from "../_hooks/useMessages";

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);

interface MessageProps {
  message: Message;
  messageIndex: number;
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

export default function Message({
  message,
  messageIndex,
  onRegenerate,
  onStop,
  onToggleSelect,
  onEdit,
}: MessageProps) {
  const renderUserContent = (content: any[]) => {
    return content.map((item, index) => {
      if (item.type === "text") {
        return (
          <div key={index} className="user-text">
            {item.text}
          </div>
        );
      } else if (item.type === "image" && item.image_url) {
        return (
          <div key={index} className="user-image">
            <img src={item.image_url.url} alt="User uploaded" />
          </div>
        );
      }
      return null;
    });
  };

  const renderLLMResponse = (response: any, responseIndex: number) => {
    const html = marked.parse(response.text || "");

    return (
      <div key={responseIndex} className="llm-response">
        <div className="response-header">
          <span className="model-name">{response.model}</span>
          <div className="response-controls">
            {response.isGenerating ? (
              <button
                onClick={() => onStop(messageIndex, responseIndex)}
                className="stop-button"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() =>
                  onRegenerate(messageIndex, responseIndex, response.model)
                }
                className="regenerate-button"
              >
                Regenerate
              </button>
            )}
            <button
              onClick={() => onToggleSelect(messageIndex, responseIndex)}
              className={`select-button ${response.selected ? "selected" : ""}`}
            >
              {response.selected
                ? `Selected (${response.selectedOrder})`
                : "Select"}
            </button>
            <button
              onClick={() => {
                const newContent = prompt("Edit response:", response.text);
                if (newContent !== null) {
                  onEdit(messageIndex, responseIndex, newContent);
                }
              }}
              className="edit-button"
            >
              Edit
            </button>
          </div>
        </div>
        <div
          className="response-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  };

  return (
    <div className="message">
      <div className="user-message">
        <div className="message-header">
          <span>User</span>
          <button
            onClick={() => {
              const newContent = prompt(
                "Edit message:",
                JSON.stringify(message.user)
              );
              if (newContent !== null) {
                try {
                  const parsedContent = JSON.parse(newContent);
                  onEdit(messageIndex, null, parsedContent);
                } catch (e) {
                  alert("Invalid JSON format");
                }
              }
            }}
            className="edit-button"
          >
            Edit
          </button>
        </div>
        {renderUserContent(message.user)}
      </div>
      <div className="llm-messages">
        {message.llm.map((response, responseIndex) =>
          renderLLMResponse(response, responseIndex)
        )}
      </div>
    </div>
  );
}
