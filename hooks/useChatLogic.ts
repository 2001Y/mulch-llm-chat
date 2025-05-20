import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useOptimistic,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import useStorageState, { storage, StorageState } from "hooks/useLocalStorage";
import useAccessToken from "hooks/useAccessToken";
import { useOpenAI } from "hooks/useOpenAI";
import { generateId } from "@/utils/generateId";
import type {
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
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

export interface ToolFunction {
  (args: any): any;
}

export interface Message {
  user: string;
  llm: Array<{
    role: string;
    model: string;
    text: string;
    selected: boolean;
    isGenerating?: boolean;
    selectedOrder?: number;
    isError?: boolean;
  }>;
  timestamp?: number;
  edited?: boolean;
}

export interface ModelItem {
  name: string;
  selected: boolean;
}

interface UseChatLogicProps {
  isShared?: boolean;
  initialMessages?: Message[];
  initialError?: string | null;
}

// ★ MarkdownをChatCompletionContentPart[]にパースするヘルパー関数
const parseMarkdownToContentParts = (
  markdown: string
): ChatCompletionUserMessageParam["content"] => {
  if (!markdown || typeof markdown !== "string") return [];

  const parts: ChatCompletionUserMessageParam["content"] = [];
  // さらに修正された正規表現
  const imageRegex =
    /!\[(.*?)\]\((data:image\/[^;]+;base64,[^\)]+|(?:https?:)?\/\/[^\)]+)\)|<img\s+src=(?:\"([^\"]*)\"|'([^']*)')[^>]*>/gi;

  let lastIndex = 0;
  let match;

  while ((match = imageRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        text: markdown.substring(lastIndex, match.index),
      });
    }
    const imageUrl = match[2] || match[3] || match[4]; // Group 2 for ![](), Group 3 for src="", Group 4 for src=''
    if (imageUrl) {
      parts.push({ type: "image_url", image_url: { url: imageUrl } });
    }
    lastIndex = imageRegex.lastIndex;
  }
  if (lastIndex < markdown.length) {
    parts.push({ type: "text", text: markdown.substring(lastIndex) });
  }
  return parts.filter((part) => !(part.type === "text" && !part.text?.trim()));
};

// useOptimistic の Action の型定義
type OptimisticMessageAction =
  | {
      type: "addUserMessageAndPlaceholders";
      userMessage: string;
      llmPlaceholders: { model: string }[];
    }
  | {
      type: "updateLlmResponse";
      llmResponse: {
        messageIndex: number;
        responseIndex: number;
        text: string;
        isGenerating?: boolean;
        isError?: boolean;
      };
    }
  | { type: "resetMessages"; payload: Message[] };

