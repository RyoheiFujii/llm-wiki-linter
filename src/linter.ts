import { WIKI_DOCS, MasterDoc } from './masters';

/**
 * 決定論的ルール判定ステータス（Judge by Rule, Explain by LLM）
 * - PASS: 決定論的検査に完全に適合
 * - FAIL: 明確なルール違反（破損リンク、スラッシュ日付等）
 * - UNKNOWN: 文脈依存・意味的解釈が必要であり、LLM調査および上位レビューへの委譲対象
 */
export type DeterministicStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export type LintRuleId = 'WIKI-001' | 'WIKI-002' | 'WIKI-003' | 'WIKI-004';

export interface LintIssue {
  ruleId: LintRuleId;
  docName: string;
  category: 'BrokenLink' | 'DateFormat' | 'SensitiveData' | 'OpenQuestion';
  status: DeterministicStatus;
  message: string;
  lineSnippet?: string;
}

export interface RuleSummary {
  ruleId: LintRuleId;
  name: string;
  status: DeterministicStatus;
  count: number;
}

export interface LintAuditResult {
  timestamp: string;
  overallStatus: DeterministicStatus;
  scannedDocs: number;
  totalDocs: number;
  ruleSummaries: RuleSummary[];
  issues: LintIssue[];
}

export function runFullWikiLint(): LintAuditResult {
  Logger.log('=== LLM Wiki Health & Lint Audit 開始 (SEC-08: Judge by Rule) ===');
  const issues: LintIssue[] = [];
  let scannedCount = 0;

  for (const doc of WIKI_DOCS) {
    try {
      const gDoc = DocumentApp.openById(doc.id);
      const text = gDoc.getBody().getText();
      scannedCount++;

      // WIKI-001: 破損・不正URLチェック (FAIL判定)
      const linkRegex = /\[([^\]]+)\]\(([^)]*)\)/g;
      let match;
      while ((match = linkRegex.exec(text)) !== null) {
        const linkText = match[1];
        const url = match[2].trim();
        if (!url || url === '#' || !url.startsWith('http')) {
          issues.push({
            ruleId: 'WIKI-001',
            docName: doc.name,
            category: 'BrokenLink',
            status: 'FAIL',
            message: `不正または空のURL: [${linkText}](${url})`
          });
        }
      }

      // WIKI-002: 日付表記揺れチェック (FAIL判定)
      const slashDateRegex = /\b202\d\/(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\b/g;
      let dateMatch;
      while ((dateMatch = slashDateRegex.exec(text)) !== null) {
        issues.push({
          ruleId: 'WIKI-002',
          docName: doc.name,
          category: 'DateFormat',
          status: 'FAIL',
          message: `スラッシュ区切りの日付表記 (推奨: YYYY-MM-DD): "${dateMatch[0]}"`
        });
      }

      // WIKI-003: センシティブデータ候補 (UNKNOWN判定: LLM調査・文脈確認へ委譲)
      const myNumberRegex = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;
      if (myNumberRegex.test(text)) {
        issues.push({
          ruleId: 'WIKI-003',
          docName: doc.name,
          category: 'SensitiveData',
          status: 'UNKNOWN',
          message: '12桁の連続数値（マイナンバー等の機密番号候補・要文脈確認）を検知'
        });
      }

      // WIKI-004: 未解決の問い・TODOの抽出 (UNKNOWN判定: 意味的レビューへ委譲)
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.includes('【未解決の問い】') || line.includes('要確認') || line.includes('TODO') || line.includes('FIXME')) {
          issues.push({
            ruleId: 'WIKI-004',
            docName: doc.name,
            category: 'OpenQuestion',
            status: 'UNKNOWN',
            message: line.trim().substring(0, 100)
          });
        }
      }

    } catch (e: any) {
      Logger.log(`[エラー] ${doc.name} の読み込みに失敗: ${e.message}`);
    }
  }

  const failCount = issues.filter(i => i.status === 'FAIL').length;
  const unknownCount = issues.filter(i => i.status === 'UNKNOWN').length;

  let overallStatus: DeterministicStatus = 'PASS';
  if (failCount > 0) {
    overallStatus = 'FAIL';
  } else if (unknownCount > 0) {
    overallStatus = 'UNKNOWN';
  }

  const ruleSummaries: RuleSummary[] = [
    {
      ruleId: 'WIKI-001',
      name: 'Broken/Invalid Links',
      status: issues.some(i => i.ruleId === 'WIKI-001' && i.status === 'FAIL') ? 'FAIL' : 'PASS',
      count: issues.filter(i => i.ruleId === 'WIKI-001').length
    },
    {
      ruleId: 'WIKI-002',
      name: 'Date Format Standard (YYYY-MM-DD)',
      status: issues.some(i => i.ruleId === 'WIKI-002' && i.status === 'FAIL') ? 'FAIL' : 'PASS',
      count: issues.filter(i => i.ruleId === 'WIKI-002').length
    },
    {
      ruleId: 'WIKI-003',
      name: 'Sensitive Identifier Scan',
      status: issues.some(i => i.ruleId === 'WIKI-003') ? 'UNKNOWN' : 'PASS',
      count: issues.filter(i => i.ruleId === 'WIKI-003').length
    },
    {
      ruleId: 'WIKI-004',
      name: 'Open Questions & Backlog TODOs',
      status: issues.some(i => i.ruleId === 'WIKI-004') ? 'UNKNOWN' : 'PASS',
      count: issues.filter(i => i.ruleId === 'WIKI-004').length
    }
  ];

  // レポート出力
  Logger.log('-----------------------------------------');
  Logger.log(`Overall Deterministic Status: [${overallStatus}]`);
  Logger.log(`走査完了ドキュメント数: ${scannedCount} / ${WIKI_DOCS.length}`);
  Logger.log(`検知イシュー総数: ${issues.length} 件 (FAIL: ${failCount}, UNKNOWN: ${unknownCount})`);

  ruleSummaries.forEach(r => {
    Logger.log(`- [${r.status}] ${r.ruleId} ${r.name}: ${r.count} 件`);
  });

  if (issues.length > 0) {
    Logger.log('--- [主な検知詳細 (抜粋)] ---');
    issues.slice(0, 15).forEach(issue => {
      Logger.log(`[${issue.status}] (${issue.ruleId}/${issue.category}) ${issue.docName}: ${issue.message}`);
    });
  }
  Logger.log('=========================================');

  return {
    timestamp: new Date().toISOString(),
    overallStatus,
    scannedDocs: scannedCount,
    totalDocs: WIKI_DOCS.length,
    ruleSummaries,
    issues
  };
}
