"use client";

import { useEffect } from "react";
import { replaceGlobalConsole } from "@/utils/logger";

export default function ClientOnly() {
  useEffect(() => {
    let previousHeight = visualViewport?.height || window.innerHeight;
    let currentFocusedElement: HTMLElement | null = null;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      const currentHeight = visualViewport?.height || window.innerHeight;
      document.body.style.setProperty("--actual-100dvh", `${currentHeight}px`);
      const heightDifference = previousHeight - currentHeight;
      if (heightDifference > 0) {
        document.body.style.setProperty(
          "--keyboardHeight",
          `${heightDifference}px`
        );
        document.body.dataset.softwareKeyboard = "true";
      } else {
        document.body.style.setProperty("--keyboardHeight", `0px`);
        document.body.dataset.softwareKeyboard = "false";
      }
      previousHeight = currentHeight;
    };

    visualViewport?.addEventListener("resize", handleResize);
    handleResize();

    // フォーカス時のスクロール制御
    const stopScroll = () => {
      if (currentFocusedElement) {
        window.scrollTo(0, 0);
      }
    };

    // フォーカスイベントハンドラ
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;

      // 入力フィールドかチェック
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.classList.contains("ProseMirror") ||
        target.getAttribute("contenteditable") === "true" ||
        target.closest(".ProseMirror")
      ) {
        currentFocusedElement = target.closest(".chat-input-area") || target;
        console.log("[ClientOnly] Focus in:", target);

        // touchendイベントリスナーを追加
        document.addEventListener("touchend", stopScroll);

        // 念のため少し遅延してもスクロール位置を確認
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(stopScroll, 100);

        // さらに遅延して再度確認（キーボード表示完了後）
        setTimeout(stopScroll, 300);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement;

      // 入力可能な要素かチェック
      if (
        target.matches('input, textarea, [contenteditable="true"]') ||
        target.closest(".ProseMirror")
      ) {
        currentFocusedElement = null;

        // イベントリスナーを削除
        document.removeEventListener("touchend", stopScroll);

        // タイムアウトをクリア
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
          scrollTimeout = null;
        }
      }
    };

    // フォーカスイベントリスナーを追加
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    const preventTouchMove = (event: TouchEvent) => {
      if (
        !event.target ||
        (!(event.target as HTMLElement).closest(".model-select-area") &&
          !(event.target as HTMLElement).closest(".responses-container") &&
          !(event.target as HTMLElement).closest(".chat-input-area") &&
          !(event.target as HTMLElement).closest(".modal-content") &&
          !(event.target as HTMLElement).closest(".modal-backdrop") &&
          !(event.target as HTMLElement).closest(".tab-navigation") &&
          !(event.target as HTMLElement).closest(
            ".input-models-tools-container"
          ) &&
          !(event.target as HTMLElement).closest(".grid") &&
          !(event.target as HTMLElement).closest(".bento-grid"))
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchmove", preventTouchMove, {
      passive: false,
    });

    // ページのスクロールを常に0に保つ
    const preventPageScroll = (event: Event) => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // スクロールイベントを監視して即座に0に戻す
    window.addEventListener("scroll", preventPageScroll, {
      passive: false,
      capture: true,
    });
    document.addEventListener("scroll", preventPageScroll, {
      passive: false,
      capture: true,
    });

    // タッチ開始時の位置も0に固定
    const handleTouchStart = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });

    // クライアントサイドでのみグローバルコンソールを置き換え
    replaceGlobalConsole();

    return () => {
      visualViewport?.removeEventListener("resize", handleResize);
      document.removeEventListener("touchmove", preventTouchMove);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("touchend", stopScroll);
      window.removeEventListener("scroll", preventPageScroll);
      document.removeEventListener("scroll", preventPageScroll);
      document.removeEventListener("touchstart", handleTouchStart);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  return null;
}
