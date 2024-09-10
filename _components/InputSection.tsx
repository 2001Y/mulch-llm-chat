import React, { useState, useEffect, useRef } from "react";
import useLocalStorage from "_hooks/useLocalStorage";

interface InputSectionProps {
    models: string[];
    mainInput: boolean;
    chatInput: string;
    setChatInput: (input: string) => void;
    handleSend: (event: React.MouseEvent<HTMLButtonElement>, isPrimaryOnly: boolean) => void;
    selectedModels: string[];
    setSelectedModels: React.Dispatch<React.SetStateAction<string[]>>;
    isEditMode: boolean;
    messageIndex: number;
    handleResetAndRegenerate: (messageIndex: number) => void;
    handleSaveOnly: (messageIndex: number) => void;
    isInitialScreen: boolean;
    handleReset: () => void;
    handleStopAllGeneration: () => void;
}

export default function InputSection({
    models,
    mainInput,
    chatInput,
    setChatInput,
    handleSend,
    selectedModels,
    setSelectedModels,
    isEditMode,
    messageIndex,
    handleResetAndRegenerate,
    handleSaveOnly,
    isInitialScreen,
    handleReset,
    handleStopAllGeneration
}: InputSectionProps) {
    const [storedMessages, setStoredMessages, isStoredMessagesLoaded] = useLocalStorage<any[]>('chatMessages', []);
    const [isComposing, setIsComposing] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [filteredModels, setFilteredModels] = useState(models);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const originalMessage = storedMessages[messageIndex]?.user || '';
    const [isInputEmpty, setIsInputEmpty] = useState(true);

    useEffect(() => {
        if (sectionRef.current) {
            const isEdited = chatInput !== originalMessage;
            sectionRef.current.classList.toggle('edited', isEdited);
        }
    }, [chatInput, originalMessage]);

    useEffect(() => {
        if (inputRef.current && mainInput) {
            inputRef.current.focus();
        }
    }, [mainInput]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (document.body.dataset && document.body.dataset.softwareKeyboard === 'false') {
            if (event.key === 'Enter' && !isComposing) {
                if (event.shiftKey) {
                    return; // Shift+Enterで改行
                }
                event.preventDefault();
                if (isEditMode) {
                    handleResetAndRegenerate(messageIndex);
                } else {
                    handleSendAndResetInput(event as unknown as React.MouseEvent<HTMLButtonElement>, event.metaKey || event.ctrlKey);
                }
            } else if (event.key === 'ArrowDown') {
                if (showSuggestions) {
                    event.preventDefault();
                    setSuggestionIndex((prevIndex) => Math.min(prevIndex + 1, filteredModels.length - 1));
                }
            } else if (event.key === 'ArrowUp') {
                if (showSuggestions) {
                    event.preventDefault();
                    setSuggestionIndex((prevIndex) => Math.max(prevIndex - 1, 0));
                }
            } else if (event.key === 'Escape') {
                setShowSuggestions(false);
            } else if ((event.metaKey || event.ctrlKey) && event.key === 'Backspace') {
                event.preventDefault();
                handleStopAllGeneration();
            } else if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
                event.preventDefault();
                handleReset();
            }
        }
    };

    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = (event: React.CompositionEvent<HTMLTextAreaElement>) => {
        setIsComposing(false);
        setChatInput(event.currentTarget.value);
    };

    const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setChatInput(text);
        setIsInputEmpty(text.trim() === '');
        if (sectionRef.current) {
            const isEdited = text !== originalMessage;
            sectionRef.current.classList.toggle('edited', isEdited);
        }
        // 複数の「@」に対応するため、最後の「@」以降の文字列をマッチさせる正規表現
        const mentionMatch = text.match(/@[^@]*$/);
        if (mentionMatch && mentionMatch[0]) {
            const searchText = mentionMatch[0].slice(1).toLowerCase();
            console.log(searchText);
            console.log(searchText.includes(' '));
            if (searchText.includes(' ') || searchText.length > 15) {
                setShowSuggestions(false);
            } else {
                const matchedModels = models.filter(model => model.toLowerCase().includes(searchText));
                setFilteredModels(matchedModels);
                setShowSuggestions(true);
                setSelectedModels(matchedModels);
            }
        }
    };

    const selectSuggestion = (index: number) => {
        const selectedModel = filteredModels[index];
        const inputElement = inputRef.current;
        if (inputElement) {
            // 入力フィールドの値から最後の「@」に続く文字列を選択されたモデル名に置き換える
            const text = inputElement.value.replace(/@[^@]*$/, `@${selectedModel.split('/')[1]} `);
            inputElement.value = text;

            setShowSuggestions(false);
            setSuggestionIndex(0);
            setChatInput(text);
        }
    };

    useEffect(() => {
        if (chatInput === '' && inputRef.current) {
            inputRef.current.value = '';
        }
    }, [chatInput]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const handleModelChange = (model: string) => {
        const wasInputFocused = document.activeElement === inputRef.current;
        setSelectedModels((prevSelectedModels) => {
            let newSelectedModels;
            if (prevSelectedModels.includes(model)) {
                newSelectedModels = prevSelectedModels.filter((m) => m !== model);
            } else {
                newSelectedModels = [model, ...prevSelectedModels.filter((m) => m !== model)];
            }
            // 選択されたモデルが1つもない場合、最初のモデルを選択状態にする
            if (newSelectedModels.length === 0) {
                newSelectedModels = [models[0]];
            }
            return newSelectedModels;
        });
        if (wasInputFocused && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    // Polyfill for unsupported browsers
    useEffect(() => {
        if (!CSS.supports('field-sizing: content')) {
            const textarea = inputRef.current;
            if (!textarea) return;

            const adjustHeight = () => {
                textarea.style.height = '1lh'; // 未入力時の高さを1lhに設定
                textarea.style.height = `${Math.max(textarea.scrollHeight, parseFloat(getComputedStyle(textarea).lineHeight))}px`;
                const computedStyle = window.getComputedStyle(textarea);
                const maxHeight = parseInt(computedStyle.maxHeight);
                if (textarea.scrollHeight > maxHeight) {
                    textarea.style.height = `${maxHeight}px`;
                    textarea.style.overflowY = 'auto';
                } else {
                    textarea.style.overflowY = 'hidden';
                }
            };

            textarea.addEventListener('input', adjustHeight);
            window.addEventListener('resize', adjustHeight);

            // 初期高さを設定
            adjustHeight();

            // chatInputが変更されたときに高さを調整
            if (chatInput === '') {
                textarea.style.height = '1lh'; // 未入力時の高さを1lhに設定
            } else {
                adjustHeight();
            }

            return () => {
                textarea.removeEventListener('input', adjustHeight);
                window.removeEventListener('resize', adjustHeight);
            };
        }
    }, [chatInput]);

    // 新しい関数: 送信後に入力をリセットする
    const handleSendAndResetInput = (event: React.MouseEvent<HTMLButtonElement>, isPrimaryOnly: boolean) => {
        handleSend(event, isPrimaryOnly);
        setChatInput('');
        setIsInputEmpty(true);
    };

    return (
        <section className={`input-section ${isInitialScreen ? 'initial-screen' : ''} ${mainInput ? 'full-input fixed' : ''} `} ref={sectionRef}>

            <div className="input-container input-actions">
                <button
                    onClick={handleReset}
                    className={`action-button new-thread-button icon-button ${isInputEmpty ? 'active' : ''}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>New Thread<span className="shortcut">⌘N</span></span>
                </button>
            </div>

            <div className="input-container chat-input-area">
                <textarea
                    ref={inputRef}
                    value={chatInput}
                    onChange={onChange}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    className="chat-input"
                    placeholder={isEditMode ? "Edit your message here..." : "Type your message here…"}
                    data-fieldsizing="content"
                />
                {showSuggestions && (
                    <ul className="suggestions-list">
                        {filteredModels.map((model, index) => (
                            <li
                                key={model}
                                className={index === suggestionIndex ? 'active' : ''}
                                onClick={() => selectSuggestion(index)}
                            >
                                <input
                                    type="radio"
                                    id={`suggestion-${index}`}
                                    name="model-suggestion"
                                    value={model}
                                    checked={index === suggestionIndex}
                                    onChange={() => selectSuggestion(index)}
                                />
                                <label htmlFor={`suggestion-${index}`}>{model.split('/')[1]}</label>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="input-container model-select-area">
                {models.map((model, index) => (
                    <div className="model-radio" key={model}>
                        <input
                            type="checkbox"
                            id={`model-${index}`}
                            value={model}
                            checked={selectedModels.includes(model)}
                            onChange={() => handleModelChange(model)}
                        />
                        <label htmlFor={`model-${index}`}>
                            {model.split('/')[1]}
                        </label>
                    </div>
                ))}
            </div>

            <div className="input-container input-actions">
                {isEditMode ? (
                    <>
                        <button
                            onClick={() => handleResetAndRegenerate(messageIndex)}
                            className="action-button reset-regenerate-button icon-button"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                            </svg>

                            <span>Regenerate<span className="shortcut">⏎</span></span>
                        </button>
                        <button
                            onClick={() => handleSaveOnly(messageIndex)}
                            className="action-button save-only-button icon-button"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            <span>
                                Save
                            </span>
                        </button>

                        <span className="line-break shortcut-area">
                            Line break
                            <span className="shortcut">⇧⏎</span>
                        </span>
                    </>
                ) : (
                    <>
                        <button
                            onClick={(e) => handleSendAndResetInput(e, false)}
                            className={`action-button send-button icon-button ${!isInputEmpty ? 'active' : ''}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                            <span>Send<span className="shortcut">⏎</span></span>
                        </button>
                        <button
                            onClick={(e) => handleSendAndResetInput(e, true)}
                            className={`action-button send-primary-button icon-button ${!isInputEmpty ? 'active' : ''}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                            </svg>
                            <span>
                                Send to <code>{selectedModels[0].split('/')[1]}</code>
                                <span className="shortcut">⌘⏎</span>
                            </span>
                        </button>
                        <span className="line-break shortcut-area">
                            Line break
                            <span className="shortcut">⇧⏎</span>
                        </span>
                    </>
                )}
            </div>
        </section>
    );
};