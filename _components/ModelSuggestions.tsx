import React, { useState, useEffect, useCallback, RefObject } from 'react';

interface ModelSuggestionsProps {
    inputValue: string;
    onSelectSuggestion: (suggestion: string) => void;
    inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement>;
    className?: string; // 新しいプロパティを追加
}

interface OpenRouterModel {
    id: string;
    name: string;
}

export default function ModelSuggestions({ inputValue, onSelectSuggestion, inputRef, className }: ModelSuggestionsProps) {
    const [suggestions, setSuggestions] = useState<OpenRouterModel[]>([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

    useEffect(() => {
        fetchSuggestions(inputValue);
    }, [inputValue]);

    const fetchSuggestions = async (query: string) => {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models');
            const data = await response.json();
            if (query.length > 0) {
                const filteredModels = data.data.filter((model: OpenRouterModel) =>
                    model.id.toLowerCase().includes(query.toLowerCase())
                );
                // 完全一致のモデルがある場合は、サジェストしない
                const exactMatch = filteredModels.find((model: OpenRouterModel) =>
                    model.id.toLowerCase() === query.toLowerCase()
                );
                setSuggestions(exactMatch ? [] : filteredModels);
            } else {
                setSuggestions(data.data);
            }
            setActiveSuggestionIndex(-1);
        } catch (error) {
            console.error('モデルの取得に失敗しました:', error);
            setSuggestions([]);
            setActiveSuggestionIndex(-1);
        }
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // この行を追加
            if (activeSuggestionIndex !== -1 && activeSuggestionIndex < suggestions.length) {
                onSelectSuggestion(suggestions[activeSuggestionIndex].id);
                setSuggestions([]);
                setActiveSuggestionIndex(-1);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault(); // この行を追加
            e.stopPropagation(); // この行を追加
            setSuggestions([]);
            setActiveSuggestionIndex(-1);
            inputRef.current?.blur();
        }
    }, [suggestions, activeSuggestionIndex, onSelectSuggestion, inputRef]);

    useEffect(() => {
        const currentInput = inputRef.current;
        if (currentInput) {
            const typedHandleKeyDown = (e: Event) => {
                if (e instanceof KeyboardEvent) {
                    handleKeyDown(e as unknown as React.KeyboardEvent);
                }
            };
            currentInput.addEventListener('keydown', typedHandleKeyDown);
            return () => {
                currentInput.removeEventListener('keydown', typedHandleKeyDown);
            };
        }
    }, [handleKeyDown, inputRef]);

    return (
        <ul className={`suggestions-list ${className || ''}`}>
            {suggestions.map((suggestion, index) => (
                <li
                    key={suggestion.id}
                    className={index === activeSuggestionIndex ? 'active' : ''}
                    onClick={() => {
                        onSelectSuggestion(suggestion.id);
                        setSuggestions([]);
                        setActiveSuggestionIndex(-1);
                    }}
                >
                    {suggestion.id.split('/')[1]}
                </li>
            ))}
        </ul>
    );
}