import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  useMemo,
  useCallback,
} from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import MarkdownTipTapEditor, { EditorHandle } from "./MarkdownTipTapEditor";
import { EditorProps as TiptapEditorProps, EditorView } from "@tiptap/pm/view";
import type { AppMessage } from "types/chat";
import type { ModelItem } from "hooks/useChatLogic";
import useStorageState from "hooks/useLocalStorage";
import { useChatLogicContext } from "contexts/ChatLogicContext";
import { useMyModels } from "hooks/useMyModels";
import { useModelTabs } from "hooks/useModelTabs";
import TabNavigation from "./shared/TabNavigation";

interface Props {
  mainInput: boolean;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  isEditMode: boolean;
  messageId: string;
  handleResetAndRegenerate: (
    messageId: string,
    newContent: string
  ) => Promise<void>;
  handleSaveOnly: (messageId: string, newContent: string) => void;
  isInitialScreen: boolean;
  handleStopAllGeneration: () => void;
  isGenerating: boolean;
}

const SubmitButton = ({
  isPrimaryOnly,
  models,
  isInputEmpty,
  isModelsLoaded,
}: {
  isPrimaryOnly: boolean;
  models: ModelItem[] | undefined;
  isInputEmpty: () => boolean;
  isModelsLoaded: boolean;
}) => {
  const { pending } = useFormStatus();

  // モデルが選択されているかチェック
  const hasSelectedModel = models && models.some((model) => model.selected);

  // 送信可能かどうかの判定：入力が空でない かつ モデルが選択されている
  const canSubmit = !isInputEmpty() && hasSelectedModel;

  if (isPrimaryOnly) {
    return (
      <button
        type="submit"
        name="submitType"
        value="primary"
        className={`action-button send-primary-button icon-button ${
          canSubmit ? "active" : ""
        }`}
        disabled={!canSubmit || pending}
      >
        {pending ? (
          <span className="loading-spinner"></span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        )}
        <span>
          {pending && "Sending..."}{" "}
          {!pending && (
            <>
              Send to{" "}
              <code>
                {(() => {
                  if (
                    !isModelsLoaded ||
                    !Array.isArray(models) ||
                    models.length === 0
                  ) {
                    return "model"; // モデルが読み込まれていない場合のフォールバック
                  }
                  const selectedModel = models.find((model) => model.selected);
                  if (!selectedModel || typeof selectedModel.id !== "string") {
                    return "model"; // 選択されたモデルがない場合のフォールバック
                  }
                  return selectedModel.id.includes("/")
                    ? selectedModel.id.split("/")[1]
                    : selectedModel.id;
                })()}
              </code>
              <span className="shortcut">⌘⇧⏎</span>
            </>
          )}
        </span>
      </button>
    );
  } else {
    return (
      <button
        type="submit"
        name="submitType"
        value="normal"
        className={`action-button send-button icon-button ${
          canSubmit ? "active" : ""
        }`}
        disabled={!canSubmit || pending}
      >
        {pending ? (
          <span className="loading-spinner"></span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        )}
        <span>
          {pending ? "Sending..." : "Send"}
          {!pending && <span className="shortcut">⌘⏎</span>}
        </span>
      </button>
    );
  }
};

// 既存のキーボード対応システムを使用するカスタムフック
const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const updateKeyboardState = () => {
      if (typeof window !== "undefined" && document.body) {
        // CSSカスタムプロパティからキーボード高さを取得
        const style = getComputedStyle(document.body);
        const heightStr = style.getPropertyValue("--keyboardHeight").trim();
        const height = heightStr ? parseFloat(heightStr.replace("px", "")) : 0;

        // data属性からキーボード表示状態を取得
        const isVisible =
          document.body.getAttribute("data-software-keyboard") === "true";

        setKeyboardHeight(height);
        setIsKeyboardVisible(isVisible);
      }
    };

    // 初期状態をチェック
    updateKeyboardState();

    // MutationObserverでbody要素の属性変更を監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "style" ||
            mutation.attributeName === "data-software-keyboard")
        ) {
          updateKeyboardState();
        }
      });
    });

    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["style", "data-software-keyboard"],
      });
    }

    // ウィンドウリサイズイベントも監視（フォールバック）
    window.addEventListener("resize", updateKeyboardState);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateKeyboardState);
    };
  }, []);

  return { keyboardHeight, isKeyboardVisible };
};

