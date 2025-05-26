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

    // シンプルな形式でモデル情報を返す（id, name, context_lengthのみ）
    const models = data.data.map((model: any) => ({
      id: model.id, // このidはOpenRouterのAPI呼び出し時に使用する
      name: model.name || model.id.split("/").pop(), // 名前がなければIDの最後の部分を使用
      context_length: model.context_length || 0, // コンテキスト長を追加
    }));

    console.log("[fetchOpenRouterModels] Fetched models count:", models.length);
    console.log("[fetchOpenRouterModels] Sample model:", models[0]);

    return models;
  } catch (error: any) {
    console.error("Error fetching OpenRouter models:", error);
    // エラーが発生した場合は空配列を返す（デフォルトは/api/defaultsから取得）
    return [];
  }
}
