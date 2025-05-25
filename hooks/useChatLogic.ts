import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useOptimistic,
  startTransition,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import useStorageState, { storage, StorageState } from "hooks/useLocalStorage";
import { generateId } from "@/utils/generateId";
import { fetchOpenRouterModels } from "@/app/actions"; // ★ Server Actionをインポート
import { type CoreMessage, streamText, tool, type StreamTextResult } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  type AppMessage,
  type MessageContent,
  type ToolCall,
  type ConversationTurn, // ★ ConversationTurn をインポート
} from "types/chat"; // ★ インポート修正
export type { AppMessage as Message }; // AppMessage を Message として再エクスポート

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

export interface ToolFunction {
  (args: any): any;
}

export interface ModelItem {
  id: string;
  name: string;
  selected: boolean;
}

interface UseChatLogicProps {
  isShared?: boolean;
  initialMessages?: AppMessage[];
  initialError?: string | null;
}

// OptimisticMessageAction の型定義を AppMessage を使うように修正
type OptimisticMessageAction =
  | {
      type: "addUserMessageAndPlaceholders";
      userMessage: AppMessage & { role: "user"; id: string }; // idを必須に
      assistantPlaceholders: (AppMessage & { role: "assistant"; id: string })[]; // idを必須に
    }
  | {
      type: "updateLlmResponse";
      updatedAssistantMessage: AppMessage & { role: "assistant"; id: string };
    }
  | { type: "resetMessages"; payload: AppMessage[] }
  | { type: "removeMessage"; messageId: string }
  | { type: "updateUserMessage"; messageId: string; newContent: string }
  | {
      type: "updateAssistantMessageContent";
      messageId: string;
      newContent: string;
    }; // 新しいアクションタイプ

// デフォルトモデルの定義
const DEFAULT_MODEL_IDS = ["openai/gpt-4o-mini", "google/gemini-2.0-flash-001"];
console.log("[DEFAULT_MODEL_IDS] Defined:", DEFAULT_MODEL_IDS);

