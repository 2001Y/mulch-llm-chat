import { ExtendedTool, ToolExecutionResult } from "../types/chat";
import { tool } from "ai";
import { z } from "zod";
import { mcpClient } from "./mcpClient";

/**
 * 統合されたツールを実行する関数
 * @param tool 実行するツール
 * @param args ツールに渡す引数
 * @returns ツール実行結果
 */
export async function executeExtendedTool(
  tool: ExtendedTool,
  args: any
): Promise<ToolExecutionResult> {
  try {
    // ツールが無効化されている場合
    if (tool.enabled === false) {
      return {
        success: false,
        error: `ツール "${tool.function.name}" は無効化されています`,
      };
    }

    // MCP カテゴリはリモート実行のため implementation が不要
    if (tool.category === "MCP") {
      console.debug(
        `[MCP] Invoking remote tool ${tool.function.name} with`,
        args
      );
      try {
        const result = await mcpClient.invoke(tool.function.name, args);
        console.debug(`[MCP] Result for ${tool.function.name}:`, result);
        return { success: true, result };
      } catch (error: any) {
        console.error(`[MCP] Error invoking ${tool.function.name}:`, error);
        return { success: false, error: error?.message || "MCP実行エラー" };
      }
    }

    // カテゴリが Tool or その他の場合はローカル実行を要求
    if (!tool.implementation) {
      return {
        success: false,
        error: `ツール "${tool.function.name}" の実行コードが設定されていません`,
      };
    }

    console.log(`[ToolExecutor] Executing tool: ${tool.function.name}`, args);

    // 文字列から関数を生成
    const fn = new Function("args", `return (${tool.implementation})(args)`);

    // 関数を実行（非同期関数の可能性も考慮）
    const result = await Promise.resolve(fn(args));

    console.log(
      `[ToolExecutor] Tool execution completed: ${tool.function.name}`,
      result
    );

    return {
      success: true,
      result: result,
    };
  } catch (error: any) {
    console.error(
      `[ToolExecutor] Error executing tool ${tool.function.name}:`,
      error
    );

    return {
      success: false,
      error: `実行エラー: ${error.message}`,
    };
  }
}

/**
 * JSONスキーマをZodスキーマに変換する簡易関数
 * @param jsonSchema JSONスキーマオブジェクト
 * @returns Zodスキーマ
 */
function jsonSchemaToZod(jsonSchema: any): z.ZodTypeAny {
  if (!jsonSchema || typeof jsonSchema !== "object") {
    return z.any();
  }

  switch (jsonSchema.type) {
    case "string":
      return z.string();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      if (jsonSchema.items) {
        return z.array(jsonSchemaToZod(jsonSchema.items));
      }
      return z.array(z.any());
    case "object":
      if (jsonSchema.properties) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const [key, value] of Object.entries(jsonSchema.properties)) {
          shape[key] = jsonSchemaToZod(value as any);
        }
        let zodObj = z.object(shape);

        // required フィールドの処理
        if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
          // requiredに含まれていないフィールドをoptionalにする
          const optionalShape: Record<string, z.ZodTypeAny> = {};
          for (const [key, zodType] of Object.entries(shape)) {
            if (jsonSchema.required.includes(key)) {
              optionalShape[key] = zodType;
            } else {
              optionalShape[key] = zodType.optional();
            }
          }
          zodObj = z.object(optionalShape);
        }

        return zodObj;
      }
      return z.record(z.any());
    default:
      return z.any();
  }
}

/**
 * ExtendedToolsから AI SDK 用のツール定義を生成する
 * @param extendedTools 統合ツールの配列
 * @returns AI SDK用のToolSet オブジェクト
 */