export default function InputSection({
  mainInput,
  chatInput,
  setChatInput,
  isEditMode,
  messageId,
  handleResetAndRegenerate,
  handleSaveOnly,
  isInitialScreen,
  handleStopAllGeneration,
  isGenerating,
}: Props) {
  const {
    AllModels,
    selectSingleModel,
    handleSend: originalHandleSend,
    isGenerating: contextIsGenerating,
    updateModels,
    models,
    tools,
    handleOpenModelModal,
    handleOpenToolsModal,
    categories,
    activeCategory,
    applyCategoryToModels,
    getCurrentMatchingCategory,
    getValidCategoryModelCount,
    customCategoryModels,
    getSelectedModelIds,
  } = useChatLogicContext();

  // モデルAPIの読み込み状態を確認
  const isModelsReady =
    AllModels && AllModels.length > 0 && Object.keys(categories).length > 0;
  const { myModels } = useMyModels();
  const [isEdited, setIsEdited] = useState(false);
  const params = useParams();
  const roomId = params?.id as string | undefined;
  const [storedMessages] = useStorageState<AppMessage[] | undefined>(
    roomId ? `chatMessages_${roomId}` : undefined
  );
  const tiptapEditorRef = useRef<EditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // iOSキーボード対策: ライブラリのフックを使用
  const { keyboardHeight, isKeyboardVisible } = useKeyboardHeight();

  // ------------------------------------------------
  // 添付ボタン押下時にキーボードフォーカスを維持するハンドラー
  // ------------------------------------------------
  const handleAttachmentButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // ボタン自身へのフォーカスでエディタが blur しないよう防止
      e.preventDefault();

      // ネイティブファイルダイアログを開く
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }

      // すでにキーボードが表示されている場合のみ、エディタを再フォーカスして維持
      if (isKeyboardVisible) {
        tiptapEditorRef.current?.focus();
      }
    },
    [isKeyboardVisible]
  );

  // ----------------------------------------------------------------------------
  // 既存メッセージ編集中は画面下部のメイン input-section-form を非表示にする
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (mainInput) return; // メイン入力では何もしない
    const currentSection = sectionRef.current;
    if (!currentSection) return;

    const addBodyClass = () =>
      document.body.classList.add("editing-message-active");
    const removeBodyClass = () =>
      document.body.classList.remove("editing-message-active");

    // focusin/out を監視して Body にフラグ用クラスを付与/削除
    currentSection.addEventListener("focusin", addBodyClass);
    currentSection.addEventListener("focusout", (e) => {
      const related = e.relatedTarget as Node | null;
      if (!currentSection.contains(related)) {
        // セクション外にフォーカスが移動した場合のみ解除
        removeBodyClass();
      }
    });

    return () => {
      currentSection.removeEventListener("focusin", addBodyClass);
      // focusout はリスナー生成時と同一の関数を参照する必要があるため
      // 無名関数では remove できない。ここではクラス除去だけ確実に行う
      removeBodyClass();
    };
  }, [mainInput]);

  // 選択されているモデルの数を取得
  const selectedModelsCount =
    models?.filter((model) => model.selected).length || 0;

  // デバッグ用：コンポーネントマウント時の初期状態をログ出力
  useEffect(() => {
    console.log(
      `[InputSection] Component mounted - Keyboard height: ${keyboardHeight}px, visible: ${isKeyboardVisible}`
    );
  }, [keyboardHeight, isKeyboardVisible]); // 依存配列を適切に設定

  // デバッグ用：現在選択されているモデルをログ出力
  useEffect(() => {
    if (models && models.length > 0) {
      console.log(
        `[InputSection] Current selected models (${selectedModelsCount}):`,
        models.filter((m) => m.selected).map((m) => m.name)
      );
    }
  }, [models, selectedModelsCount]);

  // デバッグ用：キーボードの状態をログ出力
  useEffect(() => {
    console.log(
      `[InputSection] Keyboard state changed - visible: ${isKeyboardVisible}, height: ${keyboardHeight}px`
    );
  }, [isKeyboardVisible, keyboardHeight]);

  // タブ設定（共通フックを使用）
  const baseTabs = useModelTabs({
    categories,
    activeCategory,
    models: models || [],
    getValidCategoryModelCount,
    customCategoryModels,
    AllModels,
  });

  // onClick処理を追加
  const inputTabs = useMemo(() => {
    return baseTabs.map((tab) => ({
      ...tab,
      onClick: () => applyCategoryToModels(tab.key),
    }));
  }, [baseTabs, applyCategoryToModels]);

  const isInputEmpty = () => {
    return !chatInput || chatInput.trim().length === 0;
  };

  const aiModelSuggestionsForTiptap = useMemo(() => {
    return (AllModels || []).map((model) => ({
      id: model.id,
      label: model.name || model.id,
    }));
  }, [AllModels]);

  const handleTiptapChange = (markdown: string) => {
    setChatInput(markdown);
  };

  const originalMessageMarkdown: string | null = useMemo(() => {
    if (storedMessages && messageId) {
      const message = storedMessages.find((msg) => msg.id === messageId);
      if (
        message &&
        message.role === "user" &&
        typeof message.content === "string"
      ) {
        return message.content;
      }
    }
    return null;
  }, [storedMessages, messageId]);

  useEffect(() => {
    if (mainInput && tiptapEditorRef.current) {
      tiptapEditorRef.current.focus();
    }
  }, [mainInput]);

  useEffect(() => {
    if (originalMessageMarkdown !== null) {
      setIsEdited(chatInput !== originalMessageMarkdown);
    } else {
      setIsEdited(mainInput ? chatInput !== "" : false);
    }
  }, [chatInput, originalMessageMarkdown, mainInput]);

  const editorPropsForTiptap: TiptapEditorProps = {
    handleKeyDown: (view: EditorView, event: KeyboardEvent): boolean => {
      if (event.isComposing) return false;

      // モデルが選択されているかチェック
      const hasSelectedModel = models && models.some((model) => model.selected);

      // 送信可能かどうかの判定：入力が空でない かつ モデルが選択されている
      const canSubmit = !isInputEmpty() && hasSelectedModel;

      // Ctrl+Shift+Enter (Cmd+Shift+Enter): プライマリモデル単一送信
      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        !isGenerating &&
        canSubmit
      ) {
        event.preventDefault();

        // 編集モードの場合は編集内容を新規メッセージとして送信
        if (isEditMode) {
          // 編集内容をそのまま新規メッセージとして送信
          const form = view.dom.closest("form");
          if (form) {
            // プライマリモデル送信用のhidden inputを追加
            const submitTypeInput = document.createElement("input");
            submitTypeInput.type = "hidden";
            submitTypeInput.name = "submitType";
            submitTypeInput.value = "primary";
            form.appendChild(submitTypeInput);
            form.requestSubmit();
            form.removeChild(submitTypeInput);
          }
          return true;
        }

        // 新規メッセージの場合はプライマリモデル送信
        if (!isEditMode) {
          const form = view.dom.closest("form");
          if (form) {
            // プライマリモデル送信用のhidden inputを追加
            const submitTypeInput = document.createElement("input");
            submitTypeInput.type = "hidden";
            submitTypeInput.name = "submitType";
            submitTypeInput.value = "primary";
            form.appendChild(submitTypeInput);
            form.requestSubmit();
            form.removeChild(submitTypeInput);
          }
        }
        return true;
      }

      // Ctrl+Enter (Cmd+Enter): 複数モデル送信
      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !isGenerating &&
        canSubmit
      ) {
        event.preventDefault();

        // 編集モードの場合は編集内容を新規メッセージとして送信
        if (isEditMode) {
          // 編集内容をそのまま新規メッセージとして送信
          const form = view.dom.closest("form");
          if (form) {
            // 複数モデル送信用のhidden inputを追加
            const submitTypeInput = document.createElement("input");
            submitTypeInput.type = "hidden";
            submitTypeInput.name = "submitType";
            submitTypeInput.value = "normal";
            form.appendChild(submitTypeInput);
            form.requestSubmit();
            form.removeChild(submitTypeInput);
          }
          return true;
        }

        // 新規メッセージの場合は複数モデル送信
        if (!isEditMode) {
          const form = view.dom.closest("form");
          if (form) {
            // 複数モデル送信用のhidden inputを追加
            const submitTypeInput = document.createElement("input");
            submitTypeInput.type = "hidden";
            submitTypeInput.name = "submitType";
            submitTypeInput.value = "normal";
            form.appendChild(submitTypeInput);
            form.requestSubmit();
            form.removeChild(submitTypeInput);
          }
        }
        return true;
      }

      // Enter: 段落替え（デフォルトのTiptap動作を許可）
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        // デフォルトのTiptap段落替え動作を許可
        return false;
      }

      // Shift+Enter: 改行（デフォルトのTiptap動作を許可）
      if (
        event.key === "Enter" &&
        event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        // デフォルトのTiptap改行動作を許可
        return false;
      }

      if (event.key === "Backspace" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleStopAllGeneration();
        return true;
      }
      return false;
    },
    attributes: {
      // Tiptapエディタ自体に適用するHTML属性
      // class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none', // 例: TailwindCSS用
      // placeholder: isEditMode ? "Edit your message here..." : "Type your message here…", // プレースホルダーはTiptapのPlaceholder拡張機能で設定推奨
    },
  };

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) {
      const editor = tiptapEditorRef.current?.getEditorInstance();
      if (!editor) {
        toast.error("エディタが初期化されていません。");
        return;
      }
      for (const file of Array.from(files)) {
        try {
          const base64String = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          editor.chain().focus().setImage({ src: base64String }).run();
        } catch (err) {
          console.error("画像処理エラー:", err);
          toast.error("画像の処理中にエラーが発生しました", {
            description: "別の画像を選択するか、再度お試しください。",
            duration: 3000,
          });
        }
      }
    }
    if (event.target) event.target.value = "";
  };

  const submitAction = async (formData: FormData) => {
    const submittedChatInput = formData.get("chatInput") as string;
    const submitType = formData.get("submitType") as
      | "normal"
      | "primary"
      | null;

    if (!submittedChatInput || !submittedChatInput.trim()) return;

    // モデルが選択されているかチェック
    const hasSelectedModel = models && models.some((model) => model.selected);
    if (!hasSelectedModel) {
      console.warn("[InputSection] No model selected, cannot submit");
      toast.error("モデルを選択してください", {
        description:
          "メッセージを送信するには、少なくとも1つのモデルを選択する必要があります。",
        duration: 3000,
      });
      return;
    }

    // プライマリ送信の場合、元のモデル選択状態をバックアップ
    let originalModelState: ModelItem[] | undefined;

    try {
      console.log(
        "[InputSection] submitAction - submittedChatInput:",
        submittedChatInput,
        "submitType:",
        submitType
      );

      // 編集モードの場合は、submitTypeに応じて適切な処理を選択
      if (isEditMode && messageId) {
        console.log(
          "[InputSection] Edit mode detected, submitType:",
          submitType
        );

        // プライマリモデル送信の場合、選択されたモデルのうち最初のものを単一選択
        if (submitType === "primary" && models && models.length > 0) {
          const selectedModel = models.find((m) => m.selected);
          if (selectedModel) {
            console.log(
              "[InputSection] Setting single model for primary send:",
              selectedModel.id
            );
            // 元の状態をバックアップ
            originalModelState = [...models];
            // 一時的にプライマリモデルのみを選択
            selectSingleModel(selectedModel.id);
          }
        }

        // 古いメッセージを削除してから新規送信
        if (handleResetAndRegenerate) {
          await handleResetAndRegenerate(messageId, submittedChatInput);
        }
      }

      // 新規メッセージの場合
      if (!isEditMode) {
        // プライマリモデル送信の場合
        if (submitType === "primary" && models && models.length > 0) {
          const selectedModel = models.find((m) => m.selected);
          if (selectedModel) {
            console.log(
              "[InputSection] Setting single model for primary send:",
              selectedModel.id
            );
            // 元の状態をバックアップ
            originalModelState = [...models];
            // 一時的にプライマリモデルのみを選択
            selectSingleModel(selectedModel.id);
          }
        }

        // 通常の送信処理
        await originalHandleSend(submittedChatInput);
      }
    } catch (error: any) {
      console.error("Error during submitAction:", error);
      toast.error(
        "Failed to send message: " + (error?.message || "Unknown error")
      );
    } finally {
      // プライマリ送信後、元のモデル選択状態を復元
      if (originalModelState && submitType === "primary") {
        console.log("[InputSection] Restoring original model selection state");
        updateModels(originalModelState);
      }
      setChatInput("");
    }
  };

  return (
    <form action={submitAction} className="input-section-form">
      <section
        className={`input-section ${isInitialScreen ? "initial-screen" : ""} ${
          mainInput ? "full-input fixed" : ""
        } ${isEdited ? "edited" : ""}`}
        ref={sectionRef}
      >
        <input type="hidden" name="chatInput" value={chatInput} />

        {/* 控えめなモデル・ツール選択ボタン（モデルAPIが読み込まれてから表示） */}
        {isModelsReady && (
          <div className="input-models-tools-container">
            <div className="tab-navigation-wrapper">
              <TabNavigation
                tabs={inputTabs}
                activeTab={activeCategory}
                onTabChange={(newTab) => applyCategoryToModels(newTab)}
              />
              <button
                type="button"
                onClick={handleOpenModelModal}
                className="model-management-button"
                title="モデル管理"
              >
                ⚙️
              </button>
            </div>
          </div>
        )}

        <MarkdownTipTapEditor
          ref={tiptapEditorRef}
          value={chatInput}
          onChange={handleTiptapChange}
          editable={!isGenerating}
          editorProps={editorPropsForTiptap}
          className="input-container chat-input-area chat-tiptap-editor"
          aiModelSuggestions={aiModelSuggestionsForTiptap}
          onSelectAiModel={selectSingleModel}
          placeholder={
            isEditMode
              ? "Edit your message here..."
              : "Type your message here..."
          }
        >
          <div className="input-actions">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAttachmentButtonClick}
              className="action-button add-files-button icon-button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span>Add files</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              multiple
            />

            <button
              type="button"
              onClick={handleOpenToolsModal}
              className="action-button input-tools-button"
            >
              {tools?.filter((tool) => tool.enabled !== false).length || 0}{" "}
              Tools/MCP
            </button>

            {isGenerating ? (
              <button
                type="button"
                onClick={handleStopAllGeneration}
                className="action-button stop-button icon-button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                >
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                </svg>
                <span>
                  Stop<span className="shortcut">⌘⌫</span>
                </span>
              </button>
            ) : selectedModelsCount === 0 ? (
              // モデルが選択されていない場合は基本的な送信ボタンを表示
              <SubmitButton
                isPrimaryOnly={false}
                models={models}
                isInputEmpty={isInputEmpty}
                isModelsLoaded={true}
              />
            ) : selectedModelsCount === 1 ? (
              <SubmitButton
                isPrimaryOnly={true}
                models={models}
                isInputEmpty={isInputEmpty}
                isModelsLoaded={true}
              />
            ) : (
              <>
                <SubmitButton
                  isPrimaryOnly={true}
                  models={models}
                  isInputEmpty={isInputEmpty}
                  isModelsLoaded={true}
                />
                <SubmitButton
                  isPrimaryOnly={false}
                  models={models}
                  isInputEmpty={isInputEmpty}
                  isModelsLoaded={true}
                />
              </>
            )}
          </div>
        </MarkdownTipTapEditor>
      </section>
    </form>
  );
}
