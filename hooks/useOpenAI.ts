import { useState, useEffect } from "react";
import OpenAI from "openai";

export const useOpenAI = (accessToken: string | undefined | null) => {
  const [openai, setOpenai] = useState<OpenAI | null>(null);

  useEffect(() => {
    if (accessToken) {
      const openaiInstance = new OpenAI({
        apiKey: accessToken,
        baseURL: "https://openrouter.ai/api/v1",
        dangerouslyAllowBrowser: true,
        // defaultHeaders: {
        //   "HTTP-Referer": window.location.origin,
        //   "X-Title": "Mulch AI Chat",
        // },
      });
      setOpenai(openaiInstance);
    } else {
      setOpenai(null);
    }
  }, [accessToken]);

  return openai;
};
