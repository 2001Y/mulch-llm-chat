"use client";

import { useEffect, useState } from "react";
import "@/styles/chat.scss";
import { useChatLogic } from "_hooks/useChatLogic";
import InputSection from "_components/InputSection";
import { useRouter } from "next/navigation";
import useAccessToken from "_hooks/useAccessToken";
import ModelInputModal from "_components/SettingsModal";
import useStorageState from "_hooks/useLocalStorage";
import Header from "_components/Header";

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accessToken, setAccessToken] = useAccessToken();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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

  useEffect(() => {
    setIsLoggedIn(!!accessToken);
  }, [accessToken]);

  // ロッセージ送信時にチャットIDを作成し、ローカルストレージに保存してから遷移
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

    // ストレージ変更イベントを発火
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: `chatMessages_${newChatId}`,
        newValue: JSON.stringify(messages),
      })
    );

    // チャットページに遷移
    router.push(`/${newChatId}`);
  };

  const handleLogout = () => {
    setAccessToken("");
    setModels(demoModels);
    setSelectedModels(demoModels);
  };

  return (
    <>
      <Header setIsModalOpen={setIsModalOpen} isLoggedIn={isLoggedIn} />

      <div className="new-chat-container">
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
      </div>

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
