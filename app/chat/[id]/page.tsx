'use client';
import '@/styles/chat.scss'

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Responses from "_components/ChatResponses";
import ModelInputModal from "_components/SettingsModal";
import useStorageState from "_hooks/useLocalStorage";
import useAccessToken from "_hooks/useAccessToken";
import { useOpenAI } from "_hooks/useOpenAI";

export default function ChatPage() {

  const [models, setModels] = useStorageState<string[]>('models', ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5', 'cohere/command-r-plus', "qwen/qwen-2.5-72b-instruct", "mistralai/mistral-large"]);
  const [demoModels] = useState<string[]>(['google/gemma-2-9b-it:free', "google/gemma-7b-it:free", "meta-llama/llama-3-8b-instruct:free", "openchat/openchat-7b:free"]);
  const [accessToken, setAccessToken, previousAccessToken] = useAccessToken();
  const [demoAccessToken] = useState(process.env.NEXT_PUBLIC_DEMO || '');
  const openai = useOpenAI(accessToken || demoAccessToken);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(models);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tools, setTools] = useStorageState('tools', [
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
              default: "celsius"
            }
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
            }
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
  ]
  );

  type ToolFunction = (args: any) => any;

  const [toolFunctions, setToolFunctions] = useStorageState<Record<string, ToolFunction>>('toolFunctions', {
    get_current_weather: (args: any) => {
      const { location = "Tokyo", unit = "celsius" } = args;
      const randomTemperature = () => (Math.random() * 40 - 10).toFixed(1);
      const randomWeather = () => {
        const weatherConditions = ["晴れ", "曇り", "雨", "雪"];
        return weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
      };

      const temperature = randomTemperature();
      const weather = randomWeather();

      return {
        location: location,
        temperature: unit === "fahrenheit" ? ((parseFloat(temperature) * 9 / 5) + 32).toFixed(1) : temperature,
        unit: unit,
        weather: weather
      };
    },
    transfer_funds: (args: any) => {
      const { account_to, amount } = args;
      return {
        status: "success",
        message: `振込が成功しました: ${amount}円を送金しました。`
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

      const matchedAccounts = accounts.filter(account => account.name.includes(name));

      if (matchedAccounts.length === 0) {
        return { message: "該当する口座が見つかりませんでした。" };
      }

      return {
        message: "以下の口座が見つかりました：",
        accounts: matchedAccounts.map(account => `${account.name}: ${account.account}`)
      };
    },
    // 他のー尔函数をここに加
  }
  );
  const router = useRouter();

  useEffect(() => {
    if (accessToken !== previousAccessToken) {
      setModels(['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5', 'cohere/command-r-plus', "qwen/qwen-2.5-72b-instruct", "mistralai/mistral-large"]);
    }
  }, [accessToken, previousAccessToken, setModels]);

  useEffect(() => {
    if (accessToken) {
      setSelectedModels(models);
    } else {
      setSelectedModels(demoModels);
    }
  }, [accessToken, models, demoModels]);

  useEffect(() => {
    setIsLoggedIn(!!accessToken);
  }, [accessToken]);

  const closeModal = () => setIsModalOpen(false);

  useEffect(() => {
    let previousHeight = visualViewport?.height || window.innerHeight;

    const handleResize = () => {
      const currentHeight = visualViewport?.height || window.innerHeight;
      document.body.style.setProperty('--actual-100dvh', `${currentHeight}px`);
      const heightDifference = previousHeight - currentHeight;
      if (heightDifference > 0) {
        document.body.style.setProperty('--keyboardHeight', `${heightDifference}px`);
        document.body.dataset.softwareKeyboard = 'true';
      } else {
        document.body.style.setProperty('--keyboardHeight', `0px`);
        document.body.dataset.softwareKeyboard = 'false';
      }
      previousHeight = currentHeight;
    };

    visualViewport?.addEventListener('resize', handleResize);
    handleResize();

    const preventTouchMove = (event: TouchEvent) => {
      if (!event.target || (!(event.target as HTMLElement).closest('.model-select-area') && !(event.target as HTMLElement).closest('.responses-container') && !(event.target as HTMLElement).closest('.chat-input-area'))) {
        event.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventTouchMove, { passive: false });

    return () => {
      visualViewport?.removeEventListener('resize', handleResize);
      document.removeEventListener('touchmove', preventTouchMove);
    };
  }, []);

  const handleLogout = () => {
    setAccessToken(''); // 直接空文字列を設定
    setModels(demoModels);
    setSelectedModels(demoModels);
    // setMessages([]);
  };

  return (
    <>
      <header>
        <Link href="/chat">
          <div className="logo">
            <Image src="/logo.png" width={40} height={40} alt="Logo" className="logo-img" />
            <h1>Multi AI Chat<br />
              <small>OpenRouter Chat Client</small>
            </h1>
          </div>
        </Link>
        <div className="header-side">
          {isLoggedIn ? (
            <button onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <button onClick={() => router.push('/login')} className="login">
              Login
            </button>
          )}
          <div onClick={() => setIsModalOpen(!isModalOpen)} className="setting">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 .33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
        </div>
        {!isLoggedIn && <div className="free-version">Free Version</div>}
      </header>
      <Responses
        openai={openai}
        models={isLoggedIn ? models : demoModels}
        selectedModels={selectedModels}
        setSelectedModels={setSelectedModels}
        toolFunctions={toolFunctions}
      />
      <ModelInputModal
        models={isLoggedIn ? models : demoModels}
        setModels={isLoggedIn ? setModels : () => { }}
        isModalOpen={isModalOpen}
        closeModal={closeModal}
        tools={tools}
        setTools={setTools}
        toolFunctions={toolFunctions}
        setToolFunctions={setToolFunctions as unknown as (toolFunctions: Record<string, Function>) => void}
      />
    </>
  );
}