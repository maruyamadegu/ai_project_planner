# AI Project Planner

AIを活用したプロジェクト計画・管理ツールです。

## 機能

- **AIプロジェクト計画生成**: Gemini APIを使用してプロジェクトを自動的にタスクに分解
- **フローチャート表示**: タスク間の依存関係を視覚的に表示
- **詳細計画管理**: 各タスクのサブステップ、アクションアイテム、決定事項を管理
- **レポート生成**: AIによるプロジェクトレポートとスライド作成
- **ガントチャート**: プロジェクトのタイムライン表示
- **プロジェクト保存**: Supabaseを使用したクラウド保存（オプション）
- **コラボレーション**: チームメンバーとのプロジェクト共有（Supabase必須）

## セットアップ

### 必須要件

1. **Gemini API Key**: Google AI Studioから取得
   - [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### オプション要件（プロジェクト保存・共有機能）

2. **Supabaseプロジェクト**: プロジェクトの保存・読み込み・共有機能を使用する場合
   - [https://supabase.com](https://supabase.com)でプロジェクトを作成
   - データベースマイグレーションを実行

### ローカル実行

1. 依存関係をインストール:
   ```bash
   npm install
   ```

2. 環境変数を設定:
   ```bash
   cp .env.example .env
   ```
   
   `.env`ファイルを編集して以下を設定:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # オプション: プロジェクト保存機能を使用する場合
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. アプリケーションを起動:
   ```bash
   npm run dev
   ```

### Supabaseセットアップ（オプション）

プロジェクトの保存・読み込み・共有機能を使用する場合：

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. データベースマイグレーションを実行:
   - `supabase/migrations/`フォルダ内のSQLファイルをSupabaseのSQL Editorで実行
3. 環境変数にSupabaseの設定を追加

## 使用方法

1. **APIキー設定**: 初回起動時にGemini APIキーを入力
2. **プロジェクト作成**: 目標と期日を入力してAIにプロジェクト計画を生成させる
3. **タスク管理**: 生成されたタスクを詳細に編集・管理
4. **レポート作成**: AIを使用してプロジェクトレポートを生成
5. **プロジェクト保存**: Supabaseが設定されている場合、プロジェクトをクラウドに保存

## 技術スタック

- **フロントエンド**: React, TypeScript, Tailwind CSS
- **AI**: Google Gemini API
- **バックエンド**: Supabase (オプション)
- **ビルドツール**: Vite

## 注意事項

- Gemini APIキーは必須です
- Supabaseの設定は任意ですが、プロジェクトの保存・共有機能には必要です
- APIキーはセッション中のみブラウザに保存されます