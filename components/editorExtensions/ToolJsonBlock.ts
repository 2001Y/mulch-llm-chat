/*
  ToolJsonBlock.ts – 独自コードブロック (```tooljson) を表示する TipTap 拡張
  - Markdown ⇄ Node Round-trip を公式推奨の languageMatcher 方式で実装
  - HTML パースは行わず Markdown のみ対応
*/

import { Node, mergeAttributes } from "@tiptap/core";
import CodeBlock from "@tiptap/extension-code-block";

const ToolJsonBlock = CodeBlock.extend({
  name: "toolJson", // NodeType 名。languageMatcher で参照される

  // StarterKit 側 codeBlock を無効化し、こちらを使う
  addOptions() {
    return {
      ...this.parent?.(),
      language: "tooljson", // 固定言語
    };
  },

  group: "block",
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      json: {
        default: {},
      },
    };
  },

  renderHTML({ node }) {
    return [
      "pre",
      mergeAttributes({ "data-language": "tooljson", class: "tool-json" }),
      JSON.stringify(node.attrs.json || {}, null, 2),
    ];
  },

  // Markdown 入出力
  addStorage() {
    return {
      markdown: {
        serialize: ({ node }: any) => {
          if (!node) {
            return "```tooljson\n{}\n```";
          }
          // attrs.json 優先
          if (node.attrs && node.attrs.json !== undefined) {
            return `\`\`\`tooljson\n${JSON.stringify(
              node.attrs.json,
              null,
              2
            )}\n\`\`\``;
          }
          // fallback: 子テキストをそのまま
          const raw = node.textContent || "{}";
          return `\`\`\`tooljson\n${raw}\n\`\`\``;
        },
        parse: ({ content }: { content: string }) => {
          try {
            const parsed = JSON.parse(content);
            return {
              type: "toolJson",
              attrs: { json: parsed },
            } as any;
          } catch (e) {
            // JSON パース失敗 → 空オブジェクトで保持
            return {
              type: "toolJson",
              attrs: { json: {} },
            } as any;
          }
        },
      },
    };
  },
}) as unknown as typeof Node;

export default ToolJsonBlock;
