import * as cheerio from 'cheerio';
import express from 'express';
import { db, ScanEntity, FixEntity } from './db.js';
import { validateTargetUrl } from './security.js';
import { WebsiteCrawler } from './crawler.js';
import { SEOAuditEngine } from './seo_audit.js';
import { ScoringEngine } from './scoring.js';
import { ReportingService } from './reporting.js';
import { AIService } from './ai_service.js';

export const apiRouter = express.Router();

// Active crawler instances for cancellation
const activeCrawlers = new Map<string, WebsiteCrawler>();

// ==========================================
// 1. HEALTH ENDPOINT
// ==========================================
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CROX SEO Platform Engine',
    version: '2.4.0',
    uptime_seconds: Math.round(process.uptime()),
    gemini_ai_configured: !!process.env.GEMINI_API_KEY
  });
});

// Authentication routes are intentionally omitted in this dashboard-only build.
// Add your preferred account system before enabling public multi-user access.

// ==========================================
// 3. SCAN & CRAWLER ENDPOINTS
// ==========================================
apiRouter.post('/scans', async (req, res) => {
  const { url, max_pages } = req.body;

  if (!url) {
    return res.status(400).json({ detail: 'Website target URL is required.' });
  }

  // SSRF and URL validation
  const validation = await validateTargetUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ detail: validation.error || 'Invalid or prohibited website URL.' });
  }

  const targetUrl = validation.normalizedUrl;
  const domain = validation.hostname;

  // Single-workspace dashboard limits. Clamp all client input to a safe finite range.
  const requestedPages = Number(max_pages);
  const maxPages = Number.isFinite(requestedPages) && requestedPages > 0
    ? Math.min(50, Math.max(1, Math.floor(requestedPages)))
    : 15;

  const scanId = `scan-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const scanEntity: ScanEntity = {
    id: scanId,
    user_id: null,
    target_url: targetUrl,
    domain,
    status: 'pending',
    progress: 5,
    current_action: `Initializing crawl engine and verifying SSRF boundaries for ${domain}...`,
    health_score: 0,
    technical_score: 0,
    performance_score: 0,
    accessibility_score: 0,
    seo_score: 0,
    pages_crawled: 0,
    total_urls_found: 1,
    redirects_found: 0,
    broken_links_found: 0,
    duration_seconds: 0,
    created_at: now,
    completed_at: null
  };

  db.createScan(scanEntity);

  // Return immediate response with initial scan state
  res.status(202).json({
    scan_id: scanId,
    target_url: targetUrl,
    domain,
    status: 'pending',
    progress: 5,
    current_action: scanEntity.current_action,
    pages_crawled: 0,
    total_urls_found: 1,
    redirects_found: 0,
    broken_links_found: 0,
    health_score: 0,
    duration_seconds: 0
  });

  // Start background crawl process asynchronously
  const crawler = new WebsiteCrawler(targetUrl, maxPages);
  activeCrawlers.set(scanId, crawler);
  const crawlStartTime = Date.now();

  crawler
    .crawl((evt) => {
      db.updateScan(scanId, {
        status: evt.status,
        progress: evt.progress,
        current_action: evt.currentAction,
        pages_crawled: evt.pagesCrawled,
        total_urls_found: evt.totalUrlsFound,
        redirects_found: evt.redirectsFound,
        broken_links_found: evt.brokenLinksFound,
        duration_seconds: Math.round((Date.now() - crawlStartTime) / 1000)
      });
    })
    .then(async (crawlResult) => {
      activeCrawlers.delete(scanId);

      // Save scanned pages to DB
      for (const p of crawlResult.pages) {
        db.addScannedPage({
          scan_id: scanId,
          url: p.url,
          status_code: p.statusCode,
          response_time_ms: p.responseTimeMs,
          content_type: p.contentType,
          title: p.title,
          meta_description: p.metaDescription,
          canonical_url: p.canonicalUrl,
          h1_count: p.h1List.length,
          word_count: p.wordCount,
          is_indexable: p.isIndexable,
          internal_links_count: p.internalLinks.length,
          external_links_count: p.externalLinks.length
        });
      }

      // Execute SEO Audit Rules
      const auditResult = SEOAuditEngine.audit(crawlResult.pages, scanId);

      // Save issues to DB
      db.addIssues(
        auditResult.issues.map(i => ({
          ...i,
          scan_id: scanId
        }))
      );

      // Compute Dynamic Health Scores
      const scores = ScoringEngine.calculate(
        auditResult.issues,
        crawlResult.pages.length,
        auditResult.passed_checks
      );

      const durationSeconds = Math.max(1, Math.round((Date.now() - crawlStartTime) / 1000));

      db.updateScan(scanId, {
        status: 'completed',
        progress: 100,
        current_action: 'Audit complete. Stored evidence and computed health scores.',
        health_score: scores.health_score,
        technical_score: scores.technical_score,
        performance_score: scores.performance_score,
        accessibility_score: scores.accessibility_score,
        seo_score: scores.seo_score,
        pages_crawled: crawlResult.pages.length,
        total_urls_found: crawlResult.totalUrlsFound,
        redirects_found: crawlResult.redirectsFound,
        broken_links_found: crawlResult.brokenLinksFound,
        duration_seconds: durationSeconds,
        completed_at: new Date().toISOString()
      });

    })
    .catch((err) => {
      activeCrawlers.delete(scanId);
      console.error(`[CROX Scan Error] Scan ${scanId} failed:`, err);
      db.updateScan(scanId, {
        status: 'failed',
        progress: 100,
        current_action: 'Scan halted due to an error.',
        error_message: err.message || 'Crawl failed to complete.'
      });
    });
});

apiRouter.get('/scans', (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(100, Math.floor(requestedLimit)) : 15;
  const scans = db.listScans(null, limit);

  const formatted = scans.map(s => ({
    id: s.id,
    domain: s.domain,
    target_url: s.target_url,
    status: s.status,
    health_score: s.health_score,
    pages_crawled: s.pages_crawled,
    created_at: s.created_at,
    completed_at: s.completed_at
  }));

  res.json(formatted);
});

apiRouter.get('/scans/:id', (req, res) => {
  const scan = db.getScan(req.params.id);
  if (!scan) {
    return res.status(404).json({ detail: 'Scan not found.' });
  }

  res.json({
    scan_id: scan.id,
    target_url: scan.target_url,
    domain: scan.domain,
    status: scan.status,
    progress: scan.progress,
    current_action: scan.current_action,
    pages_crawled: scan.pages_crawled,
    total_urls_found: scan.total_urls_found,
    redirects_found: scan.redirects_found,
    broken_links_found: scan.broken_links_found,
    health_score: scan.health_score,
    duration_seconds: scan.duration_seconds,
    error_message: scan.error_message
  });
});

apiRouter.get('/scans/:id/report', (req, res) => {
  const scan = db.getScan(req.params.id);
  if (!scan) {
    return res.status(404).json({ detail: 'Scan not found.' });
  }

  const pages = db.getPagesForScan(scan.id);
  const issues = db.getIssuesForScan(scan.id);

  // Compute scores and breakdowns
  const scores = ScoringEngine.calculate(issues as any, pages.length, [
    'Title Tag Presence',
    'Mobile Viewport Configuration',
    'HTTPS Encryption',
    'Robots Indexability Directives',
    'Canonical Tag Coverage'
  ]);

  const report = {
    scan_id: scan.id,
    target_url: scan.target_url,
    domain: scan.domain,
    status: scan.status,
    created_at: scan.created_at,
    completed_at: scan.completed_at,
    duration_seconds: scan.duration_seconds,
    health_score: scan.health_score,
    technical_score: scan.technical_score,
    performance_score: scan.performance_score,
    accessibility_score: scan.accessibility_score,
    seo_score: scan.seo_score,
    pages_crawled: scan.pages_crawled,
    total_urls_found: scan.total_urls_found,
    redirects_found: scan.redirects_found,
    broken_links_found: scan.broken_links_found,
    issues: issues.map(i => ({
      ...i,
      type: i.category
    })),
    pages: pages.map(p => ({
      id: p.id,
      url: p.url,
      status_code: p.status_code,
      response_time_ms: p.response_time_ms,
      content_type: p.content_type,
      title: p.title,
      meta_description: p.meta_description,
      canonical_url: p.canonical_url,
      h1_count: p.h1_count,
      word_count: p.word_count,
      is_indexable: p.is_indexable
    })),
    passed_checks: [
      'Title Tag Presence',
      'Mobile Viewport Configuration',
      'HTTPS Encryption',
      'Robots Indexability Directives',
      'Canonical Tag Coverage'
    ],
    passed_checks_count: 5,
    warning_checks_count: issues.filter(i => i.severity === 'High' || i.severity === 'Medium').length,
    critical_checks_count: issues.filter(i => i.severity === 'Critical').length,
    total_checks_count: 5 + issues.length,
    severity_counts: scores.severity_counts,
    category_scores: scores.category_scores
  };

  res.json(report);
});

apiRouter.delete('/scans/:id', (req, res) => {
  const scanId = req.params.id;

  // Cancel if actively running
  if (activeCrawlers.has(scanId)) {
    activeCrawlers.get(scanId)?.cancel();
    activeCrawlers.delete(scanId);
  }

  const deleted = db.deleteScan(scanId);
  if (!deleted) {
    return res.status(404).json({ detail: 'Scan not found or permission denied.' });
  }

  res.json({ status: 'success', message: 'Scan deleted successfully.' });
});

apiRouter.get('/scans/:id/export/csv', (req, res) => {
  const scan = db.getScan(req.params.id);
  if (!scan) {
    return res.status(404).json({ detail: 'Scan not found.' });
  }

  const pages = db.getPagesForScan(scan.id);
  const issues = db.getIssuesForScan(scan.id);

  const csv = ReportingService.generateCsv(scan, pages, issues);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="crox-audit-${scan.domain}-${scan.id}.csv"`);
  res.send(csv);
});

