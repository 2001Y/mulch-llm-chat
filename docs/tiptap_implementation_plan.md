# Tiptap 導入 実装方針メモ

## 1. 基本方針

- **UI/UX:** ユーザー入力、AI レスポンス、チャット履歴の全てのテキスト表示・編集 UI を Tiptap エディタに統一する。
- **データ形式:**
  - Tiptap エディタ内部では、Tiptap の JSON または HTML 形式でコンテンツを扱う。
  - アプリケーションの状態管理（React の state など）、ローカルストレージへの保存、API 送受信時のデータは **Markdown 形式** を基本とする。
- **変換:**
  - Markdown → Tiptap: エディタ初期表示時、外部から Markdown データを受け取った際。
  - Tiptap → Markdown: ユーザーが編集を完了した際、保存/API 送信時。
- **パフォーマンス:**
  - チャット履歴など多数の Tiptap インスタンスを描画する際は、仮想化リストの導入を検討する (`@tanstack/react-virtual` を有力候補とする)。
  - `React.memo` を適切に利用し、不要な再レンダリングを抑制する。
  - React Compiler の動向を注視しつつ、当面は手動でのメモ化も適宜行う。
- **拡張性:** まずは基本的なテキスト編集と画像・テーブル対応を優先し、その他の Tiptap 拡張機能（メンション、コードブロックの高度なハイライト等）は必要に応じて段階的に導入する。

## 2. 必要なライブラリ (✅ 導入済み)

- `@tiptap/react`
- `@tiptap/pm` (依存関係として導入済み)
- `@tiptap/starter-kit`
- `tiptap-markdown` (コミュニティ製 Markdown 拡張)
- `@tiptap/extension-image`
- `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`
- `turndown` (現状、Tiptap 化により不要になる見込み)
- `@tanstack/react-virtual` (インストール済み、ステップ 5 で適用)

## 3. 実装ステップ

### ステップ 1: 汎用 Markdown Tiptap エディタコンポーネントの作成 (`MarkdownTipTapEditor.tsx`) (✅ 完了)

- **Props:** `value`, `onChange`, `editable`, `editorProps`, `onSelectionUpdate`, `className` を実装済み。
- **機能:** `StarterKit`, `Markdown`, `Image`, `Table` 関連拡張を有効化済み。
- **メソッド公開:** `focus`, `getMarkdown`, `getEditorInstance` を `useImperativeHandle` で公開済み。

### ステップ 2: `InputSection.tsx` の Tiptap 化 (メイン入力欄と履歴編集欄) (✅ 主要機能完了)

- **完了タスク:**
  - 既存の `<textarea>` を `MarkdownTipTapEditor.tsx` に置き換え済み。
  - `value` と `onChange` の基本的な連携を実装済み (`chatInput` のテキスト部分との連携)。
  - Tiptap エディタへのフォーカス管理 (`mainInput` 時の自動フォーカス) を実装済み。
  - キーボードショートカット (Enter で送信、修飾キー+Backspace で生成停止) を `editorProps.handleKeyDown` で実装済み。
  - `isComposing` state とテキストエリアの高さ調整 `useEffect` は削除済み。
  - モデルサジェスチョン (`ModelSuggestions` との連携) を削除し、`MarkdownTipTapEditor` 内部の `@tiptap/extension-mention` に一本化する準備が完了。
- **残タスク (📝 手動確認・微調整 → 🧹 クリーンアップ):**
  - `InputSection.tsx` から `ModelSuggestions` コンポーネントとそれに関連する state (`showSuggestions`, `suggestionQuery`, `cursorRectForSuggestion`) およびロジック (`handleTiptapSelectionUpdate`内の独自メンション処理、`selectSuggestion`) を完全に削除。
  - モデルサジェスチョンリスト (`ModelSuggestions`) の CSS での最終的な位置・スタイル微調整。
  - `selectSuggestion` 実行後、Tiptap エディタのカーソルが挿入されたモデル名の直後に適切に配置されるかの確認と調整。

