"use client";

import React, { useState } from "react";
import { storage } from "../hooks/useLocalStorage";

interface GistConnectionModalProps {
  closeModal: () => void;
  onSuccess: () => void;
}

export default function GistConnectionModal({ closeModal, onSuccess }: GistConnectionModalProps) {
  const [gistToken, setGistToken] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gistToken.trim()) {
      setError("トークンが入力されていません");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch("https://api.github.com/gists", {
        headers: {
          "Authorization": `Bearer ${gistToken}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
      
      if (response.ok) {
        storage.set("gistToken", gistToken);
        onSuccess();
        closeModal();
      } else {
        setError("無効なトークンです");
      }
    } catch (error) {
      setError("接続エラーが発生しました");
      console.error("Gist API接続エラー:", error);
    } finally {
      setIsLoading(false);
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
          <span className="close-button" onClick={closeModal}>×</span>
        </div>
        <div className="modal-content">
          <p>
            チャットをシェアするためにGitHub Gistと連携します。
            <a 
              href="https://github.com/settings/tokens" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              GitHub Personal Access Token
            </a>
            を作成してください。
            トークンには「gist」スコープが必要です。
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="gistToken">Gistアクセストークン</label>
              <input
                id="gistToken"
                type="password"
                value={gistToken}
                onChange={(e) => setGistToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxx"
              />
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="modal-actions">
              <button 
                type="button" 
                onClick={closeModal} 
                className="cancel-button"
                disabled={isLoading}
              >
                キャンセル
              </button>
              <button 
                type="submit" 
                className="submit-button"
                disabled={isLoading}
              >
                {isLoading ? "接続中..." : "連携する"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
