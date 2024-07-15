'use client';

import { useState, useCallback } from "react";
import useAccessToken from "_hooks/useAccessToken";
import { useOpenAI } from "_hooks/useOpenAI";

export default function WeatherTool() {
    const [accessToken] = useAccessToken();
    const [demoAccessToken] = useState(process.env.NEXT_PUBLIC_DEMO || '');
    const openai = useOpenAI(accessToken || demoAccessToken);
    const [input, setInput] = useState('東京の天気は？');
    const [response, setResponse] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [functionCallLog, setFunctionCallLog] = useState('');

    const getCurrentWeather = (location: string = "東京") => {
        const randomTemperature = () => (Math.random() * 40 - 10).toFixed(1);
        const weatherConditions = ["晴れ", "曇り", "雨", "雪"];
        const randomWeather = () => weatherConditions[Math.floor(Math.random() * weatherConditions.length)];

        return {
            location,
            temperature: randomTemperature(),
            weather: randomWeather()
        };
    };

    const handleToolCalls = async (toolCalls: any[]) => {
        let result = '';
        for (const toolCall of toolCalls) {
            if (toolCall.function && toolCall.function.name === 'get_current_weather') {
                try {
                    // 引数の文字列をトリムし、空文字列でないことを確認
                    const argsString = toolCall.function.arguments.trim();
                    if (!argsString) {
                        throw new Error('引数が空です');
                    }
                    // JSON.parseを試みる前に、引数が有効なJSONであることを確認
                    const args = JSON.parse(argsString);
                    const { location } = args;
                    setFunctionCallLog(prev => prev + `\nファンクションコール: get_current_weather(${location})`);
                    const weatherResult = getCurrentWeather(location);
                    result += `\n天気情報:\n場所: ${weatherResult.location}\n温度: ${weatherResult.temperature}°C\n天気: ${weatherResult.weather}\n`;
                    setFunctionCallLog(prev => prev + `\n結果: ${JSON.stringify(weatherResult)}\n`);
                } catch (error) {
                    console.error("天気情報取得エラー:", error);
                    result += `\nエラー: 天気情報の取得に失敗しました。詳細: ${error.message}\n`;
                    setFunctionCallLog(prev => prev + `\nエラー: ${error}\n`);
                }
            }
        }
        return result;
    };

    const fetchWeatherResponse = useCallback(async () => {
        setIsGenerating(true);
        setFunctionCallLog('');
        try {
            const stream = await openai?.chat.completions.create({
                model: 'anthropic/claude-3.5-sonnet',
                messages: [
                    { role: 'user', content: input }
                ],
                stream: true,
                tool_choice: "auto",
                tools: [
                    {
                        type: "function",
                        function: {
                            name: "get_current_weather",
                            description: "指定された場所の現在の天気を取得します",
                            parameters: {
                                type: "object",
                                properties: {
                                    location: {
                                        type: "string",
                                        description: "場所（例：東京）",
                                    }
                                },
                                required: ["location"],
                            },
                        },
                    },
                ],
            });

            if (stream) {
                let fullResponse = '';
                for await (const part of stream) {
                    const content = part.choices[0]?.delta?.content || '';
                    const toolCalls = part.choices[0]?.delta?.tool_calls;

                    if (toolCalls) {
                        fullResponse += await handleToolCalls(toolCalls);
                    } else {
                        fullResponse += content;
                    }

                    setResponse(fullResponse);
                }
            }
        } catch (error) {
            console.error('エラー:', error);
            setResponse('エラーが発生しました。');
            setFunctionCallLog(prev => prev + `\nエラー: ${error}\n`);
        } finally {
            setIsGenerating(false);
        }
    }, [input, openai]);

    return (
        <div className="weather-tool-container">
            <h1>GPT天気ツール</h1>
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="天気について質問してください（例：東京の天気は？）"
            />
            <button onClick={fetchWeatherResponse} disabled={isGenerating}>
                {isGenerating ? '生成中...' : '送信'}
            </button>
            <div className="response-area">
                <h2>応答:</h2>
                <pre>{response}</pre>
            </div>
            <div className="function-call-log">
                <h2>ファンクションコールログ:</h2>
                <pre>{functionCallLog}</pre>
            </div>
        </div>
    );
}
