import { NextResponse } from "next/server";

export async function GET() {
  try {
    const defaults = {
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "指定された場所の天気情報を取得する",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "天気を調べたい場所（都市名）",
                },
              },
              required: ["location"],
            },
          },
          implementation: `function(args) {
  const location = args.location;
  
  // 実際の天気APIとの連携が必要
  // ここではデモ用の模擬データを返す
  const weatherData = {
    location: location,
    weather: "晴れ",
    temperature: "25°C",
    humidity: "60%",
    windSpeed: "5km/h",
    forecast: [
      { time: "今日", condition: "晴れ", temp: "25°C" },
      { time: "明日", condition: "曇り", temp: "22°C" },
      { time: "明後日", condition: "雨", temp: "18°C" }
    ],
    timestamp: new Date().toISOString(),
    note: "これはデモ用の模擬天気データです。実際の天気APIとの統合が必要です。"
  };
  
  return weatherData;
}`,
          enabled: true,
          category: "天気",
        },
        {
          type: "function",
          function: {
            name: "bank_transfer",
            description: "銀行振込を実行する",
            parameters: {
              type: "object",
              properties: {
                amount: {
                  type: "number",
                  description: "振込金額（円）",
                },
                recipient: {
                  type: "string",
                  description: "振込先名義",
                },
                account_number: {
                  type: "string",
                  description: "振込先口座番号",
                },
                bank_name: {
                  type: "string",
                  description: "振込先銀行名",
                },
                memo: {
                  type: "string",
                  description: "振込メモ（任意）",
                },
              },
              required: ["amount", "recipient", "account_number", "bank_name"],
            },
          },
          implementation: `function(args) {
  const { amount, recipient, account_number, bank_name, memo } = args;
  
  // セキュリティチェック
  if (amount <= 0 || amount > 1000000) {
    throw new Error("振込金額は1円以上100万円以下で指定してください。");
  }
  
  // 実際の銀行APIとの連携が必要
  // ここではデモ用の模擬レスポンスを返す
  const transferId = "TXN" + Date.now();
  
  return {
    transferId: transferId,
    status: "完了（デモ）",
    amount: amount,
    recipient: recipient,
    accountNumber: account_number,
    bankName: bank_name,
    memo: memo || "",
    processedAt: new Date().toISOString(),
    fee: Math.ceil(amount * 0.001), // 仮の手数料計算
    note: "これはデモ用の模擬振込です。実際の銀行APIとの統合が必要です。",
    warning: "実際の振込は行われていません。"
  };
}`,
          enabled: true,
          category: "金融",
        },
        {
          type: "function",
          function: {
            name: "lookup_transfer_destination",
            description: "振込先の口座情報を検索・確認する",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "検索したい名前または会社名",
                },
                bank_name: {
                  type: "string",
                  description: "銀行名（任意）",
                },
              },
              required: ["name"],
            },
          },
          implementation: `function(args) {
  const { name, bank_name } = args;
  
  // 実際の金融機関データベースとの連携が必要
  // ここではデモ用の模擬データを返す
  const mockResults = [
    {
      name: name,
      bankName: bank_name || "みずほ銀行",
      branchName: "新宿支店",
      accountType: "普通",
      accountNumber: "1234567",
      verified: true,
      lastUpdated: "2024-01-15"
    },
    {
      name: name + "（別支店）",
      bankName: bank_name || "三菱UFJ銀行",
      branchName: "渋谷支店",
      accountType: "当座",
      accountNumber: "9876543",
      verified: false,
      lastUpdated: "2023-12-20"
    }
  ];
  
  return {
    searchQuery: name,
    searchBank: bank_name || "全銀行",
    results: mockResults,
    resultCount: mockResults.length,
    timestamp: new Date().toISOString(),
    note: "これはデモ用の模擬検索結果です。実際の金融機関データベースとの統合が必要です。",
    warning: "実際の口座情報は表示されていません。"
  };
}`,
          enabled: true,
          category: "金融",
        },
      ],
      // カテゴリ別プリセット
      categories: {
        最高性能: {
          name: "最高性能",
          description: "最新の高性能モデル",
          count: 9,
          models: [
            "anthropic/claude-opus-4",
            "google/gemini-2.5-pro-preview",
            "openai/gpt-4.5-preview",
            "openai/o3",
            "openai/o1-pro",
            "x-ai/grok-3-beta",
            "qwen/qwen3-235b-a22b",
            "microsoft/phi-4-reasoning-plus",
            "amazon/nova-pro-v1",
          ],
        },
        コスパ優秀: {
          name: "コスパ優秀",
          description: "価格と性能のバランスが良いモデル",
          count: 6,
          models: [
            "anthropic/claude-sonnet-4",
            "openai/gpt-4o",
            "openai/o3-mini",
            "google/gemini-2.5-flash-preview",
          ],
        },
        高速: {
          name: "高速",
          description: "レスポンスが高速なモデル",
          count: 5,
          models: [
            "anthropic/claude-3.5-haiku",
            "openai/gpt-4o-mini",
            "google/gemini-2.0-flash-001",
            "qwen/qwen3-8b:free",
          ],
        },
        オープンソース: {
          name: "オープンソース",
          description: "オープンソースの高性能モデル",
          count: 5,
          models: [
            "meta-llama/llama-4-maverick",
            "qwen/qwen3-235b-a22b",
            "cohere/command-r-plus",
            "mistralai/mixtral-8x22b-instruct",
            "cognitivecomputations/dolphin-mixtral-8x22b",
            "thedrummer/valkyrie-49b-v1",
          ],
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
