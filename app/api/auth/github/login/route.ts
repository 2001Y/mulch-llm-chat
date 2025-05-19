import { NextResponse, NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  // const redirectUri = process.env.GITHUB_CALLBACK_URL; // 例: http://localhost:3000/api/auth/github/callback
  const host = request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    (host?.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  if (!githubClientId || !baseUrl || !host) {
    console.error(
      "GITHUB_CLIENT_ID or baseUrl could not be determined from request headers."
    );
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }
  const redirectUri = `${baseUrl}/api/auth/github/callback`;

  const scope = "gist";
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${redirectUri}&scope=${scope}`;

  return NextResponse.redirect(githubAuthUrl);
}
