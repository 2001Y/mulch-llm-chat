export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
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
