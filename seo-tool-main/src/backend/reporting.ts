import { IssueEntity, ScannedPageEntity, ScanEntity } from './db.js';

export class ReportingService {
  public static generateCsv(
    scan: ScanEntity,
    pages: ScannedPageEntity[],
    issues: IssueEntity[]
  ): string {
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines: string[] = [];

    // Header metadata
    lines.push(`# CROX Audit Report for ${scan.domain}`);
    lines.push(`# Scan ID: ${scan.id}`);
    lines.push(`# Target URL: ${scan.target_url}`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push(`# Health Score: ${scan.health_score}/100`);
    lines.push(`# Pages Crawled: ${scan.pages_crawled}`);
    lines.push('');

    // Issues section
    lines.push('--- ISSUES & AUDIT FINDINGS ---');
    const issueHeaders = [
      'Issue ID',
      'Rule ID',
      'Title',
      'Category',
      'Severity',
      'Status',
      'Affected URL',
      'Pages Affected',
      'Evidence',
      'Recommendation',
      'Suggested Fix'
    ];
    lines.push(issueHeaders.map(escapeCsv).join(','));

    for (const issue of issues) {
      lines.push([
        issue.id,
        issue.rule_id,
        issue.title,
        issue.category,
        issue.severity,
        issue.resolved ? 'Resolved' : 'Open',
        issue.affected_url,
        issue.pages_affected,
        issue.evidence,
        issue.recommendation,
        issue.suggested_fix || ''
      ].map(escapeCsv).join(','));
    }

    lines.push('');
    lines.push('--- CRAWLED PAGES ---');
    const pageHeaders = [
      'Page URL',
      'HTTP Status',
      'Response Time (ms)',
      'Content Type',
      'Title',
      'Meta Description',
      'Canonical URL',
      'H1 Count',
      'Word Count',
      'Is Indexable',
      'Internal Links Count'
    ];
    lines.push(pageHeaders.map(escapeCsv).join(','));

    for (const page of pages) {
      lines.push([
        page.url,
        page.status_code,
        page.response_time_ms,
        page.content_type,
        page.title || '',
        page.meta_description || '',
        page.canonical_url || '',
        page.h1_count,
        page.word_count,
        page.is_indexable ? 'Yes' : 'No',
        page.internal_links_count
      ].map(escapeCsv).join(','));
    }

    return lines.join('\r\n');
  }

  public static compareScans(
    baseScan: ScanEntity,
    baseIssues: IssueEntity[],
    compareScan: ScanEntity,
    compareIssues: IssueEntity[]
  ) {
    const scoreDelta = compareScan.health_score - baseScan.health_score;

    const baseRuleMap = new Map(baseIssues.map(i => [i.rule_id, i]));
    const compareRuleMap = new Map(compareIssues.map(i => [i.rule_id, i]));

    const resolvedIssues: IssueEntity[] = [];
    const persistentIssues: IssueEntity[] = [];
    const newIssues: IssueEntity[] = [];

    // Checked in base: if not in compare, it was resolved!
    for (const [ruleId, baseIssue] of baseRuleMap.entries()) {
      if (!compareRuleMap.has(ruleId)) {
        resolvedIssues.push(baseIssue);
      } else {
        persistentIssues.push(compareRuleMap.get(ruleId)!);
      }
    }

    // Checked in compare: if not in base, it is brand new!
    for (const [ruleId, compareIssue] of compareRuleMap.entries()) {
      if (!baseRuleMap.has(ruleId)) {
        newIssues.push(compareIssue);
      }
    }

    return {
      base_scan: {
        id: baseScan.id,
        created_at: baseScan.created_at,
        health_score: baseScan.health_score,
        pages_crawled: baseScan.pages_crawled,
        issues_count: baseIssues.length
      },
      compare_scan: {
        id: compareScan.id,
        created_at: compareScan.created_at,
        health_score: compareScan.health_score,
        pages_crawled: compareScan.pages_crawled,
        issues_count: compareIssues.length
      },
      delta: {
        health_score: scoreDelta,
        pages_crawled: compareScan.pages_crawled - baseScan.pages_crawled,
        total_issues_change: compareIssues.length - baseIssues.length
      },
      resolved_issues: resolvedIssues,
      new_issues: newIssues,
      persistent_issues: persistentIssues
    };
  }

  public static generatePdf(
    scan: ScanEntity,
    pages: ScannedPageEntity[],
    issues: IssueEntity[]
  ): Buffer {
    const lines = [
      `CROX Audit Report — ${scan.domain}`,
      `Scan: ${scan.id}`,
      `URL: ${scan.target_url}`,
      `Health: ${scan.health_score}/100   Pages: ${scan.pages_crawled}   Generated: ${new Date().toISOString()}`,
      '',
      'Issues',
      ...issues.slice(0, 40).map(issue => `- [${issue.severity}] ${issue.title} (${issue.affected_url})`),
      '',
      'Pages',
      ...pages.slice(0, 40).map(page => `- ${page.status_code || '-'} ${page.url}  title: ${(page.title || '(missing)').slice(0, 80)}`)
    ];
    const escaped = lines.map(line => line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'));
    const content = escaped.map((line, index) => `BT /F1 11 Tf 36 ${780 - index * 14} Td (${line.slice(0, 110)}) Tj ET`).join('\n');
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
      `4 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
    ];
    let offset = 9; // %PDF-1.4\n
    const offsets = [0];
    const bodyParts: string[] = [];
    for (const obj of objects) {
      offsets.push(offset);
      bodyParts.push(obj);
      offset += Buffer.byteLength(obj) + 1;
    }
    const xrefStart = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(`%PDF-1.4\n${bodyParts.join('\n')}\n${xref}${trailer}`);
  }
}
