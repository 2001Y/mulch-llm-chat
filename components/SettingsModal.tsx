import React, { useState, useEffect, useRef } from "react";
import BaseModal from "./BaseModal";
import useStorageState from "hooks/useLocalStorage";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import { storage } from "hooks/useLocalStorage";
import { toast } from "sonner";

interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export default function SettingsModal() {
  const {
    isModalOpen,
    handleCloseModal: closeModal,
    resetCurrentChat,
  } = useChatLogicContext();

  const [mounted, setMounted] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [isOpenRouterLoading, setIsOpenRouterLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isOpenRouterLoggedIn, setIsOpenRouterLoggedIn] = useState(false);
  const [isGitHubLoggedIn, setIsGitHubLoggedIn] = useState(false);

  // 招待コード関連の状態
  const [inviteCode, setInviteCode] = useState("");
  const [isInviteCodeMode, setIsInviteCodeMode] = useState(false);
  const [isValidatingInviteCode, setIsValidatingInviteCode] = useState(false);
  const [savedInviteCode, setSavedInviteCode] = useState("");

  useEffect(() => {
    setMounted(true);
    // 初期状態を設定
    const openRouterToken = storage.get("openrouter_api_key");
    const githubToken = storage.getGistToken();
    const storedInviteCode = storage.get("invite_code");

    console.log(
      "[SettingsModal] 初期状態設定 - OpenRouterトークン:",
      openRouterToken
    );
    console.log("[SettingsModal] 初期状態設定 - GitHubトークン:", githubToken);
    console.log("[SettingsModal] 初期状態設定 - 招待コード:", storedInviteCode);

    setIsOpenRouterLoggedIn(!!openRouterToken || !!storedInviteCode);
    setIsGitHubLoggedIn(!!githubToken);
    setIsInviteCodeMode(!!storedInviteCode);
    if (storedInviteCode) {
      setSavedInviteCode(storedInviteCode);
    }

    // Safari用: ページ読み込み時に認証完了をチェック
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("auth") === "success") {
      // URLパラメータをクリア（履歴を汚さないため）
      const url = new URL(window.location.href);
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.toString());

      // 認証成功の通知
      if (openRouterToken) {
        console.log("[SettingsModal] Safari認証完了を検出");
        toast.success("認証成功", {
          description:
            "OpenRouterとの認証が完了しました。AIモデルが利用可能になりました。",
          duration: 4000,
        });
      }
    }
  }, []);

  // 認証状態の変更を監視
  useEffect(() => {
    const handleTokenChange = () => {
      const token = storage.get("openrouter_api_key");
      const storedInviteCode = storage.get("invite_code");
      console.log("[SettingsModal] tokenChangeイベント受信 - トークン:", token);
      console.log(
        "[SettingsModal] tokenChangeイベント受信 - 招待コード:",
        storedInviteCode
      );
      setIsOpenRouterLoggedIn(!!token || !!storedInviteCode);
      setIsInviteCodeMode(!!storedInviteCode);
      if (storedInviteCode) {
        setSavedInviteCode(storedInviteCode);
      }
    };

    const handleStorageChange = () => {
      const token = storage.getGistToken();
      console.log(
        "[SettingsModal] storageChangeイベント受信 - GitHubトークン:",
        token
      );
      setIsGitHubLoggedIn(!!token);
    };

    window.addEventListener("tokenChange", handleTokenChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("tokenChange", handleTokenChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // OpenRouterとGitHubのOAuth認証メッセージを処理
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      console.log("[SettingsModal] Received postMessage:", event.data);
      const { type, token, error } = event.data;

      if (type === "openrouter_oauth_success" && token) {
        console.log(
          "[SettingsModal] OpenRouter OAuth成功 (postMessage):",
          token
        );
        console.log(
          "[SettingsModal] 保存前のローカルストレージ状態:",
          storage.get("openrouter_api_key")
        );

        storage.set("openrouter_api_key", token);

        // 招待コードモードを解除
        storage.remove("invite_code");
        setIsInviteCodeMode(false);
        setInviteCode("");
        setSavedInviteCode("");

        console.log(
          "[SettingsModal] 保存後のローカルストレージ状態:",
          storage.get("openrouter_api_key")
        );
        console.log("[SettingsModal] tokenChangeイベントを発行");

        window.dispatchEvent(new Event("tokenChange"));
        setIsOpenRouterLoading(false);
        setAuthError("");

        // 認証状態を即座に更新
        setIsOpenRouterLoggedIn(true);

        // 成功トースト通知を表示
        toast.success("認証成功", {
          description:
            "OpenRouterとの認証が完了しました。AIモデルが利用可能になりました。",
          duration: 4000,
        });
      } else if (type === "openrouter_oauth_error") {
        console.error("OpenRouter OAuthエラー (postMessage):", error);
        setAuthError(`OpenRouter認証エラー: ${error || "不明なエラー"}`);
        setIsOpenRouterLoading(false);

        // エラートースト通知を表示
        toast.error("認証エラー", {
          description: `OpenRouter認証に失敗しました: ${
            error || "不明なエラー"
          }`,
          duration: 5000,
        });
      } else if (type === "github_oauth_success" && token) {
        console.log("GitHub OAuth成功 (postMessage):", token);
        storage.set("gistToken", token);
        storage.set("gistOAuthSuccess", "true");
        setIsGitHubLoading(false);
        setAuthError("");

        // 成功トースト通知を表示
        toast.success("認証成功", {
          description:
            "GitHubとの認証が完了しました。チャット共有機能が利用可能になりました。",
          duration: 4000,
        });
      } else if (type === "github_oauth_error") {
        console.error("GitHub OAuthエラー (postMessage):", error);
        setAuthError(`GitHub認証エラー: ${error || "不明なエラー"}`);
        setIsGitHubLoading(false);

        // エラートースト通知を表示
        toast.error("認証エラー", {
          description: `GitHub認証に失敗しました: ${error || "不明なエラー"}`,
          duration: 5000,
        });
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => {
      window.removeEventListener("message", handleAuthMessage);
    };
  }, []);

  // 招待コードの検証処理
  const handleValidateInviteCode = async () => {
    if (!inviteCode.trim()) {
      toast.error("招待コードを入力してください");
      return;
    }

    setIsValidatingInviteCode(true);
    setAuthError("");

    try {
      const response = await fetch("/api/invite-code/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: inviteCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "招待コードの検証に失敗しました");
      }

      // 検証成功: APIキーをローカルストレージに保存し、招待コードは保持しない
      const apiKey = data.apiKey;

      if (!apiKey) {
        throw new Error("APIキーが取得できませんでした");
      }

      storage.set("openrouter_api_key", apiKey);
      storage.remove("invite_code"); // 旧招待コードを削除

      setIsInviteCodeMode(false);
      setIsOpenRouterLoggedIn(true);
      setSavedInviteCode("");

      // 他コンポーネントへ状態変更を通知
      window.dispatchEvent(new Event("tokenChange"));

      toast.success("招待コード認証成功", {
        description:
          "APIキーが発行・保存されました。AIモデルが利用可能になりました。",
        duration: 4000,
      });
    } catch (error: any) {
      console.error("[SettingsModal] 招待コード検証エラー:", error);
      setAuthError(error.message);
      toast.error("招待コード検証エラー", {
        description: error.message,
        duration: 5000,
      });
    } finally {
      setIsValidatingInviteCode(false);
    }
  };

  // OpenRouter ログイン処理
  const handleOpenRouterLogin = () => {
    console.log("[SettingsModal] OpenRouterログイン開始");
    setIsOpenRouterLoading(true);
    setAuthError("");

    // Safariかどうかを検出
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
      navigator.vendor === "Apple Computer, Inc.";

    console.log("[SettingsModal] Safari検出:", isSafari);

    if (isSafari) {
      // Safari用: リダイレクトベースの認証
      console.log("[SettingsModal] Safari用リダイレクト認証を開始");
      const callbackUrl = window.location.origin + "/api/auth/callback";
      const authUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(
        callbackUrl
      )}`;

      // 現在のページのURLを保存（認証後に戻るため）
      sessionStorage.setItem("openrouter_return_url", window.location.href);

      // 直接リダイレクト
      window.location.href = authUrl;
      return;
    }

    // 他のブラウザ用: 従来のポップアップ方式
    const callbackUrl = window.location.origin + "/api/auth/callback";

    // PKCEパラメータを生成（簡易版）
    const codeVerifier = generateRandomString(128);
    const codeChallenge = btoa(codeVerifier)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // セッションストレージにcode_verifierを保存（コールバック時に使用）
    sessionStorage.setItem("openrouter_code_verifier", codeVerifier);

    const authUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(
      callbackUrl
    )}&code_challenge=${codeChallenge}&code_challenge_method=plain`;

    console.log("[SettingsModal] コールバックURL:", callbackUrl);
    console.log("[SettingsModal] 認証URL:", authUrl);
    console.log("[SettingsModal] Code Challenge:", codeChallenge);

    const oauthWindow = window.open(authUrl, "_blank", "width=500,height=600");

    if (
      !oauthWindow ||
      oauthWindow.closed ||
      typeof oauthWindow.closed === "undefined"
    ) {
      console.error(
        "[SettingsModal] OpenRouter認証ウィンドウを開けませんでした"
      );
      setAuthError(
        "OpenRouter認証ウィンドウを開けませんでした。ポップアップがブロックされていないか確認してください。"
      );
      setIsOpenRouterLoading(false);
      return;
    }

    console.log("[SettingsModal] OpenRouter認証ウィンドウを開きました");

    // ウィンドウが閉じられたかチェック
    const checkClosed = setInterval(() => {
      if (oauthWindow.closed) {
        console.log("[SettingsModal] OpenRouter認証ウィンドウが閉じられました");
        setIsOpenRouterLoading(false);
        clearInterval(checkClosed);
        // セッションストレージをクリア
        sessionStorage.removeItem("openrouter_code_verifier");
      }
    }, 1000);
  };

  // ランダム文字列生成関数
  const generateRandomString = (length: number) => {
    const charset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  };

  // OpenRouter ログアウト処理
  const handleOpenRouterLogout = () => {
    storage.remove("openrouter_api_key");
    storage.remove("invite_code");
    setIsInviteCodeMode(false);
    setInviteCode("");
    setSavedInviteCode("");
    window.dispatchEvent(new Event("tokenChange"));
    window.location.reload();
  };

  // GitHub ログイン処理
  const handleGitHubLogin = () => {
    setIsGitHubLoading(true);
    setAuthError("");
    const githubAuthUrl = "/api/auth/github/login";
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const oauthWindow = window.open(
      githubAuthUrl,
      "githubOAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    if (
      !oauthWindow ||
      oauthWindow.closed ||
      typeof oauthWindow.closed === "undefined"
    ) {
      setAuthError(
        "GitHub認証ウィンドウを開けませんでした。ポップアップがブロックされていないか確認してください。"
      );
      setIsGitHubLoading(false);
      return;
    }

    // ウィンドウが閉じられたかチェック
    const checkClosed = setInterval(() => {
      if (oauthWindow.closed) {
        setIsGitHubLoading(false);
        clearInterval(checkClosed);
      }
    }, 1000);
  };

  // GitHub ログアウト処理
  const handleGitHubLogout = () => {
    storage.remove("gistToken");
    storage.remove("gistOAuthSuccess");
    window.dispatchEvent(new Event("storage"));
  };

  const handleResetChat = () => {
    if (
      window.confirm(
        "現在のチャット履歴を本当にリセットしますか？この操作は元に戻せません。"
      )
    ) {
      resetCurrentChat();
      closeModal();
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <BaseModal
      isOpen={isModalOpen}
      onClose={closeModal}
      title="設定"
      className="settings-modal"
    >
      <div className="settings-modal-content">
        {/* Authentication Section */}
        <h3>認証設定</h3>
        <p
          style={{
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: "0.9rem",
            marginBottom: "1rem",
            lineHeight: "1.4",
          }}
        >
          AIモデルとの対話には認証が必要です。下記のサービスでログインしてください。
        </p>

        {/* OpenRouter Authentication */}
        <div className="auth-section settings-input-area">
          <div className="auth-item">
            <div className="auth-info">
              <h4>OpenRouter</h4>
              <p>AI モデルへのアクセスに必要です</p>
              <div className="auth-status">
                ステータス:{" "}
                {isOpenRouterLoggedIn ? (
                  <span style={{ color: "#00ff00" }}>
                    ✓{" "}
                    {isInviteCodeMode
                      ? `${savedInviteCode} で認証済み`
                      : "認証済み"}
                  </span>
                ) : (
                  <span style={{ color: "#ff6b6b" }}>未認証</span>
                )}
              </div>
            </div>
            <div className="auth-actions">
              {isOpenRouterLoggedIn ? (
                <button
                  onClick={handleOpenRouterLogout}
                  className="logout-button"
                  style={{
                    backgroundColor: "rgba(255, 59, 48, 0.2)",
                    color: "#ff3b30",
                    borderColor: "rgba(255, 59, 48, 0.4)",
                  }}
                >
                  ログアウト
                </button>
              ) : (
                <>
                  <button
                    onClick={handleOpenRouterLogin}
                    className="login-button add-button"
                    disabled={isOpenRouterLoading}
                  >
                    {isOpenRouterLoading ? "認証中..." : "OpenRouterでログイン"}
                  </button>

                  <div style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                    または
                  </div>

                  <div className="invite-code-input">
                    <input
                      type="text"
                      placeholder="招待コード"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleValidateInviteCode();
                        }
                      }}
                      disabled={isValidatingInviteCode}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "0.9rem",
                        width: "150px",
                      }}
                    />
                    <button
                      onClick={handleValidateInviteCode}
                      className="add-button"
                      disabled={isValidatingInviteCode || !inviteCode.trim()}
                      style={{
                        padding: "0.5rem 1rem",
                      }}
                    >
                      {isValidatingInviteCode ? "検証中..." : "使用"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* GitHub Gist Authentication */}
        <div
          className="auth-section settings-input-area"
          style={{ marginTop: "2rem" }}
        >
          <div className="auth-item">
            <div className="auth-info">
              <h4>GitHub Gist</h4>
              <p>チャット履歴の共有とバックアップに必要です</p>
              <div className="auth-status">
                ステータス:{" "}
                {isGitHubLoggedIn ? (
                  <span style={{ color: "#00ff00" }}>✓ 認証済み</span>
                ) : (
                  <span style={{ color: "#ff6b6b" }}>未認証</span>
                )}
              </div>
            </div>
            <div className="auth-actions">
              {isGitHubLoggedIn ? (
                <button
                  onClick={handleGitHubLogout}
                  className="logout-button"
                  style={{
                    backgroundColor: "rgba(255, 59, 48, 0.2)",
                    color: "#ff3b30",
                    borderColor: "rgba(255, 59, 48, 0.4)",
                  }}
                >
                  ログアウト
                </button>
              ) : (
                <button
                  onClick={handleGitHubLogin}
                  className="login-button add-button"
                  disabled={isGitHubLoading}
                >
                  {isGitHubLoading ? "認証中..." : "GitHubでログイン"}
                </button>
              )}
            </div>
          </div>
          {authError && (
            <div
              className="error-message"
              style={{
                color: "#ff6b6b",
                fontSize: "0.9rem",
                marginTop: "0.5rem",
              }}
            >
              {authError}
            </div>
          )}
        </div>

        {/* Danger Zone - Chat Reset */}
        <h3>Danger Zone</h3>
        <div className="danger-zone-section settings-input-area">
          <p
            style={{
              flexBasis: "100%",
              color: "rgba(255,255,255,0.7)",
              fontSize: "0.9em",
              marginBottom: "0.5em",
            }}
          >
            現在のチャットスレッドの全メッセージ履歴をクリアします。この操作は取り消せません。
          </p>
          <button
            onClick={handleResetChat}
            className="delete-button"
            style={{
              backgroundColor: "rgba(255, 59, 48, 0.2)",
              color: "#ff3b30",
              borderColor: "rgba(255, 59, 48, 0.4)",
            }}
          >
            現在のチャットをリセット
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
