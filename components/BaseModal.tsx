"use client";
import React from "react";
// @ts-ignore - vaul の型が未インストールの場合は一時的に無視
import { Drawer } from "vaul";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

// Vaul Drawer をモーダル用途でラップ
export default function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
}: BaseModalProps) {
  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Portal>
        {/* Content */}
        <Drawer.Content
          className={`modal-content ${className}`}
          // モーダル中央固定にするため、既存スタイルを流用
          // Vaul は bottom からの Drawer 表示がデフォルトだが、モーダルとして中央表示する
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            maxHeight: "90vh",
            overflowY: "auto",
            zIndex: 1001,
          }}
        >
          <div className="modal-header">
            <Drawer.Title className="modal-title">{title}</Drawer.Title>
            <Drawer.Close asChild>
              <button
                type="button"
                className="modal-close-button"
                aria-label="Close modal"
              >
                ×
              </button>
            </Drawer.Close>
          </div>
          <div className="modal-body">{children}</div>
        </Drawer.Content>

        {/* Overlay - placed after Content as per Vaul documentation */}
        <Drawer.Overlay />
      </Drawer.Portal>
    </Drawer.Root>
  );
}
