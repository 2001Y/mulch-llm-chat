import { useEffect, useState } from 'react';

/**
 * iOSのキーボード表示時にセーフエリアの二重適用を防ぐためのカスタムフック
 */
export function useIOSKeyboardFix() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // より堅牢なiOS検出
    const isIOS = (() => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      // iOS検出パターン
      if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
        return true;
      }
      // iOS 13以降のiPadOSも検出
      if (navigator.maxTouchPoints > 1 && /Macintosh/.test(userAgent)) {
        return true;
      }
      return false;
    })();
    
    // iOS以外の環境、またはVisual Viewport APIがサポートされていない場合は何もしない
    if (!isIOS || !window.visualViewport) {
      return;
    }

    let lastHeight = window.innerHeight;

    const handleViewportChange = () => {
      // ビジュアルビューポートの高さとウィンドウの高さの差がキーボードの高さ
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const currentKeyboardHeight = windowHeight - viewportHeight;
      
      // キーボードの高さが10px以上の場合、キーボードが表示されていると判定
      // また、高さが減少した場合もキーボード表示と判定
      const isVisible = currentKeyboardHeight > 10 || viewportHeight < lastHeight * 0.9;
      
      setIsKeyboardVisible(isVisible);
      setKeyboardHeight(Math.max(0, currentKeyboardHeight));
      
      lastHeight = viewportHeight;
    };

    // 初期状態をチェック
    handleViewportChange();

    // ビューポートの変更を監視
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    
    // フォーカスイベントも監視（入力フィールドにフォーカスした際の追加対策）
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true')) {
        // 少し遅延を入れてからチェック（キーボードアニメーション完了を待つ）
        setTimeout(handleViewportChange, 300);
      }
    };

    document.addEventListener('focusin', handleFocusIn);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  // キーボードが表示されているときのスタイル調整
  const keyboardFixStyle: React.CSSProperties = isKeyboardVisible
    ? {
        // セーフエリアのpadding-bottomを無効化
        paddingBottom: '0.5em',
      }
    : {};

  return {
    isKeyboardVisible,
    keyboardHeight,
    keyboardFixStyle,
  };
}