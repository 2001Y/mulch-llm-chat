import { ExtendedTool, ToolExecutionResult } from "../types/chat";
import { tool } from "ai";
import { z } from "zod";

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

    // 実行コードが設定されていない場合
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
    const hasImplementation = !!extTool.implementation;

    console.log(`[convertToAISDKTools] Tool "${extTool.function?.name}":`, {
      enabled: isEnabled,
      hasImplementation: hasImplementation,
      implementation: extTool.implementation?.substring(0, 50) + "...",
    });

    return isEnabled && hasImplementation;
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
          // ここで実際の実行を行う
          const result = await executeExtendedTool(extTool, args);
          console.log(
            `[Tool Execute] ${extTool.function.name} result:`,
            result
          );
          if (result.success) {
            return result.result;
          } else {
            throw new Error(result.error);
          }
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
