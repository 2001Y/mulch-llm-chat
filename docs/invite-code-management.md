# 招待コードシステム管理ガイド

## 概要

招待コードシステムは、ユーザーがOpenRouterアカウントを持たなくても、事前に設定された招待コードを使用してAIモデルにアクセスできる機能です。

## セキュリティ上の注意事項

- **本番環境で使用する場合は、実際のAPIキーを環境変数で管理することを推奨します**
- APIキーは絶対にクライアント側に露出させないでください
- 開発・デモ環境用の招待コードと本番環境用の招待コードは分けて管理してください

## 招待コードの追加・更新

### 1. 設定ファイルの編集

`config/invite-codes.json` ファイルを編集して新しい招待コードを追加します：

```json
{
  "codes": {
    "NEW-CODE-789": "sk-or-v1-your-actual-api-key-here",
    "EXISTING-CODE-123": "sk-or-v1-example-api-key-123"
  }
}
```

### 2. 招待コードの形式

- 大文字小文字は区別されません（ユーザーフレンドリー）
- ハイフンやアンダースコアを含むことができます
- 推奨形式: `PURPOSE-RANDOM-123` (例: `DEMO-ACCESS-456`, `TRIAL-USER-789`)

### 3. 環境別の管理

#### 開発環境
開発環境では`config/invite-codes.json`に直接記載して問題ありません。

#### 本番環境
本番環境では、以下のような方法で実際のAPIキーを保護することを推奨します：

```typescript
// app/api/invite-code/validate/route.ts の修正例
const devInviteCodes = require("@/config/invite-codes.json").codes;
const prodInviteCodes = process.env.INVITE_CODES 
  ? JSON.parse(process.env.INVITE_CODES) 
  : {};

const inviteCodes = {
  ...devInviteCodes,
  ...prodInviteCodes // 本番環境の招待コードで上書き
};
```

環境変数の設定例：
```bash
INVITE_CODES='{"PROD-123":"sk-or-v1-xxx","PROD-456":"sk-or-v1-yyy"}'
```

## 使用制限の実装（オプション）

招待コードに使用制限を設けたい場合は、以下のような拡張が可能です：

1. **使用回数制限**: 各招待コードの使用回数をトラッキング
2. **有効期限**: 招待コードに有効期限を設定
3. **レート制限**: 招待コード毎のAPI呼び出し回数を制限

## トラブルシューティング

### 招待コードが機能しない場合

1. `config/invite-codes.json` ファイルが正しい形式であることを確認
2. APIキーが有効であることを確認
3. サーバーログでエラーメッセージを確認

### プロキシAPIがタイムアウトする場合

1. OpenRouterのAPIキーが有効であることを確認
2. ネットワーク接続を確認
3. OpenRouterのステータスページで障害情報を確認

## セキュリティベストプラクティス

1. **環境別のAPIキー管理**: 開発用と本番用でAPIキーを分離
2. **定期的なAPIキーのローテーション**: 定期的にAPIキーを更新
3. **アクセスログの監視**: 招待コードの使用状況を監視
4. **異常検知**: 異常な使用パターンを検出してアラート
5. **HTTPS必須**: APIエンドポイントへのアクセスは必ずHTTPS経由で

## 今後の拡張案

1. **管理画面**: 招待コードをWeb UIから管理できる機能
2. **使用統計**: 各招待コードの使用状況を可視化
3. **ユーザー管理**: 招待コードとユーザーアカウントの紐付け
4. **カスタム制限**: モデルやトークン数の制限をコード毎に設定