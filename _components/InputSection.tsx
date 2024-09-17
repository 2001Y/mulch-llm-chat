import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import useLocalStorage from "_hooks/useLocalStorage";
import { toast } from 'sonner';
import ModelSuggestions from './ModelSuggestions';

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
    handleStopAllGeneration: () => void;
    isGenerating: boolean;
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
    handleStopAllGeneration,
    isGenerating,
}: InputSectionProps) {
    const [storedMessages] = useLocalStorage<any[]>('chatMessages', []);
    const [isComposing, setIsComposing] = useState(false);
    const [isEdited, setIsEdited] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const originalMessage = storedMessages[messageIndex]?.user || null;

    useEffect(() => {
        if (mainInput) setChatInput([{ type: 'text', text: '' }]);
    }, [mainInput, setChatInput]);

    useEffect(() => {
        if (originalMessage) setIsEdited(JSON.stringify(chatInput) !== JSON.stringify(originalMessage));
    }, [chatInput, originalMessage]);

    useEffect(() => {
        if (inputRef.current && mainInput) inputRef.current.focus();
    }, [mainInput]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (document.body.dataset?.softwareKeyboard === 'false') {
            if (event.key === 'Enter' && !event.shiftKey && !isComposing && !isGenerating) {
                event.preventDefault();
                if (!isInputEmpty()) {
                    isEditMode
                        ? handleResetAndRegenerate(messageIndex)
                        : handleSendAndResetInput(event as unknown as React.MouseEvent<HTMLButtonElement>, event.metaKey || event.ctrlKey);
                }
            } else if (event.key === 'Backspace' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                handleStopAllGeneration();
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setChatInput(prev => {
            const newInput = prev.length > 0 ? [...prev] : [{ type: 'text', text: '' }];
            newInput[0] = { ...newInput[0], text };
            return newInput;
        });
        setShowSuggestions(/@[^@\s]*$/.test(text));
    };

    const selectSuggestion = (selectedModel: string) => {
        if (inputRef.current) {
            const text = inputRef.current.value.replace(/@[^@]*$/, `@${selectedModel.split('/')[1]} `);
            setChatInput([{ type: 'text', text }]);
        }
    };

    const handleModelChange = (model: string) => {
        const wasFocused = document.activeElement === inputRef.current;
        setSelectedModels(prev => {
            const isSelected = prev.includes(model);
            const newSelection = isSelected
                ? prev.filter(m => m !== model)
                : [model, ...prev];

            return newSelection.length ? newSelection : [models[0]];
        });
        if (wasFocused) {
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    const handleSendAndResetInput = (event: React.MouseEvent<HTMLButtonElement>, isPrimaryOnly: boolean) => {
        handleSend(event, isPrimaryOnly);
        setChatInput([{ type: 'text', text: '' }]);
    };

    const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files?.length) {
            try {
                const newImages = await Promise.all(
                    Array.from(files).map(file =>
                        new Promise<{ type: string; image_url: { url: string } }>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve({ type: 'image_url', image_url: { url: reader.result as string } });
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        })
                    )
                );
                setChatInput(prev => [...prev, ...newImages]);
            } catch {
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
        setChatInput(prev => prev.filter((_, i) => i !== index));
    };

    useEffect(() => {
        if (!CSS.supports('field-sizing: content')) {
            const textarea = inputRef.current;
            if (!textarea) return;

            const adjustHeight = () => {
                textarea.style.height = '1lh';
                textarea.style.height = `${Math.max(textarea.scrollHeight, parseFloat(getComputedStyle(textarea).lineHeight))}px`;
                const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight);
                textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
            };
            textarea.addEventListener('input', adjustHeight);
            window.addEventListener('resize', adjustHeight);
            adjustHeight();
            return () => {
                textarea.removeEventListener('input', adjustHeight);
                window.removeEventListener('resize', adjustHeight);
            };
        }
    }, [chatInput]);

    const isInputEmpty = () => !(chatInput[0]?.text?.trim());

    return (
        <section
            className={`input-section ${isInitialScreen ? 'initial-screen' : ''} ${mainInput ? 'full-input fixed' : ''
                } ${isEdited ? 'edited' : ''}`}
            ref={sectionRef}
        >
            <div className="input-container chat-input-area">
                <div className="files-previews">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="action-button add-files-button icon-button"
                    >
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
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span>
                            Add files
                        </span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        multiple
                    />
                    {chatInput
                        .slice(1)
                        .filter(item => item.type === 'image_url')
                        .map((image, idx) => (
                            <div key={idx} className="image-preview">
                                <img src={image.image_url?.url} alt={`選択された画像 ${idx + 1}`} />
                                <button onClick={() => removeImage(idx + 1)}>×</button>
                            </div>
                        ))}
                </div>
                <textarea
                    ref={inputRef}
                    value={chatInput[0]?.text || ''}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={e => {
                        setIsComposing(false);
                        handleInputChange({ target: e.target } as React.ChangeEvent<HTMLTextAreaElement>);
                    }}
                    className="chat-input"
                    placeholder={isEditMode ? 'Edit your message here...' : 'Type your message here…'}
                    data-fieldsizing="content"
                />
                {showSuggestions && (
                    <ModelSuggestions
                        inputValue={(chatInput[0]?.text?.match(/@([^@\s]*)$/) || [])[1] || ''}
                        onSelectSuggestion={selectSuggestion}
                        inputRef={inputRef}
                        className={`${mainInput ? 'newInput' : 'existingInput'}`}
                    />
                )}
            </div>

            <div className="input-container model-select-area">
                {models.map((model, idx) => (
                    <div className="model-radio" key={model}>
                        <input
                            type="checkbox"
                            id={`model-${idx}`}
                            value={model}
                            checked={selectedModels.includes(model)}
                            onChange={() => handleModelChange(model)}
                        />
                        <label htmlFor={`model-${idx}`}>{model.split('/')[1]}</label>
                    </div>
                ))}
            </div>

            <div className="input-container input-actions">
                {isGenerating ? (
                    <button
                        onClick={handleStopAllGeneration}
                        className="action-button stop-button icon-button"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            stroke="none"
                        >
                            <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                        </svg>
                        <span>
                            Stop<span className="shortcut">⌘⌫</span>
                        </span>
                    </button>

                ) : (
                    <>
                        {isEditMode && isEdited ? (
                            <>
                                <button
                                    onClick={() => handleResetAndRegenerate(messageIndex)}
                                    className="action-button reset-regenerate-button icon-button"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                                    </svg>
                                    <span>
                                        ReGenerate<span className="shortcut">⏎</span>
                                    </span>
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
                                    <span>Save Only</span>
                                </button>
                            </>
                        ) : !isEditMode && (
                            <>
                                <button
                                    onClick={e => handleSendAndResetInput(e, false)}
                                    className={`action-button send-button icon-button ${!isInputEmpty() ? 'active' : ''}`}
                                    disabled={isInputEmpty()}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                    <span>
                                        Send<span className="shortcut">⏎</span>
                                    </span>
                                </button>
                                <button
                                    onClick={e => handleSendAndResetInput(e, true)}
                                    className={`action-button send-primary-button icon-button ${!isInputEmpty() ? 'active' : ''}`}
                                    disabled={isInputEmpty()}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                    </svg>
                                    <span>
                                        Send to <code>{selectedModels[0].split('/')[1]}</code>
                                        <span className="shortcut">⌘⏎</span>
                                    </span>
                                </button>
                            </>
                        )}
                        <span className="line-break shortcut-area">
                            Line break<span className="shortcut">⇧⏎</span>
                        </span>
                    </>
                )}
            </div>
        </section>
    );
}