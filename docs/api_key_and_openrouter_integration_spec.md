# チャットアプリケーション改修仕様書

## 1. はじめに

本改修の目的は、チャットアプリケーションの認証・API キー管理方法を見直し、OpenRouter を主要な LLM プロバイダーとして利用しやすくすることです。また、Vercel AI SDK を活用し、モダンな開発手法を取り入れます。

## 2. 全体アーキテクチャ変更点

### 2.1. API キー管理戦略

- **中心プロバイダー:** OpenRouter をデフォルトの LLM プロバイダーとします。
- **API キー格納場所:**
  - **フロントエンド:**
    - `localStorage` にユーザーが入力/取得した OpenRouter API キーを保存します (`openrouter_api_key`)。
  - **バックエンド (フォールバック):**
    - 環境変数 `OPENROUTER_API_KEY` も利用可能とします。フロントエンドからキーが提供されない場合の最終手段とします。
- **API キー取得フロー (OpenRouter):**
  - ユーザーがアプリケーション内の「OpenRouter でログイン/API キー取得」ボタンをクリックします。
  - OpenRouter の認証ページ（または API キー発行ページ）にリダイレクト、もしくは新規ウィンドウで開きます。
  - ユーザーは OpenRouter 側で認証/承認、または API キーを生成・コピーします。
  - **動的取得の試み:** 可能であれば、OpenRouter が提供する OAuth2 や PKCE フローを利用し、認証後にコールバック経由で API キーを自動的に取得し `localStorage` に保存します。
  - **手動設定:** 上記の自動取得が困難な場合は、ユーザーがコピーした API キーを設定モーダル内の専用入力フィールドにペーストして保存するフローとします。この場合、UI/UX でスムーズな連携を促します。
- **動的設定の課題 (バックエンド):**
  - フロントエンドから渡された API キーをバックエンドの Vercel AI SDK プロバイダー (`@ai-sdk/openai`) に動的に設定する部分で技術的な課題（型エラー）が発生しています。解決策を継続調査中です。

### 2.2. 認証フロー

- **OpenRouter API キー:** 上記「2.1. API キー取得フロー (OpenRouter)」を参照。
- **GitHub Gist 連携:** 既存の GitHub OAuth による Gist アクセストークン取得・保存フローは、チャット共有機能のために維持します。設定モーダル内に Gist Token に関する設定 UI（現状あればそれを維持、なければ表示や管理方法を検討）を設けます。

### 2.3. 無料モデル・ログイン概念の廃止

- 以前検討されていた「無料モデル」や、API キー設定・Gist 連携以外の汎用的な「ログイン」の概念は廃止します。アプリケーションの LLM 機能利用は OpenRouter API キー設定が前提となります。

## 3. 具体的な改修内容

### 3.1. バックエンド (`app/api/chat/route.ts`)

- **現状の課題と対策:**
  - Vercel AI SDK の `@ai-sdk/openai` プロバイダーを使用し、OpenRouter (`baseURL: "https://openrouter.ai/api/v1"`) 経由で LLM を利用する想定です。
  - フロントエンドからリクエストボディで渡される API キー (`key` プロパティ) をプロバイダーに動的に設定する部分でリンターエラー（型ミスマッチ）が発生しています。
  - **最優先課題:** `@ai-sdk/openai` (または関連ヘルパー `createOpenAI` 等) を使用して、リクエストごとに API キー、Base URL、カスタムヘッダーを正しく設定する方法を確立します。Vercel AI SDK のドキュメント、GitHub リポジトリの Issue やサンプルコードを詳細に調査します。
- **理想的な動作:**
  - リクエストボディの `key` プロパティで渡された API キーを最優先で使用します。
  - `key` がない場合は、環境変数 `OPENROUTER_API_KEY` を使用します。
  - どちらの API キーもない場合は、401 Unauthorized エラーを返します。
- **エラー時のレスポンス:** API キー不備やその他のエラー発生時は、エラー内容がフロントエンドで判別しやすい JSON 形式で返却します（例: `{ error: { message: "...", type: "auth_error", code: "invalid_api_key" } }`）。

