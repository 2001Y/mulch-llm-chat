import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET(req: NextRequest) {
  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_SSNB,
    baseURL: 'https://openrouter.ai/api/v1',
    dangerouslyAllowBrowser: true,
  });

  const messages = [
    { role: 'system', content: 'あなたは役に立つアシスタントです。' },
    { role: 'user', content: '東京の現在の天気はどうですか？' }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "anthropic/claude-3.5-sonnet",
      messages,
      tool_choice: "auto",
      tools: [
        {
          type: "function",
          function: {
            name: "get_current_weather",
            description: "Get the current weather in a given location",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string", description: "場所（例：東京" },
              },
              required: ["location"],
            },
          },
        },
      ],
    });

    let result = response.choices[0]?.message?.content || '';
    const toolCalls = response.choices[0]?.message?.tool_calls;

    if (toolCalls) {
      result = await handleToolCalls(toolCalls);
    }

    return NextResponse.json({ content: result });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

async function handleToolCalls(toolCalls: any[]) {
  let result = '';
  for (const toolCall of toolCalls) {
    if (toolCall.function?.name === 'get_current_weather') {
      try {
        const { location } = JSON.parse(toolCall.function.arguments);
        const weatherResult = getCurrentWeather(location);
        result += `\n天気情報:\n場所: ${weatherResult.location}\n温度: ${weatherResult.temperature}°C\n天気: ${weatherResult.weather}\n`;
      } catch (error) {
        console.error("天気情報取得エラー:", error);
        result += "\nエラー: 天気情報の取得に失敗しました。\n";
      }
    }
  }
  return result;
}

function getCurrentWeather(location: string = "Tokyo") {
  const randomTemperature = () => (Math.random() * 40 - 10).toFixed(1);
  const randomWeather = () => ["晴れ", "曇り", "雨", "雪"][Math.floor(Math.random() * 4)];

  return {
    location,
    temperature: randomTemperature(),
    weather: randomWeather()
  };
}
