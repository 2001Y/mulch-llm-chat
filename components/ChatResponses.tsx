import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import InputSection from "./InputSection";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import TurndownService from "turndown";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import {
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionFunctionMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";

// Markedのインスタンスを作成し、拡張機能とオプションを設定
const markedInstance = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);
markedInstance.setOptions({
  gfm: true,
  breaks: true,
});

// 型定義を追加
type MessageContent = {
  type: string;
  text?: string;
  image_url?: { url: string };
};

type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool" | "function";
  content?: string | MessageContent[] | null | undefined;
  name?: string;
  tool_call_id?: string;
};

interface Message {
  user: MessageContent[];
  llm: Array<{
    role: string;
    model: string;
    text: string;
    selected: boolean;
    isGenerating?: boolean;
    selectedOrder?: number;
  }>;
  timestamp?: number;
  edited?: boolean;
}

interface ModelItem {
  name: string;
  selected: boolean;
}

type ModelsState = ModelItem[];

// HTMLタグをエスケープする関数
const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// コードブロック内のHTMLタグをエスケープする関数
const escapeCodeBlocks = (markdown: string): string => {
  // コードブロックに一致する正規表現
  const codeBlockRegex = /```[\s\S]*?```/g;

  return markdown.replace(codeBlockRegex, (match) => {
    // コードブロックの内容をエスケープ
    return match.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  });
};

interface ResponsesProps {
  readOnly?: boolean;
}

export default function Responses({ readOnly = false }: ResponsesProps) {
  const {
    messages,
    isGenerating,
    isShared,
    containerRef,
    chatInput,
    setChatInput,
    handleSend,
    updateMessage,
    handleResetAndRegenerate,
    handleSaveOnly,
    handleStopAllGeneration,
  } = useChatLogicContext();

  const [localChatInput, setLocalChatInput] = useState<
    { type: string; text?: string; image_url?: { url: string } }[]
  >([{ type: "text", text: "" }]);

  const MemoizedInputSection = useMemo(() => React.memo(InputSection), []);

  console.log("[DEBUG ChatResponses] Rendering. messages:", messages);

  // 編集ハンドラー
  const handleEdit = useCallback(
    (
      messageIndex: number,
      responseIndex: number | null,
      newContent: string
    ) => {
      const turndownService = new TurndownService();
      const markdownContent = turndownService.turndown(newContent);
      const newText = [{ type: "text", text: markdownContent }];
      updateMessage(messageIndex, responseIndex, newText);
    },
    [updateMessage]
  );

  // レスポンス選択ハンドラー
  const handleSelectResponse = useCallback(
    (messageIndex: number, responseIndex: number) => {
      updateMessage(messageIndex, responseIndex, undefined, true);
    },
    [updateMessage]
  );

  // ストリーム中止ハンドラー
  const handleStop = useCallback(
    (messageIndex: number, responseIndex: number) => {
      // このコンポーネントでは利用しない（コンテキストで処理）
    },
    []
  );

  // 再生成ハンドラー
  const handleRegenerate = useCallback(
    (messageIndex: number, responseIndex: number, model: string) => {
      // ここでは再生成は行わない - useChatLogicのメソッドを使うべき
    },
    []
  );

  return (
    <>
      <div
        className={`responses-container ${
          messages.length === 0 ? "initial-screen" : ""
        }`}
        ref={containerRef}
        translate="no"
      >
        {messages.map((message, messageIndex) => {
          console.log(
            "[DEBUG ChatResponses] Mapping message:",
            message,
            "at index:",
            messageIndex
          );
          const selectedResponses = message.llm
            .filter((r: any) => r.selected)
            .sort(
              (a: any, b: any) =>
                (a.selectedOrder || 0) - (b.selectedOrder || 0)
            );
          const hasSelectedResponse = selectedResponses.length > 0;
          return (
            <div key={messageIndex} className="message-block">
              {/* 常に編集可能なInputSectionを表示 */}
              <MemoizedInputSection
                chatInput={message.user}
                setChatInput={(newInput) =>
                  updateMessage(messageIndex, null, newInput)
                }
                handleSend={(event, isPrimaryOnly) =>
                  handleSend(event, isPrimaryOnly)
                }
                isEditMode={true}
                messageIndex={messageIndex}
                handleResetAndRegenerate={handleResetAndRegenerate}
                handleSaveOnly={handleSaveOnly}
                mainInput={false}
                isInitialScreen={false}
                handleStopAllGeneration={handleStopAllGeneration}
                isGenerating={isGenerating}
              />

              <div className="scroll_area">
                {message.llm.map((response, responseIndex) => {
                  const isGenerating = response.isGenerating ?? false;
                  return (
                    <div
                      key={response.model}
                      className={`response ${response.role} ${
                        hasSelectedResponse && !response.selected
                          ? "unselected"
                          : ""
                      }`}
                    >
                      <div className="meta">
                        <small>{response.model}</small>
                        {/* 常にコントロールを表示 */}
                        <div className="response-controls">
                          <button
                            className={
                              isGenerating ? "stop-button" : "regenerate-button"
                            }
                            onClick={() =>
                              isGenerating
                                ? handleStopAllGeneration()
                                : handleResetAndRegenerate(messageIndex)
                            }
                          >
                            {isGenerating ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                stroke="none"
                              >
                                <rect
                                  x="4"
                                  y="4"
                                  width="16"
                                  height="16"
                                  rx="2"
                                  ry="2"
                                />
                              </svg>
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                              </svg>
                            )}
                          </button>
                          <div
                            className={`response-select ${
                              response.selected ? "selected" : ""
                            }`}
                            onClick={() =>
                              handleSelectResponse(messageIndex, responseIndex)
                            }
                          >
                            {response.selected
                              ? selectedResponses.length > 1
                                ? selectedResponses.findIndex(
                                    (r) => r === response
                                  ) + 1
                                : "✓"
                              : ""}
                          </div>
                        </div>
                      </div>
                      <div
                        className="markdown-content"
                        contentEditable={true}
                        onBlur={(e) => {
                          handleEdit(
                            messageIndex,
                            responseIndex,
                            (e.target as HTMLDivElement).innerHTML
                          );
                        }}
                        dangerouslySetInnerHTML={{
                          __html: markedInstance.parse(response.text || ""),
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