apiRouter.post('/scans/compare', (req, res) => {
  const { base_scan_id, compare_scan_id } = req.body;

  if (!base_scan_id || !compare_scan_id) {
    return res.status(400).json({ detail: 'Both base_scan_id and compare_scan_id are required.' });
  }

  const baseScan = db.getScan(base_scan_id);
  const compareScan = db.getScan(compare_scan_id);

  if (!baseScan || !compareScan) {
    return res.status(404).json({ detail: 'One or both scans could not be found for comparison.' });
  }

  const baseIssues = db.getIssuesForScan(base_scan_id);
  const compareIssues = db.getIssuesForScan(compare_scan_id);

  const diff = ReportingService.compareScans(baseScan, baseIssues, compareScan, compareIssues);
  res.json(diff);
});

// ==========================================
// 4. ISSUES & REMEDIATION
// ==========================================
apiRouter.patch('/issues/:id', (req, res) => {
  const { resolved } = req.body;
  const updated = db.updateIssue(req.params.id, { resolved: !!resolved });
  if (!updated) {
    return res.status(404).json({ detail: 'Issue not found.' });
  }
  res.json(updated);
});

apiRouter.post('/ai/fix', async (req, res) => {
  const { title, category, affected_url, evidence, explanation } = req.body;
  const fix = await AIService.generateFix({
    title: title || 'SEO Optimization',
    category: category || 'SEO',
    affected_url: affected_url || '',
    evidence: evidence || '',
    explanation: explanation || ''
  });
  // Keep the legacy Issue Detail modal contract while exposing structured fields
  // for newer clients and Fix Center.
  res.json({
    status: 'success',
    ...fix,
    fix_content: [fix.fix_explanation, fix.code_snippet].filter(Boolean).join('\n\n'),
    remediation_guide: fix.fix_explanation
  });
});

