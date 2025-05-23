import type {
  ChatCompletionContentPartImage as OpenAIChatCompletionContentPartImage,
  ChatCompletionContentPartText as OpenAIChatCompletionContentPartText,
  ChatCompletionUserMessageParam,
} from "openai/resources/chat/completions";

export type ChatCompletionContentPart =
  | OpenAIChatCompletionContentPartText
  | OpenAIChatCompletionContentPartImage;

// MarkdownをChatCompletionContentPart[]にパースするヘルパー関数
export const parseMarkdownToContentParts = (
  markdown: string
): ChatCompletionContentPart[] => {
  if (!markdown || typeof markdown !== "string") return [];

  const parts: ChatCompletionContentPart[] = [];
  // さらに修正された正規表現
  const imageRegex =
    /!\[(.*?)?\]\((data:image\/[^;]+;base64,[^\)]+|(?:https?:)?\/\/[^\)]+)\)|<img\s+src=(?:\"([^\"]*)\"|'([^']*)')[^>]*>/gi;

  let lastIndex = 0;
  let match;

  while ((match = imageRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        text: markdown.substring(lastIndex, match.index),
      });
    }
    const imageUrl = match[2] || match[3] || match[4]; // Group 2 for ![](), Group 3 for src="", Group 4 for src=''
    if (imageUrl) {
      parts.push({
        type: "image_url",
        image_url: { url: imageUrl, detail: "auto" },
      });
    }
    lastIndex = imageRegex.lastIndex;
  }
  if (lastIndex < markdown.length) {
    parts.push({ type: "text", text: markdown.substring(lastIndex) });
  }
  return parts.filter((part) => !(part.type === "text" && !part.text?.trim()));
};
