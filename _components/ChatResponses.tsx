import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import InputSection from "./InputSection";
import useStorageState from "_hooks/useLocalStorage"
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
marked.use(
    markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            return hljs.highlight(code, { language }).value;
        }
    })
);

export default function Responses({
    openai,
    models,
    selectedModels,
    setSelectedModels,
    toolFunctions
}: {
    openai: any;
    models: string[];
    selectedModels: string[];
    setSelectedModels: React.Dispatch<React.SetStateAction<string[]>>;
    toolFunctions: Record<string, (args: any) => any>;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [lastManualScrollTop, setLastManualScrollTop] = useState(0);
    const [lastAutoScrollTop, setLastAutoScrollTop] = useState(0);
    const isAutoScrollingRef = useRef(false);
    const MemoizedInputSection = useMemo(() => React.memo(InputSection), []);
    const [selectedImage, setSelectedImage] = useState<string[] | null>(null);
    const [forceScroll, setForceScroll] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [abortControllers, setAbortControllers] = useState<AbortController[]>([]);
    const [showResetButton, setShowResetButton] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<any[]>([]);
    const [storedMessages, setStoredMessages] = useStorageState<any[]>('chatMessages', []);

    useEffect(() => {
        if (storedMessages.length > 0) {
            try {
                console.log('以前のメッージを復元:', storedMessages);
                setMessages(storedMessages);
                setShowResetButton(true);
            } catch (error) {
                console.error('メッセージの解析エラー:', error);
            }
        }
    }, [storedMessages]);

    const updateMessage = useCallback((messageIndex: number, responseIndex: number | null, text: { type: string, text: string }[] | undefined, selectedIndex?: number | undefined, toggleSelected?: boolean, saveOnly?: boolean, isEditing?: boolean) => {
        setMessages(prevMessages => {
            const newMessages = JSON.parse(JSON.stringify(prevMessages));
            if (responseIndex === null) {
                if (text !== undefined) {
                    newMessages[messageIndex].user = text;
                    const isEdited = JSON.stringify((storedMessages[messageIndex] as any)?.user) !== JSON.stringify(text);
                    newMessages[messageIndex].edited = isEdited;
                }
            } else if (newMessages[messageIndex]?.llm[responseIndex] !== undefined) {
                if (text !== undefined) {
                    newMessages[messageIndex].llm[responseIndex].text = text.map(t => t.text).join('');
                }
                if (toggleSelected) {
                    const currentResponse = newMessages[messageIndex].llm[responseIndex];
                    if (currentResponse.selected) {
                        currentResponse.selected = false;
                        delete currentResponse.selectedOrder;
                        newMessages[messageIndex].llm.forEach((response: any) => {
                            if (response.selected && response.selectedOrder > currentResponse.selectedOrder) {
                                response.selectedOrder--;
                            }
                        });
                    } else {
                        const selectedCount = newMessages[messageIndex].llm.filter((r: any) => r.selected).length;
                        currentResponse.selected = true;
                        currentResponse.selectedOrder = selectedCount + 1;
                    }
                }
            }
            if (saveOnly) {
                setStoredMessages(newMessages);
            }
            return newMessages;
        });
    }, [setMessages, setStoredMessages, storedMessages]);

    const fetchChatResponse = useCallback(async (model: string, messageIndex: number, responseIndex: number, abortController: AbortController, inputText: string) => {
        try {
            setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                if (newMessages[messageIndex]?.llm[responseIndex] !== undefined) {
                    newMessages[messageIndex].llm[responseIndex].isGenerating = true;
                }
                return newMessages;
            });

            const pastMessages = messages.flatMap(msg => {
                const userMessage = { role: 'user', content: msg.user };
                const selectedResponses = msg.llm
                    .filter((llm: any) => llm.selected)
                    .sort((a: any, b: any) => (a.selectedOrder || 0) - (b.selectedOrder || 0));

                const responseMessages = selectedResponses.length > 0
                    ? selectedResponses.map((llm: any) => ({ role: 'assistant', content: [{ type: 'text', text: llm.text }] }))
                    : [{ role: 'assistant', content: [{ type: 'text', text: msg.llm.find((llm: any) => llm.model === model)?.text || '' }] }];

                return [userMessage, ...responseMessages];
            });

            console.log('モデルに送信する過去の会話:', pastMessages);

            let result: { type: string, text: string }[] = [];
            let fc = {
                name: "",
                arguments: ""
            };
            let functionCallExecuted = false;

            const stream = await openai?.chat.completions.create({
                model,
                messages: [
                    ...pastMessages,
                    {
                        role: 'user',
                        content: [
                            { type: "text", text: inputText },
                            ...(selectedImage ? selectedImage.map((imageUrl: string) => ({
                                type: 'image_url',
                                image_url: { url: imageUrl },
                            })) : [])
                        ],
                    },
                ],
                stream: true,
                tool_choice: "auto",
            }, {
                signal: abortController.signal,
            });

            if (stream) {
                for await (const part of stream) {
                    if (abortController.signal.aborted) {
                        throw new DOMException('Aborted', 'AbortError');
                    }
                    const content = part.choices[0]?.delta?.content || '';
                    const toolCalls = part.choices[0]?.delta?.tool_calls;

                    if (toolCalls) {
                        for (const tc of toolCalls) {
                            // Gemini
                            // @ts-ignore
                            if (tc.name) {
                                fc.name += tc;
                                // @ts-ignore
                                fc.arguments += tc.arguments;
                            }

                            // Gemini以外のその他モデル
                            if (tc.function?.name) {
                                fc.name += tc.function?.name;
                            }
                            if (tc.function?.arguments) {
                                fc.arguments += tc.function?.arguments;
                            }
                            console.log('ツールコール引数:', model, fc.name, decodeURIComponent(String(fc.arguments)));
                            // ツールコール引数: openai/gpt-4o get_current_weather {"location":"東"}
                        }
                    } else {
                        result.push({ type: 'text', text: content });
                    }

                    // ファンクションコールの結果を1回だけ追加
                    if (fc.name && fc.arguments && !functionCallExecuted) {
                        try {
                            const args = JSON.parse(fc.arguments);
                            // console.log("toolFunctions:", toolFunctions);

                            result.push({ type: 'text', text: `\n\nFunction Call 実行中...: ${fc.name}(${fc.arguments})` });
                            if (toolFunctions[fc.name as keyof typeof toolFunctions]) {
                                result.push({ type: 'text', text: `\n\nFunction Call 完成` });
                                const functionResult = toolFunctions[fc.name as keyof typeof toolFunctions](args);
                                const functionResultText = `\n\n実行結果:\n${JSON.stringify(functionResult, null, 2)}\n`;
                                result.push({ type: 'text', text: functionResultText });
                                functionCallExecuted = true;
                            }
                        } catch (error) {
                            console.error('ファンクションコールの実行エラー:', error);
                        }
                    }

                    const markedResult = await marked(result.map(r => r.text).join(''));
                    updateMessage(messageIndex, responseIndex, [{ type: 'text', text: markedResult }], undefined, false, false, false);
                }

                setIsAutoScroll(false);
            } else {
                console.error('ストリームの作成に失敗しました');
                updateMessage(messageIndex, responseIndex, [{ type: 'text', text: 'エラー: レスポンスの生成に失敗しました' }], undefined, false, false, false);
            }
            setIsAutoScroll(false);
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Error fetching response from model:', model, error);
                console.log('エラーレスポンス:', error);
                console.log('エラーメッセージ:', error.message);
                updateMessage(messageIndex, responseIndex, [{ type: 'text', text: `エラー: ${error.message}` }], undefined, false, false, false);
            }
        } finally {
            setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                if (newMessages[messageIndex]?.llm[responseIndex] !== undefined) {
                    newMessages[messageIndex].llm[responseIndex].isGenerating = false;
                }
                setStoredMessages(newMessages);
                return newMessages;
            });
            setMessages(prevMessages => {
                const allResponsesComplete = prevMessages[messageIndex].llm.every((response: any) => !response.isGenerating);
                if (allResponsesComplete) {
                    setIsGenerating(false);
                }
                return prevMessages;
            });
        }
    }, [messages, openai, updateMessage, setStoredMessages, toolFunctions, selectedImage]);

    const handleSend = async (event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>, isPrimaryOnly = false, messageIndex?: number) => {
        if (isGenerating) return;

        let inputText = chatInput;
        const modelsToUse = isPrimaryOnly ? [selectedModels[0]] : selectedModels;

        setIsGenerating(true);
        setForceScroll(true);
        const newAbortControllers = modelsToUse.map(() => new AbortController());
        setAbortControllers(newAbortControllers);

        setMessages(prevMessages => {
            const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
            const newMessage = {
                user: [
                    { type: 'text', text: inputText },
                    ...(selectedImage ? selectedImage.map(imageUrl => ({
                        type: 'image_url',
                        image_url: { url: imageUrl }
                    })) : [])
                ],
                llm: modelsToUse.map((model, index) => ({
                    role: 'assistant',
                    model,
                    text: '',
                    selected: false,
                    isGenerating: true
                }))
            };
            const newMessages = [...currentMessages, newMessage];
            newMessage.llm.forEach((response, index) => {
                fetchChatResponse(response.model, newMessages.length - 1, index, newAbortControllers[index], inputText)
                    .finally(() => {
                        setMessages(prevMessages => {
                            const updatedMessages = [...prevMessages];
                            updatedMessages[newMessages.length - 1].llm[index].isGenerating = false;
                            const allResponsesComplete = updatedMessages[newMessages.length - 1].llm.every((response: any) => !response.isGenerating);
                            if (allResponsesComplete) {
                                setIsGenerating(false);
                            }
                            return updatedMessages;
                        });
                    });
            });
            setIsAutoScroll(true);

            if (currentMessages.length === 0) {
                setShowResetButton(true);
            }
            setStoredMessages(newMessages);
            return newMessages;
        });
        setChatInput('');
        setSelectedImage(null); // 送信後に選択された画���をリセット

        setTimeout(() => setForceScroll(false), 100);
    };

    const handleStopAllGeneration = () => {
        abortControllers.forEach(controller => {
            try {
                controller.abort();
            } catch (error) {
                console.error('Error while aborting:', error);
            }
        });
        setIsGenerating(false);
        setMessages(prevMessages => {
            return prevMessages.map(message => ({
                ...message,
                llm: message.llm.map((response: any) => ({ ...response, isGenerating: false }))
            }));
        });
    };

    const handleReset = () => {
        if (window.confirm('チャット履歴をクリアしてもよろしいですか？この操作は元に戻せません。')) {
            setMessages([]);
            setStoredMessages([]);
            setShowResetButton(false);
        }
    };

    const handleStop = (messageIndex: number, responseIndex: number) => {
        const controller = abortControllers[responseIndex];
        if (controller) {
            controller.abort();
            setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                newMessages[messageIndex].llm[responseIndex].isGenerating = false;
                return newMessages;
            });
        }
    };

    const handleRegenerate = async (messageIndex: number, responseIndex: number, model: string) => {
        const inputText = messages[messageIndex].user;
        const abortController = new AbortController();
        setAbortControllers([abortController]);
        setIsGenerating(true);

        try {
            await fetchChatResponse(model, messageIndex, responseIndex, abortController, inputText);
            setMessages(prevMessages => {
                setStoredMessages(prevMessages);
                return prevMessages;
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleResetAndRegenerate = async (messageIndex: number) => {
        setIsGenerating(true);
        setForceScroll(true);

        const messageBlock = document.querySelector(`.message-block:nth-child(${messageIndex + 1})`);
        if (messageBlock) {
            const userDiv = messageBlock.querySelector('.user');
            if (userDiv) {
                userDiv.classList.remove('edited');
                const contentEditableElement = userDiv.querySelector('[contenteditable]');
                if (contentEditableElement) {
                    (contentEditableElement as HTMLElement).blur();
                }
            }
        }

        const newMessages = [...messages];
        const userMessage = newMessages[messageIndex].user;
        newMessages.splice(messageIndex + 1);
        newMessages[messageIndex].llm = selectedModels.map(model => ({
            role: 'assistant',
            model,
            text: '',
            selected: false
        }));

        setMessages(newMessages);

        const newAbortControllers = selectedModels.map(() => new AbortController());
        setAbortControllers(newAbortControllers);

        newMessages[messageIndex].llm.forEach((response: { model: string }, index: number) => {
            fetchChatResponse(response.model, messageIndex, index, newAbortControllers[index], userMessage);
        });

        setIsAutoScroll(true);
        setTimeout(() => setForceScroll(false), 100);
    };

    const handleSendForInputSection = useCallback((event: React.MouseEvent<HTMLButtonElement>, isPrimaryOnly: boolean, messageIndex: number) => {
        handleSend(event, isPrimaryOnly, messageIndex);
    }, [handleSend]);

    const handleScroll = () => {
        const container = containerRef.current;
        if (container && !isAutoScrollingRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;

            if (scrollTop < lastManualScrollTop && !isScrolledToBottom) {
                setIsAutoScroll(false);
            }

            if (isScrolledToBottom) {
                setIsAutoScroll(true);
            }

            setLastManualScrollTop(scrollTop);
        }
    };

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [lastManualScrollTop]);

    useEffect(() => {
        let scrollInterval: NodeJS.Timeout | undefined;
        const scrollIntervalTime = 300;

        const scrollToBottom = () => {
            if ((isAutoScroll || forceScroll) && containerRef.current) {
                const container = containerRef.current;
                const { scrollHeight, clientHeight } = container;
                const newScrollTop = scrollHeight - clientHeight;

                isAutoScrollingRef.current = true;
                container.scrollTop = newScrollTop;
                setLastAutoScrollTop(newScrollTop);
                setTimeout(() => {
                    isAutoScrollingRef.current = false;
                }, 100);
            }
        };

        if (isGenerating) {
            scrollInterval = setInterval(scrollToBottom, scrollIntervalTime) as unknown as NodeJS.Timeout;
        } else {
            scrollToBottom();
        }

        return () => {
            if (scrollInterval) {
                clearInterval(scrollInterval);
            }
        };
    }, [messages, isAutoScroll, lastAutoScrollTop, forceScroll, isGenerating]);

    const handleEdit = (messageIndex: number, responseIndex: number | null, newContent: string) => {
        const newText = [{ type: 'text', text: newContent }];
        updateMessage(messageIndex, responseIndex, newText);
    };

    const handleSelectResponse = useCallback((messageIndex: number, responseIndex: number) => {
        updateMessage(messageIndex, responseIndex, undefined, undefined, true);
    }, [updateMessage]);

    const handleSaveOnly = (messageIndex: number) => {
        const currentMessage = messages[messageIndex];
        updateMessage(messageIndex, null, currentMessage.user, undefined, false, true);
    };

    return (
        <>
            <div className={`responses-container ${messages.length === 0 ? 'initial-screen' : ''}`} ref={containerRef} translate="no">
                {messages.map((message, messageIndex) => {
                    const selectedResponses = message.llm.filter((r: { selected: boolean; selectedOrder?: number }) => r.selected).sort((a: { selectedOrder?: number }, b: { selectedOrder?: number }) => (a.selectedOrder || 0) - (b.selectedOrder || 0));
                    const hasSelectedResponse = selectedResponses.length > 0;
                    return (
                        <div key={messageIndex} className="message-block" >
                            <MemoizedInputSection
                                models={models}
                                chatInput={message.user.map((u: { text: string }) => u.text).join('')}
                                setChatInput={(newInput: string) => updateMessage(messageIndex, null, [{ type: 'text', text: newInput }])}
                                handleSend={(event, isPrimaryOnly) => handleSendForInputSection(event, isPrimaryOnly, messageIndex)}
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
                                setSelectedImage={setSelectedImage}
                                selectedImage={selectedImage}
                            />
                            <div className="scroll_area">
                                {Array.isArray(message.llm) && message.llm.map((response: { role: string, model: string, text: string, selected: boolean, isGenerating: boolean }, responseIndex: number) => (
                                    <div key={responseIndex} className={`response ${response.role} ${hasSelectedResponse && !response.selected ? 'unselected' : ''}`}>
                                        <div className="meta">
                                            <small>{response.model}</small>
                                            <div className="response-controls">
                                                <button
                                                    className={response.isGenerating ? "stop-button" : "regenerate-button"}
                                                    onClick={() => response.isGenerating
                                                        ? handleStop(messageIndex, responseIndex)
                                                        : handleRegenerate(messageIndex, responseIndex, response.model)
                                                    }
                                                >
                                                    {response.isGenerating ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                                            <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                                                        </svg>
                                                    )}
                                                </button>
                                                <div
                                                    className={`response-select ${response.selected ? 'selected' : ''}`}
                                                    onClick={() => handleSelectResponse(messageIndex, responseIndex)}
                                                >
                                                    {response.selected ? (
                                                        selectedResponses.length > 1 ?
                                                            (selectedResponses.findIndex((r: { selectedOrder?: number }) => r === response) + 1) :
                                                            '✓'
                                                    ) : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div
                                            className="markdown-content"
                                            contentEditable
                                            onBlur={(e) => handleEdit(messageIndex, responseIndex, (e.target as HTMLDivElement).innerHTML)}
                                            dangerouslySetInnerHTML={{ __html: response.text }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div >

            <InputSection
                mainInput={true}
                models={models}
                chatInput={chatInput}
                setChatInput={setChatInput}
                handleSend={(event: React.MouseEvent<HTMLButtonElement>, isPrimaryOnly: boolean) => handleSend(event, isPrimaryOnly, messages.length - 1)}
                selectedModels={selectedModels}
                setSelectedModels={setSelectedModels}
                isEditMode={false}
                messageIndex={0}
                handleResetAndRegenerate={() => { }}
                handleSaveOnly={() => { }}
                isInitialScreen={messages.length === 0}
                handleReset={handleReset}
                handleStopAllGeneration={handleStopAllGeneration}
                setSelectedImage={setSelectedImage}
                selectedImage={selectedImage}
            />
        </>
    );
};