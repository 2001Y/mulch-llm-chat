import { useState, useEffect } from 'react';
import OpenAI from "openai"

const redirectUri = 'https://3000.2001y.dev';

export default function Home() {
  const [models, setModels] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [responses, setResponses] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [openai, setOpenai] = useState(null); // 追加

  useEffect(() => {
    const savedModels = localStorage.getItem('models');
    if (savedModels) {
      setModels(savedModels.split(','));
    }
    const savedAccessToken = localStorage.getItem('accessToken');
    if (savedAccessToken) {
      setAccessToken(savedAccessToken);
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !accessToken) {
      fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
        .then(response => response.json())
        .then(data => {
          setAccessToken(data.key);
          localStorage.setItem('accessToken', data.key);
        })
        .catch(error => console.error('Error fetching access token:', error));
    }

    if (accessToken) {
      const openaiInstance = new OpenAI({
        apiKey: accessToken,
        baseURL: "https://openrouter.ai/api/v1",
        dangerouslyAllowBrowser: true,
      });
      setOpenai(openaiInstance); // 追加
    }
  }, [accessToken]);

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
        model: model,
        messages: [{ role: "user", content: chatInput }],
        stream: true,
      });

      let result = '';
      for await (const part of stream) {
        const content = part.choices[0]?.delta?.content || "";
        result += content;
        setResponses(prevResponses => {
          const newResponses = [...prevResponses];
          newResponses[index] = { ...newResponses[index], text: result };
          return newResponses;
        });
      }

      return result;
    } catch (error) {
      console.error('Error fetching response from model:', model, error);
      setResponses(prevResponses => {
        const newResponses = [...prevResponses];
        newResponses[index] = { ...newResponses[index], text: 'Error' };
        return newResponses;
      });
    }
  };

  const handleSend = async () => {
    if (!chatInput.trim()) {
      return; // 空欄の場合は送信しない
    }

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
      setResponses(prevResponses => {
        const newResponses = [...prevResponses];
        newResponses[index] = { model, text };
        return newResponses;
      });
    } catch (error) {
      console.error('Error regenerating response:', error);
    }
  };

  return (
    <>
      {!accessToken && <button onClick={handleLogin}>Login to OpenRouter</button>}
      {accessToken && <>
        <h1>mulch AI Chat</h1>
        <div className="input-container">
          <label>
            Models
            <input type="text" value={models.join(',')} onChange={handleModelInput} className="model-input" />
          </label>
        </div>
        <div className="input-container">
          <label>
            <input
              type="text"
              value={chatInput}
              onChange={handleChatInput}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              className="chat-input"
            />
          </label>
          <button onClick={handleSend} className="send-button">Send</button>
        </div>
        <div className="responses-container">
          {responses.map((response, index) => (
            <div key={index} className={`response ${index === selectedResponse ? 'selected' : ''}`}>
              <p>{response.text}</p>
              <div className="meta">
                <small>{response.model}</small>
                <button onClick={() => handleRegenerate(index)} className="regenerate-button">ReGenerate</button>
              </div>
            </div>
          ))}
        </div>
      </>}
      <style jsx>{`
        .meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .container {padding: 20px; max-width: 800px; margin: 0 auto; }
        .login-button {padding: 10px 20px; font-size: 16px; }
        .input-container {margin-bottom: 20px; }
        .model-input, .chat-input {width: calc(100% - 110px); padding: 10px; font-size: 16px; }
        .send-button {padding: 10px 20px; font-size: 16px; margin-left: 10px; }
        .responses-container {display: flex; overflow-x: scroll;}
        .response {
          width: 20em;
          border: 1px solid grey; padding: 10px; margin: 10px; box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1); }
        .response.selected {border: 2px solid blue; }
        .select-button, .regenerate-button {padding: 5px 10px; font-size: 14px; margin-top: 10px; margin-right: 10px; }
      `}</style>
    </>
  );
}