import { useRef, useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import OpenAI from "openai";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import { encode } from 'base64-arraybuffer';

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

const Responses = ({ messages = [], updateMessage, forceScroll, handleRegenerate }) => {
  const containerRef = useRef(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [lastManualScrollTop, setLastManualScrollTop] = useState(0);
  const [lastAutoScrollTop, setLastAutoScrollTop] = useState(0);
  const isAutoScrollingRef = useRef(false);

  const handleScroll = () => {
    const container = containerRef.current;
    if (container && !isAutoScrollingRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 1;

      // ユーザーが上にスクロールした場合、自動スクロールを無効にする
      if (scrollTop < lastManualScrollTop && !isScrolledToBottom) {
        setIsAutoScroll(false);
      }

      // 最下部までスクロールした場合、自動スクロールを有効にする
      if (isScrolledToBottom) {
        setIsAutoScroll(true);
      }

      setLastManualScrollTop(scrollTop);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [lastManualScrollTop]);

  useEffect(() => {
    let scrollTimer;
    const scrollInterval = 500; // スクロール更新の間隔（ミリ秒）

    const scrollToBottom = () => {
      if ((isAutoScroll || forceScroll) && containerRef.current) {
        const container = containerRef.current;
        const { scrollHeight, clientHeight } = container;
        const newScrollTop = scrollHeight - clientHeight;

        isAutoScrollingRef.current = true;
        container.scrollTop = newScrollTop;
        setLastAutoScrollTop(newScrollTop);
        setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, 100);
      }
    };

    const scheduleScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(scrollToBottom, scrollInterval);
    };

    scheduleScroll();

    return () => {
      clearTimeout(scrollTimer);
    };
  }, [messages, isAutoScroll, lastAutoScrollTop, forceScroll]);

  const handleEdit = (messageIndex, responseIndex, newContent) => {
    if (responseIndex === null) {
      // ユーザーメッセージの編集
      const newMessages = [...messages];
      newMessages[messageIndex].user = newContent;
      updateMessage(newMessages);
    } else {
      // AIの応答の編集
      updateMessage(messageIndex, responseIndex, newContent);
    }
  };

  const handleSelectResponse = useCallback((messageIndex, responseIndex) => {
    updateMessage(messageIndex, responseIndex, undefined, null, true);
  }, [updateMessage]);

  return (
    <div className="responses-container" ref={containerRef} translate="no">
      {Array.isArray(messages) && messages.map((message, messageIndex) => {
        const selectedResponses = message.llm.filter(r => r.selected).sort((a, b) => a.selectedOrder - b.selectedOrder);
        const hasSelectedResponse = selectedResponses.length > 0;
        return (
          <div key={messageIndex} className="message-block">
            <div className="user">
              <p contentEditable onBlur={(e) => handleEdit(messageIndex, null, e.target.textContent)}>
                {message.user}
              </p>
            </div>
            <div className="scroll_area">
              {Array.isArray(message.llm) && message.llm.map((response, responseIndex) => (
                <div key={responseIndex} className={`response ${response.role} ${hasSelectedResponse && !response.selected ? 'unselected' : ''}`}>
                  <div className="meta">
                    <small>{response.model}</small>
                    <div className="response-controls">
                      <button
                        className="regenerate-button"
                        onClick={() => handleRegenerate(messageIndex, responseIndex, response.model)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                        </svg>
                      </button>
                      <div
                        className={`response-select ${response.selected ? 'selected' : ''}`}
                        onClick={() => handleSelectResponse(messageIndex, responseIndex)}
                      >
                        {response.selected ? (
                          selectedResponses.length > 1 ?
                            (selectedResponses.findIndex(r => r === response) + 1) :
                            '✓'
                        ) : ''}
                      </div>
                    </div>
                  </div>
                  <div
                    className="markdown-content"
                    contentEditable
                    onBlur={(e) => handleEdit(messageIndex, responseIndex, e.target.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: response.text }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const InputSection = ({ models, chatInput, setChatInput, handleSend, handleStop, openModal, isGenerating, selectedModels, setSelectedModels, showResetButton, handleReset, handleFileUpload }) => {
  const [isComposing, setIsComposing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [filteredModels, setFilteredModels] = useState(models);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const handleFocus = () => {
      document.body.dataset.inputFocused = 'true';
    };

    const handleBlur = () => {
      document.body.dataset.inputFocused = 'false';
    };

    if (inputRef.current) {
      inputRef.current.addEventListener('focus', handleFocus);
      inputRef.current.addEventListener('blur', handleBlur);
    }

    return () => {
      if (inputRef.current) {
        inputRef.current.removeEventListener('focus', handleFocus);
        inputRef.current.removeEventListener('blur', handleBlur);
      }
    };
  }, []);

  const handleKeyDown = (event) => {
    if (document.body.dataset.softwareKeyboard === 'false') {
      if (event.key === 'Enter' && !isComposing) {
        if (event.metaKey || event.ctrlKey) {
          // コマンド/コントロール+エンターで単体送信
          event.preventDefault();
          handleSend(event, true);
          setChatInput('');
        } else if (!event.shiftKey) {
          // 通常のエンターで複数送信
          event.preventDefault();
          handleSend(event, false);
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
    const wasInputFocused = document.activeElement === inputRef.current;
    setSelectedModels((prevSelectedModels) => {
      if (prevSelectedModels.includes(model)) {
        return prevSelectedModels.filter((m) => m !== model);
      } else {
        return [...prevSelectedModels, model];
      }
    });
    if (wasInputFocused && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 0);
    }
  };

  // Polyfill for unsupported browsers
  useEffect(() => {
    if (!CSS.supports('field-sizing: content')) {
      const textarea = inputRef.current;
      const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, parseInt(getComputedStyle(textarea).maxHeight))}px`;
      };
      textarea.addEventListener('input', adjustHeight);
      adjustHeight();
      // chatInputが空になったときに高さをリセット
      if (chatInput === '') {
        textarea.style.height = 'auto';
      }
      return () => {
        textarea.removeEventListener('input', adjustHeight);
      };
    }
  }, []);

  return (
    <section className="input-section">
      {showResetButton && (
        <button className="reset-button" onClick={handleReset}>
          Clear Chat
        </button>
      )}
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
        <input
          type="file"
          id="file-upload"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          multiple
        />
        <label htmlFor="file-upload" className="file-upload-button">
          📎
        </label>
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
  const [models, setModels] = useLocalStorage('models', ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5', 'cohere/command-r-plus', "meta-llama/llama-3-70b-instruct"]);
  const [demoModels, setDemoModels] = useState(['google/gemma-2-9b-it:free', "google/gemma-7b-it:free", "meta-llama/llama-3-8b-instruct:free", "openchat/openchat-7b:free"]);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [accessToken, setAccessToken] = useAccessToken();
  const [demoAccessToken, setDemoAccessToken] = useState(process.env.NEXT_PUBLIC_DEMO_API_KEY || '');
  const openai = useOpenAI(accessToken || demoAccessToken);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [forceScroll, setForceScroll] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortControllers, setAbortControllers] = useState([]);
  const [selectedModels, setSelectedModels] = useState(models);
  const [showResetButton, setShowResetButton] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const router = useRouter();
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

  const updateMessage = useCallback((messageIndex, responseIndex, text, selectedIndex, toggleSelected) => {
    setMessages(prevMessages => {
      const newMessages = JSON.parse(JSON.stringify(prevMessages));
      if (responseIndex !== undefined) {
        if (text !== undefined) {
          newMessages[messageIndex].llm[responseIndex].text = text;
        }
        if (toggleSelected) {
          const currentResponse = newMessages[messageIndex].llm[responseIndex];
          if (currentResponse.selected) {
            currentResponse.selected = false;
            delete currentResponse.selectedOrder;
            // 他の選択されたレスポンスの順序を更新
            newMessages[messageIndex].llm.forEach(response => {
              if (response.selected && response.selectedOrder > currentResponse.selectedOrder) {
                response.selectedOrder--;
              }
            });
          } else {
            const selectedCount = newMessages[messageIndex].llm.filter(r => r.selected).length;
            currentResponse.selected = true;
            currentResponse.selectedOrder = selectedCount + 1;
          }
        }
      }
      return newMessages;
    });
  }, []);

  const fetchChatResponse = useCallback(async (model, messageIndex, responseIndex, abortController, inputText) => {
    try {
      const pastMessages = messages.flatMap(msg => {
        const userMessage = { role: 'user', content: msg.user };
        const selectedResponses = msg.llm
          .filter(llm => llm.selected)
          .sort((a, b) => a.selectedOrder - b.selectedOrder);

        const responseMessages = selectedResponses.length > 0
          ? selectedResponses.map(llm => ({ role: 'assistant', content: llm.text }))
          : [{ role: 'assistant', content: msg.llm.find(llm => llm.model === model)?.text || '' }];

        return [userMessage, ...responseMessages];
      });

      console.log('モデルに送信する過去の会話:', pastMessages);

      const currentMessage = messages[messageIndex];
      const fileIds = currentMessage.attachedFiles?.map(file => file.id) || [];

      const stream = await openai.chat.completions.create({
        model,
        messages: [
          ...pastMessages,
          { role: 'user', content: inputText }
        ],
        stream: true,
        signal: abortController.signal,
        file_ids: fileIds.length > 0 ? fileIds : undefined, // ファイルIDがある場合のみ送信
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

  const handleSend = async (event, isPrimaryOnly = false, fileInfos = null) => {
    if (isGenerating) return;

    let inputText = chatInput;
    if (fileInfos) {
      const fileDetails = fileInfos.map(file =>
        `File: ${file.name} (ID: ${file.id}, Type: ${file.type}, Size: ${file.size} bytes)`
      ).join('\n');
      inputText += `\n[Attached Files]\n${fileDetails}`;
    }

    const modelsToUse = isPrimaryOnly ? [selectedModels[0]] : selectedModels;

    setIsGenerating(true);
    setForceScroll(true);
    const newAbortControllers = modelsToUse.map(() => new AbortController());
    setAbortControllers(newAbortControllers);

    setMessages(prevMessages => {
      const currentMessages = Array.isArray(prevMessages) ? prevMessages : [];
      const newMessage = {
        user: inputText,
        llm: modelsToUse.map((model, index) => ({
          role: 'assistant',
          model,
          text: '',
          selected: false
        })),
        attachedFiles: fileInfos // 添付ファイル情報を保存
      };
      const newMessages = [...currentMessages, newMessage];
      newMessage.llm.forEach((response, index) => {
        fetchChatResponse(response.model, newMessages.length - 1, index, newAbortControllers[index], inputText);
      });
      setIsAutoScroll(true);

      if (currentMessages.length === 0) {
        setShowResetButton(true);
      }

      return newMessages;
    });

    setChatInput('');
    setTimeout(() => setForceScroll(false), 100);
  };

  const handleReset = () => {
    setMessages([]);
    setShowResetButton(false);
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

  const handleLogout = () => {
    setAccessToken('');
    setModels(demoModels);
    setSelectedModels(demoModels);
    // メッセージ履歴をクリア
    setMessages([]);
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    const uploadedFileInfos = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'assistants');

      try {
        const response = await fetch('https://openrouter.ai/api/v1/files', {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('File uploaded:', result);

        const fileInfo = {
          id: result.id,
          name: file.name,
          type: file.type,
          size: file.size,
        };
        uploadedFileInfos.push(fileInfo);
        setUploadedFiles(prev => [...prev, fileInfo]);

      } catch (error) {
        console.error('Error uploading file:', error);
        // エラーメッセージをユーザーに表示する処理を追加
      }
    }

    if (uploadedFileInfos.length > 0) {
      const fileMessage = uploadedFileInfos.map(file =>
        `File "${file.name}" (${file.type}, ${file.size} bytes) uploaded. ID: ${file.id}`
      ).join('\n');
      setChatInput(prev => `${prev}${fileMessage}\n`);

      // ファイル情報をAIモデルに送信
      handleSend(null, false, uploadedFileInfos);
    }
  };

  const handleRegenerate = async (messageIndex, responseIndex, model) => {
    const inputText = messages[messageIndex].user;
    const abortController = new AbortController();
    setAbortControllers([abortController]);
    setIsGenerating(true);

    try {
      await fetchChatResponse(model, messageIndex, responseIndex, abortController, inputText);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="https://mulch-llm-chat.vercel.app/apple-touch-icon.jpg" />
        <link rel="apple-touch-icon" href="https://mulch-llm-chat.vercel.app/apple-touch-icon.jpg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Multi AI Chat"></meta>
        <title>Multi AI Chat | OpenRouter Chat Client</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin />
        <link href="https://fonts.googleapis.com/css2?family=Glegoo:wght@400;700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
      </Head>
      <header>
        <div className="logo">
          <Image src="/logo.png" width="40" height="40" alt="Logo" className="logo-img" />
          <h1>Multi AI Chat<br />
            <small>OpenRouter Chat Client</small>
          </h1>
        </div>
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
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
        </div>
        {!isLoggedIn && <div className="free-version">Free Version</div>}
      </header >
      <Responses
        messages={messages}
        updateMessage={updateMessage}
        forceScroll={forceScroll}
        handleRegenerate={handleRegenerate}
      />
      <InputSection
        models={isLoggedIn ? models : demoModels}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleSend={handleSend}
        handleStop={handleStop}
        openModal={openModal}
        isGenerating={isGenerating}
        selectedModels={selectedModels}
        setSelectedModels={setSelectedModels}
        showResetButton={showResetButton}
        handleReset={handleReset}
        handleFileUpload={handleFileUpload}
      />
      <ModelInputModal
        models={isLoggedIn ? models : demoModels}
        setModels={isLoggedIn ? setModels : () => { }}
        isModalOpen={isModalOpen}
        closeModal={closeModal}
      />
    </>
  );
}