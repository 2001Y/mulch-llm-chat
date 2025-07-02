import { NextRequest, NextResponse } from "next/server";

// 招待コード→OpenRouter APIキーのマッピングは環境変数 `INVITE_CODES` から読み込む。
// 形式例:
//   INVITE_CODES='{"20010920YT":"sk-or-...","ABCDEF":"sk-or-..."}'
// Vercel などの環境変数は文字列なので JSON.parse して扱う。

function loadInviteCodes(): Record<string, string> {
  const raw = process.env.INVITE_CODES;
  if (!raw) {
    console.warn("[InviteCode] 環境変数 INVITE_CODES が設定されていません");
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      console.error(
        "[InviteCode] INVITE_CODES はオブジェクト(JSON)である必要があります"
      );
      return {};
    }
    return parsed as Record<string, string>;
  } catch (e) {
    console.error("[InviteCode] INVITE_CODES の JSON 解析に失敗しました", e);
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "招待コードが提供されていません" },
        { status: 400 }
      );
    }

    // 招待コードの検証（大文字小文字を区別しない）
    const normalizedCode = code.trim().toUpperCase();
    const inviteCodes = loadInviteCodes();
    const isValid = Object.keys(inviteCodes).some(
      (validCode) => validCode.toUpperCase() === normalizedCode
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "無効な招待コードです" },
        { status: 401 }
      );
    }

    // 有効な招待コードの場合、対応するAPIキーを取得して返す
    const apiKey =
      inviteCodes[
        Object.keys(inviteCodes).find(
          (validCode) => validCode.toUpperCase() === normalizedCode
        ) as keyof typeof inviteCodes
      ];

    return NextResponse.json({
      success: true,
      message: "招待コードが検証されました",
      apiKey,
    });
  } catch (error) {
    console.error("[Invite Code Validation] Error:", error);
    return NextResponse.json(
      { error: "招待コードの検証中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
