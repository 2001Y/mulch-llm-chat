import { useState, useCallback } from "react";
import type { Message } from "./useMessages";

export function useGeneration(
  openai: any,
  messages: Message[],
  setMessages: (messages: Message[]) => void
) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortControllers, setAbortControllers] = useState<AbortController[]>(
    []
  );

  const handleStopAllGeneration = () => {
    abortControllers.forEach((controller) => {
      if (controller) {
        controller.abort();
      }
    });
    setAbortControllers([]);
    setIsGenerating(false);

    setMessages(
      messages.map((message) => ({
        ...message,
        llm: message.llm.map((response) => ({
          ...response,
          isGenerating: false,
        })),
      }))
    );
  };

  const handleStop = (messageIndex: number, responseIndex: number) => {
    if (abortControllers[responseIndex]) {
      abortControllers[responseIndex].abort();
      const newControllers = [...abortControllers];
      newControllers[responseIndex] = null as any;
      setAbortControllers(newControllers);
    }
  };

  const fetchChatResponse = useCallback(
    async (
      model: string,
      messageIndex: number,
      responseIndex: number,
      abortController: AbortController,
      inputContent: any
    ) => {
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        if (newMessages[messageIndex]?.llm[responseIndex]) {
          newMessages[messageIndex].llm[responseIndex].isGenerating = true;
        }
        return newMessages;
      });

      try {
        const pastMessages = messages.slice(0, messageIndex).flatMap((msg) => {
          const userContent = Array.isArray(msg.user)
            ? msg.user
                .filter((item) => item.type === "text")
                .map((item) => item.text)
                .join("")
            : msg.user;
          const selectedResponses = msg.llm
            .filter((r) => r.selected)
            .sort((a, b) => (a.selectedOrder || 0) - (b.selectedOrder || 0));
          return [
            { role: "user", content: userContent },
            ...selectedResponses.map((r) => ({
              role: "assistant",
              content: r.text,
            })),
          ];
        });

        const response = await openai.chat.completions.create(
          {
            model,
            messages: [
              ...pastMessages,
              {
                role: "user",
                content: inputContent,
              },
            ],
            stream: true,
          },
          { signal: abortController.signal }
        );

        let accumulatedText = "";
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || "";
          accumulatedText += content;

          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            if (newMessages[messageIndex]?.llm[responseIndex]) {
              newMessages[messageIndex].llm[responseIndex].text =
                accumulatedText;
            }
            return newMessages;
          });
        }

        setMessages((prevMessages) => {
          const newMessages = [...prevMessages];
          if (newMessages[messageIndex]?.llm[responseIndex]) {
            newMessages[messageIndex].llm[responseIndex].isGenerating = false;
          }
          return newMessages;
        });
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("生成が中止されました");
        } else {
          console.error("生成中にエラーが発生しました:", error);
        }

        setMessages((prevMessages) => {
          const newMessages = [...prevMessages];
          if (newMessages[messageIndex]?.llm[responseIndex]) {
            newMessages[messageIndex].llm[responseIndex].isGenerating = false;
          }
          return newMessages;
        });
      }
    },
    [messages, setMessages, openai]
  );

  const handleRegenerate = async (
    messageIndex: number,
    responseIndex: number,
    model: string
  ) => {
    const abortController = new AbortController();
    setAbortControllers((prev) => {
      const newControllers = [...prev];
      newControllers[responseIndex] = abortController;
      return newControllers;
    });

    setMessages((prevMessages) => {
      const newMessages = [...prevMessages];
      if (newMessages[messageIndex]?.llm[responseIndex]) {
        newMessages[messageIndex].llm[responseIndex].text = "";
      }
      return newMessages;
    });

    setIsGenerating(true);
    await fetchChatResponse(
      model,
      messageIndex,
      responseIndex,
      abortController,
      messages[messageIndex].user
    );
    setIsGenerating(false);
  };

  return {
    isGenerating,
    setIsGenerating,
    handleStopAllGeneration,
    handleStop,
    handleRegenerate,
    fetchChatResponse,
  };
}
