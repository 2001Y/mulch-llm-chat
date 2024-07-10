export async function getServerSideProps(context) {
    const { query } = context;
    const startUrl = new URL('/?' + new URLSearchParams(query), 'https://yourdomain.com');

    const manifest = {
        name: "Mulch AI Chat",
        short_name: "Mulch AI Chat",
        start_url: startUrl.toString(),
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

    return {
        props: {
            manifest
        }
    };
}

export default function Manifest({ manifest }) {
    return (
        <div>
            <pre>{JSON.stringify(manifest, null, 2)}</pre>
        </div>
    );
}