import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Database as SqlJsDatabase } from 'sql.js';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js') as (opts?: { wasmBinary?: Buffer }) => Promise<{ Database: new (data?: Buffer | Uint8Array | null) => SqlJsDatabase }>;

export interface UserEntity {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  plan: 'free' | 'pro' | 'agency';
  scans_used: number;
  created_at: string;
  settings: Record<string, any>;
  extra_audits: number;
  extra_ai: number;
  extra_keywords: number;
}

export interface WebsiteEntity {
  id: number;
  user_id: number;
  domain: string;
  target_url: string;
  created_at: string;
}

export interface ScanEntity {
  id: string;
  user_id: number | null;
  target_url: string;
  domain: string;
  status: 'pending' | 'validating' | 'crawling' | 'analyzing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  current_action: string;
  health_score: number;
  technical_score: number;
  performance_score: number;
  accessibility_score: number;
  seo_score: number;
  pages_crawled: number;
  total_urls_found: number;
  redirects_found: number;
  broken_links_found: number;
  duration_seconds: number;
  created_at: string;
  completed_at: string | null;
  error_message?: string;
}

export type ChecklistStatus = 'Found' | 'Missing' | 'Problem';

export interface ChecklistItem {
  key: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
  fix: string;
}

export interface PageChecklist {
  items: ChecklistItem[];
}

export interface ScannedPageEntity {
  id: number;
  scan_id: string;
  url: string;
  status_code: number | null;
  response_time_ms: number;
  content_type: string;
  title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  h1_count: number;
  word_count: number;
  is_indexable: boolean;
  internal_links_count: number;
  external_links_count: number;
  extra?: Record<string, any>;
  checklist?: PageChecklist;
}

export interface IssueEntity {
  id: string;
  scan_id: string;
  rule_id: string;
  title: string;
  category: 'SEO' | 'Technical' | 'Performance' | 'Accessibility' | 'Crawlability';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  pages_affected: number;
  affected_url: string;
  evidence: string;
  explanation: string;
  recommendation: string;
  suggested_fix?: string;
  verification?: string;
  resolved: boolean;
  created_at: string;
}

export type FixStatus = 'draft' | 'approved' | 'rejected';

export interface FixEntity {
  id: string;
  scan_id: string;
  issue_id: string;
  issue_title: string;
  category: IssueEntity['category'];
  severity: IssueEntity['severity'];
  affected_url: string;
  evidence: string;
  recommendation: string;
  fix_explanation: string;
  code_snippet: string;
  status: FixStatus;
  generated_by: 'gemini' | 'fallback';
  created_at: string;
  updated_at: string;
}

export interface DailyUsage {
  user_id: number;
  day_key: string;
  audits: number;
  ai_messages: number;
  keyword_searches: number;
}

export interface TrackedKeyword {
  id: number;
  user_id: number;
  keyword: string;
  country: string;
  website: string;
  last_position: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function defaultDbPath(): string {
  return path.resolve(process.cwd(), '..', 'crox-data', 'crox.sqlite');
}

function resolveDbPath(): string {
  const configured = (process.env.DB_PATH || '').trim();
  return configured || defaultDbPath();
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  scans_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  settings TEXT NOT NULL DEFAULT '{}',
  extra_audits INTEGER NOT NULL DEFAULT 0,
  extra_ai INTEGER NOT NULL DEFAULT 0,
  extra_keywords INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS signup_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signup_ip ON signup_attempts(ip, created_at);
CREATE TABLE IF NOT EXISTS daily_usage (
  user_id INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  audits INTEGER NOT NULL DEFAULT 0,
  ai_messages INTEGER NOT NULL DEFAULT 0,
  keyword_searches INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day_key)
);
CREATE TABLE IF NOT EXISTS websites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  domain TEXT NOT NULL,
  target_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  target_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  current_action TEXT,
  health_score REAL NOT NULL DEFAULT 0,
  technical_score REAL NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  accessibility_score REAL NOT NULL DEFAULT 0,
  seo_score REAL NOT NULL DEFAULT 0,
  pages_crawled INTEGER NOT NULL DEFAULT 0,
  total_urls_found INTEGER NOT NULL DEFAULT 0,
  redirects_found INTEGER NOT NULL DEFAULT 0,
  broken_links_found INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  error_message TEXT
);
CREATE TABLE IF NOT EXISTS scanned_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  h1_count INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  is_indexable INTEGER NOT NULL DEFAULT 1,
  internal_links_count INTEGER NOT NULL DEFAULT 0,
  external_links_count INTEGER NOT NULL DEFAULT 0,
  extra_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  pages_affected INTEGER NOT NULL DEFAULT 0,
  affected_url TEXT,
  evidence TEXT,
  explanation TEXT,
  recommendation TEXT,
  suggested_fix TEXT,
  verification TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fixes (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  issue_title TEXT,
  category TEXT,
  severity TEXT,
  affected_url TEXT,
  evidence TEXT,
  recommendation TEXT,
  fix_explanation TEXT,
  code_snippet TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  generated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tracked_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  country TEXT NOT NULL,
  website TEXT,
  last_position TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

function mapUser(row: any): UserEntity {
  let settings: Record<string, any> = {};
  try { settings = JSON.parse(row.settings || '{}'); } catch { settings = {}; }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    plan: row.plan,
    scans_used: row.scans_used,
    created_at: row.created_at,
    settings,
    extra_audits: row.extra_audits || 0,
    extra_ai: row.extra_ai || 0,
    extra_keywords: row.extra_keywords || 0
  };
}

