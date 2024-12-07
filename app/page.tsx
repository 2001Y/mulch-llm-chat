"use client";

import { useEffect, useState } from "react";
import "@/styles/chat.scss";
import { useChatLogic } from "hooks/useChatLogic";
import InputSection from "components/InputSection";
import { useRouter } from "next/navigation";
import useAccessToken from "hooks/useAccessToken";
import ModelInputModal from "components/SettingsModal";
import useStorageState from "hooks/useLocalStorage";
import Header from "components/Header";
import ChatList from "components/ChatList";
import BentoFeatures from "components/BentoFeatures";

export default function ChatListPage() {
  const {
    models,
    setModels,
    selectedModels,
    setSelectedModels,
    chatInput,
    setChatInput,
    isGenerating,
    handleSend,
    handleNewChat,
    isModalOpen,
    handleOpenModal,
    handleCloseModal,
  } = useChatLogic();

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
        { name: "佐次郎", account: "4567890123" },
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
  });

  const router = useRouter();

  const [chats] = useStorageState<string[]>("chats", []);
  const [hasActualChats, setHasActualChats] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!accessToken);
  }, [accessToken]);

  useEffect(() => {
    const checkActualChats = () => {
      const chatKeys = Object.keys(localStorage).filter(
        (key) =>
          key.startsWith("chatMessages_") &&
          key !== "chatMessages_default" &&
          JSON.parse(localStorage.getItem(key) || "[]").some((msg: any) =>
            msg.user?.some((u: any) => u.text?.trim())
          )
      );
      setHasActualChats(chatKeys.length > 0);
    };

    checkActualChats();
    window.addEventListener("storage", (e) => {
      if (e.key?.startsWith("chatMessages_")) {
        checkActualChats();
      }
    });
    window.addEventListener("chatListUpdate", checkActualChats);

    return () => {
      window.removeEventListener("storage", checkActualChats);
      window.removeEventListener("chatListUpdate", checkActualChats);
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleLogout = () => {
    setAccessToken("");
    setModels(demoModels);
    setSelectedModels(demoModels);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewChat]);

  return (
    <>
      <Header setIsModalOpen={handleOpenModal} isLoggedIn={isLoggedIn} />

      {(!isMobile || (isMobile && !hasActualChats)) && <BentoFeatures />}

      {hasActualChats && (
        <div className="chat-list-container">
          <ChatList />
        </div>
      )}

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
        closeModal={handleCloseModal}
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
