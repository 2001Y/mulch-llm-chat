import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import InputSection from "../_components/InputSection";

interface Message {
    user: string;
    originalUser?: string;
    llm: {
        role: string;
        model: string;
        text: string;
        selected: boolean;
        selectedOrder?: number;
        isGenerating: boolean;
    }[];
}

interface ResponsesProps {
    messages: Message[];
    updateMessage: (messageIndex: number, responseIndex: number | null, text: string | undefined, selectedIndex?: number, toggleSelected?: boolean, saveOnly?: boolean, isEditing?: boolean) => void;
    forceScroll: boolean;
    handleRegenerate: (messageIndex: number, responseIndex: number, model: string) => void;
    handleResetAndRegenerate: (messageIndex: number) => void;
    handleStop: (messageIndex: number, responseIndex: number) => void;
    handleSend: (event: React.MouseEvent<HTMLButtonElement>, isPrimaryOnly: boolean, messageIndex: number) => void;
    models: string[];
    chatInput: string;
    setChatInput: (input: string) => void;
    openModal: () => void;
    isGenerating: boolean;
    selectedModels: string[];
    setSelectedModels: React.Dispatch<React.SetStateAction<string[]>>;
    showResetButton: boolean;
    handleReset: () => void;
    handleStopAllGeneration: () => void;
}

