"use client";

import { useRouter } from 'next/navigation';

const isProduction = process.env.NODE_ENV === "production";
const redirectUri = isProduction ? "https://mulch-llm-chat.vercel.app" : "https://3000.2001y.dev";

export default function LoginPage() {
    const router = useRouter();

    const handleLogin = () => {
        const openRouterAuthUrl = `https://openrouter.ai/auth?callback_url=${redirectUri}`;
        window.location.href = openRouterAuthUrl;
    };

    return (
        <div>
            <h1>Login</h1>
            <button onClick={handleLogin} className="login-button">OpenRouterにログイン</button>
        </div>
    );
}