export function useChatLogic({
  isShared = false,
  initialMessages = undefined,
  initialError = null,
}: UseChatLogicProps = {}) {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.id
    ? decodeURIComponent(params.id as string)
    : undefined;

  const [openRouterApiKey, setOpenRouterApiKey] =
    useStorageState<string>("openrouter_api_key");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [selectedModelIds, setSelectedModelIds] =
    useStorageState<string[]>("selectedModels");
  const [models, setModels] = useState<ModelItem[]>([]);
  const [chatInput, setChatInput] = useState<string>('""');

  const [messages, setMessages] = useState<AppMessage[]>(initialMessages || []);
  // 生成中にメッセージがリセットされないようにするためのフラグ
  const isProcessingRef = useRef(false);
  // 処理中のメッセージをバックアップするための状態
  const messagesBackupRef = useRef<AppMessage[]>([]);
  // 最後に正常に処理したメッセージセットのタイムスタンプ
  const lastValidMessagesTimestampRef = useRef<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortControllers, setAbortControllers] = useState<
    Record<string, AbortController>
  >({});
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(initialError);
  const [storedMessages, setStoredMessages] = useStorageState<
    ConversationTurn[]
  >(`chatMessages_${roomId || "default"}`); // ★ AppMessage[] から ConversationTurn[] に変更
  const containerRef = useRef<HTMLDivElement>(null);
  const [AllModels, setAllModels] = useState<ModelItem[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [toolFunctions, setToolFunctions] = useStorageState("toolFunctions");
  const [tools, setTools] = useStorageState<any[]>("tools"); // ツール定義

  // モデルの初期化状態を追跡するためのref
  const modelsInitialized = useRef(false);

  // regenerateAssistantResponse で使用する API キーの取得ロジック (handleSendから流用)
  const getApiKeyForRegeneration = () => {
    const currentOpenRouterApiKey =
      openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!currentOpenRouterApiKey) {
      setApiKeyError(
        "OpenRouter APIキーが設定されていません。右上の設定ボタンからAPIキーを設定してください。OpenRouterのウェブサイト(https://openrouter.ai)でアカウント作成後、APIキーを取得できます。"
      );
      console.error("[API Key Check] OpenRouter API Key is missing.");
      return null;
    }
    setApiKeyError(null); // エラーがなければクリア
    return currentOpenRouterApiKey;
  };

  // ★ saveMessagesToHistory の宣言を正しい位置に配置
  const saveMessagesToHistory = useCallback(
    (currentMessagesToSave: AppMessage[]) => {
      if (isShared) return; // 共有ビューでは保存しない

      // roomIdがない場合はデフォルトIDを使用
      const saveRoomId = roomId || "default";

      const conversationTurns: ConversationTurn[] = [];
      let currentUserMessage: (AppMessage & { role: "user" }) | null = null;
      let currentAssistantMessages: (AppMessage & { role: "assistant" })[] = [];

      currentMessagesToSave.forEach((msg) => {
        if (!msg) return;
        // ui.timestampの混入を防ぐため、uiオブジェクトを慎重に再構築
        const cleanUi = { ...(msg.ui || {}) };
        delete (cleanUi as any).timestamp; // 明示的にtimestampプロパティを削除

        const messageWithProperTimestamp = {
          ...msg,
          timestamp: msg.timestamp || Date.now(), // msg.ui.timestampは参照しない
          ui: cleanUi,
        };

        if (messageWithProperTimestamp.role === "user") {
          if (currentUserMessage) {
            conversationTurns.push({
              userMessage: currentUserMessage,
              assistantResponses: currentAssistantMessages,
            });
          }
          currentUserMessage = messageWithProperTimestamp as AppMessage & {
            role: "user";
          };
          currentAssistantMessages = [];
        } else if (
          messageWithProperTimestamp.role === "assistant" &&
          currentUserMessage
        ) {
          currentAssistantMessages.push(
            messageWithProperTimestamp as AppMessage & { role: "assistant" }
          );
        }
      });

      if (currentUserMessage) {
        conversationTurns.push({
          userMessage: currentUserMessage,
          assistantResponses: currentAssistantMessages,
        });
      }

      storage.set(`chatMessages_${saveRoomId}`, conversationTurns);
      setStoredMessages(conversationTurns);

      // チャットが保存されたことをSidebarに通知
      window.dispatchEvent(new Event("chatListUpdate"));
    },
    [isShared, roomId, setStoredMessages]
  );

  const [optimisticMessages, addOptimisticMessage] = useOptimistic<
    AppMessage[],
    OptimisticMessageAction
  >(messages, (currentOptimisticMessages, action) => {
    switch (action.type) {
      case "addUserMessageAndPlaceholders":
        return [
          ...currentOptimisticMessages,
          action.userMessage,
          ...action.assistantPlaceholders,
        ];
      case "updateLlmResponse":
        return currentOptimisticMessages.map((msg) => {
          if (
            msg.role === "assistant" &&
            msg.id === action.updatedAssistantMessage.id
          ) {
            return action.updatedAssistantMessage;
          }
          return msg;
        });
      case "resetMessages":
        return action.payload;
      case "removeMessage":
        return currentOptimisticMessages.filter(
          (msg) =>
            (msg.role === "user" ||
              msg.role === "assistant" ||
              msg.role === "tool") &&
            msg.id !== action.messageId
        );
      case "updateUserMessage":
        return currentOptimisticMessages.map((msg) =>
          msg.role === "user" && msg.id === action.messageId
            ? {
                ...msg,
                content: action.newContent,
                timestamp: Date.now(),
                ui: { ...(msg.ui || {}), edited: true },
              }
            : msg
        );
      case "updateAssistantMessageContent":
        return currentOptimisticMessages.map((msg) =>
          msg.role === "assistant" && msg.id === action.messageId
            ? {
                ...msg,
                content: action.newContent,
                timestamp: Date.now(),
                ui: { ...(msg.ui || {}), edited: true },
              }
            : msg
        );
      default:
        return currentOptimisticMessages;
    }
  });

  // メッセージの状態変化を追跡
  useEffect(() => {
    console.log(
      `[useEffect messages] メッセージ状態変化直前: ${messages.length}件, isProcessingRef: ${isProcessingRef.current}`
    );
    // 各メッセージの詳細をログ出力
    messages.forEach((msg, index) => {
      console.log(
        `[useEffect messages] msg[${index}]: id=${msg.id}, role=${
          msg.role
        }, content='${
          typeof msg.content === "string"
            ? msg.content.substring(0, 30) + "..."
            : "Non-string content"
        }', ui=${JSON.stringify(msg.ui)}`
      );
    });

    console.log(
      `[useEffect messages] メッセージ状態変化: ${messages.length}件`
    );

    // 処理中でメッセージが空になった場合は復元を試みる
    if (messages.length === 0 && isProcessingRef.current) {
      console.warn(
        `[useEffect messages] 警告: 処理中にメッセージが0件になりました。バックアップから復元します。`
      );

      if (messagesBackupRef.current && messagesBackupRef.current.length > 0) {
        console.log(
          `[useEffect messages] バックアップから${messagesBackupRef.current.length}件のメッセージを復元します`
        );

        // バックアップデータのバリデーション
        if (!Array.isArray(messagesBackupRef.current)) {
          console.error(
            `[useEffect messages] バックアップデータが配列ではありません`
          );
          return;
        }

        const validMessages = messagesBackupRef.current.filter(
          (msg: any) =>
            msg && typeof msg === "object" && "id" in msg && "role" in msg
        );

        if (validMessages.length === 0) {
          console.error(
            `[useEffect messages] バックアップに有効なメッセージがありません`
          );
          return;
        }

        console.log(
          `[useEffect messages] 有効なメッセージが${validMessages.length}件あります`
        );

        // 非同期で復元することで無限ループを防ぐ
        setTimeout(() => {
          // 正常に復元するためにはmessagesとoptimisticMessagesの両方を更新する必要がある
          setMessages(validMessages);

          // optimisticMessagesも同期して更新
          if (typeof startTransition === "function") {
            startTransition(() => {
              addOptimisticMessage({
                type: "resetMessages",
                payload: validMessages,
              });
            });
          } else {
            addOptimisticMessage({
              type: "resetMessages",
              payload: validMessages,
            });
          }

          console.log(`[useEffect messages] メッセージを復元しました`);
        }, 0);
      } else {
        console.warn(
          `[useEffect messages] バックアップが空のため復元できません`
        );
      }
      return;
    }

    // メッセージがあり、処理中でない場合またはメッセージ数が増えた場合はバックアップを更新
    if (messages.length > 0) {
      // 最後のメッセージの時間を確認して、古いバックアップを上書きしないようにする
      const lastMessageTime = messages[messages.length - 1]?.timestamp || 0;

      if (
        !isProcessingRef.current ||
        lastMessageTime > lastValidMessagesTimestampRef.current
      ) {
        console.log(
          `[useEffect messages] 最新メッセージをバックアップ: role=${
            messages[messages.length - 1].role
          }, id=${
            messages[messages.length - 1].id
          }, timestamp=${lastMessageTime}`
        );

        messagesBackupRef.current = [...messages];
        lastValidMessagesTimestampRef.current = lastMessageTime;
      }
    }
  }, [messages, addOptimisticMessage]);

  // messagesRef は messages state に依存するので、messages の直後が良いが、useOptimisticの後でも問題ない
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // addOptimisticMessageのためのラッパー関数 - より堅牢な実装に修正
  const safeOptimisticUpdate = useCallback(
    (action: OptimisticMessageAction) => {
      // メインスレッドの処理が中断されるのを防ぐためにstartTransitionを使用
      if (typeof startTransition === "function") {
        try {
          startTransition(() => {
            addOptimisticMessage(action);
          });
        } catch (error) {
          console.error(
            `[safeOptimisticUpdate] Error in startTransition:`,
            error
          );
          // エラー時は直接呼び出し
          addOptimisticMessage(action);
        }
      } else {
        // startTransitionがない場合は直接呼び出し
        addOptimisticMessage(action);
      }

      // resetMessagesの場合はsetMessagesも呼び出して同期を確保
      if (action.type === "resetMessages") {
        const shouldUpdateMessages =
          isProcessingRef.current ||
          (messages.length === 0 && action.payload.length > 0);

        if (shouldUpdateMessages) {
          console.log(
            `[safeOptimisticUpdate] ${
              isProcessingRef.current ? "処理中" : "メッセージが空"
            }のためmessagesも同期します。`
          );
          setMessages(action.payload);
        }
      }
    },
    [addOptimisticMessage, setMessages, messages.length]
  );

  // handleSend の定義
  const handleSend = useCallback(
    async (userInput: string) => {
      console.log("[handleSend] Called with input:", userInput);
      console.log(
        "[handleSend] Current models state:",
        JSON.parse(JSON.stringify(models))
      );
      setError(null);
      setApiKeyError(null);

      // リクエスト処理中フラグをセット
      isProcessingRef.current = true;

      const currentOpenRouterApiKey =
        openRouterApiKey || process.env.OPENROUTER_API_KEY;
      if (!currentOpenRouterApiKey) {
        setApiKeyError(
          "OpenRouter APIキーが設定されていません。右上の設定ボタンからAPIキーを設定してください。OpenRouterのウェブサイト(https://openrouter.ai)でアカウント作成後、APIキーを取得できます。"
        );
        console.error("[handleSend] OpenRouter API Key is missing.");
        return;
      }

      const userMessageId = generateId();
      const newUserMessage: AppMessage & { role: "user"; id: string } = {
        id: userMessageId,
        role: "user",
        content: userInput,
        timestamp: Date.now(),
      };

      const currentSelectedModels = models?.filter((m) => m.selected) || [];
      console.log(
        "[handleSend] Current selected models:",
        JSON.parse(JSON.stringify(currentSelectedModels))
      );
      if (currentSelectedModels.length === 0) {
        setError("送信先のモデルが選択されていません。");
        console.error("[handleSend] No model selected.");
        return;
      }

      // 既存のメッセージ履歴に新しいユーザーメッセージを追加してAPIに渡す準備
      // contentがChatCompletionContentPart[]のメッセージはstringに変換する必要があるかもしれない
      const historyForApi: CoreMessage[] = optimisticMessages
        .filter(
          (msg) =>
            (msg.role === "user" ||
              msg.role === "assistant" ||
              msg.role === "system") &&
            typeof msg.content === "string" // contentがstringのメッセージのみを履歴として使用 (toolロールや複雑なcontentは一旦除外)
        )
        .map((msg) => {
          // msg.contentがstringであることは上のfilterで保証されている
          const coreMsg: CoreMessage = {
            role: msg.role as "user" | "assistant" | "system",
            content: msg.content as string,
          };
          // アシスタントメッセージの場合、tool_callsを付加することがある
          if (
            msg.role === "assistant" &&
            msg.tool_calls &&
            Array.isArray(msg.tool_calls)
          ) {
            // AppMessageのtool_callsをCoreMessageのtool_calls形式に変換する必要がある場合がある
            // ここでは互換性があると仮定。実際の型に合わせて調整。
            (coreMsg as any).tool_calls = msg.tool_calls.map((tc) => ({
              id: tc.id,
              type: tc.type,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            }));
          }
          return coreMsg;
        });

      const messagesWithUser: CoreMessage[] = [
        ...historyForApi,
        { role: "user", content: userInput },
      ];

      setIsGenerating(true);

      const createdPlaceholders = currentSelectedModels.map((modelItem) => {
        // modelIdが必ず設定されていることを確認
        if (!modelItem.id) {
          console.error("[handleSend] Model item has no id:", modelItem);
        }
        return {
          id: generateId(),
          role: "assistant" as const,
          content: "",
          timestamp: Date.now(),
          ui: {
            modelId: modelItem.id, // ここでmodelIdを明示的に設定
            isGenerating: true,
          },
        };
      });

      // 安全に最適化状態を更新
      safeOptimisticUpdate({
        type: "addUserMessageAndPlaceholders",
        userMessage: newUserMessage,
        assistantPlaceholders: createdPlaceholders,
      });

      // 現在のメッセージにユーザーメッセージとプレースホルダーを含めてバックアップ
      const initialMessages = [
        ...messages,
        newUserMessage,
        ...createdPlaceholders,
      ];
      console.log(
        `[handleSend] 処理前にメッセージ${initialMessages.length}件をバックアップ`
      );
      messagesBackupRef.current = initialMessages;
      lastValidMessagesTimestampRef.current = Date.now();

      // メッセージの状態を直接更新して安定させる
      setMessages(initialMessages);

      // messagesRef.current を使う代わりに、直前に作成した createdPlaceholders をループする
      for (const placeholder of createdPlaceholders) {
        const assistantMessageId = placeholder.id;
        const modelIdForApi = placeholder.ui?.modelId;

        if (!modelIdForApi) {
          console.warn(
            `Placeholder for ${assistantMessageId} has no modelId, skipping.`
          );
          continue;
        }

        const controller = new AbortController();
        setAbortControllers((prev) => ({
          ...prev,
          [assistantMessageId]: controller,
        }));

        (async () => {
          let accumulatedText = "";
          let currentToolCalls: any[] = [];

          try {
            console.log(
              `[handleSend] Preparing direct API request for model: ${modelIdForApi}`,
              `\nMessage count: ${messagesWithUser.length}`,
              `\nLast user message: ${
                messagesWithUser[messagesWithUser.length - 1]?.content
                  ? typeof messagesWithUser[messagesWithUser.length - 1]
                      .content === "string"
                    ? (
                        messagesWithUser[messagesWithUser.length - 1]
                          .content as string
                      ).substring(0, 100)
                    : "Complex content"
                  : "None"
              }`
            );

            // サイト情報のヘッダーを設定
            const customHeaders: Record<string, string> = {
              "X-Title": "Mulch LLM Chat",
            };

            // ユーザーのウェブサイトURLがあれば設定
            if (typeof window !== "undefined") {
              customHeaders["HTTP-Referer"] = window.location.origin;
            }

            // OpenRouterプロバイダーを作成
            const openrouter = createOpenRouter({
              apiKey: currentOpenRouterApiKey,
            });

            // リクエスト開始時間を記録
            const apiRequestStartTime = Date.now();

            console.log(
              `[handleSend] Creating OpenRouter provider for model: ${modelIdForApi}`,
              `\nRequest ID: ${userMessageId}`
            );

            // OpenRouterのモデルを取得
            const providerModel = openrouter.chat(modelIdForApi);

            // streamText呼び出しの準備
            const streamOptions = {
              model: providerModel,
              messages: messagesWithUser,
              system: "あなたは日本語で対応する親切なアシスタントです。",
              headers: customHeaders,
            };

            // ツールが設定されている場合は追加
            // if (tools && tools.length > 0) {
            //   // ツールをstreamTextに渡す方法に合わせて調整
            //   (streamOptions as any).tools = tools.map((t) =>
            //     t.function ? { type: t.type, function: t.function } : t
            //   );
            //   (streamOptions as any).tool_choice = "auto";
            //   console.log(
            //     `[handleSend] Including ${tools.length} tools in direct request`
            //   );
            // }

            console.log(
              `[handleSend] Calling streamText directly with OpenRouter provider for model: ${modelIdForApi}`,
              `\n[handleSend] streamOptions.messages: ${JSON.stringify(
                messagesWithUser
              )}`,
              `\n[handleSend] streamOptions.tools: ${JSON.stringify(
                (streamOptions as any).tools
              )}`
            );

            // streamTextを直接呼び出し
            const result = await streamText(streamOptions);

            const requestDuration = Date.now() - apiRequestStartTime;
            console.log(
              `[handleSend] Received stream after ${requestDuration}ms for model: ${modelIdForApi}`
            );

            // 追加ログここから
            // console.log(`[handleSend] result object for ${modelIdForApi}:`, JSON.stringify(result));
            // try {
            //   const textContent = await result.textPromise;
            //   console.log(`[handleSend] textPromise result for ${modelIdForApi}:`, textContent);
            // } catch (e: any) {
            //   console.error(`[handleSend] Error resolving textPromise for ${modelIdForApi}:`, e.message, e.stack);
            // }
            // try {
            //   const toolCalls = await result.toolCallsPromise;
            //   console.log(`[handleSend] toolCallsPromise result for ${modelIdForApi}:`, toolCalls);
            // } catch (e: any) {
            //     console.error(`[handleSend] Error resolving toolCallsPromise for ${modelIdForApi}:`, e.message, e.stack);
            // }
            // 追加ログここまで

            console.log(`[handleSend] 応答処理の開始: ${modelIdForApi}`);
            console.log(
              `[handleSend] result型: ${typeof result}, プロパティ: ${Object.keys(
                result
              ).join(", ")}`
            );

            // ストリームからテキストを読み取る
            // StreamTextResultから得られるtextStreamはReadableStreamとAsyncIterableの両方として使えるが、
            // for-awaitループでAsyncIterableとして扱う場合は必ずfor-awaitが完了するまで待つ必要がある
            try {
              console.log(
                `[handleSend] ストリーミング処理開始: ${modelIdForApi}`
              );
              accumulatedText = ""; // 各モデルの処理開始時にリセット

              // Vercel AI SDKの標準的なストリーミング処理
              for await (const delta of result.fullStream) {
                if (delta.type === "text-delta") {
                  const textDelta = delta.textDelta;
                  accumulatedText += textDelta;

                  // UIをリアルタイムで更新
                  const streamingUpdatePayload: AppMessage & {
                    role: "assistant";
                    id: string;
                  } = {
                    id: assistantMessageId,
                    role: "assistant",
                    content: accumulatedText,
                    timestamp: Date.now(),
                    ui: {
                      modelId: modelIdForApi,
                      isGenerating: true, // ストリーミング中はtrue
                    },
                  };
                  safeOptimisticUpdate({
                    type: "updateLlmResponse",
                    updatedAssistantMessage: streamingUpdatePayload,
                  });
                  setMessages((prevMsgs) =>
                    prevMsgs.map((m) =>
                      m.id === assistantMessageId && m.role === "assistant"
                        ? streamingUpdatePayload
                        : m
                    )
                  );
                } else {
                  console.log(
                    `[handleSend] Received non-text-delta for ${modelIdForApi}:`,
                    JSON.stringify(delta)
                  );
                }
              }

              console.log(
                `[handleSend] ストリーミング処理完了: ${modelIdForApi}, 全テキスト長: ${accumulatedText.length}`
              );
              console.log(
                `[handleSend] Final accumulatedText for ${modelIdForApi}:`,
                accumulatedText
              );
              console.log(
                `[handleSend] Final currentToolCalls for ${modelIdForApi}:`,
                JSON.stringify(currentToolCalls)
              );
            } catch (streamError: any) {
              console.error(
                `[handleSend] Error processing stream for model ${modelIdForApi}:`,
                streamError
              );
              console.error(
                `[handleSend] エラーの詳細: name=${streamError.name}, message=${streamError.message}, stack=${streamError.stack}`
              );
              if (streamError.cause) {
                console.error(`[handleSend] エラーの原因: `, streamError.cause);
              }
              accumulatedText = `ストリーム処理中にエラーが発生しました: ${
                streamError.message || "Unknown error"
              }`;
            }

            // 応答内容の処理
            if (accumulatedText.length === 0) {
              // 空レスポンスの場合のフォールバックメッセージ
              console.warn(
                `[handleSend] Empty response detected for model: ${modelIdForApi}. Adding fallback message.`
              );
              accumulatedText = `（${modelIdForApi}からの応答が空でした。`;
            } else if (
              accumulatedText.includes("error occurred") ||
              accumulatedText.includes("エラー")
            ) {
              // エラーメッセージが含まれている場合、より詳細な説明を追加
              console.warn(
                `[handleSend] Error message detected in response for model: ${modelIdForApi}`
              );
              if (!accumulatedText.includes("対処方法")) {
                accumulatedText += `\n\n（このエラーの対処方法: API設定を確認するか、別のモデルを試してください。問題が続く場合は管理者に連絡してください。）`;
              }
            }

            // 最終的なレスポンスを再度ログ出力
            console.log(
              `[handleSend] 最終的なレスポンス (model: ${modelIdForApi}): ${accumulatedText.substring(
                0,
                100
              )}...`
            );

            // UIを更新
            const optimisticUpdatePayload: AppMessage & {
              role: "assistant";
              id: string;
            } = {
              id: assistantMessageId,
              role: "assistant",
              content: accumulatedText,
              timestamp: Date.now(),
              ui: {
                modelId: modelIdForApi,
                isGenerating: true,
              },
            };
            if (currentToolCalls.length > 0) {
              optimisticUpdatePayload.tool_calls = [...currentToolCalls];
            }
            safeOptimisticUpdate({
              type: "updateLlmResponse",
              updatedAssistantMessage: optimisticUpdatePayload,
            });
          } catch (err: any) {
            if (err.name === "AbortError") {
              console.log(
                `[handleSend] Request aborted for model: ${modelIdForApi}`
              );
              accumulatedText += "\n(ストリーミングがキャンセルされました)";
            } else {
              console.error(
                `[handleSend] Error for model ${modelIdForApi}:`,
                err
              );
              accumulatedText += `\n(エラー: ${err.message})`;
              setError(
                `モデル ${modelIdForApi} との通信でエラー: ${err.message}`
              );
            }
          } finally {
            const finalAssistantMessage: AppMessage & {
              role: "assistant";
              id: string;
            } = {
              id: assistantMessageId,
              role: "assistant",
              content: accumulatedText,
              timestamp: Date.now(),
              ui: {
                modelId: modelIdForApi,
                isGenerating: false,
              },
            };
            if (currentToolCalls.length > 0) {
              finalAssistantMessage.tool_calls = [...currentToolCalls];
            }
            safeOptimisticUpdate({
              type: "updateLlmResponse",
              updatedAssistantMessage: finalAssistantMessage,
            });
            setMessages((prevMsgs) =>
              prevMsgs.map((m) => {
                if (m.id === assistantMessageId && m.role === "assistant") {
                  return finalAssistantMessage;
                }
                return m;
              })
            );

            // 生成完了状態を更新
            setAbortControllers((prev) => {
              const newControllers = { ...prev };
              delete newControllers[assistantMessageId];
              // 他に生成中のものがなければ全体のisGeneratingをfalseに
              if (Object.keys(newControllers).length === 0) {
                setIsGenerating(false);
              }
              return newControllers;
            });

            // いずれかのアボートコントローラーがまだ存在する場合は生成中状態を維持
            const remainingControllers = Object.keys(abortControllers).filter(
              (id) => id !== assistantMessageId
            );
            if (remainingControllers.length === 0) {
              setIsGenerating(false);

              // すべてのレスポンス処理が完了したらフラグをリセット
              console.log(
                `[handleSend] All responses completed, resetting isProcessingRef flag`
              );

              // 処理完了後に改めてバックアップを更新
              if (messagesRef.current.length > 0) {
                console.log(
                  `[handleSend] 処理完了後の最終バックアップを更新: ${messagesRef.current.length}件`
                );
                messagesBackupRef.current = [...messagesRef.current];
                lastValidMessagesTimestampRef.current = Date.now();
              }

              // 最後に処理中フラグをリセット
              isProcessingRef.current = false;
            }
          }
        })();
      }

      // ユーザー入力をクリア
      setChatInput("");

      // 最新のメッセージがストレージに保存されるよう更新
      if (!isShared && roomId) {
        saveMessagesToHistory([
          ...messages,
          newUserMessage,
          ...createdPlaceholders,
        ]);
      }
    },
    [
      models,
      openRouterApiKey,
      optimisticMessages,
      tools,
      isShared,
      roomId,
      messages,
      saveMessagesToHistory,
      setChatInput,
      setError,
      setApiKeyError,
      setIsGenerating,
      setAbortControllers,
    ]
  );

  const resetCurrentChat = useCallback(() => {
    const chatStorageKey = `chatMessages_${roomId || "default"}`;
    console.log(
      `[resetCurrentChat] リセット開始: roomId=${
        roomId || "default"
      }, 現在のメッセージ数=${messages.length}`
    );
    storage.remove(chatStorageKey);
    setMessages([]);
    setError(null);
    setApiKeyError(null);

    // 処理中フラグをリセット
    isProcessingRef.current = false;

    // バックアップもクリア
    messagesBackupRef.current = [];
    lastValidMessagesTimestampRef.current = 0;

    // safeOptimisticUpdateを使用
    safeOptimisticUpdate({ type: "resetMessages", payload: [] });
    console.log(
      `[resetCurrentChat] チャット履歴をリセットしました: roomId=${
        roomId || "default"
      }`
    );
  }, [
    roomId,
    setMessages,
    setError,
    setApiKeyError,
    safeOptimisticUpdate,
    messages.length,
  ]);

  const handleStopAllGeneration = useCallback(() => {
    console.log("Stopping all generations...");
    Object.values(abortControllers).forEach((controller) => {
      if (controller) {
        controller.abort();
      }
    });
    setAbortControllers({});
  }, [abortControllers, setAbortControllers]);

  const sortMessages = (arr: AppMessage[]): AppMessage[] => {
    return arr.sort((a, b) => {
      const aTime = a.timestamp || 0; // a.ui?.timestamp を a.timestamp に変更
      const bTime = b.timestamp || 0; // b.ui?.timestamp を b.timestamp に変更
      return aTime - bTime;
    });
  };

  const handleResetAndRegenerate = useCallback(
    async (messageId: string, newContent?: string) => {
      setIsGenerating(true);
      setError(null);
      isProcessingRef.current = true;
      messagesBackupRef.current = messages;

      const userMessageIndex = messages.findIndex(
        (msg) => msg.id === messageId
      );
      if (
        userMessageIndex === -1 ||
        messages[userMessageIndex].role !== "user"
      ) {
        console.error(
          "[ChatLogic] User message not found or not a user message for regeneration:",
          messageId
        );
        setIsGenerating(false);
        isProcessingRef.current = false;
        return;
      }

      const originalContent = messages[userMessageIndex].content;
      let contentForRegeneration: string;

      if (typeof newContent === "string") {
        contentForRegeneration = newContent;
      } else if (typeof originalContent === "string") {
        contentForRegeneration = originalContent;
      } else {
        console.error(
          "[ChatLogic] Cannot regenerate non-string content without new string input."
        );
        setIsGenerating(false);
        isProcessingRef.current = false;
        return;
      }

      const updatedMessages = messages
        .slice(0, userMessageIndex + 1)
        .map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: contentForRegeneration, // string型を保証
                timestamp: Date.now(),
                ui: {
                  ...(msg.ui || {}),
                  edited: typeof newContent === "string",
                },
              }
            : msg
        );

      setMessages(updatedMessages);
      await handleSend(contentForRegeneration); // string型を渡す

      isProcessingRef.current = false;
    },
    [messages, handleSend, openRouterApiKey, models, tools]
  );

  const handleSaveOnly = useCallback(
    (messageId: string, newContent: string) => {
      console.log(
        `Save only called for messageId: ${messageId} with new content: ${newContent}`
      );

      // addOptimisticMessageのためのラッパー関数
      const safeOptimisticUpdate = (action: OptimisticMessageAction) => {
        if (typeof startTransition === "function") {
          startTransition(() => {
            addOptimisticMessage(action);
          });
        } else {
          addOptimisticMessage(action);
        }
      };

      // Optimistic update を使ってUIに即時反映
      safeOptimisticUpdate({
        type: "updateUserMessage",
        messageId,
        newContent,
      });

      // 実際の messages state も更新 (useOptimistic の reducer 内のロジックと一貫性を保つ)
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId && msg.role === "user"
            ? {
                ...msg,
                content: newContent,
                timestamp: Date.now(),
                ui: { ...(msg.ui || {}), edited: true },
              }
            : msg
        )
      );
    },
    [addOptimisticMessage, setMessages]
  );

  const updateAssistantMessageContent = useCallback(
    (messageId: string, newContent: string) => {
      console.log(
        `Updating assistant messageId: ${messageId} with new content: ${newContent}`
      );

      // addOptimisticMessageのためのラッパー関数
      const safeOptimisticUpdate = (action: OptimisticMessageAction) => {
        if (typeof startTransition === "function") {
          startTransition(() => {
            addOptimisticMessage(action);
          });
        } else {
          addOptimisticMessage(action);
        }
      };

      safeOptimisticUpdate({
        type: "updateAssistantMessageContent",
        messageId,
        newContent,
      });

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId && msg.role === "assistant"
            ? {
                ...msg,
                content: newContent,
                timestamp: Date.now(),
                ui: { ...(msg.ui || {}), edited: true },
              }
            : msg
        )
      );
    },
    [addOptimisticMessage, setMessages]
  );

  const selectSingleModel = useCallback(
    (modelId: string) => {
      // 新しいモデルリストを更新
      const newModels = models.map((m) => ({
        ...m,
        selected: m.id === modelId,
      }));
      setModels(newModels);

      // 選択されたIDのみをローカルストレージに保存
      setSelectedModelIds([modelId]);
    },
    [models, setSelectedModelIds]
  );

  useEffect(() => {
    const loadOpenRouterModels = async () => {
      try {
        const fetchedModels = await fetchOpenRouterModels();
        console.log(
          "[useEffect loadOpenRouterModels] Models fetched from OpenRouter API",
          fetchedModels.length
        );

        // すべてのモデルがidとnameを持っていることを確認
        const validModels = fetchedModels.filter(
          (model: any) => !!model.id && !!model.name
        );
        console.log(
          "[useEffect loadOpenRouterModels] Valid models count:",
          validModels.length
        );

        if (validModels.length === 0) {
          // 有効なモデルがない場合はデフォルトモデルだけでも設定
          console.warn(
            "[useEffect loadOpenRouterModels] No valid models found, using default model"
          );
          setAllModels([
            {
              id: "openrouter/auto",
              name: "Auto (recommended)",
              selected: false,
            },
          ]);
          return;
        }

        const formattedModels: ModelItem[] = validModels.map((model: any) => ({
          id: model.id,
          name: model.name || model.id,
          selected: false, // 初期選択状態はfalse
        }));
        setAllModels(formattedModels);
        console.log(
          "[useEffect loadOpenRouterModels] AllModels loaded:",
          formattedModels.length
        );
      } catch (err) {
        console.error("Failed to fetch models from OpenRouter:", err);
        // エラー時にもデフォルトモデルだけは設定
        setAllModels([
          {
            id: "openrouter/auto",
            name: "Auto (recommended)",
            selected: false,
          },
        ]);
      }
    };
    loadOpenRouterModels();
  }, []); // fetchOpenRouterModelsを依存配列から削除、初回のみ実行

  // モデルリストの初期化と同期ロジック
  useEffect(() => {
    // selectedModelIds が undefined (useStorageState がロード中) なら処理しない
    if (selectedModelIds === undefined) {
      console.log(
        "[useEffect models sync] Skipping: selectedModelIds is undefined"
      );
      return;
    }

    // 既に初期化が完了していれば、再度の初期化処理は行わない
    if (modelsInitialized.current) {
      console.log(
        "[useEffect models sync] Already initialized, skipping initial sync."
      );
      return;
    }

    // --- ここからが実際の初期化処理 ---
    console.log(
      "[useEffect models init] Performing initial model list synchronization."
    );

    const currentSelectedIds = selectedModelIds || [];
    let finalSelectedIds: string[];

    if (currentSelectedIds.length > 0) {
      console.log(
        `[useEffect models init] Using stored selected model IDs (count: ${currentSelectedIds.length})`
      );
      finalSelectedIds = currentSelectedIds;
    } else {
      console.log(
        "[useEffect models init] No stored selected models, using default models."
      );
      // デフォルトモデルを設定（OpenRouter一覧に存在するかの確認は不要）
      finalSelectedIds = [...DEFAULT_MODEL_IDS];
    }

    // ローカルストレージのIDのみを元にmodelsを構築（OpenRouter一覧とはマージしない）
    const newModelList: ModelItem[] = finalSelectedIds.map((modelId) => {
      // OpenRouter一覧から名前を取得（見つからない場合はIDをそのまま使用）
      const openRouterModel = AllModels.find((m) => m.id === modelId);
      return {
        id: modelId,
        name: openRouterModel?.name || modelId,
        selected: true, // ローカルストレージにあるものはすべて選択状態
      };
    });

    console.log(
      `[useEffect models init] Setting models. Total: ${
        newModelList.length
      }, Selected: ${finalSelectedIds.length} (${finalSelectedIds.join(", ")})`
    );

    setModels(newModelList);
    setSelectedModelIds(finalSelectedIds);
    modelsInitialized.current = true;
    console.log(
      "[useEffect models init] Initial model synchronization complete."
    );
  }, [selectedModelIds, setSelectedModelIds, AllModels]);

  // 初期メッセージ読み込みuseEffect
  useEffect(() => {
    if (isProcessingRef.current) {
      // ... 処理中の復元ロジック
      return;
    }

    if (!isShared && roomId && !initialLoadComplete) {
      // storedMessages は ConversationTurn[] なので、フラット化が必要
      // ただし、古い形式のデータ（AppMessage[]）が残っている可能性もあるため、互換性処理を追加
      try {
        if (
          storedMessages &&
          Array.isArray(storedMessages) &&
          storedMessages.length > 0
        ) {
          // データ形式を判定：最初の要素が ConversationTurn か AppMessage かを確認
          const firstItem = storedMessages[0];
          let flattenedMessages: AppMessage[] = [];

          if (
            firstItem &&
            typeof firstItem === "object" &&
            "userMessage" in firstItem &&
            "assistantResponses" in firstItem
          ) {
            // 新しい形式 (ConversationTurn[]) の場合
            console.log(
              "[ChatLogic] Loading new format (ConversationTurn[]) data"
            );
            (storedMessages as ConversationTurn[]).forEach((turn) => {
              flattenedMessages.push(turn.userMessage);
              turn.assistantResponses.forEach((assistantMsg) =>
                flattenedMessages.push(assistantMsg)
              );
            });
          } else if (
            firstItem &&
            typeof firstItem === "object" &&
            "id" in firstItem &&
            "role" in firstItem
          ) {
            // 古い形式 (AppMessage[]) の場合
            console.log(
              "[ChatLogic] Loading old format (AppMessage[]) data, converting to new format"
            );
            flattenedMessages = storedMessages as unknown as AppMessage[]; // ★ unknown を経由してキャスト
            // 古い形式のデータを新しい形式に変換して保存
            saveMessagesToHistory(flattenedMessages);
          } else {
            console.warn(
              "[ChatLogic] Unknown data format in storedMessages, skipping"
            );
            flattenedMessages = [];
          }

          // 古いデータ形式からの移行とisGeneratingのリセット
          const processedLoadedMessages = flattenedMessages.map(
            (msg: AppMessage) => {
              // ui.timestamp への参照を削除
              return {
                ...msg,
                timestamp: msg.timestamp || Date.now(), // ui.timestampは参照しない
                ui: { ...(msg.ui || {}), isGenerating: false },
              };
            }
          );

          setMessages(processedLoadedMessages);
          messagesBackupRef.current = [...processedLoadedMessages];
          lastValidMessagesTimestampRef.current = Date.now();
          safeOptimisticUpdate({
            type: "resetMessages",
            payload: processedLoadedMessages,
          });
        } else {
          // storedMessages が空または無効な場合
          console.log("[ChatLogic] No valid stored messages found");
          messagesBackupRef.current = [];
          safeOptimisticUpdate({ type: "resetMessages", payload: [] });
          setMessages([]);
        }
      } catch (error) {
        console.error("[ChatLogic] Error processing storedMessages:", error);
        // エラーが発生した場合は空の状態で初期化
        messagesBackupRef.current = [];
        safeOptimisticUpdate({ type: "resetMessages", payload: [] });
        setMessages([]);
      }
      setInitialLoadComplete(true);
    } else if (isShared && initialMessages) {
      // initialMessages は AppMessage[] なのでそのまま
      const validInitialMessages = initialMessages.filter(
        (msg: any) =>
          msg && typeof msg === "object" && "id" in msg && "role" in msg
      );
      setMessages(validInitialMessages);
      messagesBackupRef.current = [...validInitialMessages];
      safeOptimisticUpdate({
        type: "resetMessages",
        payload: validInitialMessages,
      });
      setInitialLoadComplete(true);
    } else if (!roomId && !isShared && !initialLoadComplete) {
      // デフォルトメッセージ (chatMessages_default) の読み込みも ConversationTurn[] を想定して修正
      try {
        const defaultStoredTurns = storage.get(`chatMessages_default`) as
          | ConversationTurn[]
          | AppMessage[]
          | undefined;
        if (
          defaultStoredTurns &&
          Array.isArray(defaultStoredTurns) &&
          defaultStoredTurns.length > 0
        ) {
          const firstItem = defaultStoredTurns[0];
          let flattenedDefault: AppMessage[] = [];

          if (
            firstItem &&
            typeof firstItem === "object" &&
            "userMessage" in firstItem &&
            "assistantResponses" in firstItem
          ) {
            // 新しい形式 (ConversationTurn[]) の場合
            (defaultStoredTurns as ConversationTurn[]).forEach((turn) => {
              flattenedDefault.push(turn.userMessage);
              turn.assistantResponses.forEach((asMsg) =>
                flattenedDefault.push(asMsg)
              );
            });
          } else if (
            firstItem &&
            typeof firstItem === "object" &&
            "id" in firstItem &&
            "role" in firstItem
          ) {
            // 古い形式 (AppMessage[]) の場合
            flattenedDefault = defaultStoredTurns as unknown as AppMessage[]; // ★ unknown を経由してキャスト
          }

          // ★ mapのコールバック関数を実装
          const processedDefault = flattenedDefault.map((msg: AppMessage) => ({
            ...msg,
            timestamp: msg.timestamp || Date.now(),
            ui: { ...(msg.ui || {}), isGenerating: false },
          }));
          setMessages(processedDefault);
          messagesBackupRef.current = [...processedDefault];
          safeOptimisticUpdate({
            type: "resetMessages",
            payload: processedDefault,
          });
        } else {
          safeOptimisticUpdate({ type: "resetMessages", payload: [] });
          setMessages([]);
        }
      } catch (error) {
        console.error("[ChatLogic] Error processing default messages:", error);
        safeOptimisticUpdate({ type: "resetMessages", payload: [] });
        setMessages([]);
      }
      setInitialLoadComplete(true);
    }
  }, [
    roomId,
    isShared,
    initialMessages,
    storedMessages,
    setMessages,
    initialLoadComplete,
    safeOptimisticUpdate,
    saveMessagesToHistory, // saveMessagesToHistory を依存配列に追加
  ]);

  // ローカルストレージへの保存useEffect (saveMessagesToHistory を使う)
  useEffect(() => {
    if (isProcessingRef.current) return;
    if (!isShared && roomId && initialLoadComplete) {
      if (messages.length > 0) {
        saveMessagesToHistory(messages);
      } else if (messagesBackupRef.current.length > 0) {
        saveMessagesToHistory(messagesBackupRef.current);
      }
    }
  }, [messages, roomId, isShared, initialLoadComplete, saveMessagesToHistory]);

  const loadMessages = useCallback(async () => {
    if (isShared || !roomId) {
      if (initialMessages) {
        // initialMessages は AppMessage[] なのでそのままセット
        setMessages(initialMessages);
      }
      setInitialLoadComplete(true);
      return;
    }
    const loadedTurns = (await storage.get(`chatMessages_${roomId}`)) as
      | ConversationTurn[] // ★ 読み込む型は ConversationTurn[]
      | null
      | undefined;

    if (loadedTurns && loadedTurns.length > 0) {
      // ConversationTurn[] を AppMessage[] にフラット化
      const flattenedMessages: AppMessage[] = [];
      loadedTurns.forEach((turn) => {
        flattenedMessages.push(turn.userMessage);
        turn.assistantResponses.forEach((assistantMsg) => {
          flattenedMessages.push(assistantMsg);
        });
      });
      // 古いデータ形式 (ui.timestamp を含む) からの移行措置
      const processedMessages = flattenedMessages.map((msg: AppMessage) => {
        // ★ ui.timestamp への参照を削除
        return {
          ...msg,
          timestamp: msg.timestamp || Date.now(), // ui.timestampは参照しない
          ui: {
            ...(msg.ui || {}),
            isGenerating: false, // 起動時は常にfalse
          },
        };
      });
      setMessages(processedMessages);
    } else if (initialMessages) {
      setMessages(initialMessages); // initialMessages は AppMessage[]
    } else {
      setMessages([]);
    }
    setInitialLoadComplete(true);
  }, [isShared, roomId, initialMessages, setMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const updateAssistantMessageSelection = useCallback(
    (assistantMessageId: string, isSelected: boolean) => {
      console.log(
        `Updating assistant message selection: ${assistantMessageId}, selected: ${isSelected}`
      );
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === assistantMessageId && msg.role === "assistant"
            ? {
                ...msg,
                ui: { ...(msg.ui || {}), isSelected: isSelected },
              }
            : msg
        )
      );
      // 必要であれば optimistic update も行う
      // safeOptimisticUpdate({
      //   type: "updateAssistantSelection", // 新しいアクションタイプ
      //   messageId: assistantMessageId,
      //   isSelected: isSelected,
      // });
    },
    [setMessages /*, safeOptimisticUpdate */]
  );

  const regenerateAssistantResponse = useCallback(
    async (assistantMessageId: string) => {
      console.log(
        `Regenerating assistant response for ID: ${assistantMessageId}`
      );
      setError(null);
      const apiKey = getApiKeyForRegeneration();
      if (!apiKey) return;

      const targetAssistantMessage = messages.find(
        (msg) => msg.id === assistantMessageId && msg.role === "assistant"
      ) as (AppMessage & { role: "assistant" }) | undefined;

      if (!targetAssistantMessage) {
        console.error("Target assistant message not found for regeneration.");
        return;
      }

      const modelIdToRegenerate = targetAssistantMessage.ui?.modelId;
      if (!modelIdToRegenerate) {
        console.error("Model ID not found on target assistant message.");
        return;
      }

      let originUserMessage: (AppMessage & { role: "user" }) | null = null;
      const assistantIndex = messages.findIndex(
        (msg) => msg.id === assistantMessageId
      );
      for (let i = assistantIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          originUserMessage = messages[i] as AppMessage & { role: "user" };
          break;
        }
      }

      if (!originUserMessage || typeof originUserMessage.content !== "string") {
        console.error(
          "Origin user message (prompt) not found or content is not string."
        );
        return;
      }
      const userPrompt = originUserMessage.content;

      // 既存のメッセージ履歴をAPI用に準備 (再生成対象のユーザーメッセージまでを含める)
      const historyForApi: CoreMessage[] = messages
        .slice(
          0,
          messages.findIndex((msg) => msg.id === originUserMessage!.id) + 1
        )
        .filter(
          (msg) =>
            (msg.role === "user" ||
              msg.role === "assistant" ||
              msg.role === "system") &&
            typeof msg.content === "string" &&
            msg.id !== assistantMessageId // 再生成対象の古いアシスタントメッセージは除外
        )
        .map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content as string,
          ...(msg.role === "assistant" && msg.tool_calls
            ? { tool_calls: msg.tool_calls as any }
            : {}),
        }));

      setIsGenerating(true); // 全体的な生成中フラグも立てる
      // 対象のアシスタントメッセージのisGeneratingをtrueに更新
      setMessages((prevMsgs) =>
        prevMsgs.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                ui: {
                  ...(m.ui || {}),
                  isGenerating: true,
                  modelId: modelIdToRegenerate,
                },
                content: "",
              }
            : m
        )
      );

      const controller = new AbortController();
      setAbortControllers((prev) => ({
        ...prev,
        [assistantMessageId]: controller,
      }));

      let accumulatedText = "";
      try {
        const openrouter = createOpenRouter({ apiKey });
        const providerModel = openrouter.chat(modelIdToRegenerate);
        const streamOptions = {
          model: providerModel,
          messages: historyForApi, // ここはユーザープロンプトを含む履歴
          system: "あなたは日本語で対応する親切なアシスタントです。",
          headers: {
            "X-Title": "Mulch LLM Chat",
            ...(typeof window !== "undefined" && {
              "HTTP-Referer": window.location.origin,
            }),
          },
        };

        const result = await streamText(streamOptions);

        for await (const delta of result.fullStream) {
          if (delta.type === "text-delta") {
            accumulatedText += delta.textDelta;
            setMessages((prevMsgs) =>
              prevMsgs.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content: accumulatedText,
                      ui: {
                        ...(m.ui || {}),
                        isGenerating: true,
                        modelId: modelIdToRegenerate,
                      },
                    }
                  : m
              )
            );
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log(`Regeneration aborted for ${assistantMessageId}`);
          accumulatedText += "\n(再生成がキャンセルされました)";
        } else {
          console.error(
            `Error during regeneration for ${assistantMessageId}:`,
            err
          );
          accumulatedText += `\n(エラー: ${err.message})`;
          setError(
            `モデル ${modelIdToRegenerate} での再生成エラー: ${err.message}`
          );
        }
      } finally {
        setMessages((prevMsgs) =>
          prevMsgs.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: accumulatedText,
                  timestamp: Date.now(),
                  ui: {
                    ...(m.ui || {}),
                    isGenerating: false,
                    modelId: modelIdToRegenerate,
                  },
                }
              : m
          )
        );
        setAbortControllers((prev) => {
          const newControllers = { ...prev };
          delete newControllers[assistantMessageId];
          // 他に生成中のものがなければ全体のisGeneratingをfalseに
          if (Object.keys(newControllers).length === 0) {
            setIsGenerating(false);
          }
          return newControllers;
        });
      }
    },
    [
      messages,
      openRouterApiKey,
      setMessages,
      setError,
      setAbortControllers,
      setApiKeyError,
      tools,
    ]
  );

  return {
    isModalOpen,
    handleOpenModal: () => setIsModalOpen(true),
    handleCloseModal: () => setIsModalOpen(false),
    isModelModalOpen,
    handleOpenModelModal: () => setIsModelModalOpen(true),
    handleCloseModelModal: () => setIsModelModalOpen(false),
    models: models || [],
    updateModels: (newModels: ModelItem[]) => {
      setModels(newModels);
      // 選択されたIDのみをローカルストレージに保存
      const selectedIds = newModels.filter((m) => m.selected).map((m) => m.id);
      setSelectedModelIds(selectedIds);
    },
    chatInput,
    setChatInput,
    messages: optimisticMessages,
    setMessages,
    handleSend,
    isGenerating,
    error,
    apiKeyError,
    setApiKeyError,
    openRouterApiKey,
    AllModels,
    selectSingleModel,
    resetCurrentChat,
    initialLoadComplete,
    roomId,
    handleStopAllGeneration,
    handleResetAndRegenerate,
    handleSaveOnly,
    containerRef,
    updateAssistantMessageContent,
    updateAssistantMessageSelection,
    saveMessagesToHistory,
    loadMessages,
    regenerateAssistantResponse,
    selectedModelIds: selectedModelIds || [],
    setSelectedModelIds,
  };
}
