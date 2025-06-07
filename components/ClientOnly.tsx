"use client";

import { useEffect } from "react";
import { replaceGlobalConsole } from "@/utils/logger";

export default function ClientOnly() {
  useEffect(() => {
    let previousHeight = visualViewport?.height || window.innerHeight;

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

    // クライアントサイドでのみグローバルコンソールを置き換え
    replaceGlobalConsole();

    return () => {
      visualViewport?.removeEventListener("resize", handleResize);
      document.removeEventListener("touchmove", preventTouchMove);
    };
  }, []);

  return null;
}
