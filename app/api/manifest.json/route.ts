import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startUrl = searchParams.get("url") || "/";

  const manifest = {
    name: "Mulch AI Chat",
    short_name: "Mulch AI Chat",
    start_url: startUrl,
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    description: "A chat application using LLM",
    icons: [
      {
        src: "https://mulch-llm-chat.vercel.app/apple-touch-icon.jpg",
        sizes: "512x512",
        type: "image/jpg",
      },
    ],
  };

  return NextResponse.json(manifest);
}
