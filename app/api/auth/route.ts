export default async function handler(req, res) {
    const { code, redirectUri, codeVerifier } = req.body;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: "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"
            }),
        });

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching access token:', error);
        res.status(500).json({ error: 'Error fetching access token' });
    }
}