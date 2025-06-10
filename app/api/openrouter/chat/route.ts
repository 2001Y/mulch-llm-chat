import { NextRequest } from "next/server";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import inviteCodes from "@/config/invite-codes.json";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inviteCode, messages, model, tools, system } = body;

    // 招待コードの検証
    if (!inviteCode || typeof inviteCode !== "string") {
      return new Response(
        JSON.stringify({ error: "招待コードが提供されていません" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 招待コードに対応するAPIキーを取得（大文字小文字を区別しない）
    const normalizedCode = inviteCode.trim().toUpperCase();
    const apiKey = Object.entries(inviteCodes.codes).find(
      ([code]) => code.toUpperCase() === normalizedCode
    )?.[1];

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "無効な招待コードです" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // OpenRouterクライアントを作成
    const openrouter = createOpenRouter({
      apiKey: apiKey,
    });

    // カスタムヘッダーの設定
    const customHeaders: Record<string, string> = {
      "X-Title": "Mulch LLM Chat",
    };

    const referer = request.headers.get("referer");
    if (referer) {
      customHeaders["HTTP-Referer"] = referer;
    }

    // streamTextのオプションを構築
    const streamOptions: any = {
      model: openrouter.chat(model),
      messages: messages,
      headers: customHeaders,
    };

    if (system) {
      streamOptions.system = system;
    }

    if (tools && Object.keys(tools).length > 0) {
      streamOptions.tools = tools;
    }

    // OpenRouterにストリーミングリクエストを送信
    const result = await streamText(streamOptions);

    // ストリームをそのまま返す
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("[OpenRouter Proxy] Error:", error);

    // エラーレスポンスを返す
    return new Response(
      JSON.stringify({
        error: error.message || "チャットリクエストの処理中にエラーが発生しました",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}