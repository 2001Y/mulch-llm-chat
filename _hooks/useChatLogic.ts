import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import useStorageState from "_hooks/useLocalStorage";
import useAccessToken from "_hooks/useAccessToken";
import { useOpenAI } from "_hooks/useOpenAI";
import { generateId } from "@/utils/generateId";

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);

interface ToolFunction {
  (args: any): any;
}

interface Message {
  user: any[];
  llm: any[];
  timestamp?: number;
  edited?: boolean;
}

export function useChatLogic() {
  const [accessToken] = useAccessToken();
  const openai = useOpenAI(accessToken);
  const router = useRouter();
  const params = useParams();
  const roomId = params?.id as string | undefined;

  // 設定モーダルの状態管理を追加
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleOpenModal = useCallback(() => setIsModalOpen(true), []);
  const handleCloseModal = useCallback(() => setIsModalOpen(false), []);

  // ページロード時にroomIdがない場合は新しいチャットページにリダイレクト
  // useEffect(() => {
  //   if (!roomId) {
  //     const newChatId = Date.now().toString();
  //     router.push(`/${newChatId}`);
  //   }
  // }, [roomId, router]);

  const [models, setModels] = useStorageState<string[]>("models", [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "google/gemini-pro-1.5",
    "cohere/command-r-plus",
    "qwen/qwen-2.5-72b-instruct",
    "mistralai/mistral-large",
  ]);
  const [selectedModels, setSelectedModels] = useState<string[]>(models);
  const [chatInput, setChatInput] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortControllers, setAbortControllers] = useState<AbortController[]>(
    []
  );
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // roomIdが確定してからストレージを初期化
  const [storedMessages, setStoredMessages] = useStorageState<Message[]>(
    `chatMessages_${roomId || "default"}`,
    []
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // ChatResponses.tsx から移植する state
  const [AllModels, setAllModels] = useState<
    { fullId: string; shortId: string }[]
  >([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // ローカルストレージからメッジ読み込む
  useEffect(() => {
    if (storedMessages.length > 0 && !initialLoadComplete) {
      console.log(`ルーム ${roomId} の以前のメッセージを復元:`, storedMessages);
      setMessages(storedMessages);
      setInitialLoadComplete(true);
    }
  }, [storedMessages, roomId, initialLoadComplete]);

  // 覧を取得する useEffect
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

  // 未完了の生成を再開する useEffect
  useEffect(() => {
    if (!initialLoadComplete) return;

    let hasUnfinishedGeneration = false;
    messages.forEach((message, messageIndex) => {
      message.llm.forEach(
        (
          response: { isGenerating: boolean; text: string; model: string },
          responseIndex: number
        ) => {
          if (response.isGenerating && !response.text) {
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

    if (hasUnfinishedGeneration) {
      setIsGenerating(true);
    }
  }, [initialLoadComplete]);

  // メッセージの更新
  const updateMessage = useCallback(
    (
      messageIndex: number,
      responseIndex: number | null,
      content?: any,
      toggleSelected?: boolean,
      saveOnly?: boolean
    ) => {
      console.log("updateMessage called:", {
        messageIndex,
        responseIndex,
        toggleSelected,
        saveOnly,
      });
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        const message = { ...newMessages[messageIndex] };

        if (responseIndex === null) {
          if (content !== undefined) {
            message.user =
              typeof content === "function" ? content(message.user) : content;
            message.edited =
              JSON.stringify(storedMessages[messageIndex]?.user) !==
              JSON.stringify(message.user);
          }
        } else {
          const llmResponse = { ...message.llm[responseIndex] };
          console.log("Current llmResponse:", llmResponse);
          if (content !== undefined) {
            if (typeof content === "function") {
              const updatedContent = content(llmResponse.text);
              llmResponse.text = Array.isArray(updatedContent)
                ? updatedContent.map((c: any) => c.text).join("")
                : updatedContent;
            } else if (Array.isArray(content)) {
              llmResponse.text = content.map((c: any) => c.text).join("");
            }
          }
          if (toggleSelected) {
            console.log("Toggling selection. Current state:", {
              selected: llmResponse.selected,
              selectedOrder: llmResponse.selectedOrder,
            });
            if (llmResponse.selected) {
              llmResponse.selected = false;
              delete llmResponse.selectedOrder;
              message.llm = message.llm.map((resp: any) => {
                if (
                  resp.selected &&
                  resp.selectedOrder > llmResponse.selectedOrder
                ) {
                  return { ...resp, selectedOrder: resp.selectedOrder - 1 };
                }
                return resp;
              });
            } else {
              const selectedCount = message.llm.filter(
                (r: any) => r.selected
              ).length;
              llmResponse.selected = true;
              llmResponse.selectedOrder = selectedCount + 1;
            }
            console.log("After toggle:", {
              selected: llmResponse.selected,
              selectedOrder: llmResponse.selectedOrder,
            });
          }
          message.llm[responseIndex] = llmResponse;
        }
        newMessages[messageIndex] = message;
        if (saveOnly) setStoredMessages(newMessages);
        return newMessages;
      });
    },
    [setMessages, setStoredMessages, storedMessages]
  );

  // 新しいチャットを作成する
  const handleNewChat = useCallback(() => {
    // 新しいチャットIDを作成
    const newChatId = generateId(6);

    // 初期状態のメッセージを作成
    const initialMessage = {
      user: [{ type: "text", text: "" }],
      llm: [],
      timestamp: Date.now(),
    };

    // ローカルストレージに保存
    setStoredMessages([initialMessage]);

    // カスタムイベントを発火させて、ChatListコンポーネントに通知
    window.dispatchEvent(new Event("chatListUpdate"));

    // チャットページに遷移
    router.push(`/${newChatId}`);
  }, [router, setStoredMessages]);

  // extractModelsFromInput 関数
  const extractModelsFromInput = (inputContent: any): string[] => {
    const textContent = inputContent
      .filter((item: any) => item.type === "text" && item.text)
      .map((item: any) => item.text)
      .join(" ");

    const modelMatches = textContent.match(/@(\S+)/g) || [];
    return modelMatches
      .map((match: string) => match.slice(1)) // '@'を削除
      .map((shortId: string) => {
        const matchedModel = AllModels.find(
          (model) => model.shortId === shortId
        );
        return matchedModel ? matchedModel.fullId : null;
      })
      .filter((model: string | null): model is string => model !== null);
  };

  // cleanInputContent 関数
  const cleanInputContent = (inputContent: any): any => {
    return inputContent
      .map((item: any) => {
        if (item.type === "text" && item.text) {
          return {
            ...item,
            text: item.text.replace(/@\S+/g, "").trim(), // 全てのモデル指定を削除
          };
        }
        return item;
      })
      .filter((item: any) => item.text !== "");
  };

  // モデル選択のロジックを共通化する関数
  const determineModelsToUse = useCallback(
    (userInput: any[], isPrimaryOnly: boolean) => {
      const specifiedModels = extractModelsFromInput(userInput);
      return isPrimaryOnly
        ? [selectedModels[0]]
        : specifiedModels.length > 0
        ? specifiedModels
        : selectedModels;
    },
    [extractModelsFromInput, selectedModels]
  );

  // メッセージ作成のロジックを共通化する関数
  const createMessage = useCallback(
    (userInput: any[], modelsToUse: string[]) => ({
      user: userInput,
      llm: modelsToUse.map((model) => ({
        role: "assistant",
        model,
        text: "",
        selected: false,
        isGenerating: true,
      })),
      timestamp: Date.now(),
    }),
    []
  );

  // メッセージ送信のハンドラー
  const handleSend = useCallback(
    async (
      event:
        | React.FormEvent<HTMLFormElement>
        | React.MouseEvent<HTMLButtonElement>,
      isPrimaryOnly = false
    ) => {
      event.preventDefault();
      if (isGenerating) return;

      const modelsToUse = determineModelsToUse(chatInput, isPrimaryOnly);
      const newMessage = createMessage(chatInput, modelsToUse);

      // 新規チャットの場合（トップページからの送信）
      if (!roomId) {
        const newChatId = generateId(6);
        const newStorageKey = `chatMessages_${newChatId}`;
        localStorage.setItem(newStorageKey, JSON.stringify([newMessage]));
        localStorage.removeItem("chatMessages_default");
        window.dispatchEvent(new Event("chatListUpdate"));
        router.push(`/${newChatId}`);
        return;
      }

      // 既存のチャットの場合
      setIsGenerating(true);
      const newAbortControllers = modelsToUse.map(() => new AbortController());
      setAbortControllers(newAbortControllers);
      setMessages((prevMessages) => [...prevMessages, newMessage]);

      // チャットリストを更新（ストレージ保存後に実行）
      setStoredMessages([...messages, newMessage]).then(() => {
        window.dispatchEvent(new Event("chatListUpdate"));
      });

      modelsToUse.forEach((model, index) => {
        fetchChatResponse(
          model,
          messages.length,
          index,
          newAbortControllers[index],
          chatInput
        );
      });

      setChatInput([]);
      setIsAutoScroll(true);
    },
    [
      chatInput,
      isGenerating,
      roomId,
      messages.length,
      determineModelsToUse,
      createMessage,
      router,
      setStoredMessages,
    ]
  );

  // チャットのレスポンスを取得る関数
  const fetchChatResponse = useCallback(
    async (
      model: string,
      messageIndex: number,
      responseIndex: number,
      abortController: AbortController,
      inputContent: any
    ) => {
      console.log("[fetchChatResponse] 開始", {
        model,
        messageIndex,
        responseIndex,
      });
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages[messageIndex].llm[responseIndex].isGenerating = true;
        return newMessages;
      });

      try {
        // 過去のメッセージを取得し、null値を除外
        const pastMessages = messages
          .slice(0, messageIndex) // 現在のメッセージより前のメッセージのみを取得
          .flatMap((msg) => {
            const userContent = Array.isArray(msg.user)
              ? msg.user.filter(
                  (item: {
                    type: string;
                    text?: string;
                    image_url?: { url: string };
                  }) =>
                    (item.type === "text" && item.text?.trim()) ||
                    (item.type === "image_url" && item.image_url?.url)
                )
              : msg.user;

            const userMessage =
              userContent.length > 0
                ? { role: "user" as const, content: userContent }
                : null;

            const selectedResponses = msg.llm
              .filter((llm: any) => llm.selected)
              .sort(
                (a: any, b: any) =>
                  (a.selectedOrder || 0) - (b.selectedOrder || 0)
              );

            const responseMessages = selectedResponses
              .filter((llm: any) => llm.text?.trim())
              .map((llm: any) => ({
                role: "assistant" as const,
                content: llm.text.trim(),
              }));

            return [userMessage, ...responseMessages].filter(
              (message) => message !== null
            );
          });

        console.log("[fetchChatResponse] 過去のメッセージ:", pastMessages);

        // ユーザー入力からモデルを抽出
        const specifiedModel = extractModelsFromInput(inputContent);
        const modelToUse =
          specifiedModel.length > 0 ? specifiedModel[0] : model;

        // 入力をクリーンアップ
        const cleanedInputContent = cleanInputContent(inputContent);

        console.log("[fetchChatResponse] API呼び出し開始", {
          model: modelToUse,
          cleanedInputContent,
        });

        const stream = await openai?.chat.completions.create(
          {
            model: modelToUse,
            messages: [
              ...pastMessages,
              {
                role: "user" as const,
                content: Array.isArray(cleanedInputContent)
                  ? cleanedInputContent.map((item) => item.text).join("\n")
                  : cleanedInputContent,
              },
            ],
            stream: true,
            tool_choice: "auto",
          },
          {
            signal: abortController.signal,
          }
        );

        // APIに送信されるメッセージ内をログ出力
        console.log("[API Request] Messages:", [
          ...pastMessages,
          {
            role: "user",
            content: Array.isArray(cleanedInputContent)
              ? cleanedInputContent.map((item) => item.text).join("\n")
              : cleanedInputContent,
          },
        ]);

        let resultText = "";

        if (stream) {
          console.log("[fetchChatResponse] ストリーム受信開始");
          for await (const part of stream) {
            if (abortController.signal.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }
            const content = part.choices[0]?.delta?.content || "";
            resultText += content;

            const markedResult = marked(resultText);
            console.log("[fetchChatResponse] メッセージ更新", {
              messageIndex,
              responseIndex,
              contentLength: content.length,
            });
            updateMessage(
              messageIndex,
              responseIndex,
              [{ type: "text", text: markedResult }],
              false,
              false
            );
          }
          setIsAutoScroll(true);
        } else {
          console.error("[fetchChatResponse] ストリーム作成に失敗しました");
          updateMessage(
            messageIndex,
            responseIndex,
            [{ type: "text", text: "エラー: レスポンスの生成に失敗しました" }],
            false,
            false
          );
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("[fetchChatResponse] エラー発生:", error);
          updateMessage(
            messageIndex,
            responseIndex,
            [{ type: "text", text: `エラー: ${error.message}` }],
            false,
            false
          );
        }
      } finally {
        console.log("[fetchChatResponse] 完了", {
          messageIndex,
          responseIndex,
        });
        setMessages((prevMessages) => {
          const newMessages = [...prevMessages];
          newMessages[messageIndex].llm[responseIndex].isGenerating = false;
          const allResponsesComplete = newMessages[messageIndex].llm.every(
            (response: any) => !response.isGenerating
          );
          if (allResponsesComplete) {
            setIsGenerating(false);
          }
          setStoredMessages(newMessages);
          return newMessages;
        });
      }
    },
    [messages, openai, updateMessage, setStoredMessages]
  );

  // 生成の中止
  const handleStopAllGeneration = () => {
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
  };

  // 自動スクロールハラ
  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;
      setIsAutoScroll(isScrolledToBottom);
    }
  };

  // スクロールイベントの設定
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // 自動スクロー
  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      const container = containerRef.current;
      const { scrollHeight, clientHeight } = container;
      container.scrollTop = scrollHeight - clientHeight;
    }
  }, [messages, isAutoScroll]);

  // InputSectionで必要な処理を統合
  const handleInputChange = useCallback((newInput: any[]) => {
    setChatInput(newInput);
  }, []);

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModels((prevModels) => {
      if (prevModels.includes(model)) {
        return prevModels.filter((m) => m !== model);
      } else {
        return [...prevModels, model];
      }
    });
  }, []);

  const handlePrimaryModelSelect = useCallback((model: string) => {
    setSelectedModels([model]);
  }, []);

  // handleResetAndRegenerateも共通化したロジックを使用するように修正
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
      }));

      setMessages(newMessages);

      const newAbortControllers = modelsToUse.map(() => new AbortController());
      setAbortControllers(newAbortControllers);

      modelsToUse.forEach((model, index) => {
        fetchChatResponse(
          model,
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
      updateMessage(messageIndex, null, currentMessage.user, false, true);
    },
    [messages, updateMessage]
  );

  return {
    models,
    setModels,
    selectedModels,
    setSelectedModels,
    chatInput,
    setChatInput,
    messages,
    setMessages,
    isGenerating,
    handleSend,
    handleNewChat,
    handleInputChange,
    handleModelSelect,
    handlePrimaryModelSelect,
    handleResetAndRegenerate,
    handleStopAllGeneration,
    containerRef,
    isAutoScroll,
    isModalOpen,
    handleOpenModal,
    handleCloseModal,
  };
}
