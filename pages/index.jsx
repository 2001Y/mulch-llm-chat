import { useState, useEffect } from 'react';
import OpenAI from 'openai';

const isProduction = process.env.NODE_ENV === 'production';
const redirectUri = isProduction ? 'https://mulch-llm-chat.vercel.app' : 'https://3000.2001y.dev';

export default function Home() {
  const [models, setModels] = useState(['perplexity/llama-3-sonar-large-32k-online', 'openai/gpt-4o', 'openai/gpt-3.5-turbo']);
  const [chatInput, setChatInput] = useState('');
  const [responses, setResponses] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [openai, setOpenai] = useState(null);

  useEffect(() => {
    const savedModels = localStorage.getItem('models');
    if (savedModels) setModels(savedModels.split(','));

    const savedAccessToken = localStorage.getItem('accessToken');
    if (savedAccessToken) setAccessToken(savedAccessToken);
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !accessToken) {
      fetchAccessToken(code);
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      initializeOpenAI(accessToken);
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
      localStorage.setItem('accessToken', data.key);

      // codeパラメータを削除
      const url = new URL(window.location);
      url.searchParams.delete('code');
      window.history.replaceState({}, document.title, url.toString());
    } catch (error) {
      console.error('Error fetching access token:', error);
    }
  };

  const initializeOpenAI = (token) => {
    const openaiInstance = new OpenAI({
      apiKey: token,
      baseURL: 'https://openrouter.ai/api/v1',
      dangerouslyAllowBrowser: true,
    });
    setOpenai(openaiInstance);
  };

  const handleLogin = () => {
    const openRouterAuthUrl = `https://openrouter.ai/auth?callback_url=${redirectUri}`;
    window.location.href = openRouterAuthUrl;
  };

  const handleModelInput = (event) => {
    const modelsArray = event.target.value.split(',').map(model => model.trim());
    setModels(modelsArray);
    localStorage.setItem('models', modelsArray.join(','));
  };

  const handleChatInput = (event) => {
    setChatInput(event.target.value);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !isComposing) {
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

  const fetchChatResponse = async (model, index) => {
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
  };

  const updateResponse = (index, text) => {
    setResponses(prevResponses => {
      const newResponses = [...prevResponses];
      newResponses[index] = { ...newResponses[index], text };
      return newResponses;
    });
  };

  const handleSend = async () => {
    if (!chatInput.trim()) return;

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

  return (
    <>
      {!accessToken ? (
        <button onClick={handleLogin}>Login to OpenRouter</button>
      ) : (
        <>
          <header>
            <h1>MULCH AI CHAT</h1>
          </header>
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

          <section className="input-section">
            <div className="input-container">
              Models
              <input type="text" value={models.join(',')} onChange={handleModelInput} className="model-input" />
            </div>
            <div className="input-container">
              <input
                type="text"
                value={chatInput}
                onChange={handleChatInput}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                className="chat-input"
              />
              <button onClick={handleSend} className="send-button">Send</button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
