import React, { useRef, useState, useEffect, useCallback } from "react";
import InputSection from "/_components/InputSection";

export default function Responses({ messages = [], updateMessage, forceScroll, handleRegenerate, handleResetAndRegenerate, handleStop, handleSend, models, chatInput, setChatInput, openModal, isGenerating, selectedModels, setSelectedModels, showResetButton, handleReset }) {
    const containerRef = useRef(null);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [lastManualScrollTop, setLastManualScrollTop] = useState(0);
    const [lastAutoScrollTop, setLastAutoScrollTop] = useState(0);
    const [expandedMessages, setExpandedMessages] = useState({});
    const isAutoScrollingRef = useRef(false);

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
    }, [messages, expandedMessages, selectedModels]);

    const updateResponseHeights = (messageIndex) => {
        const messageBlock = document.querySelector(`.message-block:nth-child(${messageIndex + 1})`);
        if (!messageBlock) return;

        const scrollArea = messageBlock.querySelector('.scroll_area');
        const responses = messageBlock.querySelectorAll('.response');

        if (responses.length === 0) {
            scrollArea.style.maxHeight = '70vh';
            return;
        }

        const responseHeights = Array.from(responses).map(response => response.offsetHeight);
        const minHeight = Math.min(...responseHeights);
        const maxHeight = Math.max(...responseHeights);
        const totalHeight = responseHeights.reduce((sum, height) => sum + height, 0);

        const isShort = totalHeight <= 300 || maxHeight <= 300;

        if (isShort) {
            scrollArea.style.maxHeight = 'none';
            setExpandedMessages(prev => ({ ...prev, [messageIndex]: true }));
        } else {
            const isExpanded = expandedMessages[messageIndex];
            if (isExpanded) {
                scrollArea.style.maxHeight = 'none';
            } else {
                scrollArea.style.maxHeight = `${minHeight}px`;
                responses.forEach((response, index) => {
                    if (responseHeights[index] > minHeight) {
                        response.style.maxHeight = `${minHeight}px`;
                        response.style.overflow = 'hidden';
                    } else {
                        response.style.maxHeight = 'none';
                        response.style.overflow = 'visible';
                    }
                });
            }
        }
    };

    const toggleExpand = (messageIndex) => {
        setExpandedMessages(prev => ({
            ...prev,
            [messageIndex]: !prev[messageIndex]
        }));
        setTimeout(() => updateResponseHeights(messageIndex), 0);
    };

    const handleScroll = () => {
        const container = containerRef.current;
        if (container && !isAutoScrollingRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;

            // ユーザーが上にスクロールした場合、自動スクロールを無効にする
            if (scrollTop < lastManualScrollTop && !isScrolledToBottom) {
                setIsAutoScroll(false);
            }

            // 最下部までスクロールした場合、自動スクロールを有効にする
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
        let scrollInterval;
        const scrollIntervalTime = 300; // スクロール更新の間隔（ミリ秒）

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

        // ストリーミング中は定期的にスクロールを実行
        if (isGenerating) {
            scrollInterval = setInterval(scrollToBottom, scrollIntervalTime);
        } else {
            // ストリーミングが終了したら最後に一度スクロール
            scrollToBottom();
        }

        return () => {
            if (scrollInterval) {
                clearInterval(scrollInterval);
            }
        };
    }, [messages, isAutoScroll, lastAutoScrollTop, forceScroll, isGenerating]);

    const handleEdit = (messageIndex, responseIndex, newContent) => {
        if (responseIndex === null) {
            // ユーザーメッセージの編集
            updateMessage(messageIndex, null, newContent);
        } else {
            // AIの応答の編集
            updateMessage(messageIndex, responseIndex, newContent);
        }
    };

    const handleSelectResponse = useCallback((messageIndex, responseIndex) => {
        updateMessage(messageIndex, responseIndex, undefined, null, true);
    }, [updateMessage]);

    const handleSaveOnly = (messageIndex) => {
        const currentMessage = messages[messageIndex];
        updateMessage(messageIndex, null, currentMessage.user, null, false, true);
    };

    return (
        <div className={`responses-container ${messages.length === 0 ? 'initial-screen' : ''}`} ref={containerRef} translate="no">
            {messages.map((message, messageIndex) => {
                const selectedResponses = message.llm.filter(r => r.selected).sort((a, b) => a.selectedOrder - b.selectedOrder);
                const hasSelectedResponse = selectedResponses.length > 0;
                const isExpanded = expandedMessages[messageIndex];
                return (
                    <div key={messageIndex} className="message-block" >
                        <InputSection
                            models={models}
                            chatInput={message.user}
                            setChatInput={(newInput) => updateMessage(messageIndex, null, newInput)}
                            handleSend={(event, isPrimaryOnly) => handleSend(event, isPrimaryOnly, messageIndex)}
                            handleStop={handleStop}
                            openModal={openModal}
                            isGenerating={isGenerating}
                            selectedModels={selectedModels}
                            setSelectedModels={setSelectedModels}
                            showResetButton={showResetButton}
                            handleReset={handleReset}
                            isEditMode={true}
                            messageIndex={messageIndex}
                            handleResetAndRegenerate={handleResetAndRegenerate}
                            handleSaveOnly={handleSaveOnly}
                            originalMessage={message.originalUser || message.user}
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
                                        onBlur={(e) => handleEdit(messageIndex, responseIndex, e.target.innerHTML)}
                                        dangerouslySetInnerHTML={{ __html: response.text }}
                                    />
                                </div>
                            ))}
                        </div>
                        {!isExpanded && message.llm.length > 0 && (
                            <div className="expand-control">
                                <button onClick={() => toggleExpand(messageIndex)}>
                                    すべて表示
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
            {/* {messages.length === 0 && ( */}
            <InputSection
                mainInput={true}
                models={models}
                chatInput={chatInput}
                setChatInput={setChatInput}
                handleSend={(event, isPrimaryOnly) => handleSend(event, isPrimaryOnly, messages.length - 1)}
                handleStop={handleStop}
                openModal={openModal}
                isGenerating={isGenerating}
                selectedModels={selectedModels}
                setSelectedModels={setSelectedModels}
                showResetButton={showResetButton}
                handleReset={handleReset}
                isEditMode={false}
                isInitialScreen={messages.length === 0}
            />
            {/* {)}} */}
        </div >
    );
};