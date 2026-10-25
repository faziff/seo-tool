import fs from 'node:fs';
import path from 'node:path';

export interface UserEntity {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  plan: 'free' | 'pro' | 'agency';
  scans_used: number;
  created_at: string;
  settings: Record<string, any>;
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

export interface DatabaseSchema {
  users: UserEntity[];
  websites: WebsiteEntity[];
  scans: ScanEntity[];
  scanned_pages: ScannedPageEntity[];
  issues: IssueEntity[];
  fixes: FixEntity[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'crox_store.json');

class DatabaseStore {
  private data: DatabaseSchema = {
    users: [],
    websites: [],
    scans: [],
    scanned_pages: [],
    issues: [],
    fixes: []
  };

  private isLoaded = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isLoaded) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        // Treat a new/empty data file as a fresh store instead of making startup noisy.
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        this.data = {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          websites: Array.isArray(parsed.websites) ? parsed.websites : [],
          scans: Array.isArray(parsed.scans) ? parsed.scans : [],
          scanned_pages: Array.isArray(parsed.scanned_pages) ? parsed.scanned_pages : [],
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          fixes: Array.isArray(parsed.fixes) ? parsed.fixes : []
        };
      }
      this.isLoaded = true;
      this.persistSync();
    } catch (err) {
      console.error('[CROX DB] Data file is unreadable; starting with an empty store:', err);
      this.data = { users: [], websites: [], scans: [], scanned_pages: [], issues: [], fixes: [] };
      this.isLoaded = true;
      this.persistSync();
    }
  }

  private persistSync() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('[CROX DB] Failed to persist data:', err);
    }
  }

  public save() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persistSync();
    }, 200);
  }

  public saveImmediately() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.persistSync();
  }


  // --- Users ---
  public findUserByEmail(email: string): UserEntity | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: number): UserEntity | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public createUser(user: Omit<UserEntity, 'id'>): UserEntity {
    const nextId = this.data.users.length > 0 ? Math.max(...this.data.users.map(u => u.id)) + 1 : 1;
    const created: UserEntity = { ...user, id: nextId };
    this.data.users.push(created);
    // Account creation is persisted before we send the success response/token.
    this.saveImmediately();
    return created;
  }

  public updateUser(id: number, updates: Partial<UserEntity>): UserEntity | undefined {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.saveImmediately();
    return this.data.users[idx];
  }

  // --- Websites ---
  public findWebsitesByUserId(userId: number): WebsiteEntity[] {
    return this.data.websites.filter(w => w.user_id === userId);
  }

  public findOrCreateWebsite(userId: number, domain: string, targetUrl: string): WebsiteEntity {
    const existing = this.data.websites.find(w => w.user_id === userId && w.domain === domain);
    if (existing) return existing;

    const nextId = this.data.websites.length > 0 ? Math.max(...this.data.websites.map(w => w.id)) + 1 : 1;
    const created: WebsiteEntity = {
      id: nextId,
      user_id: userId,
      domain,
      target_url: targetUrl,
      created_at: new Date().toISOString()
    };
    this.data.websites.push(created);
    this.save();
    return created;
  }

  // --- Scans ---
  public getScan(id: string): ScanEntity | undefined {
    return this.data.scans.find(s => s.id === id);
  }

  public listScans(userId?: number | null, limit: number = 20): ScanEntity[] {
    let list = this.data.scans;
    if (userId) {
      list = list.filter(s => s.user_id === userId);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
  }

  public createScan(scan: ScanEntity): ScanEntity {
    this.data.scans.unshift(scan);
    this.save();
    return scan;
  }

  public updateScan(id: string, updates: Partial<ScanEntity>): ScanEntity | undefined {
    const idx = this.data.scans.findIndex(s => s.id === id);
    if (idx === -1) return undefined;
    this.data.scans[idx] = { ...this.data.scans[idx], ...updates };
    this.save();
    return this.data.scans[idx];
  }

  public deleteScan(id: string, userId?: number | null): boolean {
    const idx = this.data.scans.findIndex(s => s.id === id && (!userId || s.user_id === userId));
    if (idx === -1) return false;
    this.data.scans.splice(idx, 1);
    this.data.scanned_pages = this.data.scanned_pages.filter(p => p.scan_id !== id);
    this.data.issues = this.data.issues.filter(i => i.scan_id !== id);
    this.data.fixes = this.data.fixes.filter(f => f.scan_id !== id);
    this.save();
    return true;
  }

  // --- Pages ---
  public addScannedPage(page: Omit<ScannedPageEntity, 'id'>): ScannedPageEntity {
    const nextId = this.data.scanned_pages.length > 0 ? Math.max(...this.data.scanned_pages.map(p => p.id)) + 1 : 1;
    const created: ScannedPageEntity = { ...page, id: nextId };
    this.data.scanned_pages.push(created);
    this.save();
    return created;
  }

  public getPagesForScan(scanId: string): ScannedPageEntity[] {
    return this.data.scanned_pages.filter(p => p.scan_id === scanId);
  }

  // --- Issues ---
  public addIssues(issues: IssueEntity[]) {
    this.data.issues.push(...issues);
    this.save();
  }

  public getIssuesForScan(scanId: string): IssueEntity[] {
    return this.data.issues.filter(i => i.scan_id === scanId);
  }

  public updateIssue(id: string, updates: Partial<IssueEntity>): IssueEntity | undefined {
    const idx = this.data.issues.findIndex(i => i.id === id);
    if (idx === -1) return undefined;
    this.data.issues[idx] = { ...this.data.issues[idx], ...updates };
    this.save();
    return this.data.issues[idx];
  }

  // --- AI-assisted fix drafts ---
  public getFixesForScan(scanId: string): FixEntity[] {
    return this.data.fixes
      .filter(fix => fix.scan_id === scanId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  public getFix(id: string): FixEntity | undefined {
    return this.data.fixes.find(fix => fix.id === id);
  }

  public createFix(fix: FixEntity): FixEntity {
    this.data.fixes.unshift(fix);
    this.save();
    return fix;
  }

  public updateFix(id: string, updates: Partial<Pick<FixEntity, 'status' | 'code_snippet' | 'fix_explanation'>>): FixEntity | undefined {
    const idx = this.data.fixes.findIndex(fix => fix.id === id);
    if (idx === -1) return undefined;
    this.data.fixes[idx] = { ...this.data.fixes[idx], ...updates, updated_at: new Date().toISOString() };
    this.saveImmediately();
    return this.data.fixes[idx];
  }
}


export const db = new DatabaseStore();
