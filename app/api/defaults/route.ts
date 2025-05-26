import { NextResponse } from "next/server";

export async function GET() {
  try {
    const defaults = {
      models: [
        "openai/gpt-4o-mini",
        "google/gemini-2.0-flash-001",
        "anthropic/claude-3-5-sonnet-20241022",
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web for current information",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query",
                },
              },
              required: ["query"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "calculate",
            description: "Perform mathematical calculations",
            parameters: {
              type: "object",
              properties: {
                expression: {
                  type: "string",
                  description: "Mathematical expression to evaluate",
                },
              },
              required: ["expression"],
            },
          },
        },
      ],
      // カテゴリ別プリセット
      categories: {
        最高性能: {
          name: "最高性能",
          description: "最新の高性能モデル",
          count: 5,
          models: [
            "anthropic/claude-opus-4",
            "anthropic/claude-sonnet-4",
            "openai/gpt-4o",
            "google/gemini-2.0-flash-001",
            "openai/gpt-4-turbo",
          ],
        },
        コスパ優秀: {
          name: "コスパ優秀",
          description: "価格と性能のバランスが良いモデル",
          count: 3,
          models: [
            "openai/gpt-4o-mini",
            "anthropic/claude-3-5-haiku",
            "google/gemini-1.5-flash",
          ],
        },
        オープンソース: {
          name: "オープンソース",
          description: "オープンソースの高性能モデル",
          count: 5,
          models: [
            "meta-llama/llama-3.3-70b-instruct",
            "meta-llama/llama-3.1-8b-instruct",
            "mistralai/mistral-large",
            "mistralai/devstral-small",
            "deepseek/deepseek-r1",
          ],
        },
        高速: {
          name: "高速",
          description: "レスポンスが高速なモデル",
          count: 2,
          models: ["groq/llama-3.1-70b-versatile", "groq/gemma2-9b-it"],
        },
      },
    };

    return NextResponse.json(defaults);
  } catch (error) {
    console.error("Error in defaults API:", error);
    return NextResponse.json(
      { error: "Failed to fetch defaults" },
      { status: 500 }
    );
  }
}
