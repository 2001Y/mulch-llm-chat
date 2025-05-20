import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import InputSection from "./InputSection";
// import { Marked } from "marked"; // Tiptap化により不要
// import { markedHighlight } from "marked-highlight"; // Tiptap化により不要
// import hljs from "highlight.js"; // Tiptap化により不要 (Tiptap内でコードブロックハイライトする場合、別途拡張が必要)
// import TurndownService from "turndown"; // Tiptap化により不要
import { useChatLogicContext } from "contexts/ChatLogicContext";
import MarkdownTipTapEditor from "./MarkdownTipTapEditor"; // ★ インポート
import { useVirtualizer } from "@tanstack/react-virtual"; // ★ インポート
import {
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionFunctionMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";

// Markedのインスタンス化は不要になる
// const markedInstance = new Marked(...);

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
  readOnly?: boolean; // このpropはTiptapエディタのeditableに渡すことを検討したが、今回は常に編集可とする
}

export default function Responses({ readOnly = false }: ResponsesProps) {
  const {
    messages,
    isGenerating,
    // isShared, // isSharedはeditable制御に使っていたが、常に編集可とするため不要
    containerRef,
    // chatInput, // このコンポーネントでは直接使わない
    // setChatInput, // このコンポーネントでは直接使わない
    handleSend, // InputSectionに渡す用
    updateMessage,
    handleResetAndRegenerate,
    handleSaveOnly, // InputSectionに渡す用
    handleStopAllGeneration,
  } = useChatLogicContext();

  const MemoizedInputSection = useMemo(() => React.memo(InputSection), []);

  // 仮想スクロールのための設定
  const parentRef = containerRef; // useChatLogicContextから渡されるコンテナのrefを流用

  const estimateRowHeight = useCallback(
    (index: number) => {
      // TODO: messages[index] の内容に基づいて、より正確な高さを概算するロジックを実装
      // 例えば、テキストの行数、画像の有無、コードブロックの有無などを考慮する。
      // 最も簡単なのは、平均的な高さを返すことだが、アイテムの高さが大きく異なる場合は
      // スクロールバーの挙動が不自然になることがある。
      // TiptapエディタのコンテンツDOMの高さを直接取得するのはレンダリング後でないと難しいため、概算に留める。
      const message = messages[index];
      if (!message) return 150; // デフォルトの高さ

      let estimatedHeight = 50; // 基本の高さ (paddingなど)
      // ユーザーメッセージのTiptapエディタ部分
      if (message.user) {
        estimatedHeight += Math.max(50, message.user.split("\n").length * 20); // 行数 x 行の高さ (概算)
      }
      // LLM応答のTiptapエディタ部分 (複数の応答がある場合、最も高いものを考慮するか、平均を取るか)
      message.llm.forEach((response) => {
        if (response.text) {
          estimatedHeight += Math.max(
            50,
            response.text.split("\n").length * 20
          );
          // 画像が含まれる場合の高さも考慮 (parseMarkdownToContentParts で画像URLを抽出し、その数やサイズで加算など)
          // ここでは簡易的にテキスト行数のみで計算
        }
      });
      return Math.max(100, estimatedHeight); // 最低でも100pxは確保する例
    },
    [messages]
  );

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateRowHeight, // ★ 修正: useCallbackでメモ化した関数を使用
    overscan: 5,
  });

  // 新しいメッセージが追加されたときに最下部にスクロール
  useEffect(() => {
    if (messages.length > 0) {
      // virtualizerが準備できてからスクロールを実行
      // 初回レンダリング時やmessagesが空からの変更時に対応
      setTimeout(() => {
        // 少し遅延させて virtualizer の準備を待つ (より良い方法があれば検討)
        rowVirtualizer.scrollToIndex(messages.length - 1, {
          align: "end",
          behavior: "auto",
        }); // behavior: 'smooth' だと遅い場合あり
      }, 0);
    }
  }, [messages.length, rowVirtualizer]); // rowVirtualizer も依存配列に追加

  console.log(
    "[DEBUG ChatResponses] Rendering. messages count:",
    messages.length
  );

  // handleEdit は不要になる
  // const handleEdit = useCallback(...);

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
    <div // この div がルート要素
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        width: "100%",
        position: "relative", // 仮想アイテムの絶対配置の基準
      }}
    >
      {/* 
        親コンポーネント (ChatPage.tsx) で containerRef がアタッチされる要素は、
        以下のようなスタイルを持つことが期待される:
        .responses-container {
          height: calc(100vh - HEADER_HEIGHT - INPUT_AREA_HEIGHT); // ビューポート内の可視領域の高さ
          overflow-y: auto;
          position: relative; // 仮想アイテムの絶対配置の基準とする場合
        }
      */}
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const message = messages[virtualRow.index];
        if (!message) return null; // 安全のためのチェック

        // selectedResponses と hasSelectedResponse は message.llm に基づくので、mapの中で計算
        const selectedResponses = message.llm
          .filter((r: any) => r.selected)
          .sort(
            (a: any, b: any) => (a.selectedOrder || 0) - (b.selectedOrder || 0)
          );
        const hasSelectedResponse = selectedResponses.length > 0;

        return (
          <div
            key={virtualRow.key} // ★ virtualRow.key を使用
            ref={rowVirtualizer.measureElement} // 要素の高さを動的に計測する場合
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
            className="message-block" // 既存のクラスを適用
          >
            <MemoizedInputSection
              mainInput={false} // 履歴編集なのでメイン入力ではない
              chatInput={message.user} // userはstring (Markdown)
              setChatInput={(newMarkdown) => {
                // updateMessageのcontentはanyだが、stringを期待している
                updateMessage(virtualRow.index, null, newMarkdown);
              }}
              isEditMode={true} // 履歴は常に編集モードとしてTiptapを表示
              messageIndex={virtualRow.index} // 正しいメッセージインデックスを渡す
              handleResetAndRegenerate={handleResetAndRegenerate}
              handleSaveOnly={handleSaveOnly}
              isInitialScreen={false} // 仮想リスト内のアイテムなので常にfalse
              handleStopAllGeneration={handleStopAllGeneration}
              isGenerating={isGenerating} // 全体のisGeneratingを渡す
            />
            <div className="scroll_area">
              {message.llm.map((response, responseIndex) => {
                const isLlmGenerating = response.isGenerating ?? false;
                return (
                  <div
                    key={`${virtualRow.index}-${responseIndex}`}
                    className={`response-item ${
                      response.selected ? "selected" : ""
                    } ${isLlmGenerating ? "generating" : ""}`}
                  >
                    <div className="response-content">
                      <MarkdownTipTapEditor
                        value={response.text} // Tiptapへ渡すのはMarkdown文字列
                        onChange={(newMarkdown) => {
                          updateMessage(
                            virtualRow.index,
                            responseIndex,
                            newMarkdown
                          );
                        }}
                        editable={true} // 常に編集可能とする
                        editorProps={{
                          attributes: {
                            class:
                              "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none",
                          },
                        }}
                      />
                    </div>
                    {!isLlmGenerating && (
                      <div className="response-actions">
                        <button
                          onClick={() =>
                            handleSelectResponse(
                              virtualRow.index,
                              responseIndex
                            )
                          }
                          className="action-button select-button"
                          aria-label={response.selected ? "Deselect" : "Select"}
                        >
                          {response.selected ? "☑️" : "☐"}
                        </button>
                        {/* 以下のアクションボタンはInputSection内に移動・統合検討 */}
                      </div>
                    )}
                    {isLlmGenerating && (
                      <div className="generating-indicator">
                        🌀 Generating...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div> // ここが追加された閉じタグ
  );
}
