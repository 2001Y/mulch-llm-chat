"use client";

import React, {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import { useEditor, EditorContent, Editor, JSONContent } from "@tiptap/react";
import { EditorProps } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown"; //コミュニティ製のMarkdown拡張
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Mention from "@tiptap/extension-mention"; // ★ Mention拡張をインポート
import { ReactRenderer } from "@tiptap/react"; // ★ ReactRenderer をインポート
import tippy, {
  Instance as TippyInstance,
  Props as TippyProps,
} from "tippy.js"; // ★ tippy.js をインポート
import MentionList, { MentionListProps } from "./MentionList"; // ★ MentionListProps もインポート
import Placeholder from "@tiptap/extension-placeholder"; // ★ Placeholder拡張をインポート
import "highlight.js/styles/a11y-dark.css"; // ★ CSSを直接インポートに戻す

interface ModelMentionItemForSuggestion {
  id: string; // モデルのフルID (例: openai/gpt-4o)
  label: string; // 表示名 (例: GPT-4o)
}

interface MarkdownTipTapEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  editable?: boolean;
  editorProps?: EditorProps;
  onSelectionUpdate?: (props: { editor: Editor; transaction: any }) => void;
  className?: string;
  aiModelSuggestions?: ModelMentionItemForSuggestion[]; // 親からAIモデル候補リストを受け取る
  onSelectAiModel?: (modelId: string) => void; // ★ AIモデル選択コールバック
  children?: React.ReactNode; // ★ アクションボタンなどを受け取るためのchildren
  placeholder?: string; // ★ プレースホルダーテキスト
}

// 親コンポーネントが参照できるハンドル型を定義
export interface EditorHandle {
  focus: () => void;
  getMarkdown: () => string;
  // 必要に応じて他のコマンドも追加
  getEditorInstance: () => Editor | null; // Editorインスタンスを直接返すメソッドも追加
}

// TiptapのMention拡張の command に渡される props の型 (MentionNodeAttrs に近い)
interface MentionCommandCallbackProps {
  id?: string | null;
  label?: string | null;
  [key: string]: any; // Tiptapが他の属性を渡す可能性も考慮
}

export const MarkdownTipTapEditor = forwardRef<
  EditorHandle,
  MarkdownTipTapEditorProps
