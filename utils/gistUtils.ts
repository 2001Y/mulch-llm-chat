import { storage } from "../hooks/useLocalStorage";

export const saveToGist = async (chatId: string, chatData: any) => {
  const gistToken = storage.getGistToken();
  if (!gistToken) {
    return { success: false, message: "Gistトークンが設定されていません" };
  }

  try {
    const chatContent = JSON.stringify(chatData, null, 2);
    
    const response = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${gistToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        description: `Chat ${chatId} from Mulch LLM Chat`,
        public: false,
        files: {
          [`chat_${chatId}.json`]: {
            content: chatContent
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`APIエラー: ${response.status}`);
    }

    const data = await response.json();
    
    return { 
      success: true, 
      url: data.html_url,
      id: data.id
    };
  } catch (error) {
    console.error("Gistの保存に失敗しました:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "不明なエラー" 
    };
  }
};
