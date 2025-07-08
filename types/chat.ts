export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// 基本的なツール定義（AI SDKとの互換性のため）
export interface Tool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

// 拡張されたツール定義（実行コードを含む統合型）
export interface ExtendedTool extends Tool {
  implementation?: string; // 実行可能なJavaScriptコード（文字列形式）
  enabled?: boolean; // ツールの有効/無効状態
  /**
   * ツールのカテゴリを明示的に指定します。
   * - "Tool": 従来のローカル実装型ツール(Function Calling)
   * - "MCP": Model Context Protocol(MCP) 経由でリモート実行されるツール
   *  上記以外の文字列も許可しますが、省略時は "Tool" として扱われます。
   */
  category?: "Tool" | "MCP" | string;
}

// ツール実行結果の型
export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface MessageUI {
  isGenerating?: boolean;
  isSelected?: boolean;
  selectionOrder?: number; // 選択順序（1から始まる）
  modelId?: string;
  edited?: boolean; // 編集済みフラグを追加
  timestamp?: Date;
}

export type MessageContent = string | ToolCall[];

export interface AppMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: MessageContent;
  ui?: MessageUI;
  tool_calls?: ToolCall[];
  timestamp?: number; // タイムスタンプを追加
}

// 新しいローカルストレージ用の型定義
export interface ConversationTurn {
  userMessage: AppMessage & { role: "user" };
  assistantResponses: (AppMessage & { role: "assistant" })[];
}
