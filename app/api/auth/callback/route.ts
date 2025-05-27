import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  console.log("[OpenRouter Callback] Received parameters:", {
    code: code ? `${code.substring(0, 10)}...` : null,
    fullUrl: request.nextUrl.toString(),
  });

  if (!code) {
    console.error(
      "[OpenRouter Callback] Authorization code not found in OpenRouter callback."
    );
    return NextResponse.json(
      { error: "Authorization code not found" },
      { status: 400 }
    );
  }

  try {
    // OpenRouterのAPIキー取得エンドポイントにコードを送信
    const requestBody: any = {
      code: code,
    };

    console.log("[OpenRouter Callback] Sending request to OpenRouter API:", {
      url: "https://openrouter.ai/api/v1/auth/keys",
      bodyKeys: Object.keys(requestBody),
    });

    const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log(
      "[OpenRouter Callback] OpenRouter API response status:",
      response.status
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error(
        "[OpenRouter Callback] Failed to fetch API key from OpenRouter:",
        {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        }
      );

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
                  details: '${JSON.stringify(errorData).replace(/'/g, "\\'")}'
                }, '*');
              }
              window.close();
            </script>
            <p>Error: Failed to obtain API key. This window should close automatically.</p>
            <p>Status: ${response.status} ${response.statusText}</p>
            <p>Details: ${JSON.stringify(errorData)}</p>
          </body>
        </html>
      `;
      return new NextResponse(htmlResponse, {
        status: response.status,
        headers: { "Content-Type": "text/html" },
      });
    }

    const responseText = await response.text();
    console.log(
      "[OpenRouter Callback] OpenRouter API response body:",
      responseText
    );

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "[OpenRouter Callback] Failed to parse OpenRouter response:",
        parseError
      );
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    const apiKey = data.key;

    if (!apiKey) {
      console.error(
        "[OpenRouter Callback] API key not found in OpenRouter response:",
        data
      );

      const htmlResponse = `
        <html>
          <head><title>OpenRouter OAuth Error</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'openrouter_oauth_error', 
                  error: 'API key not found in response',
                  details: '${JSON.stringify(data).replace(/'/g, "\\'")}'
                }, '*');
              }
              window.close();
            </script>
            <p>Error: API key not found. This window should close automatically.</p>
            <p>Response: ${JSON.stringify(data)}</p>
          </body>
        </html>
      `;
      return new NextResponse(htmlResponse, {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }

    console.log(
      "[OpenRouter Callback] OpenRouter API Key obtained successfully:",
      `${apiKey.substring(0, 10)}...`
    );

    // 親ウィンドウにAPIキーを送信し、このウィンドウを閉じるHTMLを返す
    const htmlResponse = `
      <html>
        <head><title>OpenRouter OAuth Success</title></head>
        <body>
          <script>
            console.log('[OpenRouter Callback] Sending success message to parent window');
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'openrouter_oauth_success', 
                token: '${apiKey}' 
              }, '*');
              console.log('[OpenRouter Callback] Success message sent');
            } else {
              console.error('[OpenRouter Callback] No opener window found');
            }
            setTimeout(() => {
              window.close();
            }, 1000);
          </script>
          <p>Authentication successful. This window should close automatically.</p>
          <p>API Key: ${apiKey.substring(0, 10)}...</p>
        </body>
      </html>
    `;

    return new NextResponse(htmlResponse, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error(
      "[OpenRouter Callback] Error during OpenRouter OAuth callback:",
      error
    );

    // エラー時も親ウィンドウに通知
    const htmlResponse = `
      <html>
        <head><title>OpenRouter OAuth Error</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'openrouter_oauth_error', 
                error: 'Internal server error during callback',
                details: '${String(error).replace(/'/g, "\\'")}'
              }, '*');
            }
            window.close();
          </script>
          <p>Error: Internal server error. This window should close automatically.</p>
          <p>Details: ${String(error)}</p>
        </body>
      </html>
    `;
    return new NextResponse(htmlResponse, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}
