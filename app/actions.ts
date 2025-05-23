"use server";

export async function fetchOpenRouterModels() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    if (!response.ok) {
      // レスポンスがエラーの場合、エラーメッセージを投げるか、エラーオブジェクトを返す
      const errorData = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(
        `Failed to fetch models: ${response.status} ${
          errorData.message || response.statusText
        }`
      );
    }
    const data = await response.json();

    // モデルの形式を修正：id, nameという形で返す
    const models = data.data.map((model: any) => ({
      id: model.id, // このidはOpenRouterのAPI呼び出し時に使用する
      name: model.name || model.id.split("/").pop(), // 名前がなければIDの最後の部分を使用
    }));

    // デフォルトモデルを先頭に追加
    models.unshift({
      id: "openrouter/auto",
      name: "Auto (recommended)",
    });

    console.log("[fetchOpenRouterModels] Fetched models count:", models.length);
    console.log("[fetchOpenRouterModels] Sample model:", models[0]);

    return models;
  } catch (error: any) {
    console.error("Error fetching OpenRouter models:", error);
    // エラーが発生した場合でもデフォルトモデルだけは返す
    return [
      {
        id: "openrouter/auto",
        name: "Auto (recommended)",
      },
      {
        id: "anthropic/claude-3.5-sonnet",
        name: "Claude 3.5 Sonnet",
      },
    ];
  }
}
