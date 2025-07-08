import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import InputSection from "./InputSection";
// import hljs from "highlight.js"; // Tiptap化により不要 (Tiptap内でコードブロックハイライトする場合、別途拡張が必要)
import { useChatLogicContext } from "contexts/ChatLogicContext";
import MarkdownTipTapEditor from "./MarkdownTipTapEditor"; // ★ インポート
// import { useVirtualizer } from "@tanstack/react-virtual"; // ★ 仮想スクロールを一時的に無効化
import type { AppMessage } from "types/chat"; // ★ インポート修正

// HTMLタグをエスケープする関数
const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// グループ化されたメッセージの型定義
interface GroupedMessage {
  userMessage: AppMessage & { role: "user" };
  assistantMessages: (AppMessage & { role: "assistant" })[];
}

export default function Responses({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const {
    messages,
    isGenerating,
    // containerRef, // グループ化により、個別のコンテナ管理が複雑になるため一旦コメントアウト
    handleSend, // ユーザーメッセージ編集後の再送信に使う可能性あり
    updateAssistantMessageContent,
    handleResetAndRegenerate, // ユーザーメッセージからの再生成
    handleSaveOnly,
    handleStopAllGeneration,
    regenerateAssistantResponse, // ★取得
    updateAssistantMessageSelection, // ★取得
  } = useChatLogicContext();

  const MemoizedInputSection = useMemo(() => React.memo(InputSection), []);

  // メッセージをユーザーメッセージ単位でグルーピング
  const groupedMessages = useMemo(() => {
    const groups: GroupedMessage[] = [];
    let currentUserMessage: (AppMessage & { role: "user" }) | null = null;
    let currentAssistantMessages: (AppMessage & { role: "assistant" })[] = [];

    messages.forEach((msg) => {
      if (!msg) return; // nullメッセージをスキップ
      if (msg.role === "user") {
        if (currentUserMessage) {
          groups.push({
            userMessage: currentUserMessage,
            assistantMessages: currentAssistantMessages,
          });
        }
        currentUserMessage = msg as AppMessage & { role: "user" };
        currentAssistantMessages = [];
      } else if (msg.role === "assistant" && currentUserMessage) {
        currentAssistantMessages.push(
          msg as AppMessage & { role: "assistant" }
        );
      }
    });
    if (currentUserMessage) {
      groups.push({
        userMessage: currentUserMessage,
        assistantMessages: currentAssistantMessages,
      });
    }
    return groups;
  }, [messages]);

  // 選択順序とアイコンを取得するヘルパー関数
  const getSelectionIcon = (
    responseId: string,
    assistantMessages: (AppMessage & { role: "assistant" })[]
  ) => {
    const selectedMessages = assistantMessages
      .filter((msg) => msg.ui?.isSelected)
      .sort(
        (a, b) => (a.ui?.selectionOrder || 0) - (b.ui?.selectionOrder || 0)
      );

    const selectedIndex = selectedMessages.findIndex(
      (msg) => msg.id === responseId
    );

    if (selectedIndex === -1) return "□"; // 未選択は四角

    // 選択が1つだけの場合はチェックマーク、2つ以上の場合は数字
    if (selectedMessages.length === 1) return "✓";
    return (selectedIndex + 1).toString();
  };

  // レスポンスの表示状態を判定するヘルパー関数
  const getResponseDisplayState = (
    response: AppMessage & { role: "assistant" },
    assistantMessages: (AppMessage & { role: "assistant" })[]
  ) => {
    const isSelected = response.ui?.isSelected ?? false;
    const hasAnySelected = assistantMessages.some((msg) => msg.ui?.isSelected);

    if (!hasAnySelected) return "normal";
    if (isSelected) return "selected";
    return "unselected";
  };

  console.log(
    "[DEBUG ChatResponses] Rendering. Grouped messages count:",
    groupedMessages.length
  );
  if (groupedMessages.length > 0) {
    groupedMessages.forEach((group, idx) => {
      console.log(
        `Group ${idx}: UserMsgID=${group.userMessage.id}, AssistantMsgCount=${group.assistantMessages.length}`
      );
    });
  }

  // メッセージ内容の詳細ログを追加（assistantメッセージのみ）
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.role === "assistant") {
        console.debug(
          `[DEBUG ChatResponses] AssistantMsg id=${msg.id}, len=${
            (msg.content as string | undefined)?.length || 0
          }, isGenerating=${msg.ui?.isGenerating}`
        );
      }
    });
  }, [messages]);

  return (
    <>
      {groupedMessages.map((group, groupIndex) => {
        const userMsg = group.userMessage;
        const assistantMsgs = group.assistantMessages;

        return (
          <div key={userMsg.id} className="message-block">
            {/* ユーザーメッセージ表示 */}
            <MemoizedInputSection
              mainInput={false}
              chatInput={userMsg.content as string} // ユーザーメッセージはstringと仮定
              setChatInput={(newMarkdown) => {
                // ユーザーメッセージ編集時は handleSaveOnly や handleResetAndRegenerate を使う
                // ここで直接 handleSaveOnly を呼ぶか、または useChatLogic 側の updateUserInput を整備
                console.log(
                  "User message edited in ChatResponses, new markdown:",
                  newMarkdown,
                  "for ID:",
                  userMsg.id
                );
                // handleSaveOnly(userMsg.id, newMarkdown); // 保存のみの場合
                // 編集後に再生成する場合は handleResetAndRegenerate を呼ぶUIが必要
              }}
              isEditMode={true} // 常に編集モードだが、表示専用のスタイルはInputSection内で制御
              messageId={userMsg.id} // messageId を InputSection に渡す
              handleResetAndRegenerate={handleResetAndRegenerate}
              handleSaveOnly={handleSaveOnly}
              isInitialScreen={false}
              handleStopAllGeneration={handleStopAllGeneration}
              isGenerating={isGenerating || (userMsg.ui?.isGenerating ?? false)}
            />

            {/* アシスタントメッセージ群表示 - 既存のscroll_area構造を使用 */}
            {assistantMsgs.length > 0 && (
              <div className="scroll_area">
                {assistantMsgs.map((response, responseIndex) => {
                  const isLlmGenerating = response.ui?.isGenerating ?? false;
                  const isSelected = response.ui?.isSelected ?? false;
                  const displayState = getResponseDisplayState(
                    response,
                    assistantMsgs
                  );
                  const selectionIcon = getSelectionIcon(
                    response.id,
                    assistantMsgs
                  );

                  return (
                    <div
                      key={response.id}
                      className={`response ${displayState} ${
                        isLlmGenerating ? "generating" : ""
                      }`}
                    >
                      <div className="meta">
                        <span>{response.ui?.modelId || "Assistant"}</span>
                        <div className="response-controls">
                          {!isLlmGenerating && !readOnly && (
                            <button
                              onClick={() => {
                                if (regenerateAssistantResponse) {
                                  regenerateAssistantResponse(response.id);
                                }
                              }}
                              className="regenerate-button"
                              aria-label="Regenerate response"
                              title="レスポンスを再生成"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M15.325 4.302a.75.75 0 010 1.06l-1.06 1.06a6.5 6.5 0 11-8.392 9.286.75.75 0 11-1.06-1.06A8 8 0 1015.325 4.302zm-.954 8.467a.75.75 0 01-1.06 0L10 9.439l-3.31 3.33a.75.75 0 11-1.06-1.06l3.84-3.838a.75.75 0 011.06 0l3.84 3.838a.75.75 0 010 1.06z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          )}
                          {isLlmGenerating && !readOnly && (
                            <button
                              onClick={() => {
                                if (handleStopAllGeneration) {
                                  handleStopAllGeneration();
                                }
                              }}
                              className="stop-button"
                              aria-label="Stop generation"
                              title="生成を停止"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <rect
                                  x="6"
                                  y="6"
                                  width="12"
                                  height="12"
                                  rx="2"
                                />
                              </svg>
                            </button>
                          )}
                          {!isLlmGenerating && (
                            <button
                              onClick={() => {
                                if (updateAssistantMessageSelection) {
                                  updateAssistantMessageSelection(
                                    response.id,
                                    !isSelected
                                  );
                                }
                              }}
                              className={`response-select ${
                                isSelected ? "selected" : ""
                              }`}
                              aria-label={isSelected ? "Deselect" : "Select"}
                              title={isSelected ? "選択を解除" : "選択"}
                            >
                              <span className="checkbox-icon">
                                {selectionIcon}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="response-content">
                        <MarkdownTipTapEditor
                          value={(response.content as string) || ""}
                          onChange={(newMarkdown) => {
                            console.debug(
                              "[ChatResponses] onChange assistant",
                              {
                                id: response.id,
                                snippet: newMarkdown.slice(0, 120),
                                length: newMarkdown.length,
                              }
                            );
                            if (response.id) {
                              updateAssistantMessageContent(
                                response.id,
                                newMarkdown
                              );
                            }
                          }}
                          editable={!isLlmGenerating && !readOnly}
                          editorProps={{
                            attributes: {
                              class: "prose prose-sm focus:outline-none",
                            },
                          }}
                          className={`ai-response-tiptap ${
                            readOnly ? "is-readonly" : ""
                          }`}
                          placeholder="AI response will appear here..."
                        />
                      </div>
                      {isLlmGenerating && (
                        <div className="generating-indicator">
                          <svg
                            className="spinner"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          生成中...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// 型定義 Message の user を string に修正（Markdown文字列を直接格納するため）
// 元の型: user: MessageContent[];
// これは useChatLogic.ts の Message 型定義とも整合性を取る必要がある。
// useChatLogic.ts では user は string になっているため、ここも合わせる。

// ResponsesProps のコメントアウトを修正
// interface ResponsesProps {
//   readOnly?: boolean;
// }
