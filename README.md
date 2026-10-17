# llm-wiki-linter

LLM Wiki（全21ドメインマスター＋システム文書）の静的整合性および構造的健全性を自動検証する Google Apps Script（TypeScript）監査エンジンです。

## 概要

Andrej Karpathy 氏が提唱する LLM Wiki パターンに基づき、Google ドキュメント形式で管理されるマスター群を機械的・決定論的に検査します。
AGENTS.md #15（SEC-08）「Judge by Rule, Explain by LLM」の原則に準拠し、合否判定は決定論的 TypeScript コードのみで評価し、文脈依存・意味的解釈が必要な項目は `UNKNOWN` として上位レビュー・LLM 調査へ委譲します。

## 監査ルール一覧（Rule Catalog）

| ルールID | ルール名称 | 判定種別 | 対象・内容 |
|---|---|---|---|
| `WIKI-001` | Broken/Invalid Links | `FAIL` | 空リンク、`#` のみ、または `http` 形式以外の不正な Markdown リンク |
| `WIKI-002` | Date Format Standard | `FAIL` | スラッシュ区切り日付（`YYYY/MM/DD`）の表記揺れ（標準形式 `YYYY-MM-DD` への準拠） |
| `WIKI-003` | Sensitive Identifier Scan | `UNKNOWN` | 12桁の連続数値など、マイナンバー等の機密識別子候補の検知（文脈確認が必要） |
| `WIKI-004` | Open Questions & Backlog | `UNKNOWN` | 「【未解決の問い】」「要確認」「TODO」等の未確定事項・宿題の抽出 |

## 開発・ビルドコマンド

```bash
# 依存関係インストール
npm install

# TypeScript ビルド
npm run build

# デプロイ (clasp push)
npm run deploy
```

## Known Limitations（既知の制約）

1. **決定論的構文・パターン検査への特化**:
   - 本 Linter は高速かつ完全再現可能な決定論的正規表現・構文解析に特化しています。
   - 複数マスター間にまたがる事実関係の矛盾（例: 住所や契約回線の不一致、数値の論理整合性）や自然言語としての意味的整合性の判定は行いません。
2. **UNKNOWN 項目の上位委譲**:
   - `WIKI-003`（機密識別子候補）や `WIKI-004`（未解決の問い）は、機械的な合否判定を行わず `UNKNOWN` として報告されます。
   - `UNKNOWN` と判定された項目は、LLM（Gemini 4 Argon / Gemini 3.8 Flash）または人間（ふじーさん）による文脈調査・修正案提示プロセスへ委譲されます。
3. **Google Docs 読み取り権限とクォータ**:
   - 実行には Google ドライブ上のマスタードキュメントへの参照権限が必要です。また、短時間での大量アクセス時は Apps Script の UrlFetch/DocumentApp 実行時間制限（最大6分）に従います。