### ステップ 3: `ChatResponses.tsx` の LLM 応答部分の Tiptap 化 (✅ 完了)

- 既存の `dangerouslySetInnerHTML` を `MarkdownTipTapEditor.tsx` に置き換え済み。
- `message.llm[responseIndex].text` を `value` として渡し、`onChange` で `updateMessage` を呼び出し更新するロジックを実装済み。
- `editable` prop は常に `true` となっている。

### ステップ 4: 画像処理の統合 (Tiptap エディタ内での画像表示・挿入) (🚧 作業中)

- **完了タスク:**
  - `MarkdownTipTapEditor.tsx` で `Image.configure({ allowBase64: true, inline: false })` を設定済み。
  - `InputSection.tsx` の `handleImageSelect` で、選択された画像を Base64 エンコードし、`editor.commands.setImage({ src: base64String })` で Tiptap エディタに挿入する処理を実装済み。
  - `InputSection.tsx` の `handleTiptapChange` に画像挿入後の Markdown 出力を確認するログを追加済み。
  - `hooks/useChatLogic.ts` の `Message.user` と `chatInput` state を単一の Markdown 文字列形式に変更済み。
  - 上記変更に伴う型定義、関連ロジック (メッセージ作成・更新、入力リセット、`isEdited`判定など) を `hooks/useChatLogic.ts` と `components/InputSection.tsx` で修正済み。
  - `hooks/useChatLogic.ts` の `fetchChatResponse` 内で、Markdown 文字列を `ChatCompletionContentPart[]` に変換する `parseMarkdownToContentParts` ヘルパー関数を実装し適用済み。
  - `hooks/useChatLogic.ts` に旧データ形式から新 Markdown 形式へのマイグレーションロジックの基本部分を実装済み。
  - `components/InputSection.tsx` から古い画像プレビューロジックと `removeImage` 関数を削除済み。
- **残タスク:**
  - **技術検証 (📝 ログ確認 - ユーザー実施待ち):** Base64 画像が Markdown として正しくシリアライズ・デシリアライズできるか。
  - **既存データのマイグレーションロジックのテスト (📝 手動確認またはテストコード):** `hooks/useChatLogic.ts` のマイグレーションロジックが様々な旧データパターンで正しく動作するか確認。
  - **画像プレビューと削除機能の再設計/削除 (📝 最終判断):** Tiptap エディタ内の画像管理で十分か、追加 UI が必要か、実際の使用感に基づき判断。
  - **API への送信形式の最終調整 (📝 テストと微調整):** `parseMarkdownToContentParts` が様々な画像構文やエッジケースを正しく処理できるかテストし、必要に応じて正規表現やロジックを調整。

### ステップ 5: パフォーマンス最適化 (`@tanstack/react-virtual` の導入詳細) (🚧 作業中 → ✅ 基本実装完了)

- **完了タスク:**
  - `ChatResponses.tsx` に `@tanstack/react-virtual` の `useVirtualizer` フックを導入。
  - スクロールコンテナ (`containerRef`流用)、仮想アイテムのレンダリング、スタイル適用 (絶対配置と transform) の基本構造を実装。
  - 新規メッセージへの自動スクロール処理 (`scrollToIndex`) を実装。
  - `estimateSize` にメッセージ内容の行数に基づく簡易的な高さ概算ロジックを導入。
- **残タスク (📝 手動確認・微調整):**
  - **多数メッセージ表示時のスクロールパフォーマンス検証:** 数百〜数千件のメッセージ（Tiptap エディタ含む）を表示させ、スクロールの滑らかさ、CPU/メモリ使用量を確認。
  - **`estimateSize` の精度向上検討:** 現在の行数ベースの概算では不十分な場合（画像、複数行コードブロック等で高さが大きく変動する場合）、より正確な概算ロジックを検討するか、`measureElement` を使った動的計測の導入を検討（パフォーマンス影響とトレードオフ）。
  - **スクロールコンテナのスタイル確認:** 親要素 (`.responses-container`) が適切な `height` と `overflow-y: auto` を持ち、仮想スクロールが正しく機能するか確認。
  - **Tiptap エディタの初期化コスト検証:** 仮想化による頻繁なマウント/アンマウント時のエディタ初期化コストが許容範囲か確認。

