"use client";
import React, { useEffect } from "react";
// @ts-ignore - vaul の型が未インストールの場合は一時的に無視
import { Drawer } from "vaul";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string; // 追加: アクセシビリティ用説明文
  children: React.ReactNode;
  className?: string;
}

// Vaul Drawer をモーダル用途でラップ
export default function BaseModal({
  isOpen,
  onClose,
  title,
  description = "モーダルダイアログ", // デフォルト説明
  children,
  className = "",
}: BaseModalProps) {
  // --- デバッグ用ログ ---
  useEffect(() => {
    if (!isOpen) return;

    try {
      // Drawer(Content) の位置と transform 状態を確認
      const drawers = document.querySelectorAll("[data-vaul-drawer]");
      drawers.forEach((drawer, idx) => {
        const rect = (drawer as HTMLElement).getBoundingClientRect();
        const style = window.getComputedStyle(drawer as Element);
        console.debug(`[DEBUG BaseModal] Drawer ${idx} rect:`, rect);
        console.debug(
          `[DEBUG BaseModal] Drawer ${idx} transform:`,
          style.transform
        );
        console.debug(`[DEBUG BaseModal] Drawer ${idx} z-index:`, style.zIndex);
      });

      // Overlay の z-index と透明度
      const overlay = document.querySelector("[data-vaul-overlay]");
      if (overlay) {
        const ovStyle = window.getComputedStyle(overlay as Element);
        console.debug("[DEBUG BaseModal] Overlay z-index:", ovStyle.zIndex);
        console.debug("[DEBUG BaseModal] Overlay opacity:", ovStyle.opacity);
      }

      // Vaul が <style> を挿入できているか
      const hasVaulStyle = Array.from(
        document.head.querySelectorAll("style")
      ).some((el) => el.textContent?.includes("[data-vaul-drawer]"));
      console.debug("[DEBUG BaseModal] Vaul style tag found:", hasVaulStyle);

      // .layout 要素に aria-hidden が付与されていないか確認
      const layout = document.querySelector(".layout");
      if (layout) {
        console.debug(
          "[DEBUG BaseModal] .layout aria-hidden:",
          layout.getAttribute("aria-hidden")
        );
      }
    } catch (err) {
      console.error("[DEBUG BaseModal] ログ収集中にエラー", err);
    }
  }, [isOpen]);

  // モーダルオープン時にクローズボタンへフォーカスを移動
  const closeBtnRef = React.useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (isOpen && closeBtnRef.current) {
      // 次のフレームでフォーカスを設定（DOM確定後）
      requestAnimationFrame(() => closeBtnRef.current?.focus());
    }
  }, [isOpen]);

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Portal>
        {/* Content */}
        <Drawer.Content className={`modal-content ${className}`}>
          <div className="modal-header">
            <Drawer.Title className="modal-title">{title}</Drawer.Title>
            {/* アクセシビリティ用説明。スクリーンリーダーのみ */}
            {description && (
              <Drawer.Description className="sr-only">
                {description}
              </Drawer.Description>
            )}
            <Drawer.Close asChild>
              <button
                ref={closeBtnRef}
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