>(
  (
    {
      value,
      onChange,
      editable = true,
      editorProps,
      onSelectionUpdate,
      className,
      aiModelSuggestions = [], // デフォルトは空配列
      onSelectAiModel, // ★ propsから受け取る
      children, // ★ アクションボタンなどを受け取るためのchildren
      placeholder = "Type your message...", // ★ デフォルトプレースホルダー
    },
    ref
  ) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          // StarterKitに含まれるMarkdown関連の拡張機能を無効化する場合があるため注意
          // heading: { levels: [1, 2, 3] },
        }),
        Markdown.configure({
          // tiptap-markdown 拡張の設定
          html: true, // HTMLタグを許可するか (TiptapはHTMLも扱えるため、Markdown変換時に影響)
          tightLists: true,
          tightListClass: "tight",
          bulletListMarker: "-",
          linkify: true, // URLのようなテキストを自動でリンク化
          breaks: true, // Markdown内の改行を<br>タグに変換
          // transformPastedText: true, // Markdownをペーストした際に解釈する
          // transformCopiedText: true, // コピー時にMarkdownとして取得する
        }),
        Image.configure({
          inline: false,
          allowBase64: true,
        }),
        Table.configure({
          // テーブル拡張
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Mention.configure({
          HTMLAttributes: { class: "mention ai-model-mention" },
          suggestion: {
            items: ({
              query,
            }: {
              query: string;
            }): ModelMentionItemForSuggestion[] => {
              // propsで渡されたaiModelSuggestionsをフィルタリング
              return (aiModelSuggestions || [])
                .filter(
                  (model) =>
                    model.label.toLowerCase().includes(query.toLowerCase()) ||
                    model.id.toLowerCase().includes(query.toLowerCase())
                )
                .slice(0, 10); // 表示件数を調整 (例: 10件)
            },
            render: () => {
              let component: ReactRenderer<MentionListProps, any>;
              let popup: TippyInstance<TippyProps> | undefined;
              let selectedIndexLocal = 0;
              let currentRenderItemsLocal: ModelMentionItemForSuggestion[] = [];
              let suggestionRendererProps: any = {};

              return {
                onStart: (tiptapProps) => {
                  suggestionRendererProps = tiptapProps;
                  currentRenderItemsLocal =
                    tiptapProps.items as ModelMentionItemForSuggestion[];
                  selectedIndexLocal = 0;
                  component = new ReactRenderer(MentionList, {
                    props: {
                      items: currentRenderItemsLocal,
                      command: (item: any) =>
                        suggestionRendererProps.command(item), // itemの型はModelMentionItemForSuggestion
                      selectedIndex: selectedIndexLocal,
                    },
                    editor: tiptapProps.editor,
                  });
                  if (!tiptapProps.clientRect) return;
                  popup = tippy(document.body, {
                    getReferenceClientRect:
                      tiptapProps.clientRect as any /* ... */,
                  });
                },
                onUpdate: (tiptapProps) => {
                  suggestionRendererProps = tiptapProps;
                  currentRenderItemsLocal =
                    tiptapProps.items as ModelMentionItemForSuggestion[];
                  selectedIndexLocal = 0;
                  component.updateProps({
                    items: currentRenderItemsLocal,
                    command: (item: any) =>
                      suggestionRendererProps.command(item),
                    selectedIndex: selectedIndexLocal,
                  });
                  if (!tiptapProps.clientRect) return;
                  popup?.setProps({
                    getReferenceClientRect: tiptapProps.clientRect as any,
                  });
                },
                onKeyDown: (tiptapProps) => {
                  if (tiptapProps.event.key === "Escape") {
                    popup?.hide();
                    return true;
                  }
                  if (currentRenderItemsLocal.length === 0) return false;
                  let handled = false;
                  if (tiptapProps.event.key === "ArrowUp") {
                    selectedIndexLocal =
                      (selectedIndexLocal +
                        currentRenderItemsLocal.length -
                        1) %
                      currentRenderItemsLocal.length;
                    component.updateProps({
                      selectedIndex: selectedIndexLocal,
                    });
                    handled = true;
                  }
                  if (tiptapProps.event.key === "ArrowDown") {
                    selectedIndexLocal =
                      (selectedIndexLocal + 1) % currentRenderItemsLocal.length;
                    component.updateProps({
                      selectedIndex: selectedIndexLocal,
                    });
                    handled = true;
                  }
                  if (
                    tiptapProps.event.key === "Enter" ||
                    tiptapProps.event.key === "Tab"
                  ) {
                    const selectedItem =
                      currentRenderItemsLocal[selectedIndexLocal];
                    if (selectedItem) {
                      suggestionRendererProps.command(selectedItem);
                    }
                    popup?.hide();
                    handled = true;
                  }
                  return handled;
                },
                onExit: () => {
                  popup?.destroy();
                  component.destroy();
                },
              };
            },
            command: ({
              editor,
              range,
              props,
            }: {
              editor: Editor;
              range: any;
              props: MentionCommandCallbackProps;
            }) => {
              if (props.id && props.label) {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent(`@${props.label} `)
                  .run();
                window.getSelection()?.collapseToEnd();
                console.log(
                  "Selected AI Model via Mention:",
                  props.id,
                  props.label
                );
                if (onSelectAiModel && typeof props.id === "string") {
                  // ★ props.idがstringであることを確認
                  onSelectAiModel(props.id);
                }
              } else {
                console.warn(
                  "Mention command props missing id or label",
                  props
                );
              }
            },
            char: "@",
            allowSpaces: false,
          },
        }),
        Placeholder.configure({
          placeholder: placeholder,
        }),
      ],
      content: value,
      editable,
      editorProps,
      onSelectionUpdate,
      onUpdate: ({ editor }) => {
        const currentMarkdown = editor.storage.markdown.getMarkdown();
        console.log(
          "[MarkdownTipTapEditor] onUpdate triggered. Current markdown:",
          currentMarkdown,
          "Current value prop from parent:",
          value
        );
        if (value !== currentMarkdown) {
          console.log(
            "[MarkdownTipTapEditor] onChange called because value and currentMarkdown differ."
          );
          onChange(currentMarkdown);
        } else {
          console.log(
            "[MarkdownTipTapEditor] onChange skipped because value and currentMarkdown are the same."
          );
        }
      },
      immediatelyRender: false, // ★ SSR Hydration Mismatch対策
    });

    useEffect(() => {
      if (editor && value !== editor.storage.markdown.getMarkdown()) {
        editor.commands.setContent(value, false);
      }
    }, [value, editor]);

    useEffect(() => {
      if (editor) {
        editor.setEditable(editable);
      }
    }, [editable, editor]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        editor?.commands.focus();
      },
      getMarkdown: () => {
        return editor?.storage.markdown.getMarkdown() || "";
      },
      getEditorInstance: () => {
        return editor;
      },
    }));

    if (!editor) {
      return null;
    }

    return (
      <div className={className}>
        <EditorContent editor={editor} />
        {children && <div className="editor-actions">{children}</div>}
      </div>
    );
  }
);

MarkdownTipTapEditor.displayName = "MarkdownTipTapEditor";

export default MarkdownTipTapEditor;
