# Claude Code 設定

## 禁止コマンド

以下のコマンドは絶対に実行しないでください：

- git reset --hard
- git rebase
- git filter-branch
- git push --force
- rm -rf /
- その他、履歴を消すコマンド

## 許可されている操作

- ファイルの編集・削除・作成
- ビルドコマンドの実行
- Web 検索
- Git 操作（履歴を消さないもの）
- テストの実行

## コーディング規約

- インデントはスペース 2 つ
- 変数名は camelCase
- コメントは日本語で記述
