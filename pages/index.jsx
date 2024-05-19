import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import OpenAI from 'openai';

const isProduction = process.env.NODE_ENV === 'production';
const redirectUri = isProduction ? 'https://mulch-llm-chat.vercel.app' : 'https://3000.2001y.dev';

const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};

const useAccessToken = () => {
  const [accessToken, setAccessToken] = useLocalStorage('accessToken', '');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !accessToken) {
      fetchAccessToken(code);
    }
  }, [accessToken]);

  const fetchAccessToken = async (code) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      setAccessToken(data.key);

      const url = new URL(window.location);
      url.searchParams.delete('code');
      window.history.replaceState({}, document.title, url.toString());
    } catch (error) {
      console.error('Error fetching access token:', error);
    }
  };

  return [accessToken, setAccessToken];
};

const useOpenAI = (accessToken) => {
  const [openai, setOpenai] = useState(null);

  useEffect(() => {
    if (accessToken) {
      const openaiInstance = new OpenAI({
        apiKey: accessToken,
        baseURL: 'https://openrouter.ai/api/v1',
        dangerouslyAllowBrowser: true,
      });
      setOpenai(openaiInstance);
    }
  }, [accessToken]);

  return openai;
};

const useIphoneSafariDetection = () => {
  useEffect(() => {
    const isIphone = /iPhone/i.test(navigator.userAgent);
    const isSafari = /Apple/.test(navigator.vendor) && !/CriOS|FxiOS/.test(navigator.userAgent);
    if (isIphone && isSafari) {
      document.documentElement.setAttribute('data-device', 'iphone');
    }
  }, []);
};

const Responses = ({ responses, selectedResponse, handleRegenerate }) => (
  <div className="responses-container">
    {responses.map((response, index) => (
      <div key={index} className={`response ${index === selectedResponse ? 'selected' : ''}`}>
        <div className="meta">
          <small>{response.model}</small>
          <button onClick={() => handleRegenerate(index)} className="regenerate-button">ReGenerate</button>
        </div>
        <p>{response.text}</p>
      </div>
    ))}
  </div>
);

const InputSection = ({ models, setModels, chatInput, setChatInput, handleSend }) => {
  const [isComposing, setIsComposing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleModelInput = (event) => {
    const modelsArray = event.target.value.split(',').map(model => model.trim());
    setModels(modelsArray);
    if (typeof window !== 'undefined') {
      localStorage.setItem('models', JSON.stringify(modelsArray));
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && event.metaKey && !isComposing) {
      handleSend();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (event) => {
    setIsComposing(false);
    setChatInput(event.target.value);
  };

  const handleInput = (e) => {
    const text = e.currentTarget.textContent;
    setChatInput(text === '\u200B' ? '' : text); // Zero-width space check
  };

  return (
    <section className="input-section">
      <div className="input-container">
        <button onClick={() => setIsModalOpen(true)} className="open-modal-button">
          {models.map(model => model.split('/')[1]).join(', ') || 'Open Model Input'}
        </button>
      </div>
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Input Models</h2>
            <textarea type="text" value={models.join(',')} onChange={handleModelInput} className="model-input" />
            <button onClick={() => setIsModalOpen(false)} className="close-modal-button">Save</button>
          </div>
        </div>
      )}
      <div className="input-container">
        <div
          contentEditable="true"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          className="chat-input"
          style={{ whiteSpace: 'pre-wrap' }} // 改行を保持するためのスタイル
        />
        <button onClick={handleSend} className="send-button">Send</button>
      </div>
    </section>
  );
};

export default function Home() {
  const [models, setModels] = useLocalStorage('models', ['perplexity/llama-3-sonar-large-32k-online', 'openai/gpt-4o', 'openai/gpt-3.5-turbo']);
  const [chatInput, setChatInput] = useState('');
  const [responses, setResponses] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [accessToken, setAccessToken] = useAccessToken();
  const openai = useOpenAI(accessToken);

  useIphoneSafariDetection();

  const fetchChatResponse = useCallback(async (model, index) => {
    try {
      const stream = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: chatInput }],
        stream: true,
      });

      let result = '';
      for await (const part of stream) {
        const content = part.choices[0]?.delta?.content || '';
        result += content;
        updateResponse(index, result);
      }

      return result;
    } catch (error) {
      console.error('Error fetching response from model:', model, error);
      updateResponse(index, 'Error');
    }
  }, [chatInput, openai]);

  const updateResponse = (index, text) => {
    setResponses(prevResponses => {
      const newResponses = [...prevResponses];
      newResponses[index] = { ...newResponses[index], text };
      return newResponses;
    });
  };

  const handleSend = async () => {
    if (!chatInput || !chatInput.trim()) return;

    const newResponses = models.map((model, index) => ({ model, text: '' }));
    setResponses(newResponses);

    models.forEach((model, index) => {
      fetchChatResponse(model, index);
    });
  };

  const handleRegenerate = async (index) => {
    const model = responses[index].model;
    try {
      const text = await fetchChatResponse(model, index);
      updateResponse(index, text);
    } catch (error) {
      console.error('Error regenerating response:', error);
    }
  };

  const handleLogin = () => {
    const openRouterAuthUrl = `https://openrouter.ai/auth?callback_url=${redirectUri}`;
    window.location.href = openRouterAuthUrl;
  };

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0 , viewport-fit=cover" />
        <link rel="icon" href="https://via.placeholder.com/192" />
        <link rel="apple-touch-icon" href="https://via.placeholder.com/192" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#000000" />
        <title>MULCH AI CHAT</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin />
        <link href="https://fonts.googleapis.com/css2?family=Glegoo:wght@400;700&display=swap" rel="stylesheet"></link>
      </Head>
      {!accessToken ? (
        <button onClick={handleLogin} className="loginButton">Login to OpenRouter</button>
      ) : (
        <>
          <header>
            <h1>MULCH AI CHAT</h1>
          </header>
          <Responses responses={responses} selectedResponse={selectedResponse} handleRegenerate={handleRegenerate} />
          <InputSection models={models} setModels={setModels} chatInput={chatInput} setChatInput={setChatInput} handleSend={handleSend} />
        </>
      )}
    </>
  );
}
