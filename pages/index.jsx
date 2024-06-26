import { useRef, useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import OpenAI from "openai";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

const isProduction = process.env.NODE_ENV === "production";
const redirectUri = isProduction ? "https://mulch-llm-chat.vercel.app" : "https://3000.2001y.dev";

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    }
  })
);

const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      } catch (error) {
        console.error('Error reading from localStorage:', error);
        return initialValue;
      }
    }
    return initialValue;
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
      }
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
  }, [accessToken]);

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

const Responses = ({ messages, updateMessage }) => {
  const containerRef = useRef(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const handleScroll = () => {
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
  }, [messages]);

  const handleEdit = (messageIndex, responseIndex, newText) => {
    updateMessage(messageIndex, responseIndex, newText);
  };

  return (
    <div className="responses-container" ref={containerRef} translate="no">
      {messages.map((message, index) => (
        <div key={index} className="message-block">
          <div className="user">
            <p contentEditable onBlur={(e) => handleEdit(index, null, e.target.textContent)}>{message.user}</p>
          </div>
          <div className="scroll_area">
            {message.llm.map((response, idx) => (
              <div key={idx} className={`response ${response.role}`}>
                <div className="meta">
                  <small>{response.model}</small>
                </div>
                <div
                  className="markdown-content"
                  contentEditable
                  onBlur={(e) => handleEdit(index, idx, e.target.innerHTML)}
                  dangerouslySetInnerHTML={{ __html: response.text }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const InputSection = ({ models, chatInput, setChatInput, handleSend, handleStop, openModal, isGenerating, selectedModels, setSelectedModels }) => {
  const [isComposing, setIsComposing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [filteredModels, setFilteredModels] = useState(models);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleKeyDown = (event) => {
    if (document.body.dataset.softwareKeyboard === 'false') {
      if (event.key === 'Enter' && !isComposing) {
        if (event.shiftKey) {
          // Shift+Enterで改行を許可
          return;
        }
        event.preventDefault();
        if (showSuggestions) {
          selectSuggestion(suggestionIndex);
        } else {
          handleSend(event);
          setChatInput('');
        }
      } else if (event.key === 'ArrowDown') {
        if (showSuggestions) {
          event.preventDefault();
          setSuggestionIndex((prevIndex) => Math.min(prevIndex + 1, filteredModels.length - 1));
        }
      } else if (event.key === 'ArrowUp') {
        if (showSuggestions) {
          event.preventDefault();
          setSuggestionIndex((prevIndex) => Math.max(prevIndex - 1, 0));
        }
      } else if (event.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };


  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (event) => {
    setIsComposing(false);
    setChatInput(event.target.value);
  };

  const onChange = (e) => {
    const text = e.target.value;
    setChatInput(text);
    // 複数の「@」に対応するため、最後の「@」以降の文字列をマッチさせる正規表現
    const mentionMatch = text.match(/@[^@]*$/);
    if (mentionMatch && mentionMatch[0]) {
      const searchText = mentionMatch[0].slice(1).toLowerCase();
      console.log(searchText);
      console.log(searchText.includes(' '));
      if (searchText.includes(' ') || searchText.length > 15) {
        setShowSuggestions(false);
      } else {
        const matchedModels = models.filter(model => model.toLowerCase().includes(searchText));
        setFilteredModels(matchedModels);
        setShowSuggestions(true);
        setSelectedModels(matchedModels);
      }
    }
  };

  const selectSuggestion = (index) => {
    const selectedModel = filteredModels[index];
    const inputElement = inputRef.current;
    // 入力フィールドの値から最後の「@」に続く文字列を選択されたモデル名に置き換える
    const text = inputElement.value.replace(/@[^@]*$/, `@${selectedModel.split('/')[1]} `);
    inputElement.value = text;

    setShowSuggestions(false);
    setSuggestionIndex(0);
    setChatInput(text);
  };

  useEffect(() => {
    if (chatInput === '' && inputRef.current) {
      inputRef.current.value = '';
    }
  }, [chatInput]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleModelChange = (model) => {
    setSelectedModels((prevSelectedModels) => {
      if (prevSelectedModels.includes(model)) {
        return prevSelectedModels.filter((m) => m !== model);
      } else {
        return [...prevSelectedModels, model];
      }
    });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Polyfill for unsupported browsers
  useEffect(() => {
    if (!CSS.supports('field-sizing: content')) {
      const textarea = inputRef.current;
      const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      };
      textarea.addEventListener('input', adjustHeight);
      adjustHeight();
      return () => {
        textarea.removeEventListener('input', adjustHeight);
      };
    }
  }, []);

  return (
    <section className="input-section">
      <div className="input-container model-select-area">
        {models.map((model, index) => (
          <div className="model-radio" key={model}>
            <input
              type="checkbox"
              id={`model-${index}`}
              value={model}
              checked={selectedModels.includes(model)}
              onChange={() => handleModelChange(model)}
            />
            <label htmlFor={`model-${index}`}>
              {model.split('/')[1]}
            </label>
          </div>
        ))}
      </div>
      <div className="input-container chat-input-area">
        <textarea
          ref={inputRef}
          value={chatInput}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          className="chat-input"
          placeholder="Type your message here…"
          fieldSizing="content"
        />
        {showSuggestions && (
          <ul className="suggestions-list">
            {filteredModels.map((model, index) => (
              <li
                key={model}
                className={index === suggestionIndex ? 'active' : ''}
                onClick={() => selectSuggestion(index)}
              >
                <input
                  type="radio"
                  id={`suggestion-${index}`}
                  name="model-suggestion"
                  value={model}
                  checked={index === suggestionIndex}
                  onChange={() => selectSuggestion(index)}
                />
                <label htmlFor={`suggestion-${index}`}>{model.split('/')[1]}</label>
              </li>
            ))}
          </ul>
        )}
        <button onClick={isGenerating ? handleStop : handleSend} className="send-button">
          {isGenerating ? '⏹' : '↑'}
        </button>
      </div>
    </section>
  );
};

export default function Home() {
  const [models, setModels] = useLocalStorage('models', ['openai/gpt-4o', 'anthropic/claude-3-opus:beta', 'google/gemini-pro-1.5', 'cohere/command-r-plus']);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [accessToken, setAccessToken] = useAccessToken();
  const openai = useOpenAI(accessToken);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortControllers, setAbortControllers] = useState([]);
  const [selectedModels, setSelectedModels] = useState(models);

  const router = useRouter();
  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
    }
  }, [accessToken]);

  const updateMessage = (messageIndex, responseIndex, text) => {
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      newMessages[messageIndex].llm[responseIndex].text = text;
      return newMessages;
    });
  };

  const fetchChatResponse = useCallback(async (model, messageIndex, responseIndex, abortController, inputText) => {
    try {
      const pastMessages = messages.flatMap(msg => [
        { role: 'user', content: msg.user },
        ...msg.llm.map(llm => ({ role: 'assistant', content: llm.text }))
      ]);

      const stream = await openai.chat.completions.create({
        model,
        messages: [
          ...pastMessages,
          { role: 'user', content: inputText }
        ],
        stream: true,
        signal: abortController.signal,
      });

      let result = '';
      for await (const part of stream) {
        if (abortController.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const content = part.choices[0]?.delta?.content || '';
        result += content;
        updateMessage(messageIndex, responseIndex, marked(result));
      }
      setIsAutoScroll(false);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching response from model:', model, error);
        updateMessage(messageIndex, responseIndex, `Error: ${error.message}`);
        console.log(messages);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [messages, openai]);

  const handleSend = async (event) => {
    if (isGenerating) return;

    let inputText = chatInput;
    const isPrimaryOnly = event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey;
    const modelsToUse = isPrimaryOnly ? [selectedModels[0]] : selectedModels;

    setIsGenerating(true);
    const newAbortControllers = modelsToUse.map(() => new AbortController());
    setAbortControllers(newAbortControllers);

    setMessages(prevMessages => {
      const newMessage = {
        user: chatInput,
        llm: modelsToUse.map((model) => ({ role: 'assistant', model, text: '' }))
      };
      const newMessages = [...prevMessages, newMessage];
      newMessage.llm.forEach((response, index) => {
        fetchChatResponse(response.model, newMessages.length - 1, index, newAbortControllers[index], inputText);
      });
      setIsAutoScroll(true);
      return newMessages;
    });
  };

  const handleStop = () => {
    console.log('Stopping generation');
    abortControllers.forEach(controller => {
      try {
        controller.abort();
      } catch (error) {
        console.error('Error while aborting:', error);
      }
    });
    setIsGenerating(false);
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const ModelInputModal = ({ models, setModels, isModalOpen, closeModal }) => {
    const [newModel, setNewModel] = useState('');

    const handleAddModel = () => {
      if (newModel && !models.includes(newModel)) {
        setModels([...models, newModel]);
        setNewModel('');
      }
    };

    return (
      isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <span className="close" onClick={closeModal}>&times;</span>
            <h2>Settings</h2>
            <ul>
              {models.map((model, index) => (
                <li key={index}>{model}</li>
              ))}
            </ul>
            <input
              type="text"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="Add new model"
            />
            <button onClick={handleAddModel}>Add Model</button>
          </div>
        </div>
      )
    );
  };

  useEffect(() => {
    let previousHeight = visualViewport.height;

    const handleResize = () => {
      const currentHeight = visualViewport.height;
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

    visualViewport.addEventListener('resize', handleResize);
    handleResize();

    const preventTouchMove = (event) => {
      if (!event.target.closest('.model-select-area') && !event.target.closest('.responses-container') && !event.target.closest('.chat-input-area')) {
        event.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventTouchMove, { passive: false });

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
      document.removeEventListener('touchmove', preventTouchMove);
    };
  }, []);

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
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin />
        <link href="https://fonts.googleapis.com/css2?family=Glegoo:wght@400;700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
      </Head>
      <header>
        <Image src="/logo.png" width="40" height="40" alt="Logo" className="logo" />
        <h1> Multi AI Chat<br />
          <span>OpenRouter Chat Client</span>
        </h1>
        <div onClick={() => setIsModalOpen(!isModalOpen)} >⚙️</div>
      </header >
      <Responses messages={messages} updateMessage={updateMessage} />
      <InputSection models={models} chatInput={chatInput} setChatInput={setChatInput} handleSend={handleSend} handleStop={handleStop} openModal={openModal} isGenerating={isGenerating} selectedModels={selectedModels} setSelectedModels={setSelectedModels} />
      <ModelInputModal models={models} setModels={setModels} isModalOpen={isModalOpen} closeModal={closeModal} />
    </>
  );
}