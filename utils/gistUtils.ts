import { storage } from "../hooks/useLocalStorage";

interface GistSaveResult {
  success: boolean;
  message?: string;
  url?: string;
  gistUrl?: string;
  id?: string;
  reauthRequired?: boolean;
}

export const saveToGist = async (
  chatId: string,
  chatData: any
): Promise<GistSaveResult> => {
  const gistToken = storage.getGistToken();
  if (!gistToken) {
    return { success: false, message: "Gistトークンが設定されていません" };
  }

  try {
    const chatContent = JSON.stringify(chatData, null, 2);

    const response = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${gistToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: `Chat ${chatId} from Mulch LLM Chat`,
        public: false,
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
        errorMessage =
          errorData.message || JSON.stringify(errorData) || errorMessage;
      } catch (e) {
        // JSONパースに失敗した場合は、ステータスコードのみのメッセージを使用
      }

      if (response.status === 401) {
        storage.remove("gistToken");
        storage.remove("gistOAuthSuccess");
        return {
          success: false,
          message: "GitHubの認証が無効か期限切れです。再度連携してください。",
          reauthRequired: true,
        };
      }
      throw new Error(errorMessage); // ここでthrowされたエラーは下のcatchで処理される
    }

    const data = await response.json();

    const shareUrl = `${window.location.origin}/share/${data.id}`;

    return {
      success: true,
      url: shareUrl,
      gistUrl: data.html_url,
      id: data.id,
    };
  } catch (error) {
    console.error("Gistの保存に失敗しました:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "不明なエラー",
    };
  }
};

interface GistFetchResult {
  success: boolean;
  message?: string;
  chatData?: any;
}

export const fetchFromGist = async (
  gistId: string
): Promise<GistFetchResult> => {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(`APIエラー: ${response.status}`);
    }

    const data = await response.json();

    const fileName = Object.keys(data.files).find((name) =>
      name.startsWith("chat_")
    );

    if (!fileName) {
      return {
        success: false,
        message: "チャットデータが見つかりませんでした",
      };
    }

    const fileContent = data.files[fileName].content;
    let chatData;

    try {
      chatData = JSON.parse(fileContent);
    } catch (e) {
      return {
        success: false,
        message: "チャットデータの解析に失敗しました",
      };
    }

    return {
      success: true,
      chatData,
    };
  } catch (error) {
    console.error("Gistからの取得に失敗しました:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "不明なエラー",
    };
  }
};
