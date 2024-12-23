import React, {
  useState,
  useEffect,
  useCallback,
  MutableRefObject,
} from "react";

interface ModelSuggestionsProps {
  inputValue: string;
  onSelectSuggestion: (suggestion: string) => void;
  inputRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
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

    console.log("Current cursor position:", cursorPosition);
    console.log("Text before cursor:", textBeforeCursor);
    console.log("Text after cursor:", textAfterCursor);

    const currentModel = textBeforeCursor.replace(/^@/, "").trim();
    console.log("Extracted model query:", currentModel);
    return currentModel;
  }, [inputValue, inputRef]);

  useEffect(() => {
    const currentQuery = getCurrentModelQuery();
    fetchSuggestions(currentQuery);
  }, [inputValue, getCurrentModelQuery]);

  const fetchSuggestions = async (query: string) => {
    try {
      console.log("Fetching suggestions with query:", query);
      const response = await fetch("https://openrouter.ai/api/v1/models");
      const data = await response.json();
      if (query.length > 0) {
        console.log("Filtering models for query:", query);
        const calculateSimilarity = (str1: string, str2: string): number => {
          str1 = str1.toLowerCase();
          str2 = str2.toLowerCase();

          if (str1 === str2) return 1;
          if (str1.includes(str2) || str2.includes(str1)) return 0.8;

          const chars1 = str1.split("");
          const chars2 = str2.split("");
          const matchCount = chars1.filter((char) =>
            chars2.includes(char)
          ).length;
          return matchCount / Math.max(chars1.length, chars2.length);
        };

        const filteredModels = data.data
          .map((model: OpenRouterModel) => {
            const shortId = model.id.split("/").pop()?.toLowerCase() || "";
            const similarity = calculateSimilarity(
              shortId,
              query.toLowerCase()
            );
            return { ...model, similarity };
          })
          .filter((model: any) => model.similarity > 0.2)
          .sort((a: any, b: any) => b.similarity - a.similarity);

        console.log("Filtered models:", filteredModels);
        setSuggestions(filteredModels);
      } else {
        console.log("No query, showing all models");
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
    (event: React.KeyboardEvent | KeyboardEvent) => {
      if (suggestions.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (
          activeSuggestionIndex !== -1 &&
          activeSuggestionIndex < suggestions.length
        ) {
          handleSuggestionSelect(suggestions[activeSuggestionIndex].id);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        inputRef.current?.blur();
      }
    },
    [suggestions, activeSuggestionIndex, handleSuggestionSelect, inputRef]
  );

  useEffect(() => {
    const currentInput = inputRef.current;
    if (currentInput) {
      currentInput.addEventListener("keydown", handleKeyDown as EventListener);
      return () => {
        currentInput.removeEventListener(
          "keydown",
          handleKeyDown as EventListener
        );
      };
    }
  }, [handleKeyDown, inputRef]);

  // アクティブな要素が変更されたときのスクロール処理
  useEffect(() => {
    if (activeSuggestionIndex >= 0) {
      const activeElement = document.querySelector(".suggestions-list .active");
      activeElement?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeSuggestionIndex]);

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
