import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    console.error("Authorization code not found in OpenRouter callback.");
    return NextResponse.json(
      { error: "Authorization code not found" },
      { status: 400 }
    );
  }

  try {
    // OpenRouterのAPIキー取得エンドポイントにコードを送信
    const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: code,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to fetch API key from OpenRouter:", errorData);

      // エラー時も親ウィンドウに通知
      const htmlResponse = `
        <html>
          <head><title>OpenRouter OAuth Error</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'openrouter_oauth_error',
                  error: 'Failed to obtain API key',
                  details: '${JSON.stringify(
                    errorData.error || "Unknown OpenRouter error"
                  )}'
                }, '*');
              }
              window.close();
            </script>
            <p>Error: Failed to obtain API key. This window should close automatically.</p>
          </body>
        </html>
      `;
      return new NextResponse(htmlResponse, {
        status: response.status,
        headers: { "Content-Type": "text/html" },
      });
    }

    const data = await response.json();
    const apiKey = data.key;

    if (!apiKey) {
      console.error("API key not found in OpenRouter response:", data);

      const htmlResponse = `
        <html>
          <head><title>OpenRouter OAuth Error</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'openrouter_oauth_error', 
                  error: 'API key not found in response' 
                }, '*');
              }
              window.close();
            </script>
            <p>Error: API key not found. This window should close automatically.</p>
          </body>
        </html>
      `;
      return new NextResponse(htmlResponse, {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    console.log("OpenRouter API Key obtained (to be sent to opener):", apiKey);

    // 親ウィンドウにAPIキーを送信し、このウィンドウを閉じるHTMLを返す
    const htmlResponse = `
      <html>
        <head><title>OpenRouter OAuth Success</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'openrouter_oauth_success', 
                token: '${apiKey}' 
              }, '*');
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
    console.error("Error during OpenRouter OAuth callback:", error);

    // エラー時も親ウィンドウに通知
    const htmlResponse = `
      <html>
        <head><title>OpenRouter OAuth Error</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'openrouter_oauth_error', 
                error: 'Internal server error during callback' 
              }, '*');
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
