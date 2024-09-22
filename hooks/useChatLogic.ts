export function useChatLogic() {
    // ... 既存の状態と関数 ...

    // fetchChatResponse 関数
    const fetchChatResponse = useCallback(
        // 既存の fetchChatResponse 関数の実装
    , [/* 必要な依存関係 */]);

    return {
        // ... 既存のエクスポート ...
        fetchChatResponse, // 追加
        // 他の必要な関数もエクスポート
    };
}