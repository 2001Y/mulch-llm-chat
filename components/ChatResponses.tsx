import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import InputSection from "./InputSection";
import useStorageState from "hooks/useLocalStorage";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import { useParams } from "next/navigation";
import TurndownService from "turndown";
import { FunctionCallHandler } from "../utils/functionCallHandler";
import { useOpenAI } from "hooks/useOpenAI";
import useAccessToken from "hooks/useAccessToken";
import {
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionFunctionMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);

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

interface ModelCapabilities {
  streaming: boolean;
  function_calling: boolean;
  tools: boolean;
}

export default function Responses() {
  const [accessToken, setAccessToken] = useAccessToken();
  const [demoAccessToken] = useState(process.env.NEXT_PUBLIC_DEMO || "");

  const [models, setModels] = useStorageState("models");
  const [tools] = useStorageState("tools");
  const [toolFunctions] = useStorageState("toolFunctions");

  const params = useParams();
  const roomId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [AllModels, setAllModels] = useState<
    { fullId: string; shortId: string }[]
  >([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortControllers, setAbortControllers] = useState<AbortController[]>(
    []
  );
  const [chatInput, setChatInput] = useState<
    { type: string; text?: string; image_url?: { url: string } }[]
  >([]);
  const [storedMessages, setStoredMessages] = useStorageState(
    `chatMessages_${roomId}`
  );
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const MemoizedInputSection = useMemo(() => React.memo(InputSection), []);

  const openai = useOpenAI(
    (typeof accessToken === "string" ? accessToken : "") || demoAccessToken
  );

  // メッセージを復元するuseEffect
  useEffect(() => {
    if (storedMessages && storedMessages.length > 0 && !initialLoadComplete) {
      console.log(`ルーム ${roomId} の以前のメッセージを復元:`, storedMessages);
      setMessages(storedMessages);
      setInitialLoadComplete(true);
    }
  }, [storedMessages, roomId, initialLoadComplete, setMessages]);

  // メッセージが更新されたらローカルストレージに保存
  useEffect(() => {
    if (initialLoadComplete) {
      setStoredMessages(messages);
    }
  }, [messages, initialLoadComplete, setStoredMessages]);

  // 完了��成を再開するuseEffect
  useEffect(() => {
    if (!initialLoadComplete) return;

    let hasUnfinishedGeneration = false;
    messages.forEach((message, messageIndex) => {
      message.llm.forEach(
        (
          response: {
            role: string;
            model: string;
            text: string;
            selected: boolean;
            isGenerating?: boolean;
            selectedOrder?: number;
          },
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
      .filter((model: string | null): model is string => model !== null); // nullを除外
  };

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

  const updateMessage = useCallback(
    (
      messageIndex: number,
      responseIndex: number | null,
      content?: any,
      toggleSelected?: boolean,
      saveOnly?: boolean
    ) => {
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
            if (llmResponse.selected) {
              llmResponse.selected = false;
              const currentOrder = llmResponse.selectedOrder;
              delete llmResponse.selectedOrder;
              message.llm = message.llm.map((resp: any) => {
                if (
                  resp.selected &&
                  resp.selectedOrder !== undefined &&
                  currentOrder !== undefined &&
                  resp.selectedOrder > currentOrder
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
          }
          message.llm[responseIndex] = llmResponse;
        }
        newMessages[messageIndex] = message;
        if (saveOnly) setStoredMessages(newMessages);
        return newMessages;
      });
    },
    [setMessages, setStoredMessages, storedMessages, roomId]
  );

  const getModelCapabilities = async (
    modelId: string
  ): Promise<ModelCapabilities> => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models");
      const data = await response.json();
      const model = data.data.find((m: any) => m.id === modelId);

      return {
        streaming: model?.supported_features?.includes("streaming") ?? false,
        function_calling:
          model?.supported_features?.includes("function_calling") ?? false,
        tools: model?.supported_features?.includes("tools") ?? false,
      };
    } catch (error) {
      console.error("Failed to fetch model capabilities:", error);
      // デフォルトで安全な値を返す
      return {
        streaming: false,
        function_calling: false,
        tools: false,
      };
    }
  };

  const fetchChatResponse = useCallback(
    async (
      model: string,
      messageIndex: number,
      responseIndex: number,
      abortController: AbortController,
      inputContent: any
    ) => {
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages[messageIndex].llm[responseIndex].isGenerating = true;
        return newMessages;
      });

      try {
        const pastMessages = messages.flatMap((msg) => {
          const userContent = Array.isArray(msg.user)
            ? msg.user.filter(
                (item) =>
                  (item.type === "text" && item.text?.trim()) ||
                  (item.type === "image_url" && item.image_url?.url)
              )
            : msg.user;

          const convertToContentParts = (
            content: MessageContent[]
          ): ChatCompletionContentPart[] => {
            return content.map((item) => {
              if (item.type === "text" && item.text) {
                return {
                  type: "text",
                  text: item.text,
                };
              } else if (item.type === "image_url" && item.image_url) {
                return {
                  type: "image_url",
                  image_url: {
                    url: item.image_url.url,
                  },
                };
              }
              throw new Error(`Unsupported content type: ${item.type}`);
            });
          };

          const userMessage: ChatCompletionUserMessageParam | null =
            userContent.length > 0
              ? { role: "user", content: convertToContentParts(userContent) }
              : null;

          const selectedResponses = msg.llm
            .filter((llm: any) => llm.selected)
            .sort(
              (a: any, b: any) =>
                (a.selectedOrder || 0) - (b.selectedOrder || 0)
            );

          const responseMessages: ChatCompletionAssistantMessageParam[] =
            selectedResponses.length > 0
              ? selectedResponses.map((llm: any) => ({
                  role: "assistant",
                  content: llm.text?.trim()
                    ? [{ type: "text", text: llm.text.trim() }]
                    : [],
                }))
              : msg.llm.find((llm: any) => llm.model === model)?.text?.trim()
              ? [
                  {
                    role: "assistant",
                    content: [
                      {
                        type: "text",
                        text:
                          msg.llm
                            .find((llm: any) => llm.model === model)
                            ?.text?.trim() || "",
                      },
                    ],
                  },
                ]
              : [];

          return [userMessage, ...responseMessages].filter(
            (
              msg
            ): msg is
              | ChatCompletionUserMessageParam
              | ChatCompletionAssistantMessageParam =>
              msg !== null && msg.content !== null && msg.content !== undefined
          );
        });

        const filteredInputContent = Array.isArray(inputContent)
          ? inputContent.filter(
              (item) =>
                (item.type === "text" && item.text?.trim()) ||
                (item.type === "image_url" && item.image_url?.url)
            )
          : inputContent;

        if (filteredInputContent.length === 0) {
          console.error("Invalid input content");
          return;
        }

        let result: { type: string; text: string }[] = [];
        let tempContent = "";
        const functionHandler = new FunctionCallHandler();

        const specifiedModel = extractModelsFromInput(inputContent);
        const modelToUse =
          specifiedModel.length > 0 ? specifiedModel[0] : model;

        // モデルの機能をチェック
        const capabilities = await getModelCapabilities(modelToUse);

        // 基本的なリクエストパラメータ
        const requestParams: any = {
          model: modelToUse,
          messages: [
            ...pastMessages,
            {
              role: "user",
              content: filteredInputContent,
            },
          ],
        };

        // ストリーミングがサポートされている場合のみ追加
        if (capabilities.streaming) {
          requestParams.stream = true;
        }

        // ツールとfunction_callingがサポートされている場合のみ追加
        if (capabilities.tools && capabilities.function_calling) {
          requestParams.tool_choice = "auto";
          requestParams.tools = tools;
        }

        console.log("[API Request] Messages:", {
          ...requestParams,
          capabilities,
        });

        if (capabilities.streaming) {
          // ストリーミングモード
          const stream = await openai?.chat.completions.create(requestParams, {
            signal: abortController.signal,
          });

          if (stream) {
            if ("then" in stream) {
              // 非ストリーミングレスポンスの場合
              const response = await stream;
              const content = response.choices[0]?.message?.content || "";
              updateMessage(messageIndex, responseIndex, [
                { type: "text", text: content },
              ]);
            } else {
              // ストリーミングレスポンスの場合
              for await (const part of stream as any) {
                if (abortController.signal.aborted) {
                  throw new DOMException("Aborted", "AbortError");
                }
                const content = part.choices[0]?.delta?.content || "";
                const toolCalls = part.choices[0]?.delta?.tool_calls;

                console.log("[Stream Response]", {
                  content,
                  toolCalls,
                  delta: part.choices[0]?.delta,
                });

                if (toolCalls && capabilities.tools) {
                  functionHandler.handleToolCalls(toolCalls);
                } else if (!functionHandler.isAccumulating) {
                  if (content) {
                    tempContent += content;
                    result.push({ type: "text", text: content });
                    updateMessage(messageIndex, responseIndex, result);
                  }
                }

                if (functionHandler.isReadyToExecute() && capabilities.tools) {
                  const parsedToolFunctions: Record<
                    string,
                    (args: any) => any
                  > = {};
                  for (const [key, value] of Object.entries(toolFunctions)) {
                    parsedToolFunctions[key] = new Function(
                      `return ${value}`
                    )();
                  }
                  await functionHandler.execute(
                    parsedToolFunctions,
                    tempContent,
                    updateMessage,
                    messageIndex,
                    responseIndex
                  );
                }
              }
            }
            setIsAutoScroll(false);
          } else {
            console.error("ストリームの作成に失敗しました");
            updateMessage(
              messageIndex,
              responseIndex,
              [
                {
                  type: "text",
                  text: "エラー: レスポンスの生成に失敗しました",
                },
              ],
              false,
              false
            );
          }
        } else {
          // 非ストリーミングモード
          const response = await openai?.chat.completions.create(
            requestParams,
            { signal: abortController.signal }
          );

          if (response) {
            const content = response.choices[0]?.message?.content || "";
            updateMessage(messageIndex, responseIndex, [
              { type: "text", text: content },
            ]);
          } else {
            throw new Error("レスポンスの生成に失敗しました");
          }
        }
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.error("Error fetching response from model:", model, error);
          const errorMessage =
            error.response?.data?.error?.message || error.message;
          updateMessage(
            messageIndex,
            responseIndex,
            [{ type: "text", text: `エラー: ${errorMessage}` }],
            false,
            false
          );
        }
      } finally {
        setMessages((prevMessages) => {
          const newMessages = [...prevMessages];
          newMessages[messageIndex].llm[responseIndex].isGenerating = false;
          const allResponsesComplete = newMessages[messageIndex].llm.every(
            (response: any) => !response.isGenerating
          );
          if (allResponsesComplete) setIsGenerating(false);
          setStoredMessages(newMessages);
          return newMessages;
        });
      }
    },
    [
      messages,
      openai,
      updateMessage,
      setStoredMessages,
      toolFunctions,
      extractModelsFromInput,
    ]
  );

  const handleStopAllGeneration = () => {
    abortControllers.forEach((controller) => {
      try {
        controller.abort();
      } catch (error) {
        console.error("Error while aborting:", error);
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

  const handleStop = (messageIndex: number, responseIndex: number) => {
    const controller = abortControllers[responseIndex];
    if (controller) {
      controller.abort();
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages[messageIndex].llm[responseIndex].isGenerating = false;
        return newMessages;
      });
    }
  };

  const handleRegenerate = async (
    messageIndex: number,
    responseIndex: number,
    model: string
  ) => {
    const inputContent = messages[messageIndex].user;

    // ユーザー入力からモデルを抽出
    const specifiedModels = extractModelsFromInput(inputContent);
    const modelToUse = specifiedModels.length > 0 ? specifiedModels[0] : model;

    // モデルに送信する際にのみリーンアップ
    const cleanedInputContent = cleanInputContent(inputContent);

    const abortController = new AbortController();
    setAbortControllers([abortController]);
    setIsGenerating(true);

    try {
      await fetchChatResponse(
        modelToUse,
        messageIndex,
        responseIndex,
        abortController,
        cleanedInputContent
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const getSelectedModels = (models: ModelsState | null): string[] => {
    if (!models) return [];
    return models.filter((model) => model.selected).map((model) => model.name);
  };

  const handleResetAndRegenerate = async (messageIndex: number) => {
    setIsGenerating(true);
    const userMessage = messages[messageIndex].user;

    // ユーザー入力からモデルを抽出
    const specifiedModels = extractModelsFromInput(userMessage);
    const selectedModels = getSelectedModels(models);
    const modelsToUse =
      specifiedModels.length > 0 ? specifiedModels : selectedModels;

    // モデルに送信する際にのみクリーンアップ
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
  };

  const handleEdit = (
    messageIndex: number,
    responseIndex: number | null,
    newContent: string
  ) => {
    const turndownService = new TurndownService();
    const markdownContent = turndownService.turndown(newContent);
    const newText = [{ type: "text", text: markdownContent }];
    updateMessage(messageIndex, responseIndex, newText);
  };

  const handleSelectResponse = useCallback(
    (messageIndex: number, responseIndex: number) => {
      console.log("Before updateMessage:", {
        messageIndex,
        responseIndex,
        response: messages[messageIndex]?.llm[responseIndex],
        allResponses: messages[messageIndex]?.llm,
        selectedResponses: messages[messageIndex]?.llm.filter(
          (r: any) => r.selected
        ),
      });
      updateMessage(messageIndex, responseIndex, undefined, true);
      console.log("After updateMessage called");
    },
    [updateMessage, messages]
  );

  const handleSaveOnly = (messageIndex: number) => {
    const currentMessage = messages[messageIndex];
    updateMessage(messageIndex, null, currentMessage.user, false, true);
  };

  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;
      setIsAutoScroll(isScrolledToBottom);
    }
  };

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

  const handleSend = useCallback(
    async (
      event: React.MouseEvent<HTMLButtonElement>,
      isPrimaryOnly: boolean = false
    ) => {
      event.preventDefault();
      if (!chatInput.length) return;

      setIsGenerating(true);
      const newMessageIndex = messages.length;

      // ユーザー入力からモデルを抽出
      const specifiedModels = extractModelsFromInput(chatInput);
      const selectedModels = getSelectedModels(models);
      const modelsToUse = isPrimaryOnly
        ? [selectedModels[0]]
        : specifiedModels.length > 0
        ? specifiedModels
        : selectedModels;

      // モデルに送信する際にのみクリーンアップ
      const cleanedChatInput = cleanInputContent(chatInput);

      const newMessage = {
        user: chatInput,
        llm: modelsToUse.map((model) => ({
          role: "assistant",
          model,
          text: "",
          selected: false,
        })),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newMessage]);
      setChatInput([]);

      const newAbortControllers = modelsToUse.map(() => new AbortController());
      setAbortControllers(newAbortControllers);

      modelsToUse.forEach((model, index) => {
        fetchChatResponse(
          model,
          newMessageIndex,
          index,
          newAbortControllers[index],
          cleanedChatInput
        );
      });

      setIsAutoScroll(true);
    },
    [
      chatInput,
      messages,
      models,
      extractModelsFromInput,
      cleanInputContent,
      fetchChatResponse,
    ]
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
          const selectedResponses = message.llm
            .filter((r: any) => r.selected)
            .sort(
              (a: any, b: any) =>
                (a.selectedOrder || 0) - (b.selectedOrder || 0)
            );
          const hasSelectedResponse = selectedResponses.length > 0;
          return (
            <div key={messageIndex} className="message-block">
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
                        <div className="response-controls">
                          <button
                            className={
                              isGenerating ? "stop-button" : "regenerate-button"
                            }
                            onClick={() =>
                              isGenerating
                                ? handleStop(messageIndex, responseIndex)
                                : handleRegenerate(
                                    messageIndex,
                                    responseIndex,
                                    response.model
                                  )
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
                        contentEditable
                        onBlur={(e) =>
                          handleEdit(
                            messageIndex,
                            responseIndex,
                            (e.target as HTMLDivElement).innerHTML
                          )
                        }
                        dangerouslySetInnerHTML={{
                          __html: marked(response.text),
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

      <InputSection
        mainInput={true}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleSend={(event, isPrimaryOnly) => handleSend(event, isPrimaryOnly)}
        isEditMode={false}
        messageIndex={0}
        handleResetAndRegenerate={() => {}}
        handleSaveOnly={() => {}}
        isInitialScreen={messages.length === 0}
        handleStopAllGeneration={handleStopAllGeneration}
        isGenerating={isGenerating}
      />
    </>
  );
}