export default function Responses({
    messages = [],
    updateMessage,
    forceScroll,
    handleRegenerate,
    handleResetAndRegenerate,
    handleStop,
    handleSend,
    models,
    chatInput,
    setChatInput,
    openModal,
    isGenerating,
    selectedModels,
    setSelectedModels,
    showResetButton,
    handleReset,
    handleStopAllGeneration
}: ResponsesProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [lastManualScrollTop, setLastManualScrollTop] = useState(0);
    const [lastAutoScrollTop, setLastAutoScrollTop] = useState(0);
    const [expandedMessages, setExpandedMessages] = useState<{ [key: number]: boolean }>({});
    const [showExpandButton, setShowExpandButton] = useState<{ [key: number]: boolean }>({});
    const isAutoScrollingRef = useRef(false);
    const MemoizedInputSection = useMemo(() => React.memo(InputSection), []);

    const handleSendForInputSection = useCallback((event: React.MouseEvent<HTMLButtonElement>, isPrimaryOnly: boolean, messageIndex: number) => {
        handleSend(event, isPrimaryOnly, messageIndex);
    }, [handleSend]);

    useEffect(() => {
        messages.forEach((_, index) => {
            updateResponseHeights(index);
        });

        const handleResize = () => {
            messages.forEach((_, index) => {
                updateResponseHeights(index);
            });
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [messages, selectedModels, expandedMessages]);

    const updateResponseHeights = useCallback((messageIndex: number) => {
        const messageBlock = document.querySelector(`.message-block:nth-child(${messageIndex + 1})`);
        if (!messageBlock) return;

        const scrollArea = messageBlock.querySelector('.scroll_area');
        if (!scrollArea || !(scrollArea instanceof HTMLElement)) return;

        const responses = messageBlock.querySelectorAll('.response');
        const responseHeights = Array.from(responses).map(response => (response as HTMLElement).scrollHeight);
        const totalHeight = responseHeights.reduce((sum, height) => sum + height, 0);

        const isExpanded = expandedMessages[messageIndex] || false;

        if (totalHeight <= 300) {
            scrollArea.style.maxHeight = 'none';
            responses.forEach(response => {
                if (response instanceof HTMLElement) {
                    response.style.maxHeight = 'none';
                    response.style.overflow = 'visible';
                }
            });
            setShowExpandButton(prev => ({ ...prev, [messageIndex]: false }));
        } else {
            if (isExpanded) {
                scrollArea.style.maxHeight = 'none';
                responses.forEach(response => {
                    if (response instanceof HTMLElement) {
                        response.style.maxHeight = 'none';
                        response.style.overflow = 'visible';
                    }
                });
            } else {
                const averageHeight = totalHeight / responses.length;
                const sortedHeights = [...responseHeights].sort((a, b) => a - b);
                const medianHeight = sortedHeights[Math.floor(sortedHeights.length / 2)];
                const limitHeight = Math.min(averageHeight, medianHeight);

                let currentHeight = 0;
                let maxHeight = 0;

                Array.from(responses).forEach((response) => {
                    if (response instanceof HTMLElement) {
                        currentHeight += response.scrollHeight;
                        if (currentHeight >= limitHeight) {
                            maxHeight = currentHeight;
                        }
                    }
                });

                // for (const response of responses) {
                //     if (response instanceof HTMLElement) {
                //         currentHeight += response.scrollHeight;
                //         if (currentHeight >= limitHeight) {
                //             maxHeight = currentHeight;
                //             break;
                //         }
                //     }
                // }

                scrollArea.style.maxHeight = `${Math.max(300, maxHeight)}px`;
                responses.forEach((response) => {
                    if (response instanceof HTMLElement) {
                        response.style.maxHeight = 'none';
                        response.style.overflow = 'visible';
                    }
                });
            }
            setShowExpandButton(prev => ({ ...prev, [messageIndex]: true }));
        }
    }, [expandedMessages]);

    const expandMessage = useCallback((messageIndex: number) => {
        setExpandedMessages(prev => ({ ...prev, [messageIndex]: true }));
        updateResponseHeights(messageIndex);
    }, [updateResponseHeights]);

    const collapseMessage = useCallback((messageIndex: number) => {
        setExpandedMessages(prev => ({ ...prev, [messageIndex]: false }));
        updateResponseHeights(messageIndex);
    }, [updateResponseHeights]);

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
        if (responseIndex === null) {
            updateMessage(messageIndex, null, newContent);
        } else {
            updateMessage(messageIndex, responseIndex, newContent);
        }
    };

    const handleSelectResponse = useCallback((messageIndex: number, responseIndex: number) => {
        updateMessage(messageIndex, responseIndex, undefined, undefined, true);
    }, [updateMessage]);

    const handleSaveOnly = (messageIndex: number) => {
        const currentMessage = messages[messageIndex];
        updateMessage(messageIndex, null, currentMessage.user, undefined, false, true);
    };

    const handleStopForInputSection = useCallback(() => {
        if (messages.length > 0) {
            const lastMessageIndex = messages.length - 1;
            const lastResponseIndex = messages[lastMessageIndex].llm.length - 1;
            handleStop(lastMessageIndex, lastResponseIndex);
        }
    }, [messages, handleStop]);

    return (
        <div className={`responses-container ${messages.length === 0 ? 'initial-screen' : ''}`} ref={containerRef} translate="no">
            {messages.map((message, messageIndex) => {
                const selectedResponses = message.llm.filter(r => r.selected).sort((a, b) => (a.selectedOrder || 0) - (b.selectedOrder || 0));
                const hasSelectedResponse = selectedResponses.length > 0;
                return (
                    <div key={messageIndex} className="message-block" >
                        <MemoizedInputSection
                            models={models}
                            chatInput={message.user}
                            setChatInput={(newInput: string) => updateMessage(messageIndex, null, newInput)}
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
                        />
                        <div className="scroll_area">
                            {Array.isArray(message.llm) && message.llm.map((response, responseIndex) => (
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
                                                        (selectedResponses.findIndex(r => r === response) + 1) :
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
                        {message.llm.length > 0 && showExpandButton[messageIndex] && (
                            <div className="expand-control">
                                <button
                                    className={expandedMessages[messageIndex] ? 'folded' : ""}
                                    onClick={() => expandedMessages[messageIndex] ? collapseMessage(messageIndex) : expandMessage(messageIndex)}
                                >
                                    {expandedMessages[messageIndex] ? 'Collapse' : 'Show All'}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
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
            />
        </div >
    );
};