import { NextRequest, NextResponse } from "next/server";
import inviteCodes from "@/config/invite-codes.json";

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
    const isValid = Object.keys(inviteCodes.codes).some(
      (validCode) => validCode.toUpperCase() === normalizedCode
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "無効な招待コードです" },
        { status: 401 }
      );
    }

    // 有効な招待コードの場合、成功レスポンスを返す
    // APIキーは返さない（セキュリティのため）
    return NextResponse.json({
      success: true,
      message: "招待コードが検証されました",
    });
  } catch (error) {
    console.error("[Invite Code Validation] Error:", error);
    return NextResponse.json(
      { error: "招待コードの検証中にエラーが発生しました" },
      { status: 500 }
    );
  }
}