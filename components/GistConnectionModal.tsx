"use client";

import React, { useState } from "react";

interface GistConnectionModalProps {
  closeModal: () => void;
  onSuccess: () => void;
}

export default function GistConnectionModal({
  closeModal,
  onSuccess, // onSuccess は残すが、呼び出しタイミングが変わる
}: GistConnectionModalProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false); // ローディング表示は残す
  const [error, setError] = useState<string>(""); // エラー表示も残す

  const handleGitHubLogin = () => {
    setIsLoading(true);
    setError("");
    const githubAuthUrl = "/api/auth/github/login"; // 認証開始エンドポイント
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // OAuth認証用のウィンドウを開く
    const oauthWindow = window.open(
      githubAuthUrl,
      "githubOAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    // ウィンドウがブロックされたか、正常に開かなかった場合の処理
    if (
      !oauthWindow ||
      oauthWindow.closed ||
      typeof oauthWindow.closed === "undefined"
    ) {
      setError(
        "GitHub認証ウィンドウを開けませんでした。ポップアップがブロックされていないか確認してください。"
      );
      setIsLoading(false);
      return;
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  return (
    <div className="gist-modal-overlay" onClick={handleOverlayClick}>
      <div className="gist-modal">
        <div className="modal-header">
          <h2>GitHub Gist連携</h2>
          <span className="close-button" onClick={closeModal}>
            ×
          </span>
        </div>
        <div className="modal-content">
          <p>
            チャットをシェアするためにGitHub Gistと連携します。
            「GitHubでログイン」ボタンをクリックして認証してください。
          </p>

          {error && <div className="error-message">{error}</div>}

          <button
            onClick={handleGitHubLogin}
            className="github-login-button"
            disabled={isLoading}
          >
            {isLoading ? "認証ウィンドウを開いています..." : "GitHubでログイン"}
          </button>

          <div className="modal-actions" style={{ marginTop: "1em" }}>
            <button
              type="button"
              onClick={closeModal}
              className="cancel-button"
              disabled={isLoading}
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
