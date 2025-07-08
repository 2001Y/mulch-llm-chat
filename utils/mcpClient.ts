/*
  utils/mcpClient.ts
  ------------------
  役割: Model Context Protocol(MCP) サーバーへの TypeScript SDK クライアント生成を一元管理します。
  - サーバーURL とトークンは環境変数から取得し、ブラウザ側/サーバー側の両方で利用可能なようにしています。
  - 他モジュールはこのクライアントを import して `invoke` などのSDKメソッドを利用してください。
*/

// MCP SDK の Client クラスを使用
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Client } from "@modelcontextprotocol/sdk/client";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";

// create singleton client helper
function createMcpClient() {
  // デフォルトで利用可能な公開MCPサーバー(AWS News MCP)
  // NEXT_PUBLIC_MCP_SERVER が未設定の場合はこのエンドポイントを利用する
  const SERVER_URL =
    process.env.NEXT_PUBLIC_MCP_SERVER ??
    "https://demo.mcp.run/echo/streamableHttp"; // 公式デモサーバー（CORS許可済み）
  const MCP_TOKEN = process.env.NEXT_PUBLIC_MCP_TOKEN;

  // initialize client
  const client = new Client({ name: "mulch-client", version: "0.1.0" });

  const transport = new StreamableHTTPClientTransport(new URL(SERVER_URL), {
    headers: MCP_TOKEN ? { Authorization: `Bearer ${MCP_TOKEN}` } : undefined,
  });

  // connect lazily when first used
  let isConnected = false;

  async function ensureConnected() {
    if (!isConnected) {
      await client.connect(transport);
      isConnected = true;
    }
  }

  return {
    async invoke(toolName: string, args: any) {
      await ensureConnected();
      const result = await client.callTool({ name: toolName, arguments: args });
      return result;
    },
  };
}

export const mcpClient = createMcpClient();
