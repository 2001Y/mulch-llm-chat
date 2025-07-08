import { storage } from "../hooks/useLocalStorage";
import { fetchFromGist, saveToGist } from "./gistUtils";

export interface ShareStatus {
  isPublished: boolean;
  gistId?: string;
  shareUrl?: string;
  needsUpdate: boolean;
}

/**
 * ローカルストレージに保存されている gistId を元に、
 * 既に公開済みかどうかを判定し、必要に応じて差分を計算する
 */
export const getShareStatus = async (
  chatId: string,
  chatData: any
): Promise<ShareStatus> => {
  const storedGistIdKey = `gistId_${chatId}`;
  const gistId = storage.get(storedGistIdKey) as string | undefined;
  if (!gistId) {
    // 未公開
    return { isPublished: false, needsUpdate: false };
  }

  // 既に公開済み。Gist からデータを取得して差分を確認
  const fetchResult = await fetchFromGist(gistId);
  if (!fetchResult.success || !fetchResult.chatData) {
    // Gist が削除されているなど
    storage.remove(storedGistIdKey);
    return { isPublished: false, needsUpdate: false };
  }

  const isSame =
    JSON.stringify(fetchResult.chatData) === JSON.stringify(chatData);

  const shareUrl = `${window.location.origin}/share/${gistId}`;

  return {
    isPublished: true,
    gistId,
    shareUrl,
    needsUpdate: !isSame,
  };
};

interface ShareActionResult {
  success: boolean;
  message?: string;
  shareUrl?: string;
  gistId?: string;
}

/**
 * 新規にチャットを Gist として公開し、ローカルストレージへ gistId を保存
 */
export const publishChat = async (
  chatId: string,
  chatData: any
): Promise<ShareActionResult> => {
  const result = await saveToGist(chatId, chatData);
  if (result.success && result.id) {
    storage.set(`gistId_${chatId}`, result.id);
  }
  return {
    success: result.success,
    message: result.message,
    shareUrl: result.url,
    gistId: result.id,
  };
};

/**
 * 既存の Gist を更新
 */
export const updateChatGist = async (
  chatId: string,
  chatData: any,
  gistId: string
): Promise<ShareActionResult> => {
  const gistToken = storage.getGistToken();
  if (!gistToken) {
    return {
      success: false,
      message: "Gistトークンがありません。再認証してください。",
    };
  }

  try {
    const chatContent = JSON.stringify(chatData, null, 2);

    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${gistToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: {
          [`chat_${chatId}.json`]: {
            content: chatContent,
          },
        },
      }),
    });

    if (!response.ok) {
      let errorMessage = `Gist APIエラー: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (_) {}
      if (response.status === 401) {
        storage.remove("gistToken");
        storage.remove("gistOAuthSuccess");
        return {
          success: false,
          message: "GitHub認証が無効か期限切れです。再認証してください。",
        };
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const shareUrl = `${window.location.origin}/share/${data.id}`;

    return {
      success: true,
      shareUrl,
      gistId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "不明なエラー",
    };
  }
};
