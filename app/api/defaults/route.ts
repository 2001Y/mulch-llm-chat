export async function GET() {
  try {
    // デフォルトのモデル設定
    const defaultModels = [
      "openai/gpt-4o-mini",
      "google/gemini-2.0-flash-001",
      "anthropic/claude-3-5-sonnet-20241022",
    ];

    // デフォルトのツール設定
    const defaultTools = [
      {
        type: "function",
        function: {
          name: "web_search",
          description: "インターネットで最新の情報を検索します",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "検索したいキーワードや質問",
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
          description: "数式を計算します",
          parameters: {
            type: "object",
            properties: {
              expression: {
                type: "string",
                description: "計算したい数式",
              },
            },
            required: ["expression"],
          },
        },
      },
    ];

    return Response.json({
      models: defaultModels,
      tools: defaultTools,
    });
  } catch (error) {
    console.error("Error fetching defaults:", error);
    return Response.json(
      { error: "Failed to fetch defaults" },
      { status: 500 }
    );
  }
}
