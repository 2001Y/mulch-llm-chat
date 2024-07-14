import { useState, useEffect } from "react";
import useLocalStorage from "./useLocalStorage";

export default function useAccessToken() {
    const [accessToken, setAccessToken] = useLocalStorage('accessToken', '');
    const [previousAccessToken, setPreviousAccessToken] = useState(accessToken);

    useEffect(() => {
        if (accessToken !== previousAccessToken) {
            setPreviousAccessToken(accessToken);
        }
    }, [accessToken, previousAccessToken]);

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
            const ssnb = urlParams.get('ssnb');

            if (code && !accessToken) {
                fetchAccessToken(code);
            }

            if (ssnb) {
                const newAccessToken = process.env.NEXT_PUBLIC_SSNB;
                setAccessToken(newAccessToken);
            }
        }
    }, [accessToken]);

    return [accessToken, setAccessToken, previousAccessToken];
};