### ステップ 6: テストとリファクタリング (📝 未着手)

- 各機能が意図通りに動作するかテストする (Markdown⇔Tiptap 変換、画像挿入・表示、API 連携、パフォーマンス)。
- コード全体のリファクタリングを行い、可読性・保守性を向上させる。

### ステップ 7: メンション機能の検討 (`@tiptap/extension-mention`) (🚧 作業中)

- **目的:** AI モデルの指定を `@` 記号によるメンションで行えるようにする。
- **導入ライブラリ:** `@tiptap/extension-mention` および、候補リスト表示のためのカスタム UI コンポーネント。
- **現在の進捗:**
  - `@tiptap/extension-mention` をインストール済み。
  - `MarkdownTipTapEditor.tsx` に `Mention` 拡張機能を追加し、基本的な `suggestion` オプション (items, render, command) の雛形を実装済み。
  - `MentionList.tsx` コンポーネントの雛形を作成し、Tiptap からの props (items, command, selectedIndex) を受け取れるように修正済み。
  - `MarkdownTipTapEditor.tsx` の `suggestion.render().onKeyDown` でキーボードナビゲーション (ArrowUp, ArrowDown, Enter, Tab, Escape) と選択ロジックの基本を実装済み。
  - `aiModelSuggestions` prop を介して親コンポーネントから AI モデルのリストを受け取り、メンション候補として表示する機能を実装済み。
  - メンション選択時に `onSelectAiModel` prop を通じて選択されたモデル ID (例: `openai/gpt-4o`) を親コンポーネントに通知する機能を実装済み。
  - `useChatLogic.ts` の `selectSingleModel` 関数がこの通知を受けて、チャット設定のモデル選択状態を更新する連携を実装済み。
- **残タスク:**
  - **Markdown へのシリアライズ/デシリアライズ方法の確定と実装 (📝 保留 → 当面現状維持):**
    - 現在はメンション選択時に `@<モデルの表示名> ` (例: `@GPT-4o `) というプレーンテキストをエディタに挿入している。これはユーザーインターフェース上は分かりやすいが、内部的にモデル ID (`openai/gpt-4o`) と表示名を紐付けて保持・送信する方が堅牢。
    - `tiptap-markdown` がこれをどのように処理するか、またカスタムパーサー/レンダラーが必要かを調査・実装。
    - **現状は API リクエスト時に `@モデル名` の部分をパースしてモデル ID を抽出するロジック (`extractModelsFromInput` in `useChatLogic.ts`) があるため、当面はこのままで進行し、より複雑なメンション管理（ユーザーメンションなど）が必要になった際に、カスタム構文 `@[label](id)` や Tiptap のマーク/ノード属性への保存を再検討する。**
  - **候補リストの UI/UX 改善 (📝 未着手):** `MentionList.tsx` のスタイリング、スクロール、選択状態の視認性などを向上させる。
  - **非同期での候補取得 (📝 未着手):** `suggestion.items` を非同期関数に変更し、実際の API などから動的に候補を取得できるようにする。(今回は OpenRouter からのモデルリスト取得は完了しているため、この項目は必須ではない)
  - **メンション候補の具体的なユースケース実装 (📝 未着手):** 初期実装として検討していたカスタムプロンプト挿入機能 (`@prompt:<カスタムプロンプト名>`) の具体的な候補データと挿入ロジックの実装。
  - **`InputSection.tsx` のクリーンアップ:** 古いモデルサジェスチョン関連コードを削除（上記ステップ 2 の残タスクと重複）。

## 4. 機能拡張と改善検討

- **Tiptap 関連:**
  - エラーハンドリング: Tiptap 関連のエラー、画像アップロードエラーなど。
  - UI/UX の微調整: Tiptap エディタのスタイル調整、ツールバーの追加 (基本的な書式設定、画像挿入、テーブル挿入ボタンなど)。
  - アクセシビリティ: Tiptap エディタのアクセシビリティ対応。
- **React 19 機能の活用検討 (📝 未着手):**
  - React 19 のリリースと安定化に伴い、以下の機能の導入を検討し、プロジェクトのパフォーマンス、開発効率、UX を向上させる。
  - **React Compiler:**
    - **目的:** 手動でのメモ化 (`useMemo`, `useCallback`, `React.memo`) を削減し、コンパイラによる自動最適化の恩恵を受ける。コードの可読性を向上させ、パフォーマンスボトルネックを潜在的に解消する。
    - **適用箇所と期待効果:**
      - `hooks/useChatLogic.ts`:
        - 多数存在する `useState`, `useEffect`, `useCallback` 間の複雑な依存関係とメモ化ロジックをコンパイラに委ねる。
        - `updateMessage`, `addMessage`, `handleSend`, `fetchChatResponse` 等のコア関数や、`useEffect`内の各種データ同期処理の最適化。
        - 結果として、状態管理ロジックの簡素化と実行時パフォーマンスの向上が期待される。
      - `components/ChatPage.tsx`:
        - `useEffect` フック内の `localStorage` アクセスやイベントリスナー関連処理 (`checkActualChats`, `checkMobile`) の自動メモ化。
        - 条件分岐による多様なレンダリングパスの最適化。
      - `components/ChatResponses.tsx`:
        - （仮想化と併用しつつ）各メッセージアイテム (`MarkdownTipTapEditor` を含む) のレンダリング最適化。
      - `components/InputSection.tsx`:
        - 入力状態 (`chatInput`) や親からの props 変更に伴う再レンダリングの最適化。
      - その他、`Header.tsx`, `SettingsModal.tsx`, `ChatList.tsx` など、状態や props に依存する多くのコンポーネント。
    - **導入方針:** React 19 および Next.js の対応バージョンアップ後、まずは主要なロジック (`useChatLogic`) とリスト表示 (`ChatResponses`) から段階的にコンパイラを適用。既存の `React.memo` や `useCallback` は慎重に削除し、パフォーマンステスト (React DevTools Profiler, Lighthouse など) を通じて効果を検証・比較する。
  - **Actions と `useFormStatus`:**
    - **目的:** フォーム送信と関連する非同期処理の宣言的な記述、UI の Pending 状態管理の簡素化、アクセシビリティ向上。
    - **適用箇所と期待効果:**
      - `components/InputSection.tsx` (`mainInput={true}` のメッセージ送信フォーム):
        - `handleSend` ロジックを `<form action={submitAction}>` の形でリファクタリング。`submitAction` は `useChatLogic.ts` から提供、または `InputSection` 内で定義し `useChatLogic` の関数を呼び出す。
        - `useFormStatus` を使用して、フォーム送信中（`pending` 状態）に送信ボタンを無効化し、ローディングインジケータを表示する。
        - これにより、送信処理の状態管理が簡潔になり、ユーザーへのフィードバックが向上。
      - `components/SettingsModal.tsx` (API キー設定、モデル設定など):
        - 設定保存ボタンを持つ各フォーム要素を Actions パターンでリファクタリング。
        - `useFormStatus` を活用し、保存処理中の UI フィードバック（ボタンのローディング表示など）を実装。
        - 結果として、設定変更時の UX が向上し、コードの見通しも良くなる。
    - **導入方針:** まず `InputSection.tsx` のメインメッセージ送信フォームから導入。続いて `SettingsModal.tsx` の各設定フォームへ展開。既存の `isGenerating` state との連携・整理も行う。
  - **`useOptimistic` フック:**
    - **目的:** ネットワークリクエストの完了を待たずに UI を即座に更新し、体感的な応答速度を向上させる。
    - **適用箇所と期待効果:**
      - `hooks/useChatLogic.ts` (`handleSend`内):
        - ユーザーがメッセージを送信した直後に、`messages` state にそのユーザーメッセージを楽観的に追加。 (✅ 実装済み: `addOptimisticMessage` アクション `addUserMessageAndPlaceholders` を使用)
        - LLM からの応答ストリームが開始される際に、対応する LLM 側のメッセージオブジェクトを楽観的に生成し、ストリーミング内容を追記していく。(✅ 実装済み: `addOptimisticMessage` アクション `updateLlmResponse` を使用)
        - これにより、ユーザー入力と AI の応答開始がよりスムーズに繋がり、待機時間が短縮されたように感じられる。
        - エラー発生時のロールバック処理（楽観的更新の取り消し）も実装し、データの整合性を担保する。
    - **導入方針:** チャットメッセージの送受信フローに限定して導入。ユーザーメッセージの追加と、LLM 応答の初期表示部分に適用。状態管理の複雑化に注意し、エラーケースのテストを十分に行う。
    - **残タスク:**
      - エラー発生時のロールバック処理について、現状 `addOptimisticMessage` で `isError: true` を設定しエラーメッセージを表示しているが、より複雑なロールバック（例: 楽観的に追加したメッセージの完全削除）が必要か検討。**現状はエラー表示で十分と判断。**
      - LLM 応答完了時（ストリーム終了時）に `isGenerating: false` を `addOptimisticMessage` で確実に反映する。(✅ 実装済み)
  - **Asset Loading API (Suspense for Resources):**
    - **目的:** CSS、フォント、外部スクリプトなどの外部リソース読み込みを React が管理し、Suspense と連携することで、最適なタイミングでの読み込みと表示制御を実現し、初期表示速度 (LCP) や体感速度を改善する。
    - **適用箇所と期待効果:**
      - `app/layout.tsx`:
        - グローバル CSS (`globals.scss` や `chat.scss` 等) や、アプリケーション全体で使用するフォントの読み込みを React の管理下に置く。`<link rel="stylesheet" href="...">` を React の API（例: `<link resource={...}>`）に置き換える。
      - `components/ChatResponses.tsx` (または `MarkdownTipTapEditor.tsx`):
        - `highlight.js` のテーマ CSS (例: `github.css`) を、コードブロックが表示されるコンポーネントが実際に必要とするタイミングで読み込むようにする。これにより、初期ロード時には不要な CSS を読み込まず、ページの軽量化に貢献。
        - Suspense for CSS を活用し、CSS 読み込み中のフォールバック UI（例: スケルトン表示）を提供することも検討。
    - **導入方針:** Next.js が React 19 の Asset Loading API にどのように対応するか公式ドキュメントを確認し、推奨される方法で適用。まずはグローバルアセットから開始し、次にコンポーネント固有のアセットへと展開。
  - **Server Actions (Next.js App Router との連携強化):**
    - **目的:** クライアントサイドで行っている API リクエストやビジネスロジックの一部をサーバーサイドに移行し、クライアントの負荷軽減、セキュリティ向上、コードの関心事分離を促進する。
    - **適用箇所と期待効果:**
      - `hooks/useChatLogic.ts` の `fetchModels` 関数:
        - 現在クライアントサイドの `fetch` で OpenRouter API からモデルリストを取得している部分を Server Action に置き換える。
        - これにより、API エンドポイントや潜在的なクレデンシャル情報をクライアントに公開することなく、サーバーサイドで安全にデータを取得できる。
      - チャット履歴の永続化処理 (将来的な拡張):
        - `localStorage` への保存に加え、または代替として、データベースへのチャット履歴保存・読み込み機能を Server Actions として実装。
      - 共有機能 (`app/share/[gistId]/page.tsx`):
        - Gist からのデータ取得や、Gist への保存（もし実装する場合）といったバックエンドとの連携処理を Server Action でカプセル化。
        - フォーム経由でのデータ送信が不要な場合でも、`startTransition`と組み合わせて Server Action を呼び出すことで、Pending UI を管理できる。
    - **導入方針:** まずは `fetchModels` のような副作用の少ない読み取り処理から Server Action 化を試みる。書き込み処理（チャット保存など）は、トランザクション管理やエラーハンドリングを慎重に設計した上で導入。
