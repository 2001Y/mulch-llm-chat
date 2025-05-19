import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    console.error("Authorization code not found in callback.");
    return NextResponse.json(
      { error: "Authorization code not found" },
      { status: 400 }
    );
  }

  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  const host = request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    (host?.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  if (!githubClientId || !githubClientSecret || !baseUrl || !host) {
    console.error(
      "GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, or baseUrl could not be determined from request headers."
    );
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const redirectUri = `${baseUrl}/api/auth/github/callback`;

  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: githubClientId,
          client_secret: githubClientSecret,
          code: code,
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Failed to fetch access token from GitHub:", errorData);
      return NextResponse.json(
        { error: "Failed to obtain access token", details: errorData },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("Access token not found in GitHub response:", tokenData);
      // エラー時も親ウィンドウに通知することを検討
      const htmlResponse = `
        <html>
          <head><title>OAuth Error</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'github_oauth_error', error: 'Access token not found' }, '*');
              }
              window.close();
            </script>
            <p>Error: Access token not found. This window should close automatically.</p>
          </body>
        </html>
      `;
      return new NextResponse(htmlResponse, {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    console.log(
      "GitHub Access Token obtained (to be sent to opener):",
      accessToken
    );

    // 親ウィンドウにアクセストークンを送信し、このウィンドウを閉じるHTMLを返す
    const htmlResponse = `
      <html>
        <head><title>OAuth Success</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'github_oauth_success', token: '${accessToken}' }, '*'); // セキュリティのため送信元オリジンを限定することを推奨
            }
            window.close();
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `;

    return new NextResponse(htmlResponse, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Error during GitHub OAuth callback:", error);
    // エラー時も親ウィンドウに通知
    const htmlResponse = `
      <html>
        <head><title>OAuth Error</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'github_oauth_error', error: 'Internal server error during callback' }, '*');
            }
            window.close();
          </script>
          <p>Error: Internal server error. This window should close automatically.</p>
        </body>
      </html>
    `;
    return new NextResponse(htmlResponse, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}
