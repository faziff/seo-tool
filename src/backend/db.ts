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
  plan: 'free' | 'starter' | 'pro' | 'agency';
  scans_used: number;
  created_at: string;
  settings: Record<string, any>;
  extra_audits: number;
  extra_ai: number;
  extra_keywords: number;
  subscription_status?: 'free' | 'trialing' | 'trial_expired' | 'active';
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  pending_plan?: string | null;
}

export interface WebsiteEntity {
  id: number;
  user_id: number;
  domain: string;
  target_url: string;
  created_at: string;
}

export interface ProjectEntity {
  id: string;
  user_id: number;
  name: string;
  domain: string;
  target_url: string;
  country: string;
  created_at: string;
  updated_at: string;
}

export interface AIConversationEntity {
  id: string;
  user_id: number;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessageEntity {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  provider: string | null;
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
  generated_by: 'gemini' | 'hermes' | 'openrouter' | 'groq' | 'fallback';
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


export interface GoogleDataConnectionEntity {
  user_id: number;
  google_email: string;
  access_token_encrypted: string;
  access_token_iv: string;
  access_token_tag: string;
  refresh_token_encrypted: string;
  refresh_token_iv: string;
  refresh_token_tag: string;
  expires_at: string;
  scopes: string;
  connected_at: string;
  updated_at: string;
}

export interface GoogleDataPropertySelectionEntity {
  user_id: number;
  project_id: string;
  ga_property_id: string | null;
  ga_property_name: string | null;
  gsc_site_url: string | null;
  updated_at: string;
}

export interface ContentBriefEntity {
  id: string;
  user_id: number;
  project_id: string | null;
  keyword: string;
  country: string;
  title: string;
  outline: Array<{ level: 'H2' | 'H3'; heading: string }>;
  target_word_count: number;
  questions: string[];
  related_terms: string[];
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  ai_mode: string;
  status: 'draft';
  created_at: string;
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
  extra_keywords INTEGER NOT NULL DEFAULT 0,
  subscription_status TEXT NOT NULL DEFAULT 'free',
  trial_started_at TEXT,
  trial_ends_at TEXT,
  pending_plan TEXT
);
CREATE TABLE IF NOT EXISTS billing_requests (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  requested_plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  admin_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_billing_requests_status_created ON billing_requests(status, created_at DESC);
CREATE TABLE IF NOT EXISTS backlink_daily_usage (
  user_id INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  lookups INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, day_key)
);
CREATE TABLE IF NOT EXISTS user_ai_credentials (
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  model TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_user ON user_ai_credentials(user_id);
CREATE TABLE IF NOT EXISTS ai_provider_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  key_fingerprint TEXT NOT NULL,
  outcome TEXT NOT NULL,
  error_class TEXT,
  error_code TEXT,
  status_code INTEGER,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  input_chars INTEGER NOT NULL DEFAULT 0,
  output_chars INTEGER NOT NULL DEFAULT 0,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_user_created ON ai_provider_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_provider_created ON ai_provider_usage(provider, created_at DESC);
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
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  target_url TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'PK',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, domain)
);
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_project ON ai_conversations(user_id, project_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  provider TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, id);
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
CREATE TABLE IF NOT EXISTS scan_audit_summaries (
  scan_id TEXT PRIMARY KEY,
  passed_checks_json TEXT NOT NULL DEFAULT '[]',
  total_checks_count INTEGER NOT NULL DEFAULT 0
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
CREATE TABLE IF NOT EXISTS content_briefs (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  project_id TEXT,
  keyword TEXT NOT NULL,
  country TEXT NOT NULL,
  title TEXT NOT NULL,
  outline_json TEXT NOT NULL DEFAULT '[]',
  target_word_count INTEGER NOT NULL DEFAULT 1200,
  questions_json TEXT NOT NULL DEFAULT '[]',
  related_terms_json TEXT NOT NULL DEFAULT '[]',
  intent TEXT NOT NULL DEFAULT 'Informational',
  ai_mode TEXT NOT NULL DEFAULT 'heuristic',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_briefs_user_created ON content_briefs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_briefs_project ON content_briefs(user_id, project_id, created_at DESC);
CREATE TABLE IF NOT EXISTS google_data_connections (
  user_id INTEGER PRIMARY KEY,
  google_email TEXT NOT NULL DEFAULT '',
  access_token_encrypted TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,
  access_token_tag TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  refresh_token_tag TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '',
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS google_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expiry ON google_oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS google_data_property_selections (
  user_id INTEGER NOT NULL,
  project_id TEXT NOT NULL,
  ga_property_id TEXT,
  ga_property_name TEXT,
  gsc_site_url TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_google_data_selection_project ON google_data_property_selections(project_id, user_id);
`;

function mapContentBrief(row: any): ContentBriefEntity {
  const parseArray = (value: unknown): any[] => {
    try { const parsed = JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  };
  const outline = parseArray(row.outline_json).filter((item: any) =>
    (item?.level === 'H2' || item?.level === 'H3') && typeof item?.heading === 'string'
  ).map((item: any) => ({ level: item.level as 'H2' | 'H3', heading: String(item.heading) }));
  const allowedIntents = new Set(['Informational', 'Commercial', 'Transactional', 'Navigational']);
  return {
    id: String(row.id),
    user_id: Number(row.user_id),
    project_id: row.project_id ? String(row.project_id) : null,
    keyword: String(row.keyword || ''),
    country: String(row.country || 'GLOBAL'),
    title: String(row.title || ''),
    outline,
    target_word_count: Number(row.target_word_count || 1200),
    questions: parseArray(row.questions_json).filter((value: unknown): value is string => typeof value === 'string'),
    related_terms: parseArray(row.related_terms_json).filter((value: unknown): value is string => typeof value === 'string'),
    intent: allowedIntents.has(String(row.intent)) ? row.intent : 'Informational',
    ai_mode: String(row.ai_mode || 'heuristic'),
    status: 'draft',
    created_at: String(row.created_at || '')
  };
}

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
    extra_keywords: row.extra_keywords || 0,
    subscription_status: String(row.subscription_status || 'free') as UserEntity['subscription_status'],
    trial_started_at: row.trial_started_at ? String(row.trial_started_at) : null,
    trial_ends_at: row.trial_ends_at ? String(row.trial_ends_at) : null,
    pending_plan: row.pending_plan ? String(row.pending_plan) : null
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

/**
 * Internal storage contract. DatabaseStore deliberately knows only this small
 * interface, so a native SQLite or PostgreSQL adapter can replace sql.js
 * without rewriting domain methods or route handlers.
 */
interface DatabaseDriver {
  exec(sql: string): void;
  all(sql: string, params?: any[]): any[];
  get(sql: string, params?: any[]): any | undefined;
  run(sql: string, params?: any[]): void;
  persist(pathname: string): void;
}

class SqlJsDriver implements DatabaseDriver {
  constructor(private readonly database: SqlJsDatabase) {}

  exec(sql: string): void { this.database.exec(sql); }

  all(sql: string, params: any[] = []): any[] {
    const statement = this.database.prepare(sql);
    try {
      statement.bind(params);
      const rows: any[] = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }

  get(sql: string, params: any[] = []): any | undefined {
    return this.all(sql, params)[0];
  }

  run(sql: string, params: any[] = []): void {
    this.database.run(sql, params);
  }

  persist(pathname: string): void {
    const temporaryPath = `${pathname}.tmp`;
    fs.writeFileSync(temporaryPath, Buffer.from(this.database.export()));
    fs.renameSync(temporaryPath, pathname);
  }
}

class DatabaseStore {
  private driver: DatabaseDriver | null = null;
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
    const database = fs.existsSync(this.dbPath)
      ? new SQL.Database(fs.readFileSync(this.dbPath))
      : new SQL.Database();

    this.driver = new SqlJsDriver(database);
    this.driver.exec(SCHEMA);
    const userColumns = new Set(this.all('PRAGMA table_info(users)').map((column: any) => String(column.name)));
    if (!userColumns.has('subscription_status')) this.run("ALTER TABLE users ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'free'");
    if (!userColumns.has('trial_started_at')) this.run('ALTER TABLE users ADD COLUMN trial_started_at TEXT');
    if (!userColumns.has('trial_ends_at')) this.run('ALTER TABLE users ADD COLUMN trial_ends_at TEXT');
    if (!userColumns.has('pending_plan')) this.run('ALTER TABLE users ADD COLUMN pending_plan TEXT');
    this.ready = true;
    this.persistSync();
    console.log(`[CROX DB] SQLite ready at ${this.dbPath} (sql.js adapter)`);
  }

  private requireDriver(): DatabaseDriver {
    if (!this.driver) throw new Error('CROX database is not initialized.');
    return this.driver;
  }

  private persistSync() {
    try {
      this.requireDriver().persist(this.dbPath);
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
    return this.requireDriver().all(sql, params);
  }

  private get(sql: string, params: any[] = []): any | undefined {
    return this.requireDriver().get(sql, params);
  }

  private run(sql: string, params: any[] = []) {
    this.requireDriver().run(sql, params);
  }

  public listUserAICredentials(userId: number): Array<{ provider: string; encrypted_key: string; iv: string; auth_tag: string; model: string; enabled: boolean; updated_at: string }> {
    return this.all('SELECT provider, encrypted_key, iv, auth_tag, model, enabled, updated_at FROM user_ai_credentials WHERE user_id = ? ORDER BY updated_at DESC', [userId])
      .map(row => ({ ...row, enabled: !!row.enabled }));
  }

  public getUserAICredential(userId: number, provider: string): { provider: string; encrypted_key: string; iv: string; auth_tag: string; model: string; enabled: boolean; updated_at: string } | undefined {
    const row = this.get('SELECT provider, encrypted_key, iv, auth_tag, model, enabled, updated_at FROM user_ai_credentials WHERE user_id = ? AND provider = ?', [userId, provider]);
    return row ? { ...row, enabled: !!row.enabled } : undefined;
  }

  public saveUserAICredential(userId: number, credential: { provider: string; encrypted_key: string; iv: string; auth_tag: string; model: string; enabled?: boolean }): void {
    this.run(`INSERT INTO user_ai_credentials (user_id, provider, encrypted_key, iv, auth_tag, model, enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET encrypted_key=excluded.encrypted_key, iv=excluded.iv, auth_tag=excluded.auth_tag, model=excluded.model, enabled=excluded.enabled, updated_at=excluded.updated_at`,
      [userId, credential.provider, credential.encrypted_key, credential.iv, credential.auth_tag, credential.model, credential.enabled === false ? 0 : 1, new Date().toISOString()]);
    this.saveImmediately();
  }

  public updateUserAICredential(userId: number, provider: string, updates: { enabled?: boolean; model?: string }): boolean {
    const current = this.getUserAICredential(userId, provider);
    if (!current) return false;
    const model = updates.model === undefined ? current.model : updates.model;
    const enabled = updates.enabled === undefined ? current.enabled : updates.enabled;
    this.run('UPDATE user_ai_credentials SET model = ?, enabled = ?, updated_at = ? WHERE user_id = ? AND provider = ?', [model, enabled ? 1 : 0, new Date().toISOString(), userId, provider]);
    this.saveImmediately();
    return true;
  }

  public deleteUserAICredential(userId: number, provider: string): boolean {
    const before = this.getUserAICredential(userId, provider);
    if (!before) return false;
    this.run('DELETE FROM user_ai_credentials WHERE user_id = ? AND provider = ?', [userId, provider]);
    this.saveImmediately();
    return true;
  }

  public recordAIProviderUsage(event: {
    user_id: number | null;
    provider: string;
    model: string;
    key_fingerprint: string;
    outcome: 'success' | 'failed';
    error_class?: string | null;
    error_code?: string | null;
    status_code?: number | null;
    latency_ms: number;
    input_chars: number;
    output_chars: number;
    attempt_no: number;
  }): void {
    this.run(`INSERT INTO ai_provider_usage
      (user_id, provider, model, key_fingerprint, outcome, error_class, error_code, status_code, latency_ms, input_chars, output_chars, attempt_no, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      event.user_id, event.provider, event.model, event.key_fingerprint, event.outcome,
      event.error_class || null, event.error_code || null, event.status_code || null,
      Math.max(0, Math.round(event.latency_ms)), Math.max(0, Math.round(event.input_chars)),
      Math.max(0, Math.round(event.output_chars)), Math.max(1, Math.round(event.attempt_no)), new Date().toISOString()
    ]);
    // Keep a bounded audit trail; never store prompts or raw API credentials in usage history.
    this.run("DELETE FROM ai_provider_usage WHERE created_at < ?", [new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()]);
    this.save();
  }

  public getAIProviderUsage(userId: number, days = 30): {
    period_days: number;
    totals: { calls: number; successful: number; failed: number; fallback_attempts: number; rate_limited: number; quota_events: number; average_latency_ms: number };
    providers: Array<{ provider: string; calls: number; successful: number; failed: number; rate_limited: number; quota_events: number; average_latency_ms: number; last_used_at: string | null }>;
    recent: Array<{ provider: string; model: string; outcome: string; error_class: string | null; status_code: number | null; latency_ms: number; attempt_no: number; created_at: string }>;
  } {
    const safeDays = Math.max(1, Math.min(90, Math.floor(days || 30)));
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
    const rows = this.all(`SELECT
      provider,
      COUNT(*) AS calls,
      SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS successful,
      SUM(CASE WHEN outcome = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN error_class = 'rate_limit' THEN 1 ELSE 0 END) AS rate_limited,
      SUM(CASE WHEN error_class = 'quota' THEN 1 ELSE 0 END) AS quota_events,
      ROUND(AVG(latency_ms)) AS average_latency_ms,
      MAX(created_at) AS last_used_at
      FROM ai_provider_usage WHERE user_id = ? AND created_at >= ? GROUP BY provider ORDER BY calls DESC`, [userId, since]);
    const total = this.get(`SELECT
      COUNT(*) AS calls,
      SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS successful,
      SUM(CASE WHEN outcome = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN outcome = 'success' AND attempt_no > 1 THEN 1 ELSE 0 END) AS fallback_attempts,
      SUM(CASE WHEN error_class = 'rate_limit' THEN 1 ELSE 0 END) AS rate_limited,
      SUM(CASE WHEN error_class = 'quota' THEN 1 ELSE 0 END) AS quota_events,
      ROUND(AVG(latency_ms)) AS average_latency_ms
      FROM ai_provider_usage WHERE user_id = ? AND created_at >= ?`, [userId, since]) || {};
    const recent = this.all(`SELECT provider, model, outcome, error_class, status_code, latency_ms, attempt_no, created_at
      FROM ai_provider_usage WHERE user_id = ? AND created_at >= ? ORDER BY id DESC LIMIT 25`, [userId, since]);
    const number = (value: unknown) => Number(value || 0);
    return {
      period_days: safeDays,
      totals: {
        calls: number(total.calls), successful: number(total.successful), failed: number(total.failed),
        fallback_attempts: number(total.fallback_attempts), rate_limited: number(total.rate_limited),
        quota_events: number(total.quota_events), average_latency_ms: number(total.average_latency_ms)
      },
      providers: rows.map(row => ({
        provider: String(row.provider), calls: number(row.calls), successful: number(row.successful),
        failed: number(row.failed), rate_limited: number(row.rate_limited), quota_events: number(row.quota_events),
        average_latency_ms: number(row.average_latency_ms), last_used_at: row.last_used_at ? String(row.last_used_at) : null
      })),
      recent: recent.map(row => ({
        provider: String(row.provider), model: String(row.model), outcome: String(row.outcome),
        error_class: row.error_class ? String(row.error_class) : null,
        status_code: row.status_code === null || row.status_code === undefined ? null : number(row.status_code),
        latency_ms: number(row.latency_ms), attempt_no: number(row.attempt_no), created_at: String(row.created_at)
      }))
    };
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
      `INSERT INTO users (name, email, password_hash, plan, scans_used, created_at, settings, extra_audits, extra_ai, extra_keywords, subscription_status, trial_started_at, trial_ends_at, pending_plan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.name, user.email.toLowerCase(), user.password_hash, user.plan, user.scans_used, user.created_at,
        JSON.stringify(user.settings || {}), user.extra_audits || 0, user.extra_ai || 0, user.extra_keywords || 0,
        user.subscription_status || 'free', user.trial_started_at || null, user.trial_ends_at || null, user.pending_plan || null
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
      `UPDATE users SET name=?, email=?, password_hash=?, plan=?, scans_used=?, settings=?, extra_audits=?, extra_ai=?, extra_keywords=?, subscription_status=?, trial_started_at=?, trial_ends_at=?, pending_plan=? WHERE id=?`,
      [
        next.name, next.email, next.password_hash, next.plan, next.scans_used,
        JSON.stringify(next.settings || {}), next.extra_audits, next.extra_ai, next.extra_keywords,
        next.subscription_status || 'free', next.trial_started_at || null, next.trial_ends_at || null, next.pending_plan || null, id
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

  public listProjects(userId: number): ProjectEntity[] {
    return this.all('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC', [userId]) as ProjectEntity[];
  }

  public getProject(id: string, userId: number): ProjectEntity | undefined {
    return this.get('SELECT * FROM projects WHERE id = ? AND user_id = ?', [id, userId]) as ProjectEntity | undefined;
  }

  public findProjectByDomain(userId: number, domain: string): ProjectEntity | undefined {
    return this.get('SELECT * FROM projects WHERE user_id = ? AND domain = ?', [userId, domain.toLowerCase()]) as ProjectEntity | undefined;
  }

  public createProject(project: ProjectEntity): ProjectEntity {
    this.run(
      'INSERT INTO projects (id, user_id, name, domain, target_url, country, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [project.id, project.user_id, project.name, project.domain.toLowerCase(), project.target_url, project.country, project.created_at, project.updated_at]
    );
    this.saveImmediately();
    const created = this.getProject(project.id, project.user_id);
    if (!created) throw new Error('Project could not be stored.');
    return created;
  }

  public updateProject(id: string, userId: number, updates: Partial<Pick<ProjectEntity, 'name' | 'country' | 'target_url' | 'domain'>>): ProjectEntity | undefined {
    const current = this.getProject(id, userId);
    if (!current) return undefined;
    const next = { ...current, ...updates, updated_at: new Date().toISOString() };
    this.run(
      'UPDATE projects SET name = ?, domain = ?, target_url = ?, country = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [next.name, next.domain.toLowerCase(), next.target_url, next.country, next.updated_at, id, userId]
    );
    this.saveImmediately();
    return this.getProject(id, userId);
  }

  public deleteProject(id: string, userId: number): boolean {
    const project = this.getProject(id, userId);
    if (!project) return false;
    this.run('DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE project_id = ? AND user_id = ?)', [id, userId]);
    this.run('DELETE FROM ai_conversations WHERE project_id = ? AND user_id = ?', [id, userId]);
    this.run('DELETE FROM projects WHERE id = ? AND user_id = ?', [id, userId]);
    this.saveImmediately();
    return true;
  }

  public listAIConversations(userId: number, projectId: string): AIConversationEntity[] {
    return this.all('SELECT * FROM ai_conversations WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC', [userId, projectId]) as AIConversationEntity[];
  }

  public createAIConversation(conversation: AIConversationEntity): AIConversationEntity {
    this.run(
      'INSERT INTO ai_conversations (id, user_id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [conversation.id, conversation.user_id, conversation.project_id, conversation.title, conversation.created_at, conversation.updated_at]
    );
    this.saveImmediately();
    return conversation;
  }

  public listAIMessages(conversationId: string): AIMessageEntity[] {
    return this.all('SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC', [conversationId]) as AIMessageEntity[];
  }

  public addAIMessage(conversationId: string, role: AIMessageEntity['role'], content: string, provider?: string | null): AIMessageEntity {
    const createdAt = new Date().toISOString();
    this.run('INSERT INTO ai_messages (conversation_id, role, content, provider, created_at) VALUES (?, ?, ?, ?, ?)', [conversationId, role, content, provider || null, createdAt]);
    this.run('UPDATE ai_conversations SET updated_at = ? WHERE id = ?', [createdAt, conversationId]);
    this.saveImmediately();
    const row = this.get('SELECT * FROM ai_messages WHERE id = last_insert_rowid()') as AIMessageEntity | undefined;
    if (!row) throw new Error('AI message could not be stored.');
    return row;
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
    this.run('DELETE FROM scan_audit_summaries WHERE scan_id = ?', [id]);
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

  public setAuditSummary(scanId: string, passedChecks: string[], totalChecks: number) {
    this.run(
      `INSERT OR REPLACE INTO scan_audit_summaries (scan_id, passed_checks_json, total_checks_count) VALUES (?, ?, ?)`,
      [scanId, JSON.stringify(passedChecks), Math.max(0, totalChecks)]
    );
    this.save();
  }

  public getAuditSummary(scanId: string): { passed_checks: string[]; total_checks_count: number } {
    const row = this.get('SELECT * FROM scan_audit_summaries WHERE scan_id = ?', [scanId]);
    let passedChecks: string[] = [];
    try {
      const parsed = JSON.parse(row?.passed_checks_json || '[]');
      if (Array.isArray(parsed)) passedChecks = parsed.filter((value: unknown): value is string => typeof value === 'string');
    } catch { passedChecks = []; }
    return {
      passed_checks: passedChecks,
      total_checks_count: Number(row?.total_checks_count || 0)
    };
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

  public getIssue(id: string): IssueEntity | undefined {
    const row = this.get('SELECT * FROM issues WHERE id = ?', [id]);
    return row ? mapIssue(row) : undefined;
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

  public addContentBrief(brief: ContentBriefEntity): ContentBriefEntity {
    this.run(
      `INSERT INTO content_briefs (id, user_id, project_id, keyword, country, title, outline_json, target_word_count, questions_json, related_terms_json, intent, ai_mode, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        brief.id, brief.user_id, brief.project_id, brief.keyword, brief.country, brief.title,
        JSON.stringify(brief.outline), brief.target_word_count, JSON.stringify(brief.questions),
        JSON.stringify(brief.related_terms), brief.intent, brief.ai_mode, 'draft', brief.created_at
      ]
    );
    this.saveImmediately();
    const saved = this.get('SELECT * FROM content_briefs WHERE id = ? AND user_id = ?', [brief.id, brief.user_id]);
    if (!saved) throw new Error('Content brief could not be stored.');
    return mapContentBrief(saved);
  }

  public listContentBriefs(userId: number, projectId?: string): ContentBriefEntity[] {
    const rows = projectId
      ? this.all('SELECT * FROM content_briefs WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC', [userId, projectId])
      : this.all('SELECT * FROM content_briefs WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows.map(mapContentBrief);
  }

  public createGoogleOAuthState(stateHash: string, userId: number, expiresAt: string): void {
    this.run('DELETE FROM google_oauth_states WHERE expires_at <= ?', [new Date().toISOString()]);
    this.run('INSERT INTO google_oauth_states (state_hash, user_id, expires_at) VALUES (?, ?, ?)', [stateHash, userId, expiresAt]);
    this.save();
  }

  public consumeGoogleOAuthState(stateHash: string): { user_id: number; expires_at: string } | undefined {
    const row = this.get('SELECT user_id, expires_at FROM google_oauth_states WHERE state_hash = ?', [stateHash]);
    if (!row) return undefined;
    this.run('DELETE FROM google_oauth_states WHERE state_hash = ?', [stateHash]);
    this.saveImmediately();
    return { user_id: Number(row.user_id), expires_at: String(row.expires_at) };
  }

  public getGoogleDataConnection(userId: number): GoogleDataConnectionEntity | undefined {
    return this.get('SELECT * FROM google_data_connections WHERE user_id = ?', [userId]) as GoogleDataConnectionEntity | undefined;
  }

  public saveGoogleDataConnection(connection: GoogleDataConnectionEntity): GoogleDataConnectionEntity {
    this.run(
      `INSERT INTO google_data_connections (user_id, google_email, access_token_encrypted, access_token_iv, access_token_tag, refresh_token_encrypted, refresh_token_iv, refresh_token_tag, expires_at, scopes, connected_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET google_email=excluded.google_email,
       access_token_encrypted=excluded.access_token_encrypted, access_token_iv=excluded.access_token_iv,
       access_token_tag=excluded.access_token_tag, refresh_token_encrypted=excluded.refresh_token_encrypted,
       refresh_token_iv=excluded.refresh_token_iv, refresh_token_tag=excluded.refresh_token_tag,
       expires_at=excluded.expires_at, scopes=excluded.scopes, updated_at=excluded.updated_at`,
      [connection.user_id, connection.google_email, connection.access_token_encrypted, connection.access_token_iv,
        connection.access_token_tag, connection.refresh_token_encrypted, connection.refresh_token_iv,
        connection.refresh_token_tag, connection.expires_at, connection.scopes, connection.connected_at, connection.updated_at]
    );
    this.saveImmediately();
    return connection;
  }

  public updateGoogleDataAccessToken(userId: number, token: { encrypted: string; iv: string; tag: string; expiresAt: string }): void {
    this.run('UPDATE google_data_connections SET access_token_encrypted=?, access_token_iv=?, access_token_tag=?, expires_at=?, updated_at=? WHERE user_id=?',
      [token.encrypted, token.iv, token.tag, token.expiresAt, new Date().toISOString(), userId]);
    this.save();
  }

  public deleteGoogleDataConnection(userId: number): void {
    this.run('DELETE FROM google_data_connections WHERE user_id = ?', [userId]);
    this.run('DELETE FROM google_data_property_selections WHERE user_id = ?', [userId]);
    this.saveImmediately();
  }

  public saveGoogleDataPropertySelection(selection: GoogleDataPropertySelectionEntity): GoogleDataPropertySelectionEntity {
    this.run(
      `INSERT INTO google_data_property_selections (user_id, project_id, ga_property_id, ga_property_name, gsc_site_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, project_id) DO UPDATE SET ga_property_id=excluded.ga_property_id,
       ga_property_name=excluded.ga_property_name, gsc_site_url=excluded.gsc_site_url, updated_at=excluded.updated_at`,
      [selection.user_id, selection.project_id, selection.ga_property_id, selection.ga_property_name, selection.gsc_site_url, selection.updated_at]
    );
    this.save();
    return selection;
  }

  public getGoogleDataPropertySelection(userId: number, projectId: string): GoogleDataPropertySelectionEntity | undefined {
    return this.get('SELECT * FROM google_data_property_selections WHERE user_id = ? AND project_id = ?', [userId, projectId]) as GoogleDataPropertySelectionEntity | undefined;
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

  public createBillingRequest(request: { id: string; user_id: number; email: string; requested_plan: string; created_at: string }): void {
    this.run('INSERT INTO billing_requests (id, user_id, email, requested_plan, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [request.id, request.user_id, request.email, request.requested_plan, 'pending', request.created_at]);
    this.saveImmediately();
  }

  public listBillingRequests(limit = 100): Array<Record<string, any>> {
    return this.all('SELECT * FROM billing_requests ORDER BY created_at DESC LIMIT ?', [Math.max(1, Math.min(500, limit))]);
  }

  public reviewBillingRequest(id: string, status: 'approved' | 'rejected', adminNote = ''): void {
    this.run('UPDATE billing_requests SET status=?, reviewed_at=?, admin_note=? WHERE id=?',
      [status, new Date().toISOString(), adminNote.slice(0, 500), id]);
    this.saveImmediately();
  }

  public consumeBacklinkLookup(userId: number, dayKey: string, dailyLimit: number): boolean {
    const row = this.get('SELECT lookups FROM backlink_daily_usage WHERE user_id = ? AND day_key = ?', [userId, dayKey]);
    const used = Number(row?.lookups || 0);
    if (used >= dailyLimit) return false;
    this.run(`INSERT INTO backlink_daily_usage (user_id, day_key, lookups) VALUES (?, ?, 1)
      ON CONFLICT(user_id, day_key) DO UPDATE SET lookups=backlink_daily_usage.lookups + 1`, [userId, dayKey]);
    this.run('DELETE FROM backlink_daily_usage WHERE day_key < ?', [dayKey.slice(0, 7) + '-01']);
    this.save();
    return true;
  }
}

export const db = new DatabaseStore();

export async function initDb() {
  await db.init();
}
