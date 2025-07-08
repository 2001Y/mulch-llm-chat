/*
  utils/mcpClient.ts
  ------------------
  役割: Model Context Protocol(MCP) サーバーへの TypeScript SDK クライアント生成を一元管理します。
  - サーバーURL とトークンは環境変数から取得し、ブラウザ側/サーバー側の両方で利用可能なようにしています。
  - 他モジュールはこのクライアントを import して `invoke` などのSDKメソッドを利用してください。
*/

// TypeScript 型がまだ提供されていない環境でのコンパイルエラーを防ぐ
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { createClient } from "@modelcontextprotocol/typescript-sdk";

// サーバーURL と トークンはビルド時/実行時に設定する
const SERVER_URL =
  process.env.NEXT_PUBLIC_MCP_SERVER ?? "https://your-mcp-server.example.com";
const MCP_TOKEN = process.env.NEXT_PUBLIC_MCP_TOKEN;

export const mcpClient = createClient({
  server: SERVER_URL,
  auth: MCP_TOKEN ? { bearer: MCP_TOKEN } : undefined,
});