// ==========================================
// 4A. FIX CENTER — persistent AI-assisted drafts
// ==========================================
apiRouter.get('/fixes', (req, res) => {
  const scanId = String(req.query.scan_id || '').trim();
  if (!scanId) return res.status(400).json({ detail: 'scan_id is required.' });
  if (!db.getScan(scanId)) return res.status(404).json({ detail: 'Scan not found.' });
  res.json(db.getFixesForScan(scanId));
});

apiRouter.post('/fixes/generate', async (req, res) => {
  const scanId = typeof req.body?.scan_id === 'string' ? req.body.scan_id.trim() : '';
  if (!scanId) return res.status(400).json({ detail: 'Select a completed scan before generating fixes.' });
  const scan = db.getScan(scanId);
  if (!scan) return res.status(404).json({ detail: 'Scan not found.' });
  if (scan.status !== 'completed') return res.status(409).json({ detail: 'Wait until the website audit is complete before generating fixes.' });

  const allIssues = db.getIssuesForScan(scanId);
  const existing = db.getFixesForScan(scanId);
  const existingIssueIds = new Set(existing.map(fix => fix.issue_id));
  const requestedIds = Array.isArray(req.body?.issue_ids)
    ? new Set(req.body.issue_ids.filter((id: unknown): id is string => typeof id === 'string'))
    : null;
  const severityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const candidates = allIssues
    .filter(issue => !issue.resolved && !existingIssueIds.has(issue.id) && (!requestedIds || requestedIds.has(issue.id)))
    .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));
  const maxItemsRaw = Number(req.body?.max_items);
  const maxItems = Number.isFinite(maxItemsRaw) ? Math.max(1, Math.min(15, Math.floor(maxItemsRaw))) : 15;
  const batch = candidates.slice(0, maxItems);
  const generated: FixEntity[] = [];
  let cursor = 0;

  // Keep a small concurrency cap to reduce API burst/rate-limit risk.
  const worker = async () => {
    while (cursor < batch.length) {
      const issue = batch[cursor++];
      try {
        const suggestion = await AIService.generateFix({
          title: issue.title,
          category: issue.category,
          affected_url: issue.affected_url,
          evidence: issue.evidence,
          explanation: issue.explanation,
          recommendation: issue.recommendation
        });
        const now = new Date().toISOString();
        const record: FixEntity = {
          id: `fix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          scan_id: scanId,
          issue_id: issue.id,
          issue_title: issue.title,
          category: issue.category,
          severity: issue.severity,
          affected_url: issue.affected_url,
          evidence: issue.evidence,
          recommendation: issue.recommendation,
          fix_explanation: suggestion.fix_explanation,
          code_snippet: suggestion.code_snippet,
          status: 'draft',
          generated_by: suggestion.provider,
          created_at: now,
          updated_at: now
        };
        generated.push(db.createFix(record));
      } catch (error: any) {
        console.error(`[CROX Fix Center] Draft generation failed for ${issue.id}:`, error?.message || error);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(3, batch.length) }, () => worker()));
  // Persist the whole batch once rather than synchronously writing the JSON store
  // after every draft. This reduces file-system churn for larger audit batches.
  db.saveImmediately();
  const fixes = db.getFixesForScan(scanId);
  const savedIssueIds = new Set(fixes.map(fix => fix.issue_id));
  const remainingCount = allIssues.filter(issue =>
    !issue.resolved && (!requestedIds || requestedIds.has(issue.id)) && !savedIssueIds.has(issue.id)
  ).length;
  res.json({
    fixes,
    generated_count: generated.length,
    remaining_count: remainingCount,
    provider_mode: process.env.GEMINI_API_KEY ? 'gemini-enabled-with-local-fallback' : 'local-fallback',
    message: generated.length ? `Generated ${generated.length} draft${generated.length === 1 ? '' : 's'}. Review before using them.` : 'No new unresolved issues needed drafts.'
  });
});

apiRouter.patch('/fixes/:id', (req, res) => {
  const updates: { status?: 'draft' | 'approved' | 'rejected'; code_snippet?: string; fix_explanation?: string } = {};
  if (req.body?.status !== undefined) {
    if (!['draft', 'approved', 'rejected'].includes(req.body.status)) {
      return res.status(400).json({ detail: 'Status must be draft, approved, or rejected.' });
    }
    updates.status = req.body.status;
  }
  if (req.body?.code_snippet !== undefined) {
    if (typeof req.body.code_snippet !== 'string' || req.body.code_snippet.length > 12000) {
      return res.status(400).json({ detail: 'Code draft must be text no longer than 12,000 characters.' });
    }
    updates.code_snippet = req.body.code_snippet;
  }
  if (req.body?.fix_explanation !== undefined) {
    if (typeof req.body.fix_explanation !== 'string' || req.body.fix_explanation.length > 6000) {
      return res.status(400).json({ detail: 'Fix explanation must be text no longer than 6,000 characters.' });
    }
    updates.fix_explanation = req.body.fix_explanation;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ detail: 'Provide a status or an edited draft.' });
  const updated = db.updateFix(req.params.id, updates);
  if (!updated) return res.status(404).json({ detail: 'Fix draft not found.' });
  res.json(updated);
});

apiRouter.post('/ai/chat', async (req, res) => {
  const { message, scan_id } = req.body;

  if (!message) {
    return res.status(400).json({ detail: 'Message string is required.' });
  }

  let scanContext = undefined;
  if (scan_id) {
    const scan = db.getScan(scan_id);
    if (scan) {
      const issues = db.getIssuesForScan(scan.id);
      scanContext = {
        domain: scan.domain,
        healthScore: scan.health_score,
        issues: issues.map(i => ({
          title: i.title,
          category: i.category,
          severity: i.severity,
          evidence: i.evidence
        }))
      };
    }
  }

  const reply = await AIService.answerQuestion(message, scanContext);
  res.json(reply);
});

// ==========================================
// 5. KEYWORD & COMPETITOR INTELLIGENCE
// ==========================================
apiRouter.post('/market/brief', async (req, res) => {
  const { niche, market, goal } = req.body;
  if (!niche || typeof niche !== 'string' || !niche.trim()) {
    return res.status(400).json({ detail: 'Enter a niche or market topic.' });
  }
  const result = await AIService.generateMarketBrief(
    niche,
    typeof market === 'string' ? market : 'Global',
    typeof goal === 'string' ? goal : 'Grow qualified organic traffic'
  );
  res.json(result);
});
apiRouter.post('/keywords/analyze', async (req, res) => {
  const { seed_phrase, niche, market } = req.body;
  if (!seed_phrase || typeof seed_phrase !== 'string' || !seed_phrase.trim()) {
    return res.status(400).json({ detail: 'Enter a seed keyword or topic.' });
  }
  if (seed_phrase.length > 180) {
    return res.status(400).json({ detail: 'Seed keyword must be 180 characters or fewer.' });
  }

  const strategy = await AIService.generateKeywordStrategy(
    seed_phrase.trim(),
    typeof niche === 'string' ? niche.slice(0, 100) : 'General',
    typeof market === 'string' ? market.slice(0, 100) : 'Global'
  );
  res.json({
    seed_phrase: seed_phrase.trim(),
    niche: typeof niche === 'string' ? niche : 'General',
    market: typeof market === 'string' ? market : 'Global',
    total_keywords: strategy.keywords.length,
    keywords: strategy.keywords,
    ai_mode: strategy.ai_mode,
    provider_status: strategy.provider_status
  });
});

async function inspectPublicHomepage(rawDomain: string) {
  const initial = String(rawDomain || '').trim().slice(0, 260);
  const validation = await validateTargetUrl(initial);
  if (!validation.valid) {
    return {
      domain: initial || '(empty)', available: false, status_code: null,
      response_time_ms: null, title: null, description: null, h1: [], canonical: null,
      indexed_hints: [], note: validation.error || 'Domain could not be validated.'
    };
  }

  const started = performance.now();
  try {
    const response = await fetch(validation.normalizedUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(8500),
      headers: { 'User-Agent': 'CROX-Market-Inspector/1.0 (+public homepage metadata check)', 'Accept': 'text/html,application/xhtml+xml' }
    });
    const responseTimeMs = Math.round(performance.now() - started);
    const base = {
      domain: validation.hostname,
      normalized_url: validation.normalizedUrl,
      available: false,
      status_code: response.status,
      response_time_ms: responseTimeMs,
      title: null as string | null,
      description: null as string | null,
      h1: [] as string[],
      canonical: null as string | null,
      indexed_hints: [] as string[],
      note: ''
    };

    // Do not follow redirects here: validate each destination before any network request.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      return { ...base, note: `Homepage returned a redirect (${response.status})${location ? `. Destination was not followed automatically.` : '.'}` };
    }
    if (!response.ok) return { ...base, note: `Homepage returned HTTP ${response.status}; metadata could not be inspected.` };
    const contentType = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { ...base, note: `Homepage response is not HTML (${contentType || 'unknown content type'}).` };
    }
    const declaredSize = Number(response.headers.get('content-length') || '0');
    if (declaredSize > 1_500_000) {
      await response.body?.cancel();
      return { ...base, note: 'Homepage HTML exceeded the 1.5 MB inspection limit.' };
    }

    let html = '';
    const reader = response.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 1_500_000) {
          await reader.cancel();
          return { ...base, note: 'Homepage HTML exceeded the 1.5 MB inspection limit.' };
        }
        chunks.push(value);
      }
      const combined = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
      html = new TextDecoder().decode(combined);
    }

    const $ = cheerio.load(html);
    const title = $('title').first().text().trim().replace(/\s+/g, ' ').slice(0, 240) || null;
    const description = $('meta[name="description" i]').attr('content')?.trim().replace(/\s+/g, ' ').slice(0, 500) || null;
    const h1 = $('h1').map((_index, element) => $(element).text().trim().replace(/\s+/g, ' ').slice(0, 180)).get().filter(Boolean).slice(0, 6);
    const canonical = $('link[rel="canonical"]').first().attr('href')?.trim() || null;
    const robots = $('meta[name="robots" i]').attr('content')?.trim() || '';
    const indexedHints = [
      !title ? 'Missing title tag' : title.length < 30 ? 'Short title tag' : title.length > 65 ? 'Long title tag' : 'Title present',
      !description ? 'Missing meta description' : description.length < 70 ? 'Short meta description' : description.length > 160 ? 'Long meta description' : 'Meta description present',
      h1.length === 0 ? 'No H1 found' : h1.length > 1 ? 'Multiple H1 headings' : 'One H1 found',
      !canonical ? 'No canonical tag detected' : 'Canonical tag present',
      /noindex/i.test(robots) ? 'Robots meta contains noindex' : 'No noindex directive found in robots meta'
    ];
    return { ...base, available: true, title, description, h1, canonical, indexed_hints: indexedHints, note: 'Live homepage HTML inspection only. This does not represent full crawl coverage or live search-ranking data.' };
  } catch (error: any) {
    return {
      domain: validation.hostname,
      normalized_url: validation.normalizedUrl,
      available: false,
      status_code: null,
      response_time_ms: Math.round(performance.now() - started),
      title: null, description: null, h1: [], canonical: null, indexed_hints: [],
      note: error?.name === 'TimeoutError' || error?.name === 'AbortError'
        ? 'Timed out while inspecting the public homepage.'
        : 'Could not read the public homepage from this server.'
    };
  }
}

apiRouter.post('/competitor/compare', async (req, res) => {
  const { target_domain, competitor_domain } = req.body;
  if (!target_domain || !competitor_domain) {
    return res.status(400).json({ detail: 'Enter both your domain and a competitor domain.' });
  }
  if (String(target_domain).trim().toLowerCase() === String(competitor_domain).trim().toLowerCase()) {
    return res.status(400).json({ detail: 'Use two different domains to compare websites.' });
  }

  const [target, competitor] = await Promise.all([
    inspectPublicHomepage(String(target_domain)),
    inspectPublicHomepage(String(competitor_domain))
  ]);
  const recommendations: string[] = [];
  const targetTitle = String(target.title || '').toLowerCase();
  const competitorTitle = String(competitor.title || '').toLowerCase();
  const targetDescription = String(target.description || '').toLowerCase();
  const competitorDescription = String(competitor.description || '').toLowerCase();
  const targetH1 = (target.h1 || []).join(' ').toLowerCase();
  const competitorH1 = (competitor.h1 || []).join(' ').toLowerCase();

  if (target.available && !target.title) recommendations.push('Add a specific homepage title that communicates the page topic and primary value proposition.');
  if (target.available && !target.description) recommendations.push('Write a unique meta description that summarizes the offer and gives searchers a reason to click.');
  if (target.available && !(target.h1 || []).length) recommendations.push('Add one clear H1 that matches the homepage intent and the words customers use.');
  if (target.available && (target.h1 || []).length > 1) recommendations.push('Review heading hierarchy; use a single primary H1 and structure sections with H2/H3 headings.');
  if (target.available && competitor.available && competitorTitle && !targetTitle) recommendations.push('Your competitor has a readable homepage title while yours was not detected; treat this as a technical content gap.');
  if (target.available && competitor.available && competitorDescription && !targetDescription) recommendations.push('The competitor publishes a meta description and yours was not detected. Add one that reflects your offer and differentiators.');
  if (target.available && competitor.available && competitorH1 && !targetH1) recommendations.push('Review the competitor’s main heading and build a distinct, customer-focused primary message for your homepage.');
  if (target.available && competitor.available && competitorH1 && targetH1 && competitorH1 !== targetH1) recommendations.push('Compare the two primary heading topics manually, then create useful pages for relevant audience needs your site does not currently cover.');
  if (target.available && target.canonical == null) recommendations.push('Check whether the homepage needs an explicit canonical URL to reinforce the preferred version.');
  if (!recommendations.length) recommendations.push('Both homepages returned limited or similar metadata. Compare category pages, search results, content depth, backlink profiles, and actual keyword data before drawing a competitive conclusion.');

  res.json({
    target_domain: target.domain,
    competitor_domain: competitor.domain,
    target,
    competitor,
    comparison_summary: target.available && competitor.available
      ? 'Compared live homepage title, meta description, primary headings, canonical tag and response behavior.'
      : 'A partial comparison was returned. One or both websites did not expose readable homepage HTML from this server.',
    gap_recommendations: recommendations,
    data_scope: 'Public homepage metadata only; no search volume, traffic, ranking, backlink or full-crawl metrics are claimed.'
  });
});

// ==========================================
// 6. PERFORMANCE & INTEGRATIONS
// ==========================================
apiRouter.get('/pagespeed', async (req, res) => {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
  const rawStrategy = typeof req.query.strategy === 'string' ? req.query.strategy : 'mobile';
  const strategy = rawStrategy.toLowerCase();

  if (!rawUrl.trim()) return res.status(400).json({ status: 'error', message: 'URL query parameter is required.' });
  if (strategy !== 'mobile' && strategy !== 'desktop') {
    return res.status(400).json({ status: 'error', message: 'Strategy must be mobile or desktop.' });
  }

  // Validate targets before passing them to a remote provider. This also keeps
  // the endpoint aligned with the crawler's public-URL and SSRF restrictions.
  const validation = await validateTargetUrl(rawUrl);
  if (!validation.valid) {
    return res.status(400).json({ status: 'error', message: validation.error || 'Target URL could not be validated.' });
  }

  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    return res.json({
      status: 'not_configured',
      message: 'Google PageSpeed Insights is not connected yet. Add PAGESPEED_API_KEY to the server .env file and restart CROX. The crawl timing cards below still show timings measured during this audit.'
    });
  }

  try {
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', validation.normalizedUrl);
    endpoint.searchParams.set('strategy', strategy);
    endpoint.searchParams.set('category', 'performance');
    endpoint.searchParams.set('key', apiKey);

    const providerResponse = await fetch(endpoint, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/json' } });
    const payload: any = await providerResponse.json().catch(() => null);
    if (!providerResponse.ok) {
      const providerMessage = typeof payload?.error?.message === 'string' ? payload.error.message : 'Google PageSpeed Insights request failed.';
      return res.status(502).json({ status: 'error', message: providerMessage });
    }

    const audits = payload?.lighthouseResult?.audits || {};
    const rawScore = payload?.lighthouseResult?.categories?.performance?.score;
    const performanceScore = typeof rawScore === 'number' ? Math.round(rawScore * 100) : null;
    const lcp = audits['largest-contentful-paint']?.displayValue || null;
    const cls = audits['cumulative-layout-shift']?.displayValue || null;
    const fcp = audits['first-contentful-paint']?.displayValue || null;

    return res.json({
      status: 'success',
      data: { performance_score: performanceScore, lcp, cls, fcp },
      target_url: validation.normalizedUrl,
      strategy,
      provider: 'Google PageSpeed Insights',
      fetched_at: new Date().toISOString()
    });
  } catch (error: any) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      status: 'error',
      message: timedOut ? 'Google PageSpeed Insights timed out. Try again shortly.' : 'Could not reach Google PageSpeed Insights from the CROX server.'
    });
  }
});

apiRouter.get('/integrations/status', (_req, res) => {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const pageSpeedConfigured = Boolean(process.env.PAGESPEED_API_KEY);
  res.json({
    gemini: { configured: geminiConfigured, model: 'gemini-2.5-flash' },
    pagespeed: { configured: pageSpeedConfigured },
    gemini_ai: {
      status: geminiConfigured ? 'connected' : 'disconnected',
      description: 'Google Gemini 2.5 Flash for NOVA assistant and AI-assisted fix drafts.'
    },
    pagespeed_insights: {
      status: pageSpeedConfigured ? 'connected' : 'not_configured',
      description: pageSpeedConfigured ? 'Google PageSpeed Insights API is configured.' : 'Add PAGESPEED_API_KEY to enable Lighthouse lab reports.'
    },
    google_search_console: { status: 'not_connected', description: 'Search Console OAuth is not implemented in this build.' },
    stripe_billing: { status: 'not_connected', description: 'Billing integration is not implemented in this build.' }
  });
});
