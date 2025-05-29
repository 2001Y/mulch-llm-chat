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
import { toast } from "sonner";

// === デバッグ設定 ===
const DEBUG_LOGS = {
  MESSAGES: true, // メッセージ状態変化ログ
  RESUME_LLM: true, // resumeLLMGeneration関連ログ
  TOOLS: true, // Tools関連ログ
  STORAGE: false, // ローカルストレージ保存ログ
  GENERAL: true, // 一般的なログ
};
// === デバッグ設定終了 ===

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

// カテゴリ情報の型定義を追加
interface ModelCategory {
  name: string;
  description: string;
  count: number;
  models: string[];
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

// デフォルト値を取得する関数
const fetchDefaults = async () => {
  try {
    const response = await fetch("/api/defaults");
    if (!response.ok) {
      throw new Error("Failed to fetch defaults");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching defaults:", error);
    // フォールバック値
    return {
      models: ["openai/gpt-4o-mini", "google/gemini-2.0-flash-001"],
      tools: [],
    };
  }
};

export function useChatLogic({
  isShared = false,
  initialMessages = undefined,
  initialError = null,
}: UseChatLogicProps = {}) {
  const router = useRouter();
  const params = useParams();

  // roomIdは個別チャットの場合のみ設定、トップページではundefined
  const roomId = params?.id
    ? decodeURIComponent(params.id as string)
    : undefined;

  const [openRouterApiKey, setOpenRouterApiKey] =
    useStorageState<string>("openrouter_api_key");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isModelSelectorSlideoutOpen, setIsModelSelectorSlideoutOpen] =
    useState(false);
  const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
  const [selectedModelIds, setSelectedModelIds] =
    useStorageState<string[]>("selectedModels");
  const [models, setModels] = useState<ModelItem[]>([]);

  // カテゴリ状態管理を追加
  const [categories, setCategories] = useState<Record<string, ModelCategory>>(
    {}
  );
  const [activeCategory, setActiveCategory] = useState<string>("カスタム");

  const [chatInput, setChatInput] = useState<string>("");

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
  // ★ storedMessages: ローカルストレージキーの説明
  // - roomIdがある場合: `chatMessages_${roomId}` (例: chatMessages_abc123)
  // - roomIdがない場合（トップページ）: 保存しない（メッセージ送信時に新しいIDを生成してナビゲート）
  // これにより、トップページは常に新しいチャット開始画面として機能する
  const [storedMessages, setStoredMessages] = useStorageState<
    ConversationTurn[]
  >(roomId ? `chatMessages_${roomId}` : undefined); // roomIdがない場合はundefinedで保存しない
  const containerRef = useRef<HTMLDivElement>(null);
  const [AllModels, setAllModels] = useState<ModelItem[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [toolFunctions, setToolFunctions] = useStorageState("toolFunctions");
  const [tools, setTools] = useStorageState<any[]>("tools"); // ツール定義

  // モデルの初期化状態を追跡するためのref
  const modelsInitialized = useRef(false);
  const toolsInitialized = useRef(false);

  // カテゴリ変更時の無限ループを防ぐためのref
  const isUpdatingFromCategory = useRef(false);

  // 現在のチャット情報を取得
  const getCurrentChatInfo = useCallback(() => {
    if (!roomId) return null;

    const chatData = storage.get(`chatMessages_${roomId}`) || [];
    if (chatData.length === 0) return null;

    // 最初のConversationTurnから情報を取得
    const firstTurn = chatData[0];
    if (!firstTurn || !firstTurn.userMessage) return null;

    // タイムスタンプを後ろから順に探索
    let timestamp = null;
    for (let j = chatData.length - 1; j >= 0; j--) {
      const turn = chatData[j];
      if (turn && turn.userMessage && turn.userMessage.timestamp) {
        timestamp = turn.userMessage.timestamp;
        break;
      }
    }

    // 最初のユーザーメッセージを取得
    const firstMessage = firstTurn.userMessage.content
      ? firstTurn.userMessage.content.slice(0, 50) +
        (firstTurn.userMessage.content.length > 50 ? "..." : "")
      : "No messages";

    return {
      id: roomId,
      title: roomId,
      firstMessage,
      timestamp: timestamp || -1,
    };
  }, [roomId]);

  // カテゴリ情報を取得する関数
  const loadCategories = useCallback(async () => {
    try {
      console.log("[useChatLogic] Fetching categories from /api/defaults");
      const response = await fetch("/api/defaults");
      const data = await response.json();
      if (data.categories) {
        console.log(
          "[useChatLogic] Categories loaded:",
          Object.keys(data.categories)
        );
        setCategories(data.categories);
        return data.categories;
      } else {
        console.warn("[useChatLogic] No categories found in API response");
        return {};
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      return {};
    }
  }, []);

  // カテゴリの実際のモデル数を計算する関数（AllModelsに存在するもののみ）
  const getValidCategoryModelCount = useCallback(
    (categoryKey: string) => {
      const category = categories[categoryKey];
      if (!category || !AllModels || AllModels.length === 0) {
        return 0;
      }

      // AllModelsに存在するモデルのみをカウント
      const validModelCount = category.models.filter((modelId) =>
        AllModels.some((m) => m.id === modelId)
      ).length;

      // デバッグログ（カテゴリ切り替え時のみ出力）
      if (category.models.length !== validModelCount) {
        console.log(
          `[getValidCategoryModelCount] Category "${category.name}": ${validModelCount}/${category.models.length} models are valid in AllModels`
        );
      }

      return validModelCount;
    },
    [categories, AllModels]
  );

  // 現在選択されているモデルがどのカテゴリと一致するかを判定する関数
  const getCurrentMatchingCategory = useCallback(() => {
    if (!models || models.length === 0) return "カスタム";

    const selectedModelIds = models
      .filter((m) => m.selected)
      .map((m) => m.id)
      .sort();

    // 各カテゴリと比較
    for (const [categoryKey, category] of Object.entries(categories)) {
      const categoryModelIds = [...category.models].sort();

      // 配列の長さと内容が完全に一致するかチェック
      if (
        selectedModelIds.length === categoryModelIds.length &&
        selectedModelIds.every((id, index) => id === categoryModelIds[index])
      ) {
        return categoryKey;
      }
    }

    return "カスタム"; // どのカテゴリとも一致しない場合はカスタム
  }, [models, categories]);

  // カテゴリプリセットを送信用モデルに適用する関数（安全な実装）
  const applyCategoryToModels = useCallback(
    async (categoryKey: string) => {
      const category = categories[categoryKey];
      if (!category) {
        console.warn(`Category "${categoryKey}" not found`);
        return;
      }

      // 無限ループを防ぐフラグを設定
      isUpdatingFromCategory.current = true;

      try {
        console.log(
          `[useChatLogic] Applying category "${category.name}" (${categoryKey})`
        );

        // カテゴリのモデルIDリストを取得し、AllModelsに存在するもののみを保持
        const categoryModelIds = category.models;
        const validCategoryModelIds = categoryModelIds.filter((modelId) => {
          const isValid = AllModels?.some((m) => m.id === modelId);
          if (!isValid) {
            console.warn(
              `[applyCategoryToModels] Category contains invalid model ID: ${modelId}`
            );
          }
          return isValid;
        });

        // 有効なモデルIDがない場合は、AllModelsの最初のモデルを使用
        if (
          validCategoryModelIds.length === 0 &&
          AllModels &&
          AllModels.length > 0
        ) {
          console.log(
            "[applyCategoryToModels] No valid models in category, using first available model"
          );
          validCategoryModelIds.push(AllModels[0].id);
        }

        // updateModelsを使ってローカルストレージに保存（これが確実な方法）
        const categoryModels: ModelItem[] = validCategoryModelIds.map(
          (modelId: string) => {
            const foundModel = AllModels?.find((m) => m.id === modelId);
            return {
              id: modelId,
              name: foundModel?.name || modelId.split("/").pop() || modelId,
              selected: true,
            };
          }
        );

        // モデルとカテゴリを同時に更新
        setModels(categoryModels);
        setActiveCategory(categoryKey);

        // 選択されたIDのみをローカルストレージに保存
        const selectedIds = categoryModels
          .filter((m) => m.selected)
          .map((m) => m.id);
        setSelectedModelIds(selectedIds);

        // ローカルストレージから無効なモデルIDを明示的に削除
        console.log(
          `[applyCategoryToModels] Cleaning up localStorage: setting valid IDs only: ${selectedIds.join(
            ", "
          )}`
        );

        console.log(
          `[useChatLogic] Applied category "${category.name}" with ${categoryModels.length} valid models:`,
          categoryModels.map((m) => m.name)
        );

        if (validCategoryModelIds.length !== categoryModelIds.length) {
          console.log(
            `[applyCategoryToModels] Filtered ${
              categoryModelIds.length - validCategoryModelIds.length
            } invalid models from category`
          );
        }
      } catch (error) {
        console.error("Failed to apply category:", error);
      } finally {
        // フラグをリセット（少し遅延させて確実にリセット）
        setTimeout(() => {
          isUpdatingFromCategory.current = false;
        }, 100);
      }
    },
    [categories, AllModels, setSelectedModelIds]
  );

  // regenerateAssistantResponse で使用する API キーの取得ロジック (handleSendから流用)
  const getApiKeyForRegeneration = () => {
    const currentOpenRouterApiKey =
      openRouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!currentOpenRouterApiKey) {
      const errorMessage =
        "OpenRouter APIキーが設定されていません。設定モーダルを開いて認証を行ってください。";
      setApiKeyError(errorMessage);
      console.error(
        "[API Key Check] OpenRouter API Key is missing. Opening settings modal."
      );

      // トースト通知でユーザーに分かりやすく伝える
      toast.error("APIキーが必要です", {
        description:
          "再生成にはOpenRouterでの認証が必要です。設定画面を開きました。",
        duration: 5000,
      });

      // APIキーがない場合は自動で設定モーダルを開く
      setIsModalOpen(true);
      return null;
    }
    setApiKeyError(null); // エラーがなければクリア
    return currentOpenRouterApiKey;
  };

  // ★ saveMessagesToHistory の宣言を正しい位置に配置
  const saveMessagesToHistory = useCallback(
    (currentMessagesToSave: AppMessage[]) => {
      if (isShared || !roomId) return; // 共有ビューまたはroomIdがない場合は保存しない

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

      storage.set(`chatMessages_${roomId}`, conversationTurns);
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
    // 生成中メッセージがある場合のみ詳細ログを出力
    const generatingCount = messages.filter(
      (msg) => msg.role === "assistant" && msg.ui?.isGenerating === true
    ).length;

    if (generatingCount > 0) {
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
    }

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

      const currentOpenRouterApiKey =
        openRouterApiKey || process.env.OPENROUTER_API_KEY;
      if (!currentOpenRouterApiKey) {
        const errorMessage =
          "OpenRouter APIキーが設定されていません。設定モーダルを開いて認証を行ってください。";
        setApiKeyError(errorMessage);
        console.error(
          "[handleSend] OpenRouter API Key is missing. Opening settings modal."
        );

        // トースト通知でユーザーに分かりやすく伝える
        toast.error("APIキーが必要です", {
          description: "OpenRouterでの認証が必要です。設定画面を開きました。",
          duration: 5000,
        });

        // APIキーがない場合は自動で設定モーダルを開く
        setIsModalOpen(true);
        return;
      }

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

      const userMessageId = generateId();
      const newUserMessage: AppMessage & { role: "user"; id: string } = {
        id: userMessageId,
        role: "user",
        content: userInput,
        timestamp: Date.now(),
      };

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

      // ユーザー入力をクリア
      setChatInput("");

      // トップページでメッセージ送信時は新しいIDを生成してローカルストレージに保存してからナビゲート
      if (!roomId) {
        const newRoomId = generateId();
        console.log(`[handleSend] Creating new chat with ID: ${newRoomId}`);

        // 新しいメッセージをローカルストレージに保存（新しいroomIdを使用）
        const initialMessages = [newUserMessage, ...createdPlaceholders];
        const conversationTurns: ConversationTurn[] = [
          {
            userMessage: newUserMessage,
            assistantResponses: createdPlaceholders as (AppMessage & {
              role: "assistant";
            })[],
          },
        ];
        storage.set(`chatMessages_${newRoomId}`, conversationTurns);

        // セッション内遷移フラグを設定（個別ページで生成状態を維持するため）
        sessionStorage.setItem(`navigation_${newRoomId}`, "true");
        console.log(
          `[handleSend] Set session navigation flag for roomId: ${newRoomId}`
        );

        // チャットが保存されたことをSidebarに通知
        window.dispatchEvent(new Event("chatListUpdate"));

        // 新IDページに遷移（状態はローカルストレージに保存済み）
        router.push(`/${newRoomId}`);

        return; // トップページからの遷移時は早期リターン（個別ページで自動的に生成処理が開始される）
      }

      // 個別チャットページでの処理：ローカルストレージ経由で統一フロー
      // リクエスト処理中フラグをセット
      isProcessingRef.current = true;

      // 既存のメッセージに新しいユーザーメッセージとプレースホルダーを追加
      const updatedMessages = [
        ...messages,
        newUserMessage,
        ...createdPlaceholders,
      ];

      // ローカルストレージに即座に保存
      const updatedConversationTurns: ConversationTurn[] = [];
      let currentUserMessage: (AppMessage & { role: "user" }) | null = null;
      let currentAssistantMessages: (AppMessage & { role: "assistant" })[] = [];

      updatedMessages.forEach((msg) => {
        if (!msg) return;
        const cleanUi = { ...(msg.ui || {}) };
        delete (cleanUi as any).timestamp;

        const messageWithProperTimestamp = {
          ...msg,
          timestamp: msg.timestamp || Date.now(),
          ui: cleanUi,
        };

        if (messageWithProperTimestamp.role === "user") {
          if (currentUserMessage) {
            updatedConversationTurns.push({
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
        updatedConversationTurns.push({
          userMessage: currentUserMessage,
          assistantResponses: currentAssistantMessages,
        });
      }

      storage.set(`chatMessages_${roomId}`, updatedConversationTurns);
      setStoredMessages(updatedConversationTurns);

      // メッセージ状態を更新
      setMessages(updatedMessages);
      messagesBackupRef.current = updatedMessages;
      lastValidMessagesTimestampRef.current = Date.now();

      // 安全に最適化状態を更新
      safeOptimisticUpdate({
        type: "addUserMessageAndPlaceholders",
        userMessage: newUserMessage,
        assistantPlaceholders: createdPlaceholders,
      });

      // チャットが保存されたことをSidebarに通知
      window.dispatchEvent(new Event("chatListUpdate"));

      // LLM生成処理は別のuseEffectで自動検知される
    },
    [
      models,
      openRouterApiKey,
      messages,
      roomId,
      setStoredMessages,
      setChatInput,
      setError,
      setApiKeyError,
      router,
      safeOptimisticUpdate,
    ]
  );

  const resetCurrentChat = useCallback(() => {
    if (!roomId) {
      console.log("[resetCurrentChat] No roomId, clearing local state only");
      setMessages([]);
      setError(null);
      setApiKeyError(null);
      isProcessingRef.current = false;
      messagesBackupRef.current = [];
      lastValidMessagesTimestampRef.current = 0;
      safeOptimisticUpdate({ type: "resetMessages", payload: [] });
      return;
    }

    const chatStorageKey = `chatMessages_${roomId}`;
    console.log(
      `[resetCurrentChat] リセット開始: roomId=${roomId}, 現在のメッセージ数=${messages.length}`
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
      `[resetCurrentChat] チャット履歴をリセットしました: roomId=${roomId}`
    );
  }, [
    roomId,
    setMessages,
    setError,
    setApiKeyError,
    safeOptimisticUpdate,
    messages.length,
  ]);

  // 生成中ステータスのメッセージに対してLLM処理を開始する関数
  const resumeLLMGeneration = useCallback(
    async (generatingMessages: (AppMessage & { role: "assistant" })[]) => {
      console.log("[resumeLLMGeneration] === 関数開始 ===");
      console.log("[resumeLLMGeneration] roomId:", roomId);
      console.log(
        "[resumeLLMGeneration] generatingMessages.length:",
        generatingMessages.length
      );
      console.log(
        "[resumeLLMGeneration] generatingMessages:",
        generatingMessages
      );

      if (!roomId || generatingMessages.length === 0) {
        console.log("[resumeLLMGeneration] === 早期リターン ===");
        console.log("[resumeLLMGeneration] roomId:", roomId);
        console.log(
          "[resumeLLMGeneration] generatingMessages.length:",
          generatingMessages.length
        );
        return;
      }

      console.log(
        `[resumeLLMGeneration] Starting LLM generation for ${generatingMessages.length} messages`
      );

      // 生成処理開始時にisProcessingRefをリセット
      isProcessingRef.current = false;

      const currentOpenRouterApiKey =
        openRouterApiKey || process.env.OPENROUTER_API_KEY;

      console.log(
        "[resumeLLMGeneration] currentOpenRouterApiKey:",
        currentOpenRouterApiKey ? "存在" : "なし"
      );

      if (!currentOpenRouterApiKey) {
        const errorMessage =
          "OpenRouter APIキーが設定されていません。設定モーダルを開いて認証を行ってください。";
        setApiKeyError(errorMessage);
        console.error(
          "[resumeLLMGeneration] OpenRouter API Key is missing. Opening settings modal."
        );

        // トースト通知でユーザーに分かりやすく伝える
        toast.error("APIキーが必要です", {
          description:
            "メッセージ生成にはOpenRouterでの認証が必要です。設定画面を開きました。",
          duration: 5000,
        });

        // APIキーがない場合は自動で設定モーダルを開く
        setIsModalOpen(true);
        return;
      }

      // 履歴メッセージを準備（生成中メッセージを除く）- messagesRef.currentを使用
      const historyForApi: CoreMessage[] = messagesRef.current
        .filter(
          (msg) =>
            (msg.role === "user" ||
              msg.role === "assistant" ||
              msg.role === "system") &&
            typeof msg.content === "string" &&
            !generatingMessages.some((gm) => gm.id === msg.id) // 生成中メッセージは除外
        )
        .map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content as string,
        }));

      setIsGenerating(true);

      // 各生成中メッセージに対してLLM処理を開始
      for (const placeholder of generatingMessages) {
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

        // 非同期でLLM処理を実行
        (async () => {
          let accumulatedText = "";

          try {
            console.log(
              `[resumeLLMGeneration] Processing model: ${modelIdForApi}`
            );

            const customHeaders: Record<string, string> = {
              "X-Title": "Mulch LLM Chat",
            };

            if (typeof window !== "undefined") {
              customHeaders["HTTP-Referer"] = window.location.origin;
            }

            const openrouter = createOpenRouter({
              apiKey: currentOpenRouterApiKey,
            });

            const providerModel = openrouter.chat(modelIdForApi);

            const streamOptions = {
              model: providerModel,
              messages: historyForApi,
              system: "あなたは日本語で対応する親切なアシスタントです。",
              headers: customHeaders,
            };

            // === Tools検証用ログ追加（resumeLLMGeneration） ===
            if (tools && tools.length > 0) {
              console.log("[Tools Debug - Resume] Current tools state:", tools);
              console.log(
                "[Tools Debug - Resume] Current toolFunctions state:",
                toolFunctions
              );
              console.log(
                "[Tools Debug - Resume] streamOptions before streamText:",
                streamOptions
              );
            }
            // === ログ追加終了 ===

            const result = await streamText(streamOptions);

            // ストリーミング処理
            for await (const delta of result.fullStream) {
              if (delta.type === "text-delta") {
                accumulatedText += delta.textDelta;

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
                    isGenerating: true,
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
              }
            }

            console.log(
              `[resumeLLMGeneration] Completed for model: ${modelIdForApi}`
            );
          } catch (err: any) {
            if (err.name === "AbortError") {
              console.log(
                `[resumeLLMGeneration] Request aborted for model: ${modelIdForApi}`
              );
              accumulatedText += "\n(ストリーミングがキャンセルされました)";
            } else {
              console.error(
                `[resumeLLMGeneration] Error for model ${modelIdForApi}:`,
                err
              );
              accumulatedText += `\n(エラー: ${err.message})`;
            }
          } finally {
            // 最終メッセージを保存
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

              if (Object.keys(newControllers).length === 0) {
                setIsGenerating(false);
                isProcessingRef.current = false;
              }
              return newControllers;
            });
          }
        })();
      }
    },
    [
      roomId,
      openRouterApiKey,
      setMessages,
      setIsGenerating,
      setAbortControllers,
      safeOptimisticUpdate,
      setApiKeyError,
      tools,
      toolFunctions,
    ]
  );

  const sortMessages = (arr: AppMessage[]): AppMessage[] => {
    return arr.sort((a, b) => {
      const aTime = a.timestamp || 0; // a.ui?.timestamp を a.timestamp に変更
      const bTime = b.timestamp || 0; // b.ui?.timestamp を b.timestamp に変更
      return aTime - bTime;
    });
  };

  const handleStopAllGeneration = useCallback(() => {
    console.log("Stopping all generations...");
    Object.values(abortControllers).forEach((controller) => {
      if (controller) {
        controller.abort();
      }
    });
    setAbortControllers({});
  }, [abortControllers, setAbortControllers]);

  const handleResetAndRegenerate = useCallback(
    async (messageId: string, newContent?: string) => {
      setError(null);
      setApiKeyError(null);
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
        isProcessingRef.current = false;
        return;
      }

      // 現在選択されているモデルを確認
      const currentSelectedModels = models?.filter((m) => m.selected) || [];
      if (currentSelectedModels.length === 0) {
        setError("送信先のモデルが選択されていません。");
        console.error("[handleResetAndRegenerate] No model selected.");
        isProcessingRef.current = false;
        return;
      }

      // 編集されたユーザーメッセージまでを残し、その後のメッセージをすべて削除
      const updatedMessages = messages
        .slice(0, userMessageIndex + 1)
        .map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: contentForRegeneration,
                timestamp: Date.now(),
              }
            : msg
        );

      // 新しいアシスタントメッセージのプレースホルダーを作成
      const createdPlaceholders = currentSelectedModels.map((modelItem) => ({
        id: generateId(),
        role: "assistant" as const,
        content: "",
        timestamp: Date.now(),
        ui: {
          modelId: modelItem.id,
          isGenerating: true,
        },
      }));

      // 最終的なメッセージリスト（編集されたユーザーメッセージ + 新しいプレースホルダー）
      const finalMessages = [...updatedMessages, ...createdPlaceholders];

      console.log(
        `[handleResetAndRegenerate] Resetting conversation from message ${messageId}. Original messages: ${messages.length}, Final messages: ${finalMessages.length}`
      );

      // メッセージ状態を更新
      setMessages(finalMessages);
      messagesBackupRef.current = finalMessages;
      lastValidMessagesTimestampRef.current = Date.now();

      // optimisticMessagesも同期
      safeOptimisticUpdate({
        type: "resetMessages",
        payload: finalMessages,
      });

      // ローカルストレージに保存
      saveMessagesToHistory(finalMessages);

      // LLM生成はuseEffectで自動検知される（通常の送信と同じフロー）

      isProcessingRef.current = false;
    },
    [
      messages,
      models,
      setError,
      setApiKeyError,
      setMessages,
      safeOptimisticUpdate,
      saveMessagesToHistory,
    ]
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
      // AllModelsに存在するかチェック
      const isValidModel = AllModels.some((m) => m.id === modelId);
      if (!isValidModel) {
        console.warn(`[selectSingleModel] Invalid model ID: ${modelId}`);
        // 無効なモデルIDの場合は、AllModelsの最初のモデルを選択
        if (AllModels.length > 0) {
          console.log(
            `[selectSingleModel] Using first available model instead: ${AllModels[0].id}`
          );
          modelId = AllModels[0].id;
        } else {
          console.error("[selectSingleModel] No valid models available");
          return;
        }
      }

