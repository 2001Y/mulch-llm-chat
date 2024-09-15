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
    const containerRef = useRef<HTMLDivElement>(null);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [abortControllers, setAbortControllers] = useState<AbortController[]>(
        []
    );
    const [showResetButton, setShowResetButton] = useState(false);
    const [chatInput, setChatInput] = useState<
        { type: string; text?: string; image_url?: { url: string } }[]
    >([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [storedMessages, setStoredMessages] = useStorageState<any[]>(
        "chatMessages",
        []
    );

    const MemoizedInputSection = useMemo(() => React.memo(InputSection), []);

    useEffect(() => {
        if (storedMessages.length > 0) {
            console.log("以前のメッセージを復元:", storedMessages);
            setMessages(storedMessages);
            setShowResetButton(true);
        }
    }, [storedMessages]);

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
        [setMessages, setStoredMessages, storedMessages]
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
                    const userMessage = { role: "user", content: msg.user };
                    const selectedResponses = msg.llm
                        .filter((llm: any) => llm.selected)
                        .sort(
                            (a: any, b: any) =>
                                (a.selectedOrder || 0) - (b.selectedOrder || 0)
                        );
                    const responseMessages =
                        selectedResponses.length > 0
                            ? selectedResponses.map((llm: any) => ({
                                role: "assistant",
                                content: [{ type: "text", text: llm.text }],
                            }))
                            : [
                                {
                                    role: "assistant",
                                    content: [
                                        {
                                            type: "text",
                                            text:
                                                msg.llm.find((llm: any) => llm.model === model)
                                                    ?.text || "",
                                        },
                                    ],
                                },
                            ];
                    return [userMessage, ...responseMessages];
                });

                let result: { type: string; text: string }[] = [];
                let fc = { name: "", arguments: "" };
                let functionCallExecuted = false;

                const stream = await openai?.chat.completions.create(
                    {
                        model,
                        messages: [
                            ...pastMessages,
                            {
                                role: "user",
                                content: inputContent,
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
                                console.error("ファンクションコールの実行エラー:", error);
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
        [messages, openai, updateMessage, setStoredMessages, toolFunctions]
    );

    const handleSend = useCallback(
        async (
            event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
            isPrimaryOnly = false
        ) => {
            if (isGenerating) return;

            const modelsToUse = isPrimaryOnly ? [selectedModels[0]] : selectedModels;

            setIsGenerating(true);
            const newAbortControllers = modelsToUse.map(() => new AbortController());
            setAbortControllers(newAbortControllers);

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
                if (prevMessages.length === 0) setShowResetButton(true);
                setStoredMessages(newMessages);
                return newMessages;
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
            isGenerating,
            selectedModels,
            chatInput,
            setMessages,
            fetchChatResponse,
            messages.length,
            setStoredMessages,
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

    const handleReset = () => {
        if (
            window.confirm(
                "チャット履歴をクリアしてもよろしいですか？この操作は元に戻せません。"
            )
        ) {
            setMessages([]);
            setStoredMessages([]);
            setShowResetButton(false);
        }
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
        const abortController = new AbortController();
        setAbortControllers([abortController]);
        setIsGenerating(true);

        try {
            await fetchChatResponse(
                model,
                messageIndex,
                responseIndex,
                abortController,
                inputContent
            );
        } finally {
            setIsGenerating(false);
        }
    };

    const handleResetAndRegenerate = async (messageIndex: number) => {
        setIsGenerating(true);
        const userMessage = messages[messageIndex].user;
        const newMessages = [...messages].slice(0, messageIndex + 1);
        newMessages[messageIndex].llm = selectedModels.map((model) => ({
            role: "assistant",
            model,
            text: "",
            selected: false,
        }));

        setMessages(newMessages);

        const newAbortControllers = selectedModels.map(() => new AbortController());
        setAbortControllers(newAbortControllers);

        selectedModels.forEach((model, index) => {
            fetchChatResponse(
                model,
                messageIndex,
                index,
                newAbortControllers[index],
                userMessage
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
                                handleReset={handleReset}
                                handleStopAllGeneration={handleStopAllGeneration}
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
                handleReset={handleReset}
                handleStopAllGeneration={handleStopAllGeneration}
            />
        </>
    );
}