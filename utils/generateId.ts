import { nanoid } from "nanoid";

export function generateId(length: number = 8): string {
  // サーバーサイドでは固定のプレフィックスを持つIDを生成
  if (typeof window === "undefined") {
    return `ssr-${nanoid(length)}`;
  }
  // クライアントサイドでは通常のnanoidを使用
  return nanoid(length);
}