### 3.2. 設定モーダル (`components/SettingsModal.tsx`)

- **API キー設定:**
  - モーダル上部に「API Keys」セクションを設けます。
  - **OpenRouter API Key:**
    - 表示ラベル: "OpenRouter API Key"
    - 入力フィールド: パスワード型 (`type="password"`)
    - 保存ボタン: "Save" または "Update Key"
    - 取得補助: 「OpenRouter で API キーを取得/確認」のようなリンクボタンを設置し、OpenRouter のキー発行ページにユーザーを誘導します。動的取得フローが実現できた場合は、このボタンが認証フローを開始します。
  - 入力された API キーは `localStorage` の `"openrouter_api_key"` に保存します。
- **Gist Token 設定:**
  - 既存の Gist Token 関連の UI とロジックをこのセクションに統合、または隣接して配置し、管理しやすくします。
- **モデルリスト管理、Function Call 管理:**
  - 既存の機能は維持し、UI 内でセクションを分けて整理します。

### 3.3. チャットロジック (`hooks/useChatLogic.ts`)

- **API キーの取り扱い:**
  - `localStorage` から `"openrouter_api_key"` を読み込みます。
  - チャット送信時 (`handleSend` または `fetchChatResponse` 内):
    - API リクエスト (`/api/chat`) のボディに、取得した `openRouterApiKey` を `key` プロパティとして含めます。
    - OpenRouter 推奨のヘッダー (`HTTP-Referer`, `X-Title`) もリクエストボディに `siteUrl`, `siteName` として含めます。
- **デフォルトモデル:**
  - アプリケーションのデフォルト選択モデルを OpenRouter の推奨モデル（例: `openrouter/auto` または `anthropic/claude-3-haiku`など）に設定します。
- **エラーハンドリングと UI フィードバック:**
  - OpenRouter API キーが `localStorage` に保存されていない、または API から 401 エラーが返ってきた場合:
    - チャット入力エリア付近にエラーメッセージ（例: 「OpenRouter API キーが設定されていません。設定モーダルからキーを設定してください。」）を表示します。
    - メッセージと共に、「設定を開く」ボタン（設定モーダルを開く）と、「OpenRouter でキーを取得」ボタン（OpenRouter サイトへ誘導、または動的取得フローを開始）を表示します。
  - これらの状態を管理するための state（例: `apiKeyError: string | null`, `showApiKeySetupUI: boolean`）を導入します。

### 3.4. チャット UI (`InputSection.tsx`, `ChatPage.tsx` 等)

- **API キー未設定/無効時の表示:**
  - `useChatLogic` から提供される状態に基づき、API キーに関するエラーメッセージとアクションボタンをチャット入力欄の近くなど、目立つ場所に表示します。

## 4. 今後の課題と検討事項

- **OpenRouter API キーの動的取得フロー確立:**
  - OpenRouter が公式にクライアントサイド向けの OAuth2 や PKCE フローを提供しているか最終確認します。
  - 提供されている場合、そのフローを実装します。
  - 提供されていない場合、ユーザーが手動でキーを設定するフローの UI/UX を可能な限りスムーズにします。
- **バックエンド API ルートのリンターエラー解決:**
  - `@ai-sdk/openai` を使用して API キー等を動的に設定する正確な方法を特定し、実装します。
- **セキュリティ:**
  - API キーを `localStorage` に保存する際のリスクを認識し、XSS 対策などが適切に行われていることを確認します。
- **他モデルプロバイダーのサポート:**
  - 将来的に OpenAI など他のプロバイダーの API キーも設定・利用できるように、設定モーダルやロジックの拡張性を考慮します。

## 5. 補足: リンターエラーの一時回避について

`app/api/chat/route.ts` での API キー関連の型エラーは、設定オブジェクトの構造に関するものであり、ダミーの API キー文字列をコードに直接埋め込むだけでは根本的な解決には至らない可能性が高いです。正しい設定方法の特定が引き続き必要です。