export function useChatLogic({
  isShared = false,
  initialMessages = undefined,
  initialError = null,
}: UseChatLogicProps = {}) {
  const [accessToken] = useAccessToken();
  const openai = useOpenAI(accessToken);
  const router = useRouter();
  const params = useParams();
  const roomId = params?.id
    ? decodeURIComponent(params.id as string)
    : undefined;

  // States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [models, setModels] = useStorageState("models");
  const [chatInput, setChatInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortControllers, setAbortControllers] = useState<AbortController[]>(
    []
  );
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(initialError);
  const [storedMessages, setStoredMessages] = useStorageState(
    `chatMessages_${roomId || "default"}`
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [AllModels, setAllModels] = useState<
    { fullId: string; shortId: string }[]
  >([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [toolFunctions, setToolFunctions] = useStorageState("toolFunctions");

  // ★ Optimistic messages state
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<
    Message[],
    OptimisticMessageAction
  >(messages, (currentOptimisticMessages, action) => {
    switch (action.type) {
      case "addUserMessageAndPlaceholders":
        const newUserMessage: Message = createMessage(
          action.userMessage,
          action.llmPlaceholders.map((p) => p.model)
        );
        newUserMessage.llm = newUserMessage.llm.map((l) => ({
          ...l,
          isGenerating: true,
          text: "...",
          isError: false,
        }));
        return [...currentOptimisticMessages, newUserMessage];
      case "updateLlmResponse":
        const { messageIndex, responseIndex, text, isGenerating, isError } =
          action.llmResponse;
        return currentOptimisticMessages.map((msg, idx) => {
          if (idx === messageIndex) {
            const updatedLlm = [...msg.llm];
            if (updatedLlm[responseIndex]) {
              updatedLlm[responseIndex] = {
                ...updatedLlm[responseIndex],
                text,
                isGenerating:
                  isGenerating ?? updatedLlm[responseIndex].isGenerating,
                isError: isError ?? false,
              };
            }
            return { ...msg, llm: updatedLlm };
          }
          return msg;
        });
      case "resetMessages":
        return action.payload;
      default:
        return currentOptimisticMessages;
    }
  });

  // --- Start: Helper and Core Logic Functions (Moved Up) ---
  const extractModelsFromInput = useCallback(
    (markdownInput: string): string[] => {
      const modelMatches = markdownInput.match(/@(\S+)/g) || [];
      return modelMatches
        .map((match: string) => match.slice(1))
        .map((shortId: string) => {
          const matchedModel = AllModels.find(
            (model) => model.shortId === shortId
          );
          return matchedModel ? matchedModel.fullId : null;
        })
        .filter((model: string | null): model is string => model !== null);
    },
    [AllModels]
  );

  const cleanInputContent = useCallback((markdownInput: string): string => {
    return markdownInput.replace(/@\S+/g, "").trim();
  }, []);

  const determineModelsToUse = useCallback(
    (userInputMarkdown: string, isPrimaryOnly: boolean): string[] => {
      const specifiedModels = extractModelsFromInput(userInputMarkdown);
      const currentModels = models || [];
      const selectedModels = currentModels
        .filter((model: ModelItem) => model.selected)
        .map((model: ModelItem) => model.name);
      if (selectedModels.length === 0) return ["anthropic/claude-2"];
      return isPrimaryOnly
        ? [selectedModels[0]]
        : specifiedModels.length > 0
        ? specifiedModels
        : selectedModels;
    },
    [models, extractModelsFromInput]
  );

  const createMessage = useCallback(
    (userInputMarkdown: string, modelsToUse: string[]): Message => ({
      user: userInputMarkdown,
      llm: modelsToUse.map((model: string) => ({
        role: "assistant",
        model,
        text: "",
        selected: false,
        isGenerating: true,
        isError: false,
      })),
      timestamp: Date.now(),
      edited: false,
    }),
    []
  );

  const originalUpdateMessage = useCallback(
    (
      messageIndex: number,
      responseIndex: number | null,
      content?: string | ((prevText: string) => string),
      toggleSelected?: boolean,
      saveOnly?: boolean
    ) => {
      if (responseIndex !== null && typeof content === "string") {
        // LLMのストリーミング応答を楽観的UIに反映
        addOptimisticMessage({
          type: "updateLlmResponse",
          llmResponse: {
            messageIndex,
            responseIndex,
            text: content,
            isGenerating: true,
            isError: false,
          },
        });
      } else {
        // ユーザー入力の編集や選択状態の変更は直接setMessagesで (またはこれもoptimisticに)
        setMessages((prevMessages) => {
          // ... (既存のsetMessagesロジックをここに移動・調整)
          const newMessages = [...prevMessages];
          // ... (元のupdateMessageのロジックをここに記述)
          if (messageIndex < 0 || messageIndex >= newMessages.length)
            return prevMessages;
          const messageToUpdate = { ...newMessages[messageIndex] };
          if (responseIndex === null) {
            /* ... user update ... */
          } else {
            /* ... llm non-streaming update (e.g. toggle selected) ... */
            const llmResponseToUpdate = {
              ...messageToUpdate.llm[responseIndex],
            };
            if (toggleSelected) {
              /* ... */
            }
            // 他のケース (エラーでisGenerating:falseにするなど) も考慮
            if (typeof content === "string") llmResponseToUpdate.text = content; // ストリーミング以外でのテキスト更新

            messageToUpdate.llm[responseIndex] = llmResponseToUpdate;
          }
          newMessages[messageIndex] = messageToUpdate;
          if (saveOnly && !isShared && roomId) setStoredMessages(newMessages);
          return newMessages;
        });
      }
    },
    [addOptimisticMessage, setMessages, isShared, roomId, storedMessages] // 依存関係
  );

  const fetchChatResponse = useCallback(
    async (
      model: string,
      messageIndex: number,
      responseIndex: number,
      abortController: AbortController,
      userInputMarkdown: string
    ) => {
      console.log("[fetchChatResponse] 開始", {
        model,
        messageIndex,
        responseIndex,
      });
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        if (
          newMessages[messageIndex] &&
          newMessages[messageIndex].llm[responseIndex]
        ) {
          newMessages[messageIndex].llm[responseIndex].isGenerating = true;
        }
        return newMessages;
      });

      try {
        const currentMessageHistory = messages;
        const pastMessages = currentMessageHistory
          .slice(0, messageIndex)
          .flatMap((msg) => {
            const userParts = parseMarkdownToContentParts(msg.user || "");
            const userMsgObj: ChatCompletionUserMessageParam | null =
              userParts.length > 0
                ? { role: "user", content: userParts }
                : null;
            const assistantMsgs: ChatCompletionAssistantMessageParam[] = msg.llm
              .filter((llm) => llm.selected && llm.text?.trim())
              .map((llm) => ({ role: "assistant", content: llm.text.trim() }));
            return [userMsgObj, ...assistantMsgs].filter(
              (
                m
              ): m is
                | ChatCompletionUserMessageParam
                | ChatCompletionAssistantMessageParam => m !== null
            );
          });

        const cleanedUserInput = cleanInputContent(userInputMarkdown || "");
        const currentUserInputParts =
          parseMarkdownToContentParts(cleanedUserInput);

        const extractedModels = extractModelsFromInput(userInputMarkdown || "");
        const modelToUse =
          (extractedModels.length > 0 ? extractedModels[0] : undefined) ||
          model;

        // 送信するメッセージがない場合はAPIコールをスキップする（ただしエラーメッセージはユーザーに表示）
        if (currentUserInputParts.length === 0 && pastMessages.length === 0) {
          console.warn(
            "[DEBUG fetchChatResponse] No content to send (current input and history are empty). Skipping API call."
          );
          // ローディング状態を解除し、ユーザーにフィードバック
          setMessages((prevMsgs) => {
            const updatedMsgs = [...prevMsgs];
            if (
              updatedMsgs[messageIndex] &&
              updatedMsgs[messageIndex].llm[responseIndex]
            ) {
              updatedMsgs[messageIndex].llm[responseIndex].isGenerating = false;
              updatedMsgs[messageIndex].llm[responseIndex].text =
                "メッセージ内容がありません。"; // ユーザーへのフィードバック
            }
            return updatedMsgs;
          });
          // 全体のisGeneratingフラグも適切に管理
          if (messages[messageIndex]?.llm.every((r) => !r.isGenerating)) {
            setIsGenerating(false);
          }
          return;
        }

        const apiMessages: ChatCompletionMessageParam[] = [
          ...(pastMessages as ChatCompletionMessageParam[]),
        ];
        if (currentUserInputParts.length > 0) {
          apiMessages.push({ role: "user", content: currentUserInputParts });
        }

        console.log(
          "[API Request] Processed Messages:",
          JSON.stringify(apiMessages, null, 2)
        );

        const stream = await openai?.chat.completions.create(
          {
            model: modelToUse,
            messages: apiMessages,
            stream: true,
            tool_choice: "auto",
          },
          {
            signal: abortController.signal,
          }
        );

        // APIに送信されるメッセージ内をログ出力
        console.log("[API Request] Messages:", apiMessages);

        let resultText = "";

        if (stream) {
          console.log("[fetchChatResponse] トリーム受信開始");
          for await (const part of stream) {
            if (abortController.signal.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }
            const content = part.choices[0]?.delta?.content || "";
            resultText += content;

            addOptimisticMessage({
              type: "updateLlmResponse",
              llmResponse: {
                messageIndex,
                responseIndex,
                text: resultText,
                isGenerating: true,
                isError: false,
              },
            });
          }
          addOptimisticMessage({
            type: "updateLlmResponse",
            llmResponse: {
              messageIndex,
              responseIndex,
              text: resultText,
              isGenerating: false,
              isError: false,
            },
          });
          setIsAutoScroll(true);
        } else {
          console.error("[fetchChatResponse] ストリーム作成に失敗しました");
          addOptimisticMessage({
            type: "updateLlmResponse",
            llmResponse: {
              messageIndex,
              responseIndex,
              text: "エラー: ストリーム作成失敗",
              isGenerating: false,
              isError: true,
            },
          });
        }
      } catch (e: any) {
        console.error("API Error:", e);
        let errorMessage = "An unexpected error occurred.";
        if (e.name === "AbortError") {
          errorMessage = "Generation aborted.";
        } else if (e.response && e.response.data && e.response.data.error) {
          errorMessage = e.response.data.error.message || "API request failed.";
        } else if (e.message) {
          errorMessage = e.message;
        }

        addOptimisticMessage({
          type: "updateLlmResponse",
          llmResponse: {
            messageIndex,
            responseIndex,
            text: `Error: ${errorMessage}`,
            isGenerating: false,
            isError: true,
          },
        });
        setError(errorMessage);
      } finally {
        console.log("[fetchChatResponse] 完了", {
          messageIndex,
          responseIndex,
        });
        setMessages((prevMessages) => {
          const newMessages = [...prevMessages];
          if (
            newMessages[messageIndex] &&
            newMessages[messageIndex].llm[responseIndex]
          ) {
            newMessages[messageIndex].llm[responseIndex].isGenerating = false;
            const allResponsesComplete = newMessages[messageIndex].llm.every(
              (response: any) => !response.isGenerating
            );
            if (allResponsesComplete) {
              setIsGenerating(false);
            }
          }
          setStoredMessages(newMessages);
          return newMessages;
        });
      }
    },
    [
      messages,
      openai,
      addOptimisticMessage,
      setStoredMessages,
      extractModelsFromInput,
      cleanInputContent,
      setError,
      AllModels,
      setMessages,
      setIsGenerating,
      isShared,
      roomId,
    ]
  );
  // --- End: Helper and Core Logic Functions ---

  // --- Start: Event Handlers (Mainly UI interaction) ---
  const handleOpenModal = useCallback(() => {
    console.log("[DEBUG] useChatLogic - handleOpenModal called");
    setIsModalOpen(true);
    console.log("[DEBUG] useChatLogic - isModalOpen set to true");
  }, []);
  const handleCloseModal = useCallback(() => {
    console.log("[DEBUG] useChatLogic - handleCloseModal called");
    setIsModalOpen(false);
    console.log("[DEBUG] useChatLogic - isModalOpen set to false");
  }, []);

  const handleSend = useCallback(
    async (
      event:
        | React.FormEvent<HTMLFormElement>
        | React.MouseEvent<HTMLButtonElement>
        | React.KeyboardEvent<HTMLDivElement>,
      isPrimaryOnly = false,
      savedInput?: string
    ) => {
      event.preventDefault();
      if (isGenerating) return;
      const inputToUse = savedInput || chatInput;
      if (!inputToUse.trim()) return;
      const modelsToUse: string[] = determineModelsToUse(
        inputToUse,
        isPrimaryOnly
      );

      // ユーザーメッセージとLLMプレースホルダーを楽観的UIに追加
      addOptimisticMessage({
        type: "addUserMessageAndPlaceholders",
        userMessage: inputToUse,
        llmPlaceholders: modelsToUse.map((modelName: string) => ({
          model: modelName,
        })),
      });

      // サーバーへの実際の送信処理 (fetchChatResponse呼び出し)
      // この時、messageIndex は楽観的更新前の messages.length を使う必要があるため注意
      const currentMessagesLengthBeforeOptimisticUpdate = messages.length;

      if (!roomId) {
        const newChatId = generateId(6);
        const newStorageKey = `chatMessages_${newChatId}`;
        storage.set(newStorageKey, [
          messages[currentMessagesLengthBeforeOptimisticUpdate],
        ]);
        router.push(`/${newChatId}`);
        window.dispatchEvent(new Event("hideBentoGrid"));
        window.dispatchEvent(new Event("chatListUpdate"));
      } else {
        setIsGenerating(true);
        const newAbortControllers = modelsToUse.map(
          () => new AbortController()
        );
        setAbortControllers(newAbortControllers);
        modelsToUse.forEach((modelName: string, index: number) => {
          fetchChatResponse(
            modelName,
            currentMessagesLengthBeforeOptimisticUpdate,
            index,
            newAbortControllers[index],
            inputToUse
          );
        });
      }
      setChatInput("");
      setIsAutoScroll(true);
    },
    [
      addOptimisticMessage,
      chatInput,
      isGenerating,
      roomId,
      determineModelsToUse,
      createMessage,
      router,
      setStoredMessages,
      fetchChatResponse,
      models,
      setChatInput,
      setIsAutoScroll,
      setAbortControllers,
      setIsGenerating,
      messages,
      setMessages,
      isShared,
    ]
  );

  const handleModelSelect = useCallback(
    (modelName: string) => {
      const currentModels = models ?? [];
      setModels(
        currentModels.map((model: ModelItem) => ({
          ...model,
          selected: model.name === modelName ? !model.selected : model.selected,
        }))
      );
    },
    [models]
  );

  const handlePrimaryModelSelect = useCallback(
    (modelName: string) => {
      const currentModels = models ?? [];
      setModels(
        currentModels.map((model: ModelItem) => ({
          ...model,
          selected: model.name === modelName,
        }))
      );
    },
    [models]
  );

  const handleStopAllGeneration = useCallback(() => {
    abortControllers.forEach((controller) => {
      try {
        controller.abort();
      } catch (error) {
        console.error("中止中にエラーが発生しました:", error);
      }
    });
    setIsGenerating(false);
    setMessages((prevMessages) =>
      prevMessages.map((message) => ({
        ...message,
        llm: message.llm.map((response: any) => ({
          ...response,
          isGenerating: false,
        })),
      }))
    );
  }, [abortControllers, setIsGenerating, setMessages]);

  const handleResetAndRegenerate = useCallback(
    (messageIndex: number) => {
      setIsGenerating(true);
      const userMessage = messages[messageIndex].user;
      const modelsToUse = determineModelsToUse(userMessage, false);
      const cleanedUserMessage = cleanInputContent(userMessage);

      const newMessages = [...messages].slice(0, messageIndex + 1);
      newMessages[messageIndex].llm = modelsToUse.map((model) => ({
        role: "assistant",
        model,
        text: "",
        selected: false,
        isGenerating: true,
        isError: false,
      }));

      setMessages(newMessages);

      const newAbortControllers = modelsToUse.map(() => new AbortController());
      setAbortControllers(newAbortControllers);

      modelsToUse.forEach((modelName: string, index: number) => {
        fetchChatResponse(
          modelName,
          messageIndex,
          index,
          newAbortControllers[index],
          cleanedUserMessage
        );
      });

      setIsAutoScroll(true);
    },
    [messages, determineModelsToUse, cleanInputContent, fetchChatResponse]
  );

  const handleSaveOnly = useCallback(
    (messageIndex: number) => {
      const currentMessage = messages[messageIndex];
      originalUpdateMessage(
        messageIndex,
        null,
        currentMessage.user,
        false,
        true
      );
    },
    [messages, originalUpdateMessage]
  );

  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;
      setIsAutoScroll(isScrolledToBottom);
    }
  };

  const selectSingleModel = useCallback(
    (modelId: string) => {
      setModels((prevModels: ModelItem[] | undefined) =>
        (prevModels || []).map((m: ModelItem) => ({
          ...m,
          selected: m.name === modelId,
        }))
      );
      console.log("[DEBUG useChatLogic] Model selected via mention:", modelId);
    },
    [setModels]
  );
  // --- End: Event Handlers ---

  // --- Start: useEffects (Should be after all function definitions they depend on) ---
  useEffect(() => {
    if (!isShared) setError(null);

    let messagesToSet: Message[] | undefined = undefined;

    if (isShared && initialMessages === undefined && !initialError) {
      console.log("[DEBUG] 共有チャットの initialMessages 待機中");
      setInitialLoadComplete(false);
      return;
    }

    if (initialMessages) {
      // 共有チャットの場合は初期メッセージを使用
      messagesToSet = initialMessages.map((msg: Message) =>
        // initialMessages の user が旧形式(配列)である可能性を考慮し変換
        typeof msg.user === "string"
          ? msg
          : {
              ...msg,
              user: (msg.user as any[])
                .map((part) => part.text || "")
                .join("\n\n"),
            }
      ) as Message[];
      if (!initialError) setError(null);
      console.log("[DEBUG] Initial messages loaded and potentially migrated.");
    } else if (
      roomId &&
      storedMessages &&
      storedMessages.length > 0 &&
      !initialLoadComplete
    ) {
      console.log(`[DEBUG] ルーム ${roomId} のメッセージ読み込み:`, {
        storedMessages,
        roomId,
        initialLoadComplete,
      });
      messagesToSet = storedMessages.map((msg: Message) => {
        if (typeof msg.user === "string") {
          return msg; // 新形式ならそのまま
        }
        // 旧形式 (ChatInputItem[] のような配列) の場合、テキスト部分を結合してMarkdown文字列に変換
        // 画像は現状のマイグレーションでは失われる (ステップ4後半で画像もMarkdownに含める際に再検討)
        const userMarkdown = (msg.user as any[])
          .filter((part) => part.type === "text" && part.text)
          .map((part) => part.text)
          .join("\n\n"); // 段落区切りなどで結合
        console.log(
          `[DEBUG] Migrating message user for roomId ${roomId}, msg timestamp ${msg.timestamp}`
        );
        return { ...msg, user: userMarkdown };
      }) as Message[];
      if (!initialError) setError(null);
      console.log(
        `[DEBUG] ルーム ${roomId} のメッセージ読み込み・マイグレーション完了`
      );
    } else if (roomId && !storedMessages && !initialLoadComplete) {
      messagesToSet = [];
      console.log("[DEBUG] 新規チャットまたは空のチャット (localStorage)");
    } else if (!roomId && !isShared) {
      messagesToSet = [];
      console.log("[DEBUG] ルートページ、メッセージなし");
    }

    if (messagesToSet !== undefined) {
      setMessages(messagesToSet);
      setInitialLoadComplete(true);
    }
  }, [
    storedMessages,
    roomId,
    initialLoadComplete,
    initialMessages,
    isShared,
    initialError,
  ]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/models");
        const data = await response.json();
        const modelIds = data.data.map((model: any) => ({
          fullId: model.id,
          shortId: model.id.split("/").pop(),
        }));
        setAllModels(modelIds);
      } catch (error) {
        console.error("モデルリストの取得に失敗しました:", error);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    if (!initialLoadComplete) return;
    let hasUnfinishedGeneration = false;
    messages.forEach((message, messageIndex) => {
      message.llm.forEach(
        (response: Message["llm"][0], responseIndex: number) => {
          if (response.isGenerating === true && !response.text) {
            hasUnfinishedGeneration = true;
            const abortController = new AbortController();
            setAbortControllers((prevControllers) => {
              const newControllers = [...prevControllers];
              newControllers[responseIndex] = abortController;
              return newControllers;
            });
            fetchChatResponse(
              response.model,
              messageIndex,
              responseIndex,
              abortController,
              cleanInputContent(message.user)
            );
          }
        }
      );
    });
    if (hasUnfinishedGeneration) setIsGenerating(true);
  }, [
    initialLoadComplete,
    messages,
    fetchChatResponse,
    cleanInputContent,
    setIsGenerating,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      const container = containerRef.current;
      const { scrollHeight, clientHeight } = container;
      container.scrollTop = scrollHeight - clientHeight;
    }
  }, [messages, isAutoScroll]);
  // --- End: useEffects ---

  return {
    models,
    setModels,
    messages: optimisticMessages,
    setMessages,
    isGenerating,
    setIsGenerating,
    isModalOpen,
    handleOpenModal,
    handleCloseModal,
    toolFunctions,
    setToolFunctions,
    chatInput,
    setChatInput,
    handleSend,
    handleModelSelect,
    handlePrimaryModelSelect,
    isShared,
    updateMessage: originalUpdateMessage,
    handleResetAndRegenerate,
    handleSaveOnly,
    handleStopAllGeneration,
    containerRef,
    isAutoScroll,
    setIsAutoScroll,
    AllModels,
    initialLoadComplete,
    error,
    setError,
    roomId,
    cleanInputContent,
    fetchChatResponse,
    selectSingleModel,
  };
}
