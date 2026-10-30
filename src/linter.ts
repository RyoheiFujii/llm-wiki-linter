import { WIKI_DOCS, MasterDoc } from './masters';
import type {
  DeterministicStatus,
  LintRuleId,
  RuleCategory,
  LintIssue,
  RuleSummary,
  LintAuditResult
} from './types';

export type {
  DeterministicStatus,
  LintRuleId,
  RuleCategory,
  LintIssue,
  RuleSummary,
  LintAuditResult
};

export const EXCLUDED_ORPHAN_DOCS = [
  'about-me.md',
  'README.md',
  'log.md',
  'AGENTS.md',
  'custom-instructions-master.md'
];

/**
 * WIKI-006: 単一ドキュメント本文からクロスリファレンスを抽出・検証し、被参照カウントを加算する
 */
export function checkCrossReferencesInText(
  text: string,
  docName: string,
  validDocNames: Set<string>,
  inboundRefCount: Map<string, number>
): LintIssue[] {
  const issues: LintIssue[] = [];
  const crossRefRegex = /\babout-[a-z0-9_-]+\.md\b/g;
  let match: RegExpExecArray | null;

  while ((match = crossRefRegex.exec(text)) !== null) {
    const targetDocName = match[0];
    if (!validDocNames.has(targetDocName)) {
      issues.push({
        ruleId: 'WIKI-006',
        docName: docName,
        category: 'BrokenCrossReference',
        status: 'FAIL',
        message: `未登録のマスター文書へのクロスリファレンス（リンク切れ）を検知: "${targetDocName}"`
      });
    } else {
      if (targetDocName !== docName) {
        inboundRefCount.set(targetDocName, (inboundRefCount.get(targetDocName) || 0) + 1);
      }
    }
  }

  return issues;
}

/**
 * WIKI-006: 全ドキュメント走査後に、被参照カウントが 0 の孤立マスターを検出する
 */
export function detectOrphanDocuments(
  allDocNames: string[],
  inboundRefCount: Map<string, number>,
  excludedDocs: string[] = EXCLUDED_ORPHAN_DOCS
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const docName of allDocNames) {
    if (excludedDocs.includes(docName)) {
      continue;
    }
    const refCount = inboundRefCount.get(docName) || 0;
    if (refCount === 0) {
      issues.push({
        ruleId: 'WIKI-006',
        docName: docName,
        category: 'OrphanDocument',
        status: 'UNKNOWN',
        message: `他のマスター文書からの被参照リンクが存在しない孤立マスター (Inbound Refs: 0)`
      });
    }
  }

  return issues;
}

export function runFullWikiLint(): LintAuditResult {
  Logger.log('=== LLM Wiki Health & Lint Audit 開始 (SEC-08: Judge by Rule) ===');
  const issues: LintIssue[] = [];
  let scannedCount = 0;

  // WIKI-006 準備: 全マスター名集合と被参照カウンター
  const validDocNames = new Set(WIKI_DOCS.map(d => d.name));
  const inboundRefCount = new Map<string, number>(WIKI_DOCS.map(d => [d.name, 0]));

  for (const doc of WIKI_DOCS) {
    try {
      const gDoc = DocumentApp.openById(doc.id);
      const body = gDoc.getBody();
      const text = body.getText();
      scannedCount++;

      // WIKI-005: log.md 肥大化・ネスト表検知ガード (50,000文字上限 / テーブル数5上限)
      if (doc.name === 'log.md' || doc.id === '15m6Rk7ey3rUoFY4zpP9R0NxTKHF8iecI0wd9ea8GKxI') {
        const tableCount = body.getTables().length;
        if (text.length > 50000 || tableCount > 5) {
          issues.push({
            ruleId: 'WIKI-005',
            docName: doc.name,
            category: 'LogSizeGuard',
            status: 'FAIL',
            message: `log.md 肥大化・ネスト表検知 (文字数: ${text.length}/上限50,000, テーブル数: ${tableCount}/上限5)。月次アーカイブ分割を実行してください。`
          });
        }
      }

      // WIKI-001: 破損・不正URLチェック (FAIL判定)
      const linkRegex = /\[([^\]]+)\]\(([^)]*)\)/g;
      let match: RegExpExecArray | null;
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
      let dateMatch: RegExpExecArray | null;
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

      // WIKI-006: クロスリファレンス抽出 & 被参照カウント
      const crossRefIssues = checkCrossReferencesInText(text, doc.name, validDocNames, inboundRefCount);
      issues.push(...crossRefIssues);

    } catch (e: any) {
      Logger.log(`[エラー] ${doc.name} の読み込みに失敗: ${e.message}`);
    }
  }

  // WIKI-006: 全ドキュメント走査完了後、孤立マスター (Orphan Documents) 判定
  const orphanIssues = detectOrphanDocuments(WIKI_DOCS.map(d => d.name), inboundRefCount, EXCLUDED_ORPHAN_DOCS);
  issues.push(...orphanIssues);

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
      status: issues.some(i => i.ruleId === 'WIKI-003' && i.status === 'UNKNOWN') ? 'UNKNOWN' : 'PASS',
      count: issues.filter(i => i.ruleId === 'WIKI-003').length
    },
    {
      ruleId: 'WIKI-004',
      name: 'Open Questions & Backlog TODOs',
      status: issues.some(i => i.ruleId === 'WIKI-004' && i.status === 'UNKNOWN') ? 'UNKNOWN' : 'PASS',
      count: issues.filter(i => i.ruleId === 'WIKI-004').length
    },
    {
      ruleId: 'WIKI-005',
      name: 'log.md Size & Table Bloat Guard (<=50KB / <=5 tables)',
      status: issues.some(i => i.ruleId === 'WIKI-005' && i.status === 'FAIL') ? 'FAIL' : 'PASS',
      count: issues.filter(i => i.ruleId === 'WIKI-005').length
    },
    {
      ruleId: 'WIKI-006',
      name: 'Cross-Reference & Orphan Guard',
      status: issues.some(i => i.ruleId === 'WIKI-006' && i.status === 'FAIL')
        ? 'FAIL'
        : issues.some(i => i.ruleId === 'WIKI-006' && i.status === 'UNKNOWN')
        ? 'UNKNOWN'
        : 'PASS',
      count: issues.filter(i => i.ruleId === 'WIKI-006').length
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