      // 新しいモデルリストを更新
      const newModels = models.map((m) => ({
        ...m,
        selected: m.id === modelId,
      }));

      // 選択されたモデルがmodelsに存在しない場合は追加
      const selectedModelExists = newModels.some((m) => m.id === modelId);
      if (!selectedModelExists) {
        const modelToAdd = AllModels.find((m) => m.id === modelId);
        if (modelToAdd) {
          newModels.push({
            id: modelToAdd.id,
            name: modelToAdd.name,
            selected: true,
          });
          // 他のモデルの選択を解除
          newModels.forEach((m) => {
            if (m.id !== modelId) {
              m.selected = false;
            }
          });
        }
      }

      setModels(newModels);

      // 選択されたIDのみをローカルストレージに保存
      setSelectedModelIds([modelId]);
    },
    [models, setSelectedModelIds, AllModels]
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
          // 有効なモデルがない場合はデフォルト値をAPIから取得
          console.warn(
            "[useEffect loadOpenRouterModels] No valid models found, using default models from API"
          );
          try {
            const defaults = await fetchDefaults();
            const defaultModels = defaults.models.map((modelId: string) => ({
              id: modelId,
              name: modelId.split("/").pop() || modelId,
              selected: false,
            }));
            setAllModels(defaultModels);
          } catch (err) {
            console.error("Failed to fetch default models:", err);
            setAllModels([]);
          }
          return;
        }

        const formattedModels: ModelItem[] = validModels.map((model: any) => ({
          id: model.id,
          name: model.name || model.id,
          selected: false, // 初期選択状態はfalse
        }));

        // 重複チェック：重複したIDを排除
        const uniqueModels = formattedModels.filter(
          (model, index, self) =>
            index === self.findIndex((m) => m.id === model.id)
        );

        if (formattedModels.length !== uniqueModels.length) {
          console.warn(
            `[useEffect loadOpenRouterModels] Removed ${
              formattedModels.length - uniqueModels.length
            } duplicate models`
          );
        }

        setAllModels(uniqueModels);
        console.log(
          "[useEffect loadOpenRouterModels] AllModels loaded:",
          uniqueModels.length
        );
      } catch (err) {
        console.error("Failed to fetch models from OpenRouter:", err);
        // エラー時もデフォルト値をAPIから取得
        try {
          const defaults = await fetchDefaults();
          const defaultModels = defaults.models.map((modelId: string) => ({
            id: modelId,
            name: modelId.split("/").pop() || modelId,
            selected: false,
          }));
          setAllModels(defaultModels);
          console.log(
            "[useEffect loadOpenRouterModels] Using default models due to error"
          );
        } catch (defaultsErr) {
          console.error("Failed to fetch default models:", defaultsErr);
          setAllModels([]);
        }
      }
    };
    loadOpenRouterModels();
  }, []);

  // モデルリストの初期化ロジック（修正版）
  useEffect(() => {
    // selectedModelIds が undefined (useStorageState がロード中) なら処理しない
    if (selectedModelIds === undefined) {
      console.log(
        "[useEffect models sync] Skipping: selectedModelIds is undefined"
      );
      return;
    }

    // AllModelsが空の場合は処理しない（まだロードされていない）
    if (!AllModels || AllModels.length === 0) {
      console.log(
        "[useEffect models sync] Skipping: AllModels is empty or not loaded"
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
    const initializeModels = async () => {
      console.log(
        "[useEffect models init] Performing initial model list synchronization."
      );

      const currentSelectedIds = selectedModelIds || [];
      let finalSelectedIds: string[];

      if (currentSelectedIds.length > 0) {
        console.log(
          `[useEffect models init] Using stored selected model IDs (count: ${currentSelectedIds.length})`
        );

        // AllModelsに存在しないモデルIDを除外
        const validSelectedIds = currentSelectedIds.filter((modelId) => {
          const isValid = AllModels.some((m) => m.id === modelId);
          if (!isValid) {
            console.warn(
              `[useEffect models init] Removing invalid model ID from storage: ${modelId}`
            );
          }
          return isValid;
        });

        if (validSelectedIds.length !== currentSelectedIds.length) {
          console.log(
            `[useEffect models init] Cleaned up ${
              currentSelectedIds.length - validSelectedIds.length
            } invalid model IDs`
          );
          // 無効なモデルIDを削除してローカルストレージを更新
          setSelectedModelIds(validSelectedIds);
        }

        finalSelectedIds = validSelectedIds;
      } else {
        console.log(
          "[useEffect models init] No stored selected models, fetching defaults."
        );
        // APIからデフォルトモデルを取得
        const defaults = await fetchDefaults();

        // デフォルトモデルもAllModelsに存在するかチェック
        const validDefaultIds = defaults.models.filter((modelId: string) => {
          const isValid = AllModels.some((m) => m.id === modelId);
          if (!isValid) {
            console.warn(
              `[useEffect models init] Default model ID not found in AllModels: ${modelId}`
            );
          }
          return isValid;
        });

        finalSelectedIds = validDefaultIds;
      }

      // 有効なモデルIDがない場合は、AllModelsの最初のモデルを使用
      if (finalSelectedIds.length === 0 && AllModels.length > 0) {
        console.log(
          "[useEffect models init] No valid models found, using first available model"
        );
        finalSelectedIds = [AllModels[0].id];
        setSelectedModelIds(finalSelectedIds);
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
        }, Selected: ${finalSelectedIds.length} (${finalSelectedIds.join(
          ", "
        )})`
      );

      setModels(newModelList);

      // カテゴリも同期
      const matchingCategory = getCurrentMatchingCategory();
      setActiveCategory(matchingCategory);

      modelsInitialized.current = true;
      console.log(
        "[useEffect models init] Initial model synchronization complete."
      );
    };

    initializeModels();
  }, [
    selectedModelIds,
    setSelectedModelIds,
    AllModels,
    getCurrentMatchingCategory,
  ]);

  // ローカルストレージのモデル項目が変更されるたびに無効なモデルIDをクリーンアップ
  useEffect(() => {
    // 初期化が完了していない、またはAllModelsが空の場合はスキップ
    if (
      !modelsInitialized.current ||
      !AllModels ||
      AllModels.length === 0 ||
      !selectedModelIds
    ) {
      return;
    }

    // カテゴリ変更による更新中はスキップ（無限ループ防止）
    // ただし、カテゴリ変更後の遅延処理は実行する
    if (isUpdatingFromCategory.current) {
      // カテゴリ変更後の遅延クリーンアップを設定
      setTimeout(() => {
        if (!isUpdatingFromCategory.current) {
          console.log(
            "[useEffect cleanup] Delayed cleanup after category change"
          );
          // 遅延クリーンアップを実行（再帰的にuseEffectをトリガー）
          setSelectedModelIds([...selectedModelIds]);
        }
      }, 200);
      return;
    }

    console.log(
      "[useEffect cleanup] Checking for invalid model IDs in storage"
    );

    // AllModelsに存在しないモデルIDを検出
    const invalidModelIds = selectedModelIds.filter((modelId) => {
      const isValid = AllModels.some((m) => m.id === modelId);
      if (!isValid) {
        console.warn(`[useEffect cleanup] Found invalid model ID: ${modelId}`);
      }
      return !isValid;
    });

    // 無効なモデルIDがある場合はクリーンアップ
    if (invalidModelIds.length > 0) {
      const validSelectedIds = selectedModelIds.filter((modelId) =>
        AllModels.some((m) => m.id === modelId)
      );

      console.log(
        `[useEffect cleanup] Removing ${
          invalidModelIds.length
        } invalid model IDs: ${invalidModelIds.join(", ")}`
      );

      // 有効なモデルIDがない場合は、AllModelsの最初のモデルを使用
      if (validSelectedIds.length === 0 && AllModels.length > 0) {
        console.log(
          "[useEffect cleanup] No valid models remaining, using first available model"
        );
        validSelectedIds.push(AllModels[0].id);
      }

      // ローカルストレージを更新
      setSelectedModelIds(validSelectedIds);

      // modelsステートも更新
      const updatedModels: ModelItem[] = validSelectedIds.map((modelId) => {
        const openRouterModel = AllModels.find((m) => m.id === modelId);
        return {
          id: modelId,
          name: openRouterModel?.name || modelId,
          selected: true,
        };
      });

      setModels(updatedModels);

      // カテゴリも同期
      setTimeout(() => {
        const matchingCategory = getCurrentMatchingCategory();
        setActiveCategory(matchingCategory);
      }, 50);

      console.log(
        `[useEffect cleanup] Updated to ${
          validSelectedIds.length
        } valid model IDs: ${validSelectedIds.join(", ")}`
      );
    }
  }, [
    selectedModelIds,
    AllModels,
    modelsInitialized.current,
    setSelectedModelIds,
    getCurrentMatchingCategory,
  ]);

  // updateModels関数も修正して、無効なモデルIDを自動的に除外
  const safeUpdateModels = useCallback(
    (newModels: ModelItem[]) => {
      // 無限ループを防ぐための安全チェック
      if (isUpdatingFromCategory.current) {
        console.log("[updateModels] Skipping update during category change");
        return;
      }

      // AllModelsに存在するモデルのみを保持
      const validModels = newModels.filter((model) => {
        const isValid = AllModels.some((m) => m.id === model.id);
        if (!isValid) {
          console.warn(
            `[updateModels] Filtering out invalid model ID: ${model.id}`
          );
        }
        return isValid;
      });

      // 有効なモデルがない場合は、AllModelsの最初のモデルを使用
      if (validModels.length === 0 && AllModels.length > 0) {
        console.log(
          "[updateModels] No valid models provided, using first available model"
        );
        const firstModel = AllModels[0];
        validModels.push({
          id: firstModel.id,
          name: firstModel.name,
          selected: true,
        });
      }

      setModels(validModels);
      // 選択されたIDのみをローカルストレージに保存
      const selectedIds = validModels
        .filter((m) => m.selected)
        .map((m) => m.id);
      setSelectedModelIds(selectedIds);

      // カテゴリも同期（少し遅延させて無限ループを防ぐ）
      setTimeout(() => {
        const matchingCategory = getCurrentMatchingCategory();
        setActiveCategory(matchingCategory);
      }, 50);

      if (validModels.length !== newModels.length) {
        console.log(
          `[updateModels] Filtered ${
            newModels.length - validModels.length
          } invalid models`
        );
      }
    },
    [AllModels, setSelectedModelIds, getCurrentMatchingCategory]
  );

  // ツールリストの初期化ロジック
  useEffect(() => {
    // tools が undefined (useStorageState がロード中) なら処理しない
    if (tools === undefined) {
      console.log("[useEffect tools sync] Skipping: tools is undefined");
      return;
    }

    // 既に初期化が完了していれば、再度の初期化処理は行わない
    if (toolsInitialized.current) {
      console.log(
        "[useEffect tools sync] Already initialized, skipping initial sync."
      );
      return;
    }

    // --- ここからが実際の初期化処理 ---
    const initializeTools = async () => {
      console.log(
        "[useEffect tools init] Performing initial tools list synchronization."
      );

      const currentTools = tools || [];

      if (currentTools.length > 0) {
        console.log(
          `[useEffect tools init] Using stored tools (count: ${currentTools.length})`
        );
      } else {
        console.log(
          "[useEffect tools init] No stored tools, fetching defaults."
        );
        // APIからデフォルトツールを取得
        const defaults = await fetchDefaults();
        setTools(defaults.tools);
        console.log(
          `[useEffect tools init] Set default tools: ${defaults.tools.length} tools`
        );
      }

      toolsInitialized.current = true;
      console.log(
        "[useEffect tools init] Initial tools synchronization complete."
      );
    };

    initializeTools();
  }, [tools, setTools]);

  // 初期メッセージ読み込みuseEffect
  useEffect(() => {
    if (isProcessingRef.current) {
      // ... 処理中の復元ロジック
      return;
    }

    if (!isShared && roomId && !initialLoadComplete) {
      // roomIdがある場合のみメッセージを読み込む
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

          // セッション内フラグを確認（同一セッション内での遷移かどうか）
          const isWithinSession =
            sessionStorage.getItem(`navigation_${roomId}`) === "true";

          console.log(
            `[ChatLogic] Loading messages. isWithinSession: ${isWithinSession}, roomId: ${roomId}`
          );

          // 古いデータ形式からの移行とisGeneratingの処理
          const processedLoadedMessages = flattenedMessages.map(
            (msg: AppMessage) => {
              // ui.timestamp への参照を削除
              const cleanedMessage = {
                ...msg,
                timestamp: msg.timestamp || Date.now(), // ui.timestampは参照しない
                ui: { ...(msg.ui || {}) },
              };

              // 同一セッション内での遷移の場合は、isGenerating状態を維持
              // アプリ再起動時（セッションフラグがない場合）はfalseにリセット
              if (!isWithinSession) {
                cleanedMessage.ui.isGenerating = false;
              }
              // isWithinSessionがtrueの場合は、元の isGenerating 状態を維持

              return cleanedMessage;
            }
          );

          // セッションフラグをクリア（一度使用したら削除）
          if (isWithinSession) {
            sessionStorage.removeItem(`navigation_${roomId}`);
            console.log(
              `[ChatLogic] Cleared session navigation flag for roomId: ${roomId}`
            );
          }

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
      // 共有ビューの場合
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
    } else if (!roomId && !isShared) {
      // roomIdがない場合（トップページ）は常にメッセージをクリア
      console.log("[ChatLogic] Clearing messages for top page (no roomId)");
      messagesBackupRef.current = [];
      safeOptimisticUpdate({ type: "resetMessages", payload: [] });
      setMessages([]);
      setInitialLoadComplete(true);
    } else if (!initialLoadComplete) {
      // その他の場合でまだ初期化されていない場合
      console.log("[ChatLogic] Initializing empty state for new chat");
      safeOptimisticUpdate({ type: "resetMessages", payload: [] });
      setMessages([]);
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

  // 生成中メッセージの検知と再開処理用の別useEffect
  useEffect(() => {
    const generatingMessages = messages.filter(
      (msg) => msg.role === "assistant" && msg.ui?.isGenerating === true
    ) as (AppMessage & { role: "assistant" })[];

    // 生成中メッセージがない場合は早期リターン（ログ出力を最小化）
    if (generatingMessages.length === 0) {
      return;
    }

    console.log("[useEffect resumeLLM] === useEffect開始 ===");
    console.log("[useEffect resumeLLM] roomId:", roomId);
    console.log(
      "[useEffect resumeLLM] initialLoadComplete:",
      initialLoadComplete
    );
    console.log("[useEffect resumeLLM] isShared:", isShared);

    if (!roomId || !initialLoadComplete || isShared) {
      console.log("[useEffect resumeLLM] === 早期リターン ===");
      return;
    }

    console.log(
      `[useEffect] Checking for generating messages. Found: ${generatingMessages.length}, isGenerating: ${isGenerating}`
    );

    if (!isGenerating) {
      console.log(
        `[useEffect] Found ${generatingMessages.length} generating messages, starting LLM generation`
      );
      console.log("[useEffect] === resumeLLMGeneration呼び出し直前 ===");
      setTimeout(() => {
        console.log(
          "[useEffect] === setTimeout内でresumeLLMGeneration呼び出し ==="
        );
        resumeLLMGeneration(generatingMessages);
      }, 100);
    } else {
      console.log(
        `[useEffect] Generation already in progress for ${generatingMessages.length} messages`
      );
    }
  }, [
    roomId,
    initialLoadComplete,
    isShared,
    messages,
    isGenerating,
    resumeLLMGeneration,
  ]);

  // 初期メッセージ読み込み完了後の生成チェック用useEffect
  useEffect(() => {
    if (!roomId || !initialLoadComplete || isShared || !messages.length) return;

    const generatingMessages = messages.filter(
      (msg) => msg.role === "assistant" && msg.ui?.isGenerating === true
    ) as (AppMessage & { role: "assistant" })[];

    if (generatingMessages.length > 0 && !isGenerating) {
      console.log(
        `[useEffect] Initial load complete, starting generation for ${generatingMessages.length} messages`
      );
      // 少し遅延してから実行することで、他の状態更新との競合を回避
      setTimeout(() => {
        resumeLLMGeneration(generatingMessages);
      }, 200);
    }
  }, [initialLoadComplete]); // initialLoadCompleteの変化のみを監視

  // ローカルストレージへの保存useEffect (saveMessagesToHistory を使う)
  useEffect(() => {
    if (isProcessingRef.current) return;
    if (!isShared && initialLoadComplete) {
      // 生成中メッセージがある場合のみログ出力
      const generatingCount = messages.filter(
        (msg) => msg.role === "assistant" && msg.ui?.isGenerating === true
      ).length;

      if (generatingCount > 0) {
        console.log(
          "[Storage] Saving messages to history, count:",
          messages.length
        );
      }

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

      // セッション内フラグを確認（同一セッション内での遷移かどうか）
      const isWithinSession =
        sessionStorage.getItem(`navigation_${roomId}`) === "true";

      console.log(
        `[loadMessages] Loading messages. isWithinSession: ${isWithinSession}, roomId: ${roomId}`
      );

      // 古いデータ形式 (ui.timestamp を含む) からの移行措置
      const processedMessages = flattenedMessages.map((msg: AppMessage) => {
        // ★ ui.timestamp への参照を削除
        const cleanedMessage = {
          ...msg,
          timestamp: msg.timestamp || Date.now(), // ui.timestampは参照しない
          ui: {
            ...(msg.ui || {}),
          },
        };

        // 同一セッション内での遷移の場合は、isGenerating状態を維持
        // アプリ再起動時（セッションフラグがない場合）はfalseにリセット
        if (!isWithinSession) {
          cleanedMessage.ui.isGenerating = false;
        }
        // isWithinSessionがtrueの場合は、元の isGenerating 状態を維持

        return cleanedMessage;
      });

      // セッションフラグをクリア（一度使用したら削除）
      if (isWithinSession) {
        sessionStorage.removeItem(`navigation_${roomId}`);
        console.log(
          `[loadMessages] Cleared session navigation flag for roomId: ${roomId}`
        );
      }

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

        // === Tools検証用ログ追加（再生成時） ===
        if (tools && tools.length > 0) {
          console.log("[Tools Debug - Regenerate] Current tools state:", tools);
          console.log(
            "[Tools Debug - Regenerate] Current toolFunctions state:",
            toolFunctions
          );
          console.log(
            "[Tools Debug - Regenerate] streamOptions before streamText:",
            streamOptions
          );
        }
        // === ログ追加終了 ===

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
            isProcessingRef.current = false;
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

  // OpenRouter認証成功時にAPIキーエラーをクリアし、APIキー状態を更新
  useEffect(() => {
    const handleTokenChange = () => {
      const currentToken = storage.get("openrouter_api_key"); // accessTokenではなくopenrouter_api_keyを確認
      console.log(
        "[useChatLogic] tokenChangeイベント受信 - 現在のトークン:",
        currentToken
      );

      // APIキーの状態を強制的に更新
      setOpenRouterApiKey(currentToken);

      if (currentToken && apiKeyError) {
        console.log(
          "[useChatLogic] OpenRouter token detected, clearing API key error"
        );
        setApiKeyError(null);

        // 認証成功のトースト通知（設定モーダル以外からの場合）
        if (!isModalOpen) {
          toast.success("認証完了", {
            description:
              "OpenRouterとの認証が完了しました。メッセージを送信できます。",
            duration: 3000,
          });
        }
      }
    };

    // tokenChangeイベントをリッスン
    window.addEventListener("tokenChange", handleTokenChange);

    // 初回チェック
    handleTokenChange();

    return () => {
      window.removeEventListener("tokenChange", handleTokenChange);
    };
  }, [apiKeyError, isModalOpen, setOpenRouterApiKey]);

  // カテゴリ初期化useEffect
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // activeCategory を現在の状態に同期（カテゴリ変更時以外）
  useEffect(() => {
    // カテゴリ変更による更新中は同期しない
    if (isUpdatingFromCategory.current) {
      return;
    }

    const matchingCategory = getCurrentMatchingCategory();
    if (matchingCategory !== activeCategory) {
      console.log(
        `[useChatLogic] Syncing activeCategory from "${activeCategory}" to "${matchingCategory}"`
      );
      setActiveCategory(matchingCategory);
    }
  }, [getCurrentMatchingCategory, activeCategory]);

  return {
    isModalOpen,
    handleOpenModal: () => setIsModalOpen(true),
    handleCloseModal: () => setIsModalOpen(false),
    isModelModalOpen,
    handleOpenModelModal: () => setIsModelModalOpen(true),
    handleCloseModelModal: () => setIsModelModalOpen(false),
    isModelSelectorSlideoutOpen,
    handleOpenModelSelectorSlideout: () => setIsModelSelectorSlideoutOpen(true),
    handleCloseModelSelectorSlideout: () =>
      setIsModelSelectorSlideoutOpen(false),
    isToolsModalOpen,
    handleOpenToolsModal: () => setIsToolsModalOpen(true),
    handleCloseToolsModal: () => setIsToolsModalOpen(false),
    tools: tools || [],
    updateTools: (newTools: any[]) => setTools(newTools),
    models: models || [],
    updateModels: safeUpdateModels, // 安全なupdateModels関数を使用
    // カテゴリ関連の新しいAPI
    categories,
    activeCategory,
    setActiveCategory,
    applyCategoryToModels,
    getCurrentMatchingCategory,
    getValidCategoryModelCount,
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
    resumeLLMGeneration,
    getCurrentChatInfo,
  };
}
