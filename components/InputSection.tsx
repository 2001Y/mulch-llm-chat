import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  useMemo,
} from "react";
import { toast } from "sonner";
import { storage } from "hooks/useLocalStorage";
import Image from "next/image";
import { useParams } from "next/navigation";
import MarkdownTipTapEditor, { EditorHandle } from "./MarkdownTipTapEditor";
import { Editor } from "@tiptap/core";
import { EditorProps as TiptapEditorProps, EditorView } from "@tiptap/pm/view";
import type { Message, ModelItem } from "hooks/useChatLogic";
import useStorageState from "hooks/useLocalStorage";
import { useChatLogicContext } from "contexts/ChatLogicContext";

interface Props {
  mainInput: boolean;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  handleSend: (
    event:
      | React.MouseEvent<HTMLButtonElement>
      | React.KeyboardEvent<HTMLDivElement>,
    isPrimaryOnly: boolean,
    currentInput?: string
  ) => void;
  isEditMode: boolean;
  messageIndex: number;
  handleResetAndRegenerate: (messageIndex: number) => void;
  handleSaveOnly: (messageIndex: number) => void;
  isInitialScreen: boolean;
  handleStopAllGeneration: () => void;
  isGenerating: boolean;
}

export default function InputSection({
  mainInput,
  chatInput,
  setChatInput,
  handleSend,
  isEditMode,
  messageIndex,
  handleResetAndRegenerate,
  handleSaveOnly,
  isInitialScreen,
  handleStopAllGeneration,
  isGenerating,
}: Props) {
  const [models, setModels] = useStorageState<ModelItem[] | undefined>(
    "models"
  );
  const { AllModels, selectSingleModel } = useChatLogicContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isEdited, setIsEdited] = useState(false);
  const params = useParams();
  const roomId = params?.id as string | undefined;
  const [storedMessages] = useStorageState<Message[] | undefined>(
    roomId ? `chatMessages_${roomId}` : undefined
  );
  const tiptapEditorRef = useRef<EditorHandle>(null);

  const aiModelSuggestionsForTiptap = useMemo(() => {
    return (AllModels || []).map((model) => ({
      id: model.fullId,
      label: model.shortId || model.fullId,
    }));
  }, [AllModels]);

  const handleTiptapChange = (markdown: string) => {
    setChatInput(markdown);
  };

  const handleModelSelect = (modelName: string) => {
    const editor = tiptapEditorRef.current?.getEditorInstance();
    const wasFocused = !!editor?.isFocused;
    setModels(
      (models ?? []).map((model) => ({
        name: model.name,
        selected: model.name === modelName ? !model.selected : model.selected,
      }))
    );
    if (wasFocused) {
      setTimeout(() => editor?.commands.focus(), 0);
    }
  };

  const originalMessageMarkdown: string | null = useMemo(() => {
    if (
      storedMessages &&
      messageIndex >= 0 &&
      messageIndex < storedMessages.length
    ) {
      return storedMessages[messageIndex].user;
    }
    return null;
  }, [storedMessages, messageIndex]);

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
      if (event.key === "Enter" && !event.shiftKey && !isGenerating) {
        event.preventDefault();
        if (!isInputEmpty()) {
          if (isEditMode) {
            handleResetAndRegenerate(messageIndex);
          } else {
            handleSendAndResetInput(
              event as any,
              event.metaKey || event.ctrlKey
            );
          }
          return true;
        }
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

  const handleSendAndResetInput = (
    event:
      | React.MouseEvent<HTMLButtonElement>
      | React.KeyboardEvent<HTMLDivElement>,
    isPrimaryOnly: boolean
  ) => {
    const currentInputForSend = chatInput;
    setChatInput("");
    handleSend(event, isPrimaryOnly, currentInputForSend);
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

  const isInputEmpty = () => !chatInput.trim();

  return (
    <section
      className={`input-section ${isInitialScreen ? "initial-screen" : ""} ${
        mainInput ? "full-input fixed" : ""
      } ${isEdited ? "edited" : ""}`}
      ref={sectionRef}
    >
      <div className="input-container chat-input-area">
        <div
          className="add-files-container"
          style={{
            marginBottom: "0.5em",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
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
        </div>
        <MarkdownTipTapEditor
          ref={tiptapEditorRef}
          value={chatInput}
          onChange={handleTiptapChange}
          editable={!isGenerating}
          editorProps={editorPropsForTiptap}
          className="chat-tiptap-editor"
          aiModelSuggestions={aiModelSuggestionsForTiptap}
          onSelectAiModel={selectSingleModel}
        />
      </div>

      <div className="input-container model-select-area">
        {Array.isArray(models) &&
          models?.map((model, idx) => (
            <div className="model-radio" key={model.name}>
              <input
                type="checkbox"
                id={`model-${idx}`}
                value={model.name}
                checked={model.selected}
                onChange={() => handleModelSelect(model.name)}
              />
              <label htmlFor={`model-${idx}`}>{model.name.split("/")[1]}</label>
            </div>
          ))}
      </div>

      <div className="input-container input-actions">
        {isGenerating ? (
          <button
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
        ) : (
          <>
            {isEditMode && isEdited ? (
              <>
                <button
                  onClick={() => handleResetAndRegenerate(messageIndex)}
                  className="action-button reset-regenerate-button icon-button"
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
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                  </svg>
                  <span>
                    ReGenerate<span className="shortcut">⏎</span>
                  </span>
                </button>
                <button
                  onClick={() => handleSaveOnly(messageIndex)}
                  className="action-button save-only-button icon-button"
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
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  <span>Save Only</span>
                </button>
              </>
            ) : (
              !isEditMode && (
                <>
                  <button
                    onClick={(e) => handleSendAndResetInput(e, false)}
                    className={`action-button send-button icon-button ${
                      !isInputEmpty() ? "active" : ""
                    }`}
                    disabled={isInputEmpty()}
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
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    <span>
                      Send<span className="shortcut">⏎</span>
                    </span>
                  </button>
                  <button
                    onClick={(e) => handleSendAndResetInput(e, true)}
                    className={`action-button send-primary-button icon-button ${
                      !isInputEmpty() ? "active" : ""
                    }`}
                    disabled={isInputEmpty()}
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
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    <span>
                      Send to{" "}
                      <code>
                        {(Array.isArray(models) &&
                          models
                            ?.find((model) => model.selected)
                            ?.name.split("/")[1]) ||
                          "model"}
                      </code>
                      <span className="shortcut">⌘⏎</span>
                    </span>
                  </button>
                </>
              )
            )}
            <span className="line-break shortcut-area">
              Line break<span className="shortcut">⇧⏎</span>
            </span>
          </>
        )}
      </div>
    </section>
  );
}
