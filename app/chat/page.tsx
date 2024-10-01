"use client";

import { useEffect, useState } from "react";
import "@/styles/chat.scss";
import styles from "./ChatList.module.scss"; // モジュールCSSをインポート
import { useChatLogic } from "_hooks/useChatLogic"; // カスタムフックをインポート
import InputSection from "_components/InputSection";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import useAccessToken from "_hooks/useAccessToken";
import ModelInputModal from "_components/SettingsModal";
import useStorageState from "_hooks/useLocalStorage";
import { useOpenAI } from "_hooks/useOpenAI";

interface ChatItem {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: number;
}

export default function ChatListPage() {
  const {
    models,
    setModels,
    selectedModels,
    setSelectedModels,
    chatInput,
    setChatInput,
    isGenerating,
  } = useChatLogic();

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useAccessToken();
  const [demoAccessToken] = useState(process.env.NEXT_PUBLIC_DEMO || "");
  const [demoModels] = useState<string[]>([
    "google/gemma-2-9b-it:free",
    "google/gemma-7b-it:free",
    "meta-llama/llama-3-8b-instruct:free",
    "openchat/openchat-7b:free",
  ]);
  const [tools, setTools] = useStorageState("tools", [
    {
      type: "function",
      function: {
        name: "get_current_weather",
        description: "現在の天気を取得する",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "場所（例：東京）",
            },
            unit: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              description: "温度の単位",
              default: "celsius",
            },
          },
          required: ["location"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "transfer_funds",
        description: "振込を行う",
        parameters: {
          type: "object",
          properties: {
            account_to: {
              type: "string",
              description: "送金先の口座番号",
            },
            amount: {
              type: "number",
              description: "送金額",
            },
          },
          required: ["account_to", "amount"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_account",
        description: "名前から口座名を検索する",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "検索する名前（姓または名）",
            },
          },
          required: ["name"],
        },
      },
    },
    // 他のツールここに追加
  ]);

  type ToolFunction = (args: any) => any;

  const [toolFunctions, setToolFunctions] = useStorageState<
    Record<string, ToolFunction>
  >("toolFunctions", {
    get_current_weather: (args: any) => {
      const { location = "Tokyo", unit = "celsius" } = args;
      const randomTemperature = () => (Math.random() * 40 - 10).toFixed(1);
      const randomWeather = () => {
        const weatherConditions = ["晴れ", "曇り", "雨", "雪"];
        return weatherConditions[
          Math.floor(Math.random() * weatherConditions.length)
        ];
      };

      const temperature = randomTemperature();
      const weather = randomWeather();

      return {
        location: location,
        temperature:
          unit === "fahrenheit"
            ? ((parseFloat(temperature) * 9) / 5 + 32).toFixed(1)
            : temperature,
        unit: unit,
        weather: weather,
      };
    },
    transfer_funds: (args: any) => {
      const { account_to, amount } = args;
      return {
        status: "success",
        message: `振込が成功しました: ${amount}円を送金しました。`,
      };
    },
    search_account: (args: any) => {
      const { name } = args;
      const accounts = [
        { name: "田中太郎", account: "1234567890" },
        { name: "田中花子", account: "2345678901" },
        { name: "田中一郎", account: "3456789012" },
        { name: "佐藤次郎", account: "4567890123" },
        { name: "鈴木三郎", account: "5678901234" },
      ];

      const matchedAccounts = accounts.filter((account) =>
        account.name.includes(name)
      );

      if (matchedAccounts.length === 0) {
        return { message: "該当する口座が見つかりませんでした。" };
      }

      return {
        message: "以下の口座が見つかりました：",
        accounts: matchedAccounts.map(
          (account) => `${account.name}: ${account.account}`
        ),
      };
    },
    // 他のー尔函数をここに加
  });
  const router = useRouter();

  // ローカルストレージからチャットリストを取得
  useEffect(() => {
    const chatItems: ChatItem[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("chatMessages_")) {
        const chatId = key.replace("chatMessages_", "");
        const chatData = JSON.parse(localStorage.getItem(key) || "[]");
        if (chatData.length > 0) {
          const lastMessage = chatData[chatData.length - 1];
          chatItems.push({
            id: chatId,
            title: `Chat ${chatId}`,
            lastMessage: lastMessage.user[0]?.text || "No messages",
            timestamp: lastMessage.timestamp || Date.now(),
          });
        }
      }
    }
    setChats(chatItems.sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  // メッセージ送信時にチャットIDを作成し、ローカルストレージに保存してから遷移
  const handleSend = (
    event:
      | React.FormEvent<HTMLFormElement>
      | React.MouseEvent<HTMLButtonElement>,
    isPrimaryOnly = false
  ) => {
    event.preventDefault();
    if (isGenerating) return;

    // 新しいチャットIDを作成
    const newChatId = Date.now().toString();

    // 初期メッセージを作成してローカルストレージに保存
    const initialMessage = {
      user: chatInput,
      llm: selectedModels.map((model) => ({
        role: "assistant",
        model,
        text: "",
        selected: false,
        isGenerating: true,
      })),
      timestamp: Date.now(),
    };

    const messages = [initialMessage];

    // ローカルストレージに保存
    localStorage.setItem(`chatMessages_${newChatId}`, JSON.stringify(messages));

    // チャットページに遷移
    router.push(`/chat/${newChatId}`);
  };

  useEffect(() => {
    setIsLoggedIn(!!accessToken);
  }, [accessToken]);

  const handleLogout = () => {
    setAccessToken("");
    setModels(demoModels); // Ensure setModels is defined
    setSelectedModels(demoModels);
    // その他の必要なステート更新
  };

  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // チャットを削除する関数を修正
  const handleDelete = (chatId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    localStorage.removeItem(`chatMessages_${chatId}`);
    setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
    setActiveMenu(null);
  };

  // メニューを開く関数を追加
  const handleOpenMenu = (chatId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveMenu(activeMenu === chatId ? null : chatId);
  };

  return (
    <>
      <header>
        <div className="logo">
          <Image
            src="/logo.png"
            width={40}
            height={40}
            alt="Logo"
            className="logo-img"
          />
          <h1>
            Multi AI Chat
            <br />
            <small>OpenRouter Chat Client</small>
          </h1>
        </div>
        <div className="header-side">
          {isLoggedIn ? (
            <button onClick={handleLogout}>Logout</button>
          ) : (
            <button onClick={() => router.push("/login")} className="login">
              Login
            </button>
          )}
          <div onClick={() => setIsModalOpen(!isModalOpen)} className="setting">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 .33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
        </div>
        {!isLoggedIn && <div className="free-version">Free Version</div>}
      </header>

      <div className={styles.chatList}>
        <ul>
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link href={`/chat/${chat.id}`}>
                <div className={styles.chatItem}>
                  <h3>{chat.title}</h3>
                  <p>{chat.lastMessage}</p>
                  <small>{new Date(chat.timestamp).toLocaleString()}</small>
                  <button
                    className={styles.moreButton}
                    onClick={(e) => handleOpenMenu(chat.id, e)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <circle cx="6" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="18" cy="12" r="2" />
                    </svg>
                  </button>
                  {activeMenu === chat.id && (
                    <div className={styles.menuPopup}>
                      <ul>
                        <li onClick={(e) => handleDelete(chat.id, e)}>
                          チャットを消す
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <InputSection
        mainInput={true}
        models={models}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleSend={handleSend}
        selectedModels={selectedModels}
        setSelectedModels={setSelectedModels}
        isEditMode={false}
        messageIndex={0}
        handleResetAndRegenerate={() => {}}
        handleSaveOnly={() => {}}
        isInitialScreen={true}
        handleStopAllGeneration={() => {}}
        isGenerating={isGenerating}
      />

      <ModelInputModal
        models={isLoggedIn ? models : demoModels}
        setModels={isLoggedIn ? setModels : () => {}}
        isModalOpen={isModalOpen}
        closeModal={() => setIsModalOpen(false)}
        tools={tools}
        setTools={setTools}
        toolFunctions={toolFunctions}
        setToolFunctions={
          setToolFunctions as unknown as (
            toolFunctions: Record<string, Function>
          ) => void
        }
      />
    </>
  );
}
