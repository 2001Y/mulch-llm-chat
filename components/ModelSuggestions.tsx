import React, { useState, useEffect, useCallback, useRef } from "react";

interface ModelSuggestionsProps {
  inputValue: string;
  onSelectSuggestion: (suggestion: string) => void;
  cursorRect?: {
    top: number;
    left: number;
    height: number;
    bottom: number;
    right: number;
  } | null;
  className?: string;
  show: boolean;
  parentRef?: React.RefObject<HTMLElement | null>;
}

interface OpenRouterModel {
  id: string;
  name: string;
}

export default function ModelSuggestions({
  inputValue,
  onSelectSuggestion,
  cursorRect,
  className,
  show,
  parentRef,
}: ModelSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<OpenRouterModel[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!show || !inputValue.trim()) {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      return;
    }
    fetchSuggestions(inputValue.replace(/^@/, "").trim());
  }, [inputValue, show]);

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
    (event: KeyboardEvent) => {
      if (!show || suggestions.length === 0) return;

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
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        if (
          activeSuggestionIndex !== -1 &&
          activeSuggestionIndex < suggestions.length
        ) {
          handleSuggestionSelect(suggestions[activeSuggestionIndex].id);
        } else if (suggestions.length > 0 && event.key === "Enter") {
          // Enterで一番上の候補を選択 (アクティブなものがなくても)
          // handleSuggestionSelect(suggestions[0].id);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
      }
    },
    [show, suggestions, activeSuggestionIndex, handleSuggestionSelect]
  );

  useEffect(() => {
    if (show) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [show, handleKeyDown]);

  useEffect(() => {
    if (activeSuggestionIndex >= 0) {
      const activeElement = document.querySelector(".suggestions-list .active");
      activeElement?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeSuggestionIndex]);

  if (!show || !parentRef?.current) {
    return null;
  }

  const calculatePosition = () => {
    if (!parentRef?.current) {
      return { top: "auto", left: "auto", width: "auto" };
    }
    const parentRect = parentRef.current.getBoundingClientRect();
    const top = parentRef.current.offsetHeight;
    const left = 0;
    const width = parentRef.current.offsetWidth;

    return { top: `${top}px`, left: `${left}px`, width: `${width}px` };
  };

  return (
    <ul
      ref={listRef}
      className={`suggestions-list ${className || ""}`}
      style={{
        position: "absolute",
        ...calculatePosition(),
        zIndex: 10,
      }}
    >
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
