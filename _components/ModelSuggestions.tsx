import React, { useState, useEffect, useCallback, RefObject } from "react";

interface ModelSuggestionsProps {
  inputValue: string;
  onSelectSuggestion: (suggestion: string) => void;
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement>;
  className?: string;
}

interface OpenRouterModel {
  id: string;
  name: string;
}

export default function ModelSuggestions({
  inputValue,
  onSelectSuggestion,
  inputRef,
  className,
}: ModelSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<OpenRouterModel[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const getCurrentModelQuery = useCallback(() => {
    const input = inputRef.current;
    if (!input) return "";

    const cursorPosition = input.selectionStart || 0;
    const textBeforeCursor = inputValue.slice(0, cursorPosition);
    const textAfterCursor = inputValue.slice(cursorPosition);

    const beforeMatch = textBeforeCursor.match(/@[^@\s]*$/);
    if (!beforeMatch) return "";

    if (beforeMatch[0] === "@") return "";

    const afterMatch = textAfterCursor.match(/^[^@\s]*/);
    const currentModel =
      beforeMatch[0].slice(1) + (afterMatch ? afterMatch[0] : "");
    return currentModel;
  }, [inputValue, inputRef]);

  useEffect(() => {
    const currentQuery = getCurrentModelQuery();
    fetchSuggestions(currentQuery);
  }, [inputValue, getCurrentModelQuery]);

  const fetchSuggestions = async (query: string) => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models");
      const data = await response.json();
      if (query.length > 0) {
        const filteredModels = data.data.filter((model: OpenRouterModel) =>
          model.id.toLowerCase().includes(query.toLowerCase())
        );
        const exactMatch = filteredModels.find(
          (model: OpenRouterModel) =>
            model.id.toLowerCase() === query.toLowerCase()
        );
        setSuggestions(exactMatch ? [] : filteredModels);
      } else {
        setSuggestions(data.data);
      }
      setActiveSuggestionIndex(-1);
    } catch (error) {
      console.error("モデルの取得に失敗しました:", error);
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  };

  const handleSuggestionSelect = useCallback(
    (selectedModel: string) => {
      onSelectSuggestion(selectedModel);
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
    },
    [onSelectSuggestion]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (
          activeSuggestionIndex !== -1 &&
          activeSuggestionIndex < suggestions.length
        ) {
          handleSuggestionSelect(suggestions[activeSuggestionIndex].id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        inputRef.current?.blur();
      }
    },
    [suggestions, activeSuggestionIndex, handleSuggestionSelect]
  );

  useEffect(() => {
    const currentInput = inputRef.current;
    if (currentInput) {
      const typedHandleKeyDown = (e: Event) => {
        if (e instanceof KeyboardEvent) {
          handleKeyDown(e as unknown as React.KeyboardEvent);
        }
      };
      currentInput.addEventListener("keydown", typedHandleKeyDown);
      return () => {
        currentInput.removeEventListener("keydown", typedHandleKeyDown);
      };
    }
  }, [handleKeyDown, inputRef]);

  return (
    <ul className={`suggestions-list ${className || ""}`}>
      {suggestions.map((suggestion, index) => (
        <li
          key={suggestion.id}
          className={index === activeSuggestionIndex ? "active" : ""}
          onClick={() => handleSuggestionSelect(suggestion.id)}
        >
          {suggestion.id.split("/")[1]}
        </li>
      ))}
    </ul>
  );
}
