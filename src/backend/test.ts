import assert from 'node:assert';
import { validateTargetUrl, isPrivateOrReservedIPv4 } from './security.js';
import { db } from './db.js';
import { hashPassword, verifyPassword, generateToken, verifyToken } from './auth.js';
import { SEOAuditEngine } from './seo_audit.js';
import { ScoringEngine } from './scoring.js';
import { ReportingService } from './reporting.js';
import { KeywordIntelligenceService } from './keywords.js';
import { AIService } from './ai_service.js';

let passedTests = 0;
let failedTests = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ ${name}:`, err.message);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('\n=== RUNNING CROX BACKEND TEST SUITE ===\n');

  // Test 1: SSRF Defense
  await test('SSRF blocks loopback 127.0.0.1', async () => {
    assert.strictEqual(isPrivateOrReservedIPv4('127.0.0.1'), true);
    const res = await validateTargetUrl('http://127.0.0.1:8000');
    assert.strictEqual(res.valid, false);
  });

  await test('SSRF blocks AWS/GCP cloud metadata IP 169.254.169.254', async () => {
    assert.strictEqual(isPrivateOrReservedIPv4('169.254.169.254'), true);
    const res = await validateTargetUrl('http://169.254.169.254/latest/meta-data/');
    assert.strictEqual(res.valid, false);
  });

  await test('SSRF blocks localhost domain', async () => {
    const res = await validateTargetUrl('http://localhost:3000');
    assert.strictEqual(res.valid, false);
  });

  await test('SSRF accepts valid public domains', async () => {
    const res = await validateTargetUrl('https://example.org');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.hostname, 'example.org');
  });

  // Test 2: Password hashing & Auth tokens
  await test('Password hashing & verification works with bcrypt', () => {
    const plain = 'CroxSuperSecret2026!';
    const hash = hashPassword(plain);
    assert.notStrictEqual(hash, plain);
    assert.strictEqual(verifyPassword(plain, hash), true);
    assert.strictEqual(verifyPassword('wrongPassword', hash), false);
  });

  await test('JWT Token generation & verification', () => {
    const dummyUser = { id: 999, email: 'unit-test@crox.ai', name: 'Tester', plan: 'pro' as const, scans_used: 0, created_at: '', settings: {}, password_hash: '' };
    const token = generateToken(dummyUser);
    const payload = verifyToken(token);
    assert.notStrictEqual(payload, null);
    assert.strictEqual(payload?.userId, 999);
    assert.strictEqual(payload?.email, 'unit-test@crox.ai');
  });

  // Test 3: Database User isolation & Scan persistence
  await test('Database persists and retrieves scans', () => {
    const scanId = `test-scan-${Date.now()}`;
    db.createScan({
      id: scanId,
      user_id: 1,
      target_url: 'https://crox.ai',
      domain: 'crox.ai',
      status: 'completed',
      progress: 100,
      current_action: 'Complete',
      health_score: 95,
      technical_score: 96,
      performance_score: 92,
      accessibility_score: 90,
      seo_score: 98,
      pages_crawled: 5,
      total_urls_found: 8,
      redirects_found: 0,
      broken_links_found: 0,
      duration_seconds: 3,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    });

    const retrieved = db.getScan(scanId);
    assert.strictEqual(retrieved?.id, scanId);
    assert.strictEqual(retrieved?.domain, 'crox.ai');
    assert.strictEqual(retrieved?.health_score, 95);

    // Clean up
    db.deleteScan(scanId);
    assert.strictEqual(db.getScan(scanId), undefined);
  });

  // Test 4: SEO Audit Engine
  await test('SEO Audit Engine detects missing title and missing H1', () => {
    const dummyPages = [
      {
        url: 'https://example.com/',
        statusCode: 200,
        responseTimeMs: 150,
        contentType: 'text/html',
        title: null, // Missing Title!
        metaDescription: null, // Missing Meta Desc!
        canonicalUrl: 'https://example.com/',
        robotsMeta: null,
        charset: 'UTF-8',
        lang: 'en',
        viewportMeta: 'width=device-width',
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        twitterCard: null,
        h1List: [], // Missing H1!
        h2Count: 1,
        h3Count: 0,
        wordCount: 350,
        isIndexable: true,
        images: [],
        internalLinks: [],
        externalLinks: [],
        jsonLdList: [],
        hasMixedContent: false,
        rawHtmlLength: 2000
      }
    ];

    const audit = SEOAuditEngine.audit(dummyPages, 'test-audit-scan');
    assert.strictEqual(audit.issues.length >= 3, true);

    const titleIssue = audit.issues.find(i => i.rule_id === 'SEO_TITLE_MISSING');
    assert.notStrictEqual(titleIssue, undefined);
    assert.strictEqual(titleIssue?.severity, 'Critical');

    const h1Issue = audit.issues.find(i => i.rule_id === 'SEO_H1_MISSING');
    assert.notStrictEqual(h1Issue, undefined);
    assert.strictEqual(h1Issue?.severity, 'High');
  });

  // Test 5: Scoring Engine
  await test('Scoring Engine calculates accurate deductions', () => {
    const dummyIssues = [
      {
        id: '1',
        rule_id: 'SEO_TITLE_MISSING',
        title: 'Missing Title',
        category: 'SEO' as const,
        severity: 'Critical' as const,
        pages_affected: 1,
        affected_url: 'https://example.com/',
        evidence: 'No title',
        explanation: 'Critical',
        recommendation: 'Add title',
        resolved: false,
        created_at: ''
      }
    ];

    const score = ScoringEngine.calculate(dummyIssues, 1, ['HTTPS Encryption']);
    assert.strictEqual(score.health_score < 100, true);
    assert.strictEqual(score.health_score > 50, true);
    assert.strictEqual(score.severity_counts.Critical, 1);
  });

  // Test 6: Reporting and CSV generation
  await test('CSV generation escapes quotes correctly (RFC-4180)', () => {
    const dummyScan: any = {
      id: 'scan-csv-test',
      domain: 'test.com',
      target_url: 'https://test.com',
      health_score: 88,
      pages_crawled: 1
    };
    const dummyIssues: any[] = [
      {
        id: 'iss-1',
        rule_id: 'TEST_RULE',
        title: 'Title with "Quotes"',
        category: 'SEO',
        severity: 'Medium',
        resolved: false,
        affected_url: 'https://test.com',
        pages_affected: 1,
        evidence: 'Found "evidence"',
        recommendation: 'Fix it',
        suggested_fix: '<title>Safe</title>'
      }
    ];
    const csv = ReportingService.generateCsv(dummyScan, [], dummyIssues);
    assert.strictEqual(csv.includes('""Quotes""'), true);
    assert.strictEqual(csv.includes('--- ISSUES & AUDIT FINDINGS ---'), true);
  });

  // Test 7: Scan Comparison Diff Engine
  await test('Comparison engine tracks resolved and new issues accurately', () => {
    const baseScan: any = { id: 'base-1', health_score: 70, pages_crawled: 5, created_at: '' };
    const compareScan: any = { id: 'compare-1', health_score: 85, pages_crawled: 5, created_at: '' };

    const baseIssues: any[] = [
      { id: '1', rule_id: 'ISSUE_A', title: 'Issue A' },
      { id: '2', rule_id: 'ISSUE_B', title: 'Issue B' }
    ];

    const compareIssues: any[] = [
      { id: '3', rule_id: 'ISSUE_B', title: 'Issue B' }, // Persistent
      { id: '4', rule_id: 'ISSUE_C', title: 'Issue C' }  // Brand new
    ];

    const diff = ReportingService.compareScans(baseScan, baseIssues, compareScan, compareIssues);
    assert.strictEqual(diff.delta.health_score, 15);
    assert.strictEqual(diff.resolved_issues.length, 1);
    assert.strictEqual(diff.resolved_issues[0].rule_id, 'ISSUE_A');
    assert.strictEqual(diff.new_issues.length, 1);
    assert.strictEqual(diff.new_issues[0].rule_id, 'ISSUE_C');
    assert.strictEqual(diff.persistent_issues.length, 1);
  });

  // Test 8: Keyword Intent Classification
  await test('Keyword Intelligence classifies intent accurately', () => {
    const commercial = KeywordIntelligenceService.generateKeywords('crm software');
    assert.strictEqual(commercial.length > 5, true);
    const buyKeyword = commercial.find(k => k.keyword.includes('pricing') || k.keyword.includes('buy'));
    assert.notStrictEqual(buyKeyword, undefined);
    assert.strictEqual(buyKeyword?.intent, 'Transactional');
  });

  // Test 9: NOVA fallback must never fabricate live demand data.
  await test('NOVA keyword and market research fallback labels estimated data honestly', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const strategy = await AIService.generateKeywordStrategy('artisan candles', 'E-commerce & retail', 'Pakistan');
      assert.strictEqual(strategy.ai_mode, 'heuristic');
      assert.strictEqual(strategy.keywords.length > 5, true);
      assert.strictEqual(strategy.keywords.every(item => item.cpc_estimate_available === false), true);
      assert.strictEqual(strategy.keywords.every(item => item.search_volume_provider_status === 'provider_not_configured'), true);
      assert.strictEqual(strategy.keywords.some(item => item.keyword.toLowerCase().includes('pakistan')), true);

      const brief = await AIService.generateMarketBrief('artisan candle shop', 'Pakistan', 'Grow online sales');
      assert.strictEqual(brief.ai_mode, 'heuristic');
      assert.strictEqual(brief.brief.includes('30-day'), true);
      assert.strictEqual(brief.note.toLowerCase().includes('no live market metrics'), true);
    } finally {
      if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = originalKey;
    }
  });

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
  console.log(`========================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
