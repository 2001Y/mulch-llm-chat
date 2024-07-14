export default function handler(req, res) {
    const manifest = {
        name: "Mulch AI Chat",
        short_name: "Mulch AI Chat",
        start_url: req.query.url || '/',
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        description: "A chat application using LLM",
        icons: [
            {
                src: "https://mulch-llm-chat.vercel.app/apple-touch-icon.jpg",
                sizes: "512x512",
                type: "image/jpg"
            }
        ]
    };

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(manifest);
}