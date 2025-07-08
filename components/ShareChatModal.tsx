"use client";

import React from "react";
import BaseModal from "./BaseModal";
import "@/styles/ShareChatModal.scss";

interface ShareChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPublished: boolean;
  shareUrl?: string;
  needsUpdate: boolean;
  onPublish: () => Promise<void>;
  onUpdate: () => Promise<void>;
}

export default function ShareChatModal({
  isOpen,
  onClose,
  isPublished,
  shareUrl,
  needsUpdate,
  onPublish,
  onUpdate,
}: ShareChatModalProps) {
  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="チャットをシェア"
      className="share-modal"
    >
      {/* modal-body 内 */}
      {isPublished ? (
        <>
          <p>既に公開済みです。</p>
          <div className="share-url-container">
            <input
              value={shareUrl}
              readOnly
              onFocus={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => {
                if (shareUrl) {
                  navigator.clipboard.writeText(shareUrl);
                }
              }}
            >
              コピー
            </button>
          </div>
          {needsUpdate && (
            <button className="update-button" onClick={onUpdate}>
              更新
            </button>
          )}
        </>
      ) : (
        <>
          <p>まだ公開されていません。</p>
          <div className="share-url-placeholder">(URL未発行)</div>
          <button className="publish-button" onClick={onPublish}>
            URL発行
          </button>
        </>
      )}
    </BaseModal>
  );
}
