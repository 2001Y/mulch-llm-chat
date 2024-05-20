import { useRef, useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Image from "next/image";
import OpenAI from "openai";
import { marked } from "marked"; // Import marked
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js"; // Import highlight.js

// Environment variables
const isProduction = process.env.NODE_ENV === "production";
const redirectUri = isProduction ? "https://mulch-llm-chat.vercel.app" : "https://3000.2001y.dev";

// Configure marked with markedHighlight
marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    }
  })
);

// Custom Hooks
const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(initialValue);

  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      setStoredValue(item ? JSON.parse(item) : initialValue);
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
  }, [key, initialValue]);

  const setValue = (value) => {
    try {
      setStoredValue(value);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  };

  return [storedValue, setValue];
};

const useAccessToken = () => {
  const [accessToken, setAccessToken] = useLocalStorage('accessToken', '');

  useEffect(() => {
    const fetchAccessToken = async (code) => {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAccessToken(data.key);

        const url = new URL(window.location);
        url.searchParams.delete('code');
        window.history.replaceState({}, document.title, url.toString());
      } catch (error) {
        console.error('Error fetching access token:', error);
        alert(`Failed to fetch access token: ${error.message}`);
      }
    };

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code && !accessToken) {
        fetchAccessToken(code);
      }
    }
  }, [accessToken, setAccessToken]);

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

// Components
const Responses = ({ messages }) => {
  const containerRef = useRef(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      if (scrollTop + clientHeight < scrollHeight - 10) {
        setIsAutoScroll(false);
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    if (isAutoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isAutoScroll]);

  return (
    <div className="responses-container" ref={containerRef} translate="no">
      {messages.map((message, index) => (
        <div key={index} className="message-block">
          <div className="user">
            <p>{message.user}</p>
          </div>
          <div className="scroll_area">
            {message.llm.map((response, idx) => (
              <div key={idx} className={`response ${response.role}`}>
                <div className="meta">
                  <small>{response.model}</small>
                </div>
                <div
                  className="markdown-content"
                  dangerouslySetInnerHTML={{ __html: marked(response.text) }} // Render Markdown
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const InputSection = ({ models, setChatInput, handleSend, openModal }) => {
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !isComposing && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    } else if (event.key === 'Enter' && event.shiftKey) {
      // Allow newline insertion
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (event) => {
    setIsComposing(false);
    setChatInput(event.target.textContent);
  };

  const handleInput = (e) => {
    const text = e.currentTarget.textContent;
    // placeholder のための空白文字を削除
    if (text === '\u200B' || text.trim() === '') {
      e.currentTarget.innerHTML = '';
    } else {
      setChatInput(text);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, text);
  };

  return (
    <section className="input-section">
      <div className="input-container">
        <button onClick={openModal} className="open-modal-button">
          model: {models.map(model => model.split('/')[1]).join(', ') || 'Open Model Input'}
        </button>
      </div>
      <div className="input-container chat-input-area">
        <div
          contentEditable="true"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onPaste={handlePaste}
          className="chat-input"
          data-placeholder="Type your message here..."
          style={{ whiteSpace: 'pre-wrap' }}
        />
        <button onClick={handleSend} className="send-button">↑</button>
      </div>
    </section>
  );
};


const ModelInputModal = ({ models, setModels, isModalOpen, closeModal }) => {
  const handleModelInput = (event) => {
    const modelsArray = event.target.value.split(',').map(model => model.trim());
    setModels(modelsArray);
    if (typeof window !== 'undefined') {
      localStorage.setItem('models', JSON.stringify(modelsArray));
    }
  };

  return (
    <div className={`modal-overlay ${isModalOpen ? 'visible' : 'hidden'}`} onClick={closeModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Input Models</h2>
        <textarea type="text" value={models.join(',')} onChange={handleModelInput} className="model-input" />
      </div>
      <div className="save">
        Save
      </div>
    </div>
  );
};

// Main Component
export default function Home() {
  const [models, setModels] = useLocalStorage('models', ['openai/gpt-4o', 'anthropic/claude-3-opus:beta', 'google/gemini-pro-1.5', 'cohere/command-r-plus']);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [accessToken, setAccessToken] = useAccessToken();
  const openai = useOpenAI(accessToken);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const fetchChatResponse = useCallback(async (model, messageIndex, responseIndex) => {
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
        updateMessage(messageIndex, responseIndex, result);
      }
      setIsAutoScroll(false); // Stop auto-scroll when any response is fully generated
      return result;
    } catch (error) {
      console.error('Error fetching response from model:', model, error);
      updateMessage(messageIndex, responseIndex, `Error: ${error.message}`);
    }
  }, [chatInput, openai]);

  const updateMessage = (messageIndex, responseIndex, text) => {
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      newMessages[messageIndex].llm[responseIndex].text = text;
      return newMessages;
    });
  };

  const handleSend = async () => {
    setMessages(prevMessages => {
      const newMessage = {
        user: chatInput,
        llm: models.map((model) => ({ role: 'model', model, text: '' }))
      };
      const newMessages = [...prevMessages, newMessage];
      newMessage.llm.forEach((response, index) => {
        fetchChatResponse(response.model, newMessages.length - 1, index);
      });
      setIsAutoScroll(true); // Enable auto-scroll when a new message is sent
      return newMessages;
    });
  };

  const handleLogin = () => {
    const openRouterAuthUrl = `https://openrouter.ai/auth?callback_url=${redirectUri}`;
    window.location.href = openRouterAuthUrl;
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="https://via.placeholder.com/192" />
        <link rel="apple-touch-icon" href="https://via.placeholder.com/192" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Multi AI Chat"></meta>
        <title>Multi AI Chat | OpenRouter Chat Client</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Glegoo:wght@400;700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
      </Head>
      {!accessToken ? (
        <button onClick={handleLogin} className="loginButton">Login to OpenRouter</button>
      ) : (
        <>
          <header>
            <Image src="/logo.png" width="40" height="40" alt="Logo" className="logo" />
            <h1>
              Multi AI Chat<br />
              <span>OpenRouter Chat Client</span>
            </h1>
          </header>
          <Responses messages={messages} />
          <InputSection models={models} setChatInput={setChatInput} handleSend={handleSend} openModal={openModal} />
          <ModelInputModal models={models} setModels={setModels} isModalOpen={isModalOpen} closeModal={closeModal} />
        </>
      )}
    </>
  );
}
