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
    const modelIds = data.data.map((model: any) => ({
      fullId: model.id,
      shortId: model.id.split("/").pop(), // shortIdもここで生成してしまう
    }));
    return modelIds;
  } catch (error: any) {
    console.error("Error fetching OpenRouter models:", error);
    // エラーを再スローするか、特定の形式でエラー情報を返す
    // ここでは、呼び出し側で処理しやすいように加工したエラー情報を返すことも検討できる
    throw new Error(`Could not fetch models from OpenRouter: ${error.message}`);
  }
}
