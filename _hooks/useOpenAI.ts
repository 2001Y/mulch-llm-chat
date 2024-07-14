import { useState, useEffect } from "react";
import OpenAI from "openai";

export const useOpenAI = (accessToken: string) => {
    const [openai, setOpenai] = useState<OpenAI | null>(null);

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
