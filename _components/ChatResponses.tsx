import React, {
    useRef,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import InputSection from "./InputSection";
import useStorageState from "_hooks/useLocalStorage";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import { useParams } from 'next/navigation';

marked.use(
    markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            return hljs.highlight(code, { language }).value;
        },
    })
);

export default function Responses({
    openai,
    models,
    selectedModels,
    setSelectedModels,
    toolFunctions,
}: {
    openai: any;
    models: string[];
    selectedModels: string[];
    setSelectedModels: React.Dispatch<React.SetStateAction<string[]>>;
    toolFunctions: Record<string, (args: any) => any>;
}) {
    const params = useParams();
    const roomId = params.id as string;

    const containerRef = useRef<HTMLDivElement>(null);
    const [AllModels, setAllModels] = useState<{ fullId: string; shortId: string }[]>([]);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [abortControllers, setAbortControllers] = useState<AbortController[]>(
        []
    );
    const [chatInput, setChatInput] = useState<
        { type: string; text?: string; image_url?: { url: string } }[]
    >([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [storedMessages, setStoredMessages] = useStorageState<any[]>(`chatMessages_${roomId}`, []);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    const MemoizedInputSection = useMemo(() => React.memo(InputSection), []);

    // メッセージを復元するuseEffect
    useEffect(() => {
        if (storedMessages.length > 0 && !initialLoadComplete) {
            console.log(`ルーム ${roomId} の以前のメッセージを復元:`, storedMessages);
            setMessages(storedMessages);
            setInitialLoadComplete(true);
        }
    }, [storedMessages, roomId, initialLoadComplete]);

    // 未完了の生成を再開するuseEffect
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

        // 初回のみ実行されるようにするため、依存配列を空に
    }, [initialLoadComplete]);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const response = await fetch('https://openrouter.ai/api/v1/models');
                const data = await response.json();
                const modelIds = data.data.map((model: any) => ({
                    fullId: model.id,
                    shortId: model.id.split('/').pop()
                }));
                setAllModels(modelIds);
            } catch (error) {
                console.error('モデルリストの取得に失敗しました:', error);
            }
        };
        fetchModels();
    }, []);

    const extractModelsFromInput = (inputContent: any): string[] => {
        const textContent = inputContent
            .filter((item: any) => item.type === 'text' && item.text)
            .map((item: any) => item.text)
            .join(' ');

        const modelMatches = textContent.match(/@(\S+)/g) || [];
        return modelMatches
            .map((match: string) => match.slice(1)) // '@'を削除
            .map((shortId: string) => {
                const matchedModel = AllModels.find(model => model.shortId === shortId);
                return matchedModel ? matchedModel.fullId : null;
            })
            .filter((model: string | null): model is string => model !== null); // nullを除外
    };

    const cleanInputContent = (inputContent: any): any => {
        return inputContent.map((item: any) => {
            if (item.type === 'text' && item.text) {
                return {
                    ...item,
                    text: item.text.replace(/@\S+/g, '').trim(), // 全てのモデル指定を削除
                };
            }
            return item;
        }).filter((item: any) => item.text !== '');
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
                            const selectedCount = message.llm.filter((r: any) => r.selected)
                                .length;
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
                        ? msg.user.filter((item: { type: string; text?: string; image_url?: { url: string } }) =>
                            (item.type === 'text' && item.text?.trim()) ||
                            (item.type === 'image_url' && item.image_url?.url)
                        )
                        : msg.user;

                    const userMessage = userContent.length > 0
                        ? { role: "user", content: userContent }
                        : null;

                    const selectedResponses = msg.llm
                        .filter((llm: any) => llm.selected)
                        .sort((a: any, b: any) => (a.selectedOrder || 0) - (b.selectedOrder || 0));

                    const responseMessages = selectedResponses.length > 0
                        ? selectedResponses.map((llm: any) => ({
                            role: "assistant",
                            content: llm.text?.trim() ? [{ type: "text", text: llm.text.trim() }] : [],
                        }))
                        : msg.llm.find((llm: any) => llm.model === model)?.text?.trim()
                            ? [{
                                role: "assistant",
                                content: [{ type: "text", text: msg.llm.find((llm: any) => llm.model === model).text.trim() }],
                            }]
                            : [];

                    return [userMessage, ...responseMessages].filter(Boolean);
                }).filter(message => message.content && message.content.length > 0);

                // inputContentのフィルタリング
                const filteredInputContent = Array.isArray(inputContent)
                    ? inputContent.filter(item =>
                        (item.type === 'text' && item.text?.trim()) ||
                        (item.type === 'image_url' && item.image_url?.url)
                    )
                    : inputContent;

                if (filteredInputContent.length === 0) {
                    console.error("Invalid input content");
                    return;
                }

                let result: { type: string; text: string }[] = [];
                let fc = { name: "", arguments: "" };
                let functionCallExecuted = false;

                // ユーザー入力からモデルを抽出
                const specifiedModel = extractModelsFromInput(inputContent);
                const modelToUse = specifiedModel.length > 0 ? specifiedModel[0] : model;

                const stream = await openai?.chat.completions.create(
                    {
                        model: modelToUse,
                        messages: [
                            ...pastMessages,
                            {
                                role: "user",
                                content: filteredInputContent,
                            },
                        ],
                        stream: true,
                        tool_choice: "auto",
                    },
                    {
                        signal: abortController.signal,
                    }
                );

                if (stream) {
                    for await (const part of stream) {
                        if (abortController.signal.aborted) {
                            throw new DOMException("Aborted", "AbortError");
                        }
                        const content = part.choices[0]?.delta?.content || "";
                        const toolCalls = part.choices[0]?.delta?.tool_calls;

                        if (toolCalls) {
                            for (const tc of toolCalls) {
                                if (tc.name) {
                                    fc.name += tc;
                                    fc.arguments += tc.arguments;
                                }
                                if (tc.function?.name) {
                                    fc.name += tc.function?.name;
                                }
                                if (tc.function?.arguments) {
                                    fc.arguments += tc.function?.arguments;
                                }
                            }
                        } else {
                            result.push({ type: "text", text: content });
                        }

                        if (fc.name && fc.arguments && !functionCallExecuted) {
                            try {
                                const args = JSON.parse(fc.arguments);
                                result.push({
                                    type: "text",
                                    text: `\n\nFunction Call 実行中...: ${fc.name}(${fc.arguments})`,
                                });
                                if (toolFunctions[fc.name]) {
                                    result.push({ type: "text", text: `\n\nFunction Call 完成` });
                                    const functionResult = toolFunctions[fc.name](args);
                                    result.push({
                                        type: "text",
                                        text: `\n\n実行結果:\n${JSON.stringify(
                                            functionResult,
                                            null,
                                            2
                                        )}\n`,
                                    });
                                    functionCallExecuted = true;
                                }
                            } catch (error) {
                                console.error("ファンクションコーの実行エラー:", error);
                            }
                        }

                        const markedResult = await marked(result.map((r) => r.text).join(""));
                        updateMessage(
                            messageIndex,
                            responseIndex,
                            [{ type: "text", text: markedResult }],
                            false,
                            false
                        );
                    }
                    setIsAutoScroll(false);
                } else {
                    console.error("ストリームの作成に失敗しました");
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
                    console.error("Error fetching response from model:", model, error);
                    updateMessage(
                        messageIndex,
                        responseIndex,
                        [{ type: "text", text: `エラー: ${error.message}` }],
                        false,
                        false
                    );
                }
            } finally {
                setMessages((prevMessages) => {
                    const newMessages = [...prevMessages];
                    newMessages[messageIndex].llm[responseIndex].isGenerating = false;
                    const allResponsesComplete = newMessages[
                        messageIndex
                    ].llm.every((response: any) => !response.isGenerating);
                    if (allResponsesComplete) setIsGenerating(false);
                    setStoredMessages(newMessages);
                    return newMessages;
                });
            }
        },
        [messages, openai, updateMessage, setStoredMessages, toolFunctions, extractModelsFromInput]
    );

    const handleSend = useCallback(
        async (
            event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
            isPrimaryOnly = false
        ) => {
            if (isGenerating) return;

            // ユーザー入力から複数のモデルを抽出
            const specifiedModels = extractModelsFromInput(chatInput);
            const modelsToUse = specifiedModels.length > 0
                ? specifiedModels
                : isPrimaryOnly
                    ? [selectedModels[0]]
                    : selectedModels;

            setIsGenerating(true);
            const newAbortControllers = modelsToUse.map(() => new AbortController());
            setAbortControllers(newAbortControllers);

            // ユーザーのメッセージをそのまま保存
            setMessages((prevMessages) => {
                const newMessage = {
                    user: chatInput,
                    llm: modelsToUse.map((model) => ({
                        role: "assistant",
                        model,
                        text: "",
                        selected: false,
                        isGenerating: true,
                    })),
                };
                const newMessages = [...prevMessages, newMessage];
                setStoredMessages(newMessages);
                return newMessages;
            });

            // モデルに送信する際にのみ入力をクリーンアップ
            const cleanedChatInput = cleanInputContent(chatInput);

            modelsToUse.forEach((model, index) => {
                fetchChatResponse(
                    model,
                    messages.length,
                    index,
                    newAbortControllers[index],
                    cleanedChatInput
                );
            });

            setChatInput([]);
            setIsAutoScroll(true);
        },
        [
            isGenerating,
            selectedModels,
            chatInput,
            setMessages,
            fetchChatResponse,
            messages.length,
            setStoredMessages,
            AllModels,
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

        // モデルに送信する際にのみクリーンアップ
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

    const handleResetAndRegenerate = async (messageIndex: number) => {
        setIsGenerating(true);
        const userMessage = messages[messageIndex].user;

        // ユーザー入力からモデルを抽出
        const specifiedModels = extractModelsFromInput(userMessage);
        const modelsToUse = specifiedModels.length > 0
            ? specifiedModels
            : selectedModels;

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
        const newText = [{ type: "text", text: newContent }];
        updateMessage(messageIndex, responseIndex, newText);
    };

    const handleSelectResponse = useCallback(
        (messageIndex: number, responseIndex: number) => {
            updateMessage(messageIndex, responseIndex, undefined, true);
        },
        [updateMessage]
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

    return (
        <>
            <div
                className={`responses-container ${messages.length === 0 ? "initial-screen" : ""
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
                                models={models}
                                chatInput={message.user}
                                setChatInput={(newInput) =>
                                    updateMessage(messageIndex, null, newInput)
                                }
                                handleSend={(event, isPrimaryOnly) =>
                                    handleSend(event, isPrimaryOnly)
                                }
                                selectedModels={selectedModels}
                                setSelectedModels={setSelectedModels}
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
                                {message.llm.map(
                                    (
                                        response: {
                                            role: string;
                                            model: string;
                                            text: string;
                                            selected: boolean;
                                            isGenerating: boolean;
                                        },
                                        responseIndex: number
                                    ) => (
                                        <div
                                            key={responseIndex}
                                            className={`response ${response.role} ${hasSelectedResponse && !response.selected
                                                ? "unselected"
                                                : ""
                                                }`}
                                        >
                                            <div className="meta">
                                                <small>{response.model}</small>
                                                <div className="response-controls">
                                                    <button
                                                        className={
                                                            response.isGenerating
                                                                ? "stop-button"
                                                                : "regenerate-button"
                                                        }
                                                        onClick={() =>
                                                            response.isGenerating
                                                                ? handleStop(messageIndex, responseIndex)
                                                                : handleRegenerate(
                                                                    messageIndex,
                                                                    responseIndex,
                                                                    response.model
                                                                )
                                                        }
                                                    >
                                                        {response.isGenerating ? (
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
                                                        className={`response-select ${response.selected ? "selected" : ""
                                                            }`}
                                                        onClick={() =>
                                                            handleSelectResponse(messageIndex, responseIndex)
                                                        }
                                                    >
                                                        {response.selected
                                                            ? selectedResponses.length > 1
                                                                ? selectedResponses.findIndex(
                                                                    (r: any) => r === response
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
                                                dangerouslySetInnerHTML={{ __html: response.text }}
                                            />
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <InputSection
                mainInput={true}
                models={models}
                chatInput={chatInput}
                setChatInput={setChatInput}
                handleSend={(event, isPrimaryOnly) => handleSend(event, isPrimaryOnly)}
                selectedModels={selectedModels}
                setSelectedModels={setSelectedModels}
                isEditMode={false}
                messageIndex={0}
                handleResetAndRegenerate={() => { }}
                handleSaveOnly={() => { }}
                isInitialScreen={messages.length === 0}
                handleStopAllGeneration={handleStopAllGeneration}
                isGenerating={isGenerating}
            />
        </>
    );
}