function mapScan(row: any): ScanEntity {
  return {
    id: row.id,
    user_id: row.user_id,
    target_url: row.target_url,
    domain: row.domain,
    status: row.status,
    progress: row.progress,
    current_action: row.current_action || '',
    health_score: row.health_score,
    technical_score: row.technical_score,
    performance_score: row.performance_score,
    accessibility_score: row.accessibility_score,
    seo_score: row.seo_score,
    pages_crawled: row.pages_crawled,
    total_urls_found: row.total_urls_found,
    redirects_found: row.redirects_found,
    broken_links_found: row.broken_links_found,
    duration_seconds: row.duration_seconds,
    created_at: row.created_at,
    completed_at: row.completed_at,
    error_message: row.error_message || undefined
  };
}

function mapPage(row: any): ScannedPageEntity {
  let extra: Record<string, any> = {};
  try { extra = JSON.parse(row.extra_json || '{}'); } catch { extra = {}; }
  return {
    id: row.id,
    scan_id: row.scan_id,
    url: row.url,
    status_code: row.status_code,
    response_time_ms: row.response_time_ms,
    content_type: row.content_type,
    title: row.title,
    meta_description: row.meta_description,
    canonical_url: row.canonical_url,
    h1_count: row.h1_count,
    word_count: row.word_count,
    is_indexable: !!row.is_indexable,
    internal_links_count: row.internal_links_count,
    external_links_count: row.external_links_count,
    extra,
    checklist: extra.checklist
  };
}

function mapIssue(row: any): IssueEntity {
  return {
    id: row.id,
    scan_id: row.scan_id,
    rule_id: row.rule_id,
    title: row.title,
    category: row.category,
    severity: row.severity,
    pages_affected: row.pages_affected,
    affected_url: row.affected_url,
    evidence: row.evidence,
    explanation: row.explanation,
    recommendation: row.recommendation,
    suggested_fix: row.suggested_fix || undefined,
    verification: row.verification || undefined,
    resolved: !!row.resolved,
    created_at: row.created_at
  };
}

