'use client';

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import OpenAI from "openai";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import Responses from "/_components/Responses";
import InputSection from "/_components/InputSection";
import ModelInputModal from "/_components/ModelInputModal";
import useLocalStorage from "/_hooks/useLocalStorage";
import useAccessToken from "/_hooks/useAccessToken";
import { useOpenAI } from "/_hooks/useOpenAI";

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    }
  })
);

export default function Home() {
  const [models, setModels] = useLocalStorage('models', ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5', 'cohere/command-r-plus', "meta-llama/llama-3-70b-instruct"]);
  const [demoModels, setDemoModels] = useState(['google/gemma-2-9b-it:free', "google/gemma-7b-it:free", "meta-llama/llama-3-8b-instruct:free", "openchat/openchat-7b:free"]);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [accessToken, setAccessToken, previousAccessToken] = useAccessToken();
  const [demoAccessToken, setDemoAccessToken] = useState(process.env.NEXT_PUBLIC_DEMO || '');
  const openai = useOpenAI(accessToken || demoAccessToken);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [forceScroll, setForceScroll] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortControllers, setAbortControllers] = useState([]);
  const [selectedModels, setSelectedModels] = useState(models);
  const [showResetButton, setShowResetButton] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (accessToken !== previousAccessToken) {
      setModels(['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-pro-1.5', 'cohere/command-r-plus', "meta-llama/llama-3-70b-instruct"]);
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

  const updateMessage = useCallback((messageIndex, responseIndex, text, selectedIndex, toggleSelected, saveOnly, isEditing) => {
    setMessages(prevMessages => {
      const newMessages = JSON.parse(JSON.stringify(prevMessages));
      if (responseIndex === null) {
        if (text !== undefined) {
          if (saveOnly) {
            newMessages[messageIndex].originalUser = text;
            newMessages[messageIndex].user = text;
          } else {
            if (!newMessages[messageIndex].originalUser) {
              newMessages[messageIndex].originalUser = newMessages[messageIndex].user;
            }
            newMessages[messageIndex].user = text;
          }
        }
      } else if (newMessages[messageIndex]?.llm[responseIndex] !== undefined) {
        if (text !== undefined) {
          newMessages[messageIndex].llm[responseIndex].text = text;
        }
        if (toggleSelected) {
          const currentResponse = newMessages[messageIndex].llm[responseIndex];
          if (currentResponse.selected) {
            currentResponse.selected = false;
            delete currentResponse.selectedOrder;
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
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        if (newMessages[messageIndex]?.llm[responseIndex] !== undefined) {
          newMessages[messageIndex].llm[responseIndex].isGenerating = true;
        }
        return newMessages;
      });
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
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        if (newMessages[messageIndex]?.llm[responseIndex] !== undefined) {
          newMessages[messageIndex].llm[responseIndex].isGenerating = false;
        }
        return newMessages;
      });
      setMessages(prevMessages => {
        const allResponsesComplete = prevMessages[messageIndex].llm.every(response => !response.isGenerating);
        if (allResponsesComplete) {
          setIsGenerating(false);
        }
        return prevMessages;
      });
    }
  }, [messages, openai, updateMessage]);

  const handleSend = async (event, isPrimaryOnly = false, messageIndex) => {
    if (isGenerating) return;

    let inputText = chatInput;
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
          selected: false,
          isGenerating: true
        }))
      };
      const newMessages = [...currentMessages, newMessage];
      newMessage.llm.forEach((response, index) => {
        fetchChatResponse(response.model, newMessages.length - 1, index, newAbortControllers[index], inputText)
          .finally(() => {
            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages];
              updatedMessages[newMessages.length - 1].llm[index].isGenerating = false;
              const allResponsesComplete = updatedMessages[newMessages.length - 1].llm.every(response => !response.isGenerating);
              if (allResponsesComplete) {
                setIsGenerating(false);
              }
              return updatedMessages;
            });
          });
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
    if (isGenerating) {
      abortControllers.forEach(controller => {
        try {
          controller.abort();
        } catch (error) {
          console.error('Error while aborting:', error);
        }
      });
      setIsGenerating(false);
      setMessages(prevMessages => {
        return prevMessages.map(message => ({
          ...message,
          llm: message.llm.map(response => ({ ...response, isGenerating: false }))
        }));
      });
    } else {
      if (window.confirm('本当にチャット履歴をクリアしますか？この操作は元に戻せません。')) {
        setMessages([]);
        setShowResetButton(false);
      }
    }
  };

  const handleStop = (messageIndex, responseIndex) => {
    const controller = abortControllers[responseIndex];
    if (controller) {
      controller.abort();
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        newMessages[messageIndex].llm[responseIndex].isGenerating = false;
        return newMessages;
      });
    }
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

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
    setMessages([]);
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

  const handleResetAndRegenerate = async (messageIndex) => {
    setIsGenerating(true);
    setForceScroll(true);

    const messageBlock = document.querySelector(`.message-block:nth-child(${messageIndex + 1})`);
    if (messageBlock) {
      const userDiv = messageBlock.querySelector('.user');
      if (userDiv) {
        userDiv.classList.remove('edited');
        const contentEditableElement = userDiv.querySelector('[contenteditable]');
        if (contentEditableElement) {
          contentEditableElement.blur();
        }
      }
    }

    const newMessages = [...messages];
    const userMessage = newMessages[messageIndex].user;
    newMessages.splice(messageIndex + 1);
    newMessages[messageIndex].llm = selectedModels.map(model => ({
      role: 'assistant',
      model,
      text: '',
      selected: false
    }));

    setMessages(newMessages);

    const newAbortControllers = selectedModels.map(() => new AbortController());
    setAbortControllers(newAbortControllers);

    newMessages[messageIndex].llm.forEach((response, index) => {
      fetchChatResponse(response.model, messageIndex, index, newAbortControllers[index], userMessage);
    });

    setIsAutoScroll(true);
    setTimeout(() => setForceScroll(false), 100);
  };

  return (
    <>
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
      </header>
      {(showResetButton || isGenerating) && (
        <button className={`reset-button ${isGenerating ? 'generating' : 'newThread'}`} onClick={handleReset}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isGenerating ? (
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            ) : (
              <>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </>
            )}
          </svg>
          <span className="shortcut-area">{isGenerating ? (<>
            Stop generation
            <span className="shortcut">
              ⌘⌫
            </span>
          </>) : 'New thread'}</span>
        </button>
      )}
      <Responses
        messages={messages}
        updateMessage={updateMessage}
        forceScroll={forceScroll}
        handleRegenerate={handleRegenerate}
        handleResetAndRegenerate={handleResetAndRegenerate}
        handleStop={handleStop}
        handleSend={handleSend}
        models={isLoggedIn ? models : demoModels}
        chatInput={chatInput}
        setChatInput={setChatInput}
        openModal={openModal}
        isGenerating={isGenerating}
        selectedModels={selectedModels}
        setSelectedModels={setSelectedModels}
        showResetButton={showResetButton}
        handleReset={handleReset}
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