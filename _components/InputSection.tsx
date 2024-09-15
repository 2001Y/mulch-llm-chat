import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import useLocalStorage from "_hooks/useLocalStorage";
import { toast } from 'sonner';

interface InputSectionProps {
    models: string[];
    mainInput: boolean;
    chatInput: { type: string, text?: string, image_url?: { url: string } }[];
    setChatInput: React.Dispatch<React.SetStateAction<{ type: string, text?: string, image_url?: { url: string } }[]>>;
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
    handleStopAllGeneration,
}: InputSectionProps) {
    const [storedMessages, setStoredMessages, isStoredMessagesLoaded] = useLocalStorage<any[]>('chatMessages', []);
    const [isComposing, setIsComposing] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [filteredModels, setFilteredModels] = useState(models);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isEdited, setIsEdited] = useState(false);

    const originalMessage = storedMessages[messageIndex]?.user || null;

    useEffect(() => {
        if (mainInput) {
            setChatInput([{ type: 'text', text: '' }]);
        }
    }, [mainInput, setChatInput]);

    useEffect(() => {
        if (originalMessage) {
            const isContentEdited = JSON.stringify(chatInput) !== JSON.stringify(originalMessage);
            setIsEdited(isContentEdited);
        }
    }, [chatInput, originalMessage]);

    useEffect(() => {
        if (inputRef.current && mainInput) {
            inputRef.current.focus();
        }
    }, [mainInput]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (document.body.dataset && document.body.dataset.softwareKeyboard === 'false') {
            const keyActions: { [key: string]: () => void } = {
                'Enter': () => {
                    if (!event.shiftKey && !isComposing) {
                        event.preventDefault();
                        isEditMode ? handleResetAndRegenerate(messageIndex) : handleSendAndResetInput(event as unknown as React.MouseEvent<HTMLButtonElement>, event.metaKey || event.ctrlKey);
                    }
                },
                'ArrowDown': () => {
                    if (showSuggestions) {
                        event.preventDefault();
                        setSuggestionIndex((prevIndex) => Math.min(prevIndex + 1, filteredModels.length - 1));
                    }
                },
                'ArrowUp': () => {
                    if (showSuggestions) {
                        event.preventDefault();
                        setSuggestionIndex((prevIndex) => Math.max(prevIndex - 1, 0));
                    }
                },
                'Escape': () => setShowSuggestions(false),
                'Backspace': () => {
                    if (event.metaKey || event.ctrlKey) {
                        event.preventDefault();
                        handleStopAllGeneration();
                    }
                },
                'n': () => {
                    if (event.metaKey || event.ctrlKey) {
                        event.preventDefault();
                        handleReset();
                    }
                }
            };

            const action = keyActions[event.key];
            if (action) action();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setChatInput(prevInput => {
            const textItem = prevInput.find(item => item.type === 'text');
            if (textItem) {
                return prevInput.map(item => item.type === 'text' ? { ...item, text } : item);
            } else {
                return [{ type: 'text', text }, ...prevInput];
            }
        });
        updateSuggestions(text);
    };

    const updateSuggestions = (text: string) => {
        const mentionMatch = text.match(/@[^@]*$/);
        if (mentionMatch && mentionMatch[0]) {
            const searchText = mentionMatch[0].slice(1).toLowerCase();
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
        if (inputRef.current) {
            const text = inputRef.current.value.replace(/@[^@]*$/, `@${selectedModel.split('/')[1]} `);
            inputRef.current.value = text;
            setShowSuggestions(false);
            setSuggestionIndex(0);
            setChatInput([{ type: 'text', text }]);
        }
    };

    const handleModelChange = (model: string) => {
        const wasInputFocused = document.activeElement === inputRef.current;
        setSelectedModels((prevSelectedModels) => {
            let newSelectedModels = prevSelectedModels.includes(model)
                ? prevSelectedModels.filter((m) => m !== model)
                : [model, ...prevSelectedModels.filter((m) => m !== model)];
            return newSelectedModels.length === 0 ? [models[0]] : newSelectedModels;
        });
        if (wasInputFocused && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    const handleSendAndResetInput = (event: React.MouseEvent<HTMLButtonElement>, isPrimaryOnly: boolean) => {
        handleSend(event, isPrimaryOnly);
        setChatInput([{ type: 'text', text: '' }]);
    };

    const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            try {
                const newImages = await Promise.all(
                    Array.from(files).map((file) =>
                        new Promise<{ type: string, image_url: { url: string } }>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve({ type: 'image_url', image_url: { url: reader.result as string } });
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        })
                    )
                );
                setChatInput(prevInput => [...prevInput, ...newImages]);
            } catch (error) {
                toast.error('画像の読み込み中にエラーが発生しました', {
                    description: '別の画像を選択してください',
                    duration: 3000,
                });
            }
        } else {
            toast.error('画像が選択されませんでした', {
                description: '画像を選択してください',
                duration: 3000,
            });
        }
        if (event.target) event.target.value = '';
    };

    const removeImage = (index: number) => {
        setChatInput(prevInput => prevInput.filter((_, i) => i !== index));
    };

    // Polyfill for unsupported browsers
    useEffect(() => {
        if (!CSS.supports('field-sizing: content')) {
            const textarea = inputRef.current;
            if (!textarea) return;

            const adjustHeight = () => {
                textarea.style.height = '1lh';
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

            adjustHeight();

            const textContent = chatInput.find(item => item.type === 'text')?.text || '';
            if (textContent === '') {
                textarea.style.height = '1lh';
            } else {
                adjustHeight();
            }

            return () => {
                textarea.removeEventListener('input', adjustHeight);
                window.removeEventListener('resize', adjustHeight);
            };
        }
    }, [chatInput]);

    // chatInputが空の配列の場合に対応するヘルパー関数
    const isInputEmpty = () => {
        if (chatInput.length === 0) return true;
        if (chatInput.length === 1) {
            const firstItem = chatInput[0];
            return firstItem.type === 'text' && (!firstItem.text || firstItem.text.trim() === '');
        }
        return false;
    };

    return (
        <section className={`input-section ${isInitialScreen ? 'initial-screen' : ''} ${mainInput ? 'full-input fixed' : ''} ${isEdited ? 'edited' : ''}`} ref={sectionRef}>
            <div className="input-container input-actions">
                <button
                    onClick={handleReset}
                    className={`action-button new-thread-button icon-button ${isInputEmpty() ? 'active' : ''}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span>New Thread<span className="shortcut">⌘N</span></span>
                </button>
            </div>

            <div className="input-container chat-input-area">
                {chatInput.filter(item => item.type === 'image_url').length > 0 && (
                    <div className="image-previews">
                        {chatInput.filter(item => item.type === 'image_url').map((image, index) => (
                            <div key={index} className="image-preview">
                                <img src={image.image_url?.url} alt={`選択された画像 ${index + 1}`} />
                                <button onClick={() => removeImage(index)}>
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <textarea
                    ref={inputRef}
                    value={chatInput.find(item => item.type === 'text')?.text || ''}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={(e) => {
                        setIsComposing(false);
                        handleInputChange({ target: e.target } as React.ChangeEvent<HTMLTextAreaElement>);
                    }}
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
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="image-select-button icon-button"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    multiple
                />
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
                            className={`action-button send-button icon-button ${!isInputEmpty() ? 'active' : ''}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                            <span>Send<span className="shortcut">⏎</span></span>
                        </button>
                        <button
                            onClick={(e) => handleSendAndResetInput(e, true)}
                            className={`action-button send-primary-button icon-button ${!isInputEmpty() ? 'active' : ''}`}
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