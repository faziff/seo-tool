import assert from 'node:assert';
import { validateTargetUrl, isPrivateOrReservedIPv4 } from './security.js';
import { db, initDb } from './db.js';
import { SEOAuditEngine } from './seo_audit.js';
import { ScoringEngine } from './scoring.js';
import { ReportingService } from './reporting.js';
import { KeywordIntelligenceService } from './keywords.js';
import { AIService } from './ai_service.js';
import { generateAIText, getAIProviderSettings, getAIProviderStatus, getAIProviderUsage } from './ai_provider.js';
import { secretFingerprint, withRequestCache } from './request_cache.js';
import { encryptProviderKey, decryptProviderKey } from './ai_key_vault.js';
import { auditContentPage } from './content.js';

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
  process.env.DB_PATH = process.env.DB_PATH || `${process.cwd()}/.data/crox-test.sqlite`;
  await initDb();
  console.log('\n=== RUNNING CROX BACKEND TEST SUITE ===\n');

  await test('Project and AI conversation storage is account-scoped and persistent', () => {
    const ownerId = 900_000 + Math.floor(Math.random() * 90_000);
    const projectId = `test-project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const created = db.createProject({
      id: projectId,
      user_id: ownerId,
      name: 'Example workspace',
      domain: 'example.org',
      target_url: 'https://example.org',
      country: 'PK',
      created_at: now,
      updated_at: now
    });
    assert.strictEqual(created.domain, 'example.org');
    assert.strictEqual(db.listProjects(ownerId).some(project => project.id === projectId), true);
    assert.strictEqual(db.getProject(projectId, ownerId + 1), undefined);

    const conversationId = `test-conversation-${Date.now()}`;
    db.createAIConversation({ id: conversationId, user_id: ownerId, project_id: projectId, title: 'Test CROX AI thread', created_at: now, updated_at: now });
    db.addAIMessage(conversationId, 'user', 'Help prioritize technical SEO fixes.');
    db.addAIMessage(conversationId, 'assistant', 'Review indexability, then metadata.', 'demo');
    assert.strictEqual(db.listAIConversations(ownerId, projectId).length, 1);
    assert.strictEqual(db.listAIMessages(conversationId).length, 2);
    assert.strictEqual(db.deleteProject(projectId, ownerId), true);
    assert.strictEqual(db.getProject(projectId, ownerId), undefined);
    assert.strictEqual(db.listAIMessages(conversationId).length, 0);
  });

  await test('Content briefs persist with account scoping and structured JSON fields', () => {
    const ownerId = 880_000 + Math.floor(Math.random() * 90_000);
    const briefId = `content-brief-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    const saved = db.addContentBrief({
      id: briefId,
      user_id: ownerId,
      project_id: null,
      keyword: 'technical SEO audit',
      country: 'US',
      title: 'Technical SEO Audit: A Practical Guide',
      outline: [
        { level: 'H2', heading: 'What is a technical SEO audit?' },
        { level: 'H3', heading: 'Core checks' }
      ],
      target_word_count: 1200,
      questions: ['What should an audit cover?'],
      related_terms: ['technical SEO checklist'],
      intent: 'Informational',
      ai_mode: 'heuristic',
      status: 'draft',
      created_at: createdAt
    });
    assert.strictEqual(saved.outline.length, 2);
    assert.strictEqual(saved.status, 'draft');
    assert.strictEqual(db.listContentBriefs(ownerId).some(item => item.id === briefId), true);
    assert.strictEqual(db.listContentBriefs(ownerId + 1).some(item => item.id === briefId), false);
  });

  await test('Content audit calculates local signals and does not fabricate competitor benchmarks', () => {
    const sampleWords = ('The practical guide explains how the service works and why customers should compare the available options. ').repeat(35);
    const page = {
      url: 'https://example.com/technical-seo',
      statusCode: 200,
      responseTimeMs: 250,
      contentType: 'text/html',
      title: 'Technical SEO Audit Guide',
      metaDescription: 'A useful guide to technical SEO audits.',
      canonicalUrl: 'https://example.com/technical-seo',
      robotsMeta: null,
      charset: 'utf-8',
      lang: 'en',
      viewportMeta: 'width=device-width, initial-scale=1',
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      twitterCard: null,
      h1List: ['Technical SEO Audit'],
      h2Count: 3,
      h3Count: 1,
      h2List: ['What is a technical SEO audit?', 'Important checks', 'Next steps'],
      h3List: ['Crawlability'],
      wordCount: 420,
      contentText: sampleWords,
      isIndexable: true,
      images: [],
      internalLinks: [],
      externalLinks: [],
      jsonLdList: [],
      hasMixedContent: false,
      schemaTypes: [],
      faqSchemaCount: 0,
      author: null,
      datePublished: null,
      dateModified: null,
      siteName: null,
      publisherName: null,
      questionHeadings: 0,
      answerBlocks: 0,
      shortAnswerBlocks: 0,
      definitionBlocks: 0,
      listCount: 0,
      tableCount: 0,
      externalCitations: 0,
      rawHtmlLength: 1000
    } as any;
    const result = auditContentPage(page, 'technical SEO audit', []);
    assert.strictEqual(typeof result.overall_score, 'number');
    assert.strictEqual(result.word_count.competitor_average, null);
    assert.strictEqual(result.keyword_presence.in_title, true);
    assert.strictEqual(result.keyword_presence.in_h1, true);
    assert.strictEqual(result.readability.status, 'scored');
    const noKeyword = auditContentPage(page, null, []);
    assert.strictEqual(noKeyword.keyword_presence.score, null);
  });

  await test('External request cache coalesces identical calls and fingerprints credentials', async () => {
    const descriptor = { request: `test-${Date.now()}`, token: secretFingerprint('example-secret') };
    let calls = 0;
    const loader = async () => {
      calls += 1;
      await new Promise(resolve => setTimeout(resolve, 5));
      return { value: 'cached-result' };
    };
    const [first, second] = await Promise.all([
      withRequestCache('backend-test', descriptor, loader, { ttlSeconds: 30 }),
      withRequestCache('backend-test', descriptor, loader, { ttlSeconds: 30 })
    ]);
    const third = await withRequestCache('backend-test', descriptor, loader, { ttlSeconds: 30 });
    assert.deepStrictEqual(first, { value: 'cached-result' });
    assert.deepStrictEqual(second, { value: 'cached-result' });
    assert.deepStrictEqual(third, { value: 'cached-result' });
    assert.strictEqual(calls, 1);
    assert.strictEqual(secretFingerprint('example-secret').includes('example-secret'), false);
  });

  await test('AI provider status supports safe demo mode without credentials', () => {
    const keys = ['AI_PROVIDER', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'HERMES_API_KEY', 'OPENROUTER_API_KEY', 'GROQ_API_KEY'] as const;
    const original = new Map(keys.map(key => [key, process.env[key]]));
    try {
      for (const key of keys) delete process.env[key];
      const status = getAIProviderStatus();
      assert.strictEqual(status.provider, 'demo');
      assert.strictEqual(status.configured, false);
      assert.strictEqual(status.mode, 'demo');
      assert.strictEqual(status.note.toLowerCase().includes('api_key'), false);
    } finally {
      for (const key of keys) {
        const value = original.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  await test('CROX AI provider API keys are encrypted at rest and scoped per account', () => {
    const priorSecret = process.env.AI_KEYS_ENCRYPTION_SECRET;
    process.env.AI_KEYS_ENCRYPTION_SECRET = 'crox-backend-test-secret-that-is-at-least-32-chars';
    const userId = 870_000 + Math.floor(Math.random() * 100_000);
    const rawKey = 'test-provider-secret-never-store-plain';
    try {
      const sealed = encryptProviderKey(rawKey);
      assert.strictEqual(JSON.stringify(sealed).includes(rawKey), false);
      assert.strictEqual(decryptProviderKey(sealed), rawKey);
      const tampered = { ...sealed, auth_tag: Buffer.from('tampered-auth-tag').toString('base64') };
      assert.throws(() => decryptProviderKey(tampered), /auth|Unsupported state|unable to authenticate/i);
      db.saveUserAICredential(userId, { provider: 'openai', ...sealed, model: 'gpt-6-luna' });
      const stored = db.getUserAICredential(userId, 'openai');
      assert.ok(stored);
      assert.strictEqual(stored!.encrypted_key.includes(rawKey), false);
      assert.strictEqual(db.getUserAICredential(userId + 1, 'openai'), undefined);
      assert.strictEqual(db.deleteUserAICredential(userId, 'openai'), true);
    } finally {
      if (priorSecret === undefined) delete process.env.AI_KEYS_ENCRYPTION_SECRET;
      else process.env.AI_KEYS_ENCRYPTION_SECRET = priorSecret;
    }
  });

  await test('Server environment key pools are counted without exposing secrets', () => {
    const envNames = ['AI_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_API_KEYS', 'OPENAI_API_KEY_1', 'OPENAI_API_KEY_2'];
    const original = new Map(envNames.map(name => [name, process.env[name]]));
    try {
      for (const name of envNames) delete process.env[name];
      process.env.OPENAI_API_KEYS = 'server-key-alpha,server-key-beta';
      const settings = getAIProviderSettings(888_001);
      const openai = settings.providers.find(item => item.provider === 'openai');
      assert.ok(openai);
      assert.strictEqual(openai!.key_count, 2);
      assert.strictEqual(openai!.source, 'server');
      assert.strictEqual(JSON.stringify(settings).includes('server-key-alpha'), false);
    } finally {
      for (const [name, value] of original) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  await test('CROX AI failover switches provider on quota exhaustion and records safe usage', async () => {
    const envNames = ['AI_PROVIDER', 'OPENAI_API_KEY', 'OPENAI_API_KEYS', 'OPENAI_MODEL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEYS', 'ANTHROPIC_MODEL'];
    const originalEnv = new Map(envNames.map(name => [name, process.env[name]]));
    const originalFetch = globalThis.fetch;
    const userId = 888_100 + Math.floor(Math.random() * 10_000);
    const secretOne = `test-openai-key-${Date.now()}`;
    const secretTwo = `test-anthropic-key-${Date.now()}`;
    let openaiCalls = 0;
    let anthropicCalls = 0;
    try {
      for (const name of envNames) delete process.env[name];
      process.env.AI_PROVIDER = 'openai';
      process.env.OPENAI_API_KEYS = secretOne;
      process.env.ANTHROPIC_API_KEY = secretTwo;
      process.env.ANTHROPIC_MODEL = 'claude-haiku-5-5';
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('api.openai.com')) {
          openaiCalls++;
          return new Response(JSON.stringify({ error: { message: 'You exceeded your current quota', code: 'insufficient_quota' } }), {
            status: 429, headers: { 'content-type': 'application/json' }
          });
        }
        if (url.includes('api.anthropic.com')) {
          anthropicCalls++;
          return new Response(JSON.stringify({ content: [{ type: 'text', text: 'CROX fallback test passed' }] }), {
            status: 200, headers: { 'content-type': 'application/json' }
          });
        }
        throw new Error('Unexpected test URL.');
      }) as typeof fetch;

      const result = await generateAIText(`failover-test-${Date.now()}`, userId);
      assert.strictEqual(result.provider, 'anthropic');
      assert.strictEqual(result.fallback_used, true);
      assert.strictEqual(openaiCalls, 1);
      assert.strictEqual(anthropicCalls, 1);
      const usage = getAIProviderUsage(userId, 1);
      assert.strictEqual(usage.totals.calls, 2);
      assert.strictEqual(usage.totals.failed, 1);
      assert.strictEqual(usage.totals.successful, 1);
      assert.strictEqual(usage.totals.fallback_attempts, 1);
      assert.strictEqual(JSON.stringify(usage).includes(secretOne), false);
      assert.strictEqual(JSON.stringify(usage).includes(secretTwo), false);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [name, value] of originalEnv) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

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

  // Test 2: Scan and Fix Center persistence
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

    const issueId = `test-issue-${Date.now()}`;
    const fixId = `test-fix-${Date.now()}`;
    const createdAt = new Date().toISOString();
    db.createFix({
      id: fixId,
      scan_id: scanId,
      issue_id: issueId,
      issue_title: 'Missing page title',
      category: 'SEO',
      severity: 'High',
      affected_url: 'https://crox.ai/',
      evidence: 'No title element was detected.',
      recommendation: 'Add a unique, descriptive title.',
      fix_explanation: 'Place a page-specific title in the document head.',
      code_snippet: '<title>Page topic | Brand</title>',
      status: 'draft',
      generated_by: 'fallback',
      created_at: createdAt,
      updated_at: createdAt
    });
    assert.strictEqual(db.getFixesForScan(scanId).length, 1);
    const approvedFix = db.updateFix(fixId, { status: 'approved' });
    assert.strictEqual(approvedFix?.status, 'approved');

    // Deleting a scan must also remove its saved Fix Center drafts.
    db.deleteScan(scanId);
    assert.strictEqual(db.getScan(scanId), undefined);
    assert.strictEqual(db.getFixesForScan(scanId).length, 0);
  });

  // Test 3: SEO Audit Engine
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

  // Test 4: Scoring Engine
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

  // Test 5: Reporting and CSV generation
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

  // Test 6: Scan Comparison Diff Engine
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

  // Test 7: Keyword Intent Classification
  await test('Keyword Intelligence classifies intent accurately', () => {
    const commercial = KeywordIntelligenceService.generateKeywords('crm software');
    assert.strictEqual(commercial.length > 5, true);
    const buyKeyword = commercial.find(k => k.keyword.includes('pricing') || k.keyword.includes('buy'));
    assert.notStrictEqual(buyKeyword, undefined);
    assert.strictEqual(buyKeyword?.intent, 'Transactional');
  });

  // Test 8: CROX AI fallback must never fabricate live demand data.
  await test('CROX AI keyword and market research fallback labels estimated data honestly', async () => {
    const providerEnvKeys = ['AI_PROVIDER', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'HERMES_API_KEY', 'OPENROUTER_API_KEY', 'GROQ_API_KEY'] as const;
    const originalProviderEnv = new Map(providerEnvKeys.map(key => [key, process.env[key]]));
    for (const key of providerEnvKeys) delete process.env[key];
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

      const contentBrief = await AIService.generateContentBrief('technical SEO audit', 'US');
      assert.strictEqual(contentBrief.ai_mode, 'heuristic');
      assert.strictEqual(contentBrief.outline.length >= 4, true);
      assert.strictEqual(contentBrief.questions.length >= 3, true);
      assert.strictEqual(contentBrief.note.toLowerCase().includes('not verified search-volume'), true);
    } finally {
      for (const key of providerEnvKeys) {
        const value = originalProviderEnv.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  await test('Fix Center fallback generates a contextual code draft', async () => {
    const providerEnvKeys = ['AI_PROVIDER', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'HERMES_API_KEY', 'OPENROUTER_API_KEY', 'GROQ_API_KEY'] as const;
    const originalProviderEnv = new Map(providerEnvKeys.map(key => [key, process.env[key]]));
    for (const key of providerEnvKeys) delete process.env[key];
    try {
      const fix = await AIService.generateFix({
        title: 'Missing meta description',
        category: 'SEO',
        affected_url: 'https://example.com/product',
        evidence: 'The page has no meta description element.',
        explanation: 'Search engines may choose unrelated page text for the snippet.',
        recommendation: 'Write a unique summary for this product page.'
      });
      assert.strictEqual(fix.provider, 'fallback');
      assert.strictEqual(fix.code_snippet.includes('name=\"description\"'), true);
      assert.strictEqual(fix.fix_explanation.length > 20, true);
    } finally {
      for (const key of providerEnvKeys) {
        const value = originalProviderEnv.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
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
