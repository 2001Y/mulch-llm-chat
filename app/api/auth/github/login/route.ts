import { NextResponse } from "next/server";

export async function GET() {
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL; // 例: http://localhost:3000/api/auth/github/callback

  if (!githubClientId || !redirectUri) {
    console.error(
      "GITHUB_CLIENT_ID or GITHUB_CALLBACK_URL is not set in environment variables."
    );
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const scope = "gist";
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${redirectUri}&scope=${scope}`;

  return NextResponse.redirect(githubAuthUrl);
}
