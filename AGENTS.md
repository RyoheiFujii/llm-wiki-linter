# AGENTS.md - LLM Wiki Linter Project Guidelines

## 1. Project Overview
- **Name**: llm-wiki-linter
- **Type**: Google Apps Script (TypeScript + Clasp)
- **Target Script ID**: `1pxgARG2limSbEpwhc9JWR9BQRieg-L0jJZKvtlX_-0eKvwz794NJdqJA`
- **Source Directory**: `src/` (TypeScript files)
- **Build Output**: `dist/` (JavaScript files for Clasp)

---

## 2. Verification Loop & Deployment Protocol
コード改修・実装時は以下の手順を厳格に遵守すること。
1. **ビルド検証**: `npm run build`
   - TypeScript のコンパイルおよび型エラーが 0 件であることを確認する。
2. **GAS デプロイ**: `npm run deploy`
   - ビルド通過後のみ実行すること。
3. **Git コミット＆プッシュ**:
   - コミットメッセージは Conventional Commits 形式に従うこと。
   - 例: `git commit -m "feat(linter): add rule" && git push origin main`

---

## 3. Strict Project Constraints
- **Read-Only Inspection**: Linter は対象 Google Docs を読み取り専用（read-only）で検査し、勝手に Docs の本文を書き換えないこと。
- **Zero Speculation**: リンク切れやフォーマット異常の判定は、正規表現および確定事実に基いて客観的に判定すること。
