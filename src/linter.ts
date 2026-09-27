import { WIKI_DOCS, MasterDoc } from './masters';

interface LintIssue {
  docName: string;
  category: 'BrokenLink' | 'DateFormat' | 'SensitiveData' | 'OpenQuestion';
  message: string;
  lineSnippet?: string;
}

function runFullWikiLint(): void {
  Logger.log('=== LLM Wiki Health & Lint Audit 開始 ===');
  const issues: LintIssue[] = [];
  let scannedCount = 0;

  for (const doc of WIKI_DOCS) {
    try {
      const gDoc = DocumentApp.openById(doc.id);
      const text = gDoc.getBody().getText();
      scannedCount++;

      // 1. リンク切れ・不正URLチェック
      const linkRegex = /\[([^\]]+)\]\(([^)]*)\)/g;
      let match;
      while ((match = linkRegex.exec(text)) !== null) {
        const linkText = match;
        const url = match.trim();
        if (!url || url === '#' || !url.startsWith('http')) {
          issues.push({
            docName: doc.name,
            category: 'BrokenLink',
            message: `不正または空のURL: [${linkText}](${url})`
          });
        }
      }

      // 2. 日付表記揺れチェック (YYYY/MM/DD や 202X.MM.DD などを検知)
      const slashDateRegex = /\b202\d\/(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\b/g;
      let dateMatch;
      while ((dateMatch = slashDateRegex.exec(text)) !== null) {
        issues.push({
          docName: doc.name,
          category: 'DateFormat',
          message: `スラッシュ区切りの日付表記 (推奨: YYYY-MM-DD): "${dateMatch[0]}"`
        });
      }

      // 3. センシティブデータ監査 (マイナンバー等のパターン簡易スキャン)
      const myNumberRegex = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;
      if (myNumberRegex.test(text)) {
        // ※誤検知の可能性もあるためフラグとして検知
        issues.push({
          docName: doc.name,
          category: 'SensitiveData',
          message: '12桁の連続数値（マイナンバー等の機密番号候補）を検知'
        });
      }

      // 4. 未解決の問い・TODOの抽出
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.includes('【未解決の問い】') || line.includes('要確認') || line.includes('TODO') || line.includes('FIXME')) {
          issues.push({
            docName: doc.name,
            category: 'OpenQuestion',
            message: line.trim().substring(0, 100)
          });
        }
      }

    } catch (e: any) {
      Logger.log(`[エラー] ${doc.name} の読み込みに失敗: ${e.message}`);
    }
  }

  // レポート出力
  Logger.log('-----------------------------------------');
  Logger.log(`走査完了ドキュメント数: ${scannedCount} / ${WIKI_DOCS.length}`);
  Logger.log(`検知イシュー総数: ${issues.length} 件`);
  
  const brokenLinks = issues.filter(i => i.category === 'BrokenLink');
  const dateFormats = issues.filter(i => i.category === 'DateFormat');
  const sensitive = issues.filter(i => i.category === 'SensitiveData');
  const openQuestions = issues.filter(i => i.category === 'OpenQuestion');

  Logger.log(`- 破損・空リンク: ${brokenLinks.length} 件`);
  Logger.log(`- 日付表記揺れ: ${dateFormats.length} 件`);
  Logger.log(`- 機密識別子フラグ: ${sensitive.length} 件`);
  Logger.log(`- 未解決の問い・TODO: ${openQuestions.length} 件`);

  if (issues.length > 0) {
    Logger.log('--- [主な検知詳細 (抜粋)] ---');
    issues.slice(0, 15).forEach(issue => {
      Logger.log(`[${issue.category}] ${issue.docName}: ${issue.message}`);
    });
  }
  Logger.log('=========================================');
}
