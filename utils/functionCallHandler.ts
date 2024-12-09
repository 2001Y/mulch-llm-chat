import { MessageContent } from "../types/chat";

// JSONの完全性をチェックする関数
export const isCompleteJSON = (text: string) => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

// JSONパース用のヘルパー関数
export const safeJSONParse = (text: string) => {
  try {
    // 引用符で囲まれていない文字列を修正
    const fixedText = text.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    return JSON.parse(fixedText);
  } catch (e) {
    console.error("[JSON Parse Error]", { text, error: e });
    throw new Error(`JSON解析エラー: ${text}`);
  }
};

// 関数コールの状態を管理するクラス
export class FunctionCallHandler {
  private name: string = "";
  private arguments: string = "";
  private isAccumulatingArguments: boolean = false;
  private openBraces: number = 0;
  private functionCallExecuted: boolean = false;
  private pendingFunctionCall: boolean = false;

  constructor() {
    this.reset();
  }

  reset() {
    this.name = "";
    this.arguments = "";
    this.isAccumulatingArguments = false;
    this.openBraces = 0;
    this.functionCallExecuted = false;
    this.pendingFunctionCall = false;
  }

  // ツールコールの更新を処理
  handleToolCalls(toolCalls: any) {
    this.pendingFunctionCall = true;
    for (const tc of toolCalls) {
      if (tc.name) {
        this.name = tc.name;
        if (tc.arguments) {
          this.accumulateArguments(tc.arguments);
        }
      }
      if (tc.function?.name) {
        this.name = tc.function.name;
      }
      if (tc.function?.arguments) {
        this.accumulateArguments(tc.function.arguments);
      }
      console.log("[Function Call Update]", {
        name: this.name,
        arguments: this.arguments,
        openBraces: this.openBraces,
        isAccumulatingArguments: this.isAccumulatingArguments,
      });
    }
  }

  // 引数を蓄積
  private accumulateArguments(args: string) {
    this.isAccumulatingArguments = true;
    this.arguments += args;

    // 中括弧の数を数える
    const openCount = (args.match(/{/g) || []).length;
    const closeCount = (args.match(/}/g) || []).length;
    this.openBraces += openCount - closeCount;
  }

  // 関数実行の準備ができているかチェック
  isReadyToExecute() {
    return (
      this.name &&
      this.arguments &&
      !this.functionCallExecuted &&
      this.openBraces === 0 &&
      this.isAccumulatingArguments
    );
  }

  // 関数を実行
  async execute(
    toolFunctions: Record<string, (args: any) => any>,
    tempContent: string,
    updateMessage: (
      messageIndex: number,
      responseIndex: number,
      content: MessageContent[]
    ) => void,
    messageIndex: number,
    responseIndex: number
  ) {
    try {
      console.log("[Raw Function Arguments]", this.arguments);
      const args = safeJSONParse(this.arguments);
      console.log("[Parsed Function Arguments]", args);

      // 関数実行中は一時的なメッセージを表示
      const tempResult: MessageContent[] = [
        { type: "text", text: `${tempContent}\n\n[${this.name}を実行中...]` },
      ];
      updateMessage(messageIndex, responseIndex, tempResult);

      if (toolFunctions[this.name]) {
        // 文字列から関数に変換
        const fn = new Function(`return ${toolFunctions[this.name]}`)();
        const functionResult = await Promise.resolve(fn(args));
        console.log("[Function Result]", {
          name: this.name,
          result: functionResult,
        });

        // 関数実行結果を含めた最終的なメッセージを表示
        const finalResult: MessageContent[] = [
          { type: "text", text: tempContent },
          {
            type: "function_result",
            text: JSON.stringify(functionResult, null, 2),
            function: this.name,
          },
        ];
        updateMessage(messageIndex, responseIndex, finalResult);
        this.functionCallExecuted = true;
        this.pendingFunctionCall = false;
        this.isAccumulatingArguments = false;
        this.openBraces = 0;
      } else {
        console.error("[Function Not Found]", { name: this.name });
        const errorResult: MessageContent[] = [
          { type: "text", text: tempContent },
          {
            type: "error",
            text: `関数 "${this.name}" は定義されていません。`,
          },
        ];
        updateMessage(messageIndex, responseIndex, errorResult);
      }
    } catch (error: any) {
      console.error("[Function Execution Error]", {
        name: this.name,
        arguments: this.arguments,
        error,
      });
      const errorResult: MessageContent[] = [
        { type: "text", text: tempContent },
        {
          type: "error",
          text: `関数実行中にエラーが発生しました: ${error.message}`,
        },
      ];
      updateMessage(messageIndex, responseIndex, errorResult);
    }
  }

  // ゲッター
  get isPendingFunctionCall() {
    return this.pendingFunctionCall;
  }

  get isAccumulating() {
    return this.isAccumulatingArguments;
  }
}