export function convertToAISDKTools(extendedTools: ExtendedTool[]) {
  console.log("[convertToAISDKTools] === 開始 ===");
  console.log("[convertToAISDKTools] Input extendedTools:", extendedTools);
  console.log(
    "[convertToAISDKTools] extendedTools.length:",
    extendedTools?.length || 0
  );

  const tools: Record<string, any> = {};

  if (!extendedTools || !Array.isArray(extendedTools)) {
    console.warn(
      "[convertToAISDKTools] Invalid extendedTools input:",
      extendedTools
    );
    return tools;
  }

  console.log("[convertToAISDKTools] Processing tools...");

  const validTools = extendedTools.filter((extTool) => {
    const isEnabled = extTool.enabled !== false;
    const isMcp = extTool.category === "MCP";
    const hasImplementation = !!extTool.implementation;

    console.log(`[convertToAISDKTools] Tool "${extTool.function?.name}":`, {
      enabled: isEnabled,
      isMcp,
      hasImplementation,
      implementation: extTool.implementation?.substring(0, 50) + "...",
    });

    // MCP カテゴリは implementation が不要
    return isEnabled && (isMcp || hasImplementation);
  });

  console.log(
    `[convertToAISDKTools] Valid tools count: ${validTools.length}/${extendedTools.length}`
  );

  validTools.forEach((extTool, index) => {
    try {
      console.log(
        `[convertToAISDKTools] Converting tool ${index + 1}: ${
          extTool.function.name
        }`
      );
      console.log(
        `[convertToAISDKTools] Tool parameters:`,
        extTool.function.parameters
      );

      // パラメータをZodスキーマに変換
      const parameters = jsonSchemaToZod(extTool.function.parameters);
      console.log(
        `[convertToAISDKTools] Zod schema created for ${extTool.function.name}`
      );

      tools[extTool.function.name] = tool({
        description: extTool.function.description,
        parameters: parameters,
        execute: async (args: any) => {
          console.log(
            `[Tool Execute] ${extTool.function.name} called with:`,
            args
          );

          const execResult = await executeExtendedTool(extTool, args);

          // 成功時
          if (execResult.success) {
            console.log(
              `[Tool Execute] ${extTool.function.name} success:`,
              execResult.result
            );
            return execResult.result;
          }

          // 失敗時：例外を投げずエラー内容を返却して LLM / UI へ伝搬させる
          console.error(
            `[Tool Execute] ${extTool.function.name} error:`,
            execResult.error
          );
          return {
            error: execResult.error ?? "Unknown tool execution error",
          };
        },
      });

      console.log(
        `[convertToAISDKTools] Successfully converted: ${extTool.function.name}`
      );
    } catch (error) {
      console.error(
        `[convertToAISDKTools] Error converting tool ${extTool.function.name}:`,
        error
      );
    }
  });

  console.log("[convertToAISDKTools] === 完了 ===");
  console.log(
    "[convertToAISDKTools] Final tools object keys:",
    Object.keys(tools)
  );
  console.log("[convertToAISDKTools] Final tools object:", tools);

  return tools;
}

/**
 * ツール名から ExtendedTool を検索する
 * @param toolName ツール名
 * @param extendedTools 統合ツールの配列
 * @returns 見つかったツール、またはundefined
 */
export function findToolByName(
  toolName: string,
  extendedTools: ExtendedTool[]
): ExtendedTool | undefined {
  return extendedTools.find((tool) => tool.function.name === toolName);
}

/**
 * 古い形式のデータ（tools + toolFunctions）を統合形式に変換する
 * @param oldTools 旧ツール定義配列
 * @param oldToolFunctions 旧ツール実行関数オブジェクト
 * @returns 統合されたExtendedTool配列
 */
export function migrateOldToolsData(
  oldTools?: any[],
  oldToolFunctions?: Record<string, string>
): ExtendedTool[] {
  if (!oldTools || !Array.isArray(oldTools)) {
    return [];
  }

  return oldTools.map((tool) => {
    const extendedTool: ExtendedTool = {
      type: tool.type || "function",
      function: {
        name: tool.function?.name || "unknown",
        description: tool.function?.description || "",
        parameters: tool.function?.parameters || {},
      },
      enabled: true,
      category: "移行済み",
    };

    // 対応する実行関数があれば追加
    if (oldToolFunctions && oldToolFunctions[extendedTool.function.name]) {
      extendedTool.implementation =
        oldToolFunctions[extendedTool.function.name];
    }

    return extendedTool;
  });
}
