import { MasterDoc } from './masters';

export type DeterministicStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export type LintRuleId =
  | 'WIKI-001'
  | 'WIKI-002'
  | 'WIKI-003'
  | 'WIKI-004'
  | 'WIKI-005'
  | 'WIKI-006';

export type RuleCategory =
  | 'BrokenLink'
  | 'DateFormat'
  | 'SensitiveData'
  | 'OpenQuestion'
  | 'LogSizeGuard'
  | 'BrokenCrossReference'
  | 'OrphanDocument';

export interface LintIssue {
  ruleId: LintRuleId;
  docName: string;
  category: RuleCategory;
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