function mapFix(row: any): FixEntity {
  return {
    id: row.id,
    scan_id: row.scan_id,
    issue_id: row.issue_id,
    issue_title: row.issue_title,
    category: row.category,
    severity: row.severity,
    affected_url: row.affected_url,
    evidence: row.evidence,
    recommendation: row.recommendation,
    fix_explanation: row.fix_explanation,
    code_snippet: row.code_snippet,
    status: row.status,
    generated_by: row.generated_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

class DatabaseStore {
  private sql: SqlJsDatabase | null = null;
  private dbPath = '';
  private saveTimeout: NodeJS.Timeout | null = null;
  private ready = false;

  public async init() {
    if (this.ready) return;
    this.dbPath = resolveDbPath();
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const wasmBinary = fs.readFileSync(wasmPath);
    const SQL = await initSqlJs({ wasmBinary });

    if (fs.existsSync(this.dbPath)) {
      const file = fs.readFileSync(this.dbPath);
      this.sql = new SQL.Database(file);
    } else {
      this.sql = new SQL.Database();
    }
    this.sql.exec(SCHEMA);
    this.ready = true;
    this.persistSync();
    console.log(`[CROX DB] SQLite ready at ${this.dbPath}`);
  }

  private requireSql(): SqlJsDatabase {
    if (!this.sql) throw new Error('CROX database is not initialized.');
    return this.sql;
  }

  private persistSync() {
    try {
      const sql = this.requireSql();
      const data = sql.export();
      const tmp = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmp, Buffer.from(data));
      fs.renameSync(tmp, this.dbPath);
    } catch (err) {
      console.error('[CROX DB] Failed to persist SQLite file:', err);
    }
  }

  public save() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.persistSync(), 200);
  }

  public saveImmediately() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.persistSync();
  }

  private all(sql: string, params: any[] = []): any[] {
    const stmt = this.requireSql().prepare(sql);
    stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  private get(sql: string, params: any[] = []): any | undefined {
    return this.all(sql, params)[0];
  }

  private run(sql: string, params: any[] = []) {
    this.requireSql().run(sql, params);
  }

  public findUserByEmail(email: string): UserEntity | undefined {
    const row = this.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [email.trim()]);
    return row ? mapUser(row) : undefined;
  }

  public findUserById(id: number): UserEntity | undefined {
    const row = this.get('SELECT * FROM users WHERE id = ?', [id]);
    return row ? mapUser(row) : undefined;
  }

  public listUsers(limit = 100): UserEntity[] {
    return this.all('SELECT * FROM users ORDER BY created_at DESC LIMIT ?', [limit]).map(mapUser);
  }

  public createUser(user: Omit<UserEntity, 'id'>): UserEntity {
    this.run(
      `INSERT INTO users (name, email, password_hash, plan, scans_used, created_at, settings, extra_audits, extra_ai, extra_keywords)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.name, user.email.toLowerCase(), user.password_hash, user.plan, user.scans_used, user.created_at,
        JSON.stringify(user.settings || {}), user.extra_audits || 0, user.extra_ai || 0, user.extra_keywords || 0
      ]
    );
    const created = this.findUserByEmail(user.email);
    this.saveImmediately();
    if (!created) throw new Error('Account could not be stored.');
    return created;
  }

  public updateUser(id: number, updates: Partial<UserEntity>): UserEntity | undefined {
    const current = this.findUserById(id);
    if (!current) return undefined;
    const next = { ...current, ...updates };
    this.run(
      `UPDATE users SET name=?, email=?, password_hash=?, plan=?, scans_used=?, settings=?, extra_audits=?, extra_ai=?, extra_keywords=? WHERE id=?`,
      [
        next.name, next.email, next.password_hash, next.plan, next.scans_used,
        JSON.stringify(next.settings || {}), next.extra_audits, next.extra_ai, next.extra_keywords, id
      ]
    );
    this.saveImmediately();
    return this.findUserById(id);
  }

  public countSignupAttempts(ip: string, sinceMs: number): number {
    const row = this.get('SELECT COUNT(*) as c FROM signup_attempts WHERE ip = ? AND created_at >= ?', [ip, sinceMs]);
    return Number(row?.c || 0);
  }

  public recordSignupAttempt(ip: string) {
    this.run('INSERT INTO signup_attempts (ip, created_at) VALUES (?, ?)', [ip, Date.now()]);
    this.run('DELETE FROM signup_attempts WHERE created_at < ?', [Date.now() - 24 * 60 * 60 * 1000]);
    this.save();
  }

  public getDailyUsage(userId: number, dayKey: string): DailyUsage {
    const row = this.get('SELECT * FROM daily_usage WHERE user_id = ? AND day_key = ?', [userId, dayKey]);
    if (row) return row as DailyUsage;
    this.run('INSERT INTO daily_usage (user_id, day_key, audits, ai_messages, keyword_searches) VALUES (?, ?, 0, 0, 0)', [userId, dayKey]);
    this.save();
    return { user_id: userId, day_key: dayKey, audits: 0, ai_messages: 0, keyword_searches: 0 };
  }

  public incrementUsage(userId: number, dayKey: string, field: 'audits' | 'ai_messages' | 'keyword_searches') {
    this.getDailyUsage(userId, dayKey);
    this.run(`UPDATE daily_usage SET ${field} = ${field} + 1 WHERE user_id = ? AND day_key = ?`, [userId, dayKey]);
    this.saveImmediately();
  }

  public findWebsitesByUserId(userId: number): WebsiteEntity[] {
    return this.all('SELECT * FROM websites WHERE user_id = ?', [userId]) as WebsiteEntity[];
  }

  public findOrCreateWebsite(userId: number, domain: string, targetUrl: string): WebsiteEntity {
    const existing = this.get('SELECT * FROM websites WHERE user_id = ? AND domain = ?', [userId, domain]);
    if (existing) return existing as WebsiteEntity;
    this.run('INSERT INTO websites (user_id, domain, target_url, created_at) VALUES (?, ?, ?, ?)', [
      userId, domain, targetUrl, new Date().toISOString()
    ]);
    this.save();
    return this.get('SELECT * FROM websites WHERE user_id = ? AND domain = ?', [userId, domain]) as WebsiteEntity;
  }

  public getScan(id: string): ScanEntity | undefined {
    const row = this.get('SELECT * FROM scans WHERE id = ?', [id]);
    return row ? mapScan(row) : undefined;
  }

  public listScans(userId?: number | null, limit: number = 20): ScanEntity[] {
    if (userId) {
      return this.all('SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]).map(mapScan);
    }
    return this.all('SELECT * FROM scans ORDER BY created_at DESC LIMIT ?', [limit]).map(mapScan);
  }

  public createScan(scan: ScanEntity): ScanEntity {
    this.run(
      `INSERT INTO scans (id, user_id, target_url, domain, status, progress, current_action, health_score, technical_score, performance_score, accessibility_score, seo_score, pages_crawled, total_urls_found, redirects_found, broken_links_found, duration_seconds, created_at, completed_at, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scan.id, scan.user_id, scan.target_url, scan.domain, scan.status, scan.progress, scan.current_action,
        scan.health_score, scan.technical_score, scan.performance_score, scan.accessibility_score, scan.seo_score,
        scan.pages_crawled, scan.total_urls_found, scan.redirects_found, scan.broken_links_found, scan.duration_seconds,
        scan.created_at, scan.completed_at, scan.error_message || null
      ]
    );
    this.save();
    return scan;
  }

  public updateScan(id: string, updates: Partial<ScanEntity>): ScanEntity | undefined {
    const current = this.getScan(id);
    if (!current) return undefined;
    const next = { ...current, ...updates };
    this.run(
      `UPDATE scans SET user_id=?, target_url=?, domain=?, status=?, progress=?, current_action=?, health_score=?, technical_score=?, performance_score=?, accessibility_score=?, seo_score=?, pages_crawled=?, total_urls_found=?, redirects_found=?, broken_links_found=?, duration_seconds=?, completed_at=?, error_message=? WHERE id=?`,
      [
        next.user_id, next.target_url, next.domain, next.status, next.progress, next.current_action,
        next.health_score, next.technical_score, next.performance_score, next.accessibility_score, next.seo_score,
        next.pages_crawled, next.total_urls_found, next.redirects_found, next.broken_links_found, next.duration_seconds,
        next.completed_at, next.error_message || null, id
      ]
    );
    this.save();
    return this.getScan(id);
  }

  public deleteScan(id: string, userId?: number | null): boolean {
    const scan = this.getScan(id);
    if (!scan) return false;
    if (userId && scan.user_id !== userId) return false;
    this.run('DELETE FROM scanned_pages WHERE scan_id = ?', [id]);
    this.run('DELETE FROM issues WHERE scan_id = ?', [id]);
    this.run('DELETE FROM fixes WHERE scan_id = ?', [id]);
    this.run('DELETE FROM scans WHERE id = ?', [id]);
    this.save();
    return true;
  }

  public addScannedPage(page: Omit<ScannedPageEntity, 'id'>): ScannedPageEntity {
    const extra = { ...(page.extra || {}), checklist: page.checklist };
    this.run(
      `INSERT INTO scanned_pages (scan_id, url, status_code, response_time_ms, content_type, title, meta_description, canonical_url, h1_count, word_count, is_indexable, internal_links_count, external_links_count, extra_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        page.scan_id, page.url, page.status_code, page.response_time_ms, page.content_type, page.title,
        page.meta_description, page.canonical_url, page.h1_count, page.word_count, page.is_indexable ? 1 : 0,
        page.internal_links_count, page.external_links_count, JSON.stringify(extra)
      ]
    );
    this.save();
    const row = this.get('SELECT * FROM scanned_pages WHERE scan_id = ? AND url = ? ORDER BY id DESC LIMIT 1', [page.scan_id, page.url]);
    return mapPage(row);
  }

  public getPagesForScan(scanId: string): ScannedPageEntity[] {
    return this.all('SELECT * FROM scanned_pages WHERE scan_id = ?', [scanId]).map(mapPage);
  }

  public addIssues(issues: IssueEntity[]) {
    for (const issue of issues) {
      this.run(
        `INSERT OR REPLACE INTO issues (id, scan_id, rule_id, title, category, severity, pages_affected, affected_url, evidence, explanation, recommendation, suggested_fix, verification, resolved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          issue.id, issue.scan_id, issue.rule_id, issue.title, issue.category, issue.severity, issue.pages_affected,
          issue.affected_url, issue.evidence, issue.explanation, issue.recommendation, issue.suggested_fix || null,
          issue.verification || null, issue.resolved ? 1 : 0, issue.created_at
        ]
      );
    }
    this.save();
  }

  public getIssuesForScan(scanId: string): IssueEntity[] {
    return this.all('SELECT * FROM issues WHERE scan_id = ?', [scanId]).map(mapIssue);
  }

  public updateIssue(id: string, updates: Partial<IssueEntity>): IssueEntity | undefined {
    const row = this.get('SELECT * FROM issues WHERE id = ?', [id]);
    if (!row) return undefined;
    const current = mapIssue(row);
    const next = { ...current, ...updates };
    this.run(
      `UPDATE issues SET title=?, category=?, severity=?, pages_affected=?, affected_url=?, evidence=?, explanation=?, recommendation=?, suggested_fix=?, verification=?, resolved=? WHERE id=?`,
      [
        next.title, next.category, next.severity, next.pages_affected, next.affected_url, next.evidence,
        next.explanation, next.recommendation, next.suggested_fix || null, next.verification || null,
        next.resolved ? 1 : 0, id
      ]
    );
    this.save();
    const updated = this.get('SELECT * FROM issues WHERE id = ?', [id]);
    return updated ? mapIssue(updated) : undefined;
  }

  public getFixesForScan(scanId: string): FixEntity[] {
    return this.all('SELECT * FROM fixes WHERE scan_id = ? ORDER BY updated_at DESC', [scanId]).map(mapFix);
  }

  public getFix(id: string): FixEntity | undefined {
    const row = this.get('SELECT * FROM fixes WHERE id = ?', [id]);
    return row ? mapFix(row) : undefined;
  }

  public createFix(fix: FixEntity): FixEntity {
    this.run(
      `INSERT INTO fixes (id, scan_id, issue_id, issue_title, category, severity, affected_url, evidence, recommendation, fix_explanation, code_snippet, status, generated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fix.id, fix.scan_id, fix.issue_id, fix.issue_title, fix.category, fix.severity, fix.affected_url,
        fix.evidence, fix.recommendation, fix.fix_explanation, fix.code_snippet, fix.status, fix.generated_by,
        fix.created_at, fix.updated_at
      ]
    );
    this.save();
    return fix;
  }

  public updateFix(id: string, updates: Partial<Pick<FixEntity, 'status' | 'code_snippet' | 'fix_explanation'>>): FixEntity | undefined {
    const current = this.getFix(id);
    if (!current) return undefined;
    const next = { ...current, ...updates, updated_at: new Date().toISOString() };
    this.run('UPDATE fixes SET status=?, code_snippet=?, fix_explanation=?, updated_at=? WHERE id=?', [
      next.status, next.code_snippet, next.fix_explanation, next.updated_at, id
    ]);
    this.saveImmediately();
    return this.getFix(id);
  }

  public listTrackedKeywords(userId: number): TrackedKeyword[] {
    return this.all('SELECT * FROM tracked_keywords WHERE user_id = ? ORDER BY updated_at DESC', [userId]) as TrackedKeyword[];
  }

  public addTrackedKeyword(userId: number, keyword: string, country: string, website: string): TrackedKeyword {
    const now = new Date().toISOString();
    this.run(
      'INSERT INTO tracked_keywords (user_id, keyword, country, website, last_position, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, keyword, country, website, 'Not ranked yet', 'Baseline stored. Connect a SERP provider later for live positions.', now, now]
    );
    this.save();
    return this.get('SELECT * FROM tracked_keywords WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]) as TrackedKeyword;
  }

  public updateTrackedKeyword(id: number, userId: number, updates: { last_position?: string; notes?: string }): TrackedKeyword | undefined {
    const current = this.get('SELECT * FROM tracked_keywords WHERE id = ? AND user_id = ?', [id, userId]);
    if (!current) return undefined;
    this.run('UPDATE tracked_keywords SET last_position=?, notes=?, updated_at=? WHERE id=?', [
      updates.last_position ?? current.last_position,
      updates.notes ?? current.notes,
      new Date().toISOString(),
      id
    ]);
    this.save();
    return this.get('SELECT * FROM tracked_keywords WHERE id = ?', [id]) as TrackedKeyword;
  }
}

export const db = new DatabaseStore();

export async function initDb() {
  await db.init();
}
