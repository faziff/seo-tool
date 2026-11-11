import { secretFingerprint, withRequestCache } from './request_cache.js';

export interface BacklinkSummary {
  target: string;
  rank: number | null;
  backlinks: number;
  referring_domains: number;
  referring_pages: number;
  referring_ips: number;
  referring_subnets: number;
  dofollow: number | null;
  nofollow: number | null;
  broken_backlinks: number | null;
  spam_score: number | null;
  crawled_pages: number | null;
  checked_at: string;
}

export interface BacklinkRecord {
  source_domain: string;
  source_url: string;
  target_url: string;
  anchor: string;
  dofollow: boolean | null;
  rank: number | null;
  first_seen: string | null;
  last_seen: string | null;
}

function credentials() {
  const login = String(process.env.DATAFORSEO_LOGIN || '').trim();
  const password = String(process.env.DATAFORSEO_PASSWORD || '').trim();
  return login && password ? { login, password } : null;
}

function numeric(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function apiError(payload: any): string | null {
  const task = payload?.tasks?.[0];
  const status = Number(task?.status_code || 0);
  if (status >= 40000) return String(task?.status_message || 'DataForSEO rejected the backlink request.').slice(0, 240);
  const result = task?.result?.[0];
  if (!result) return String(task?.status_message || 'DataForSEO returned no backlink results.').slice(0, 240);
  return null;
}

async function postDataForSeo<T>(endpoint: string, target: string, limit?: number): Promise<T> {
  const auth = credentials();
  if (!auth) throw new Error('Configure DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to enable live backlink metrics.');
  const encoded = Buffer.from(`${auth.login}:${auth.password}`).toString('base64');
  const body: Record<string, unknown> = {
    target,
    include_subdomains: true,
    exclude_internal_backlinks: true,
    backlinks_status_type: 'live',
    rank_scale: 'one_hundred'
  };
  if (limit) {
    body.limit = Math.max(1, Math.min(100, Math.floor(limit)));
    body.order_by = ['rank,desc'];
  }
  const response = await fetch(`https://api.dataforseo.com/v3/backlinks/${endpoint}/live`, {
    method: 'POST',
    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([body]),
    signal: AbortSignal.timeout(25_000)
  });
  const payload: any = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`DataForSEO Backlinks API returned HTTP ${response.status}.`);
  const error = apiError(payload);
  if (error) throw new Error(error);
  return payload.tasks[0].result[0] as T;
}

export function backlinkProviderConfigured(): boolean {
  return Boolean(credentials());
}

export async function getBacklinkProfile(target: string, sampleLimit = 25): Promise<{ summary: BacklinkSummary; backlinks: BacklinkRecord[] }> {
  const auth = credentials();
  if (!auth) throw new Error('DataForSEO credentials are not configured.');
  const normalizedTarget = target.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const summaryResult = await withRequestCache<any>(
    'dataforseo:backlinks:summary',
    { target: normalizedTarget, credential: secretFingerprint(`${auth.login}:${auth.password}`) },
    () => postDataForSeo<any>('summary', normalizedTarget),
    { ttlSeconds: 1800, maxEntries: 400 }
  );
  const listResult = await withRequestCache<any>(
    'dataforseo:backlinks:list',
    { target: normalizedTarget, limit: sampleLimit, credential: secretFingerprint(`${auth.login}:${auth.password}`) },
    () => postDataForSeo<any>('backlinks', normalizedTarget, sampleLimit),
    { ttlSeconds: 1800, maxEntries: 400 }
  );

  const summary = summaryResult;
  const item = (Array.isArray(listResult?.items) ? listResult.items : []).map((row: any): BacklinkRecord => ({
    source_domain: String(row?.domain_from || row?.url_from || '').slice(0, 255),
    source_url: String(row?.url_from || '').slice(0, 2048),
    target_url: String(row?.url_to || '').slice(0, 2048),
    anchor: String(row?.anchor || '').slice(0, 300),
    dofollow: typeof row?.dofollow === 'boolean' ? row.dofollow : null,
    rank: numeric(row?.rank),
    first_seen: row?.first_seen ? String(row.first_seen) : null,
    last_seen: row?.last_seen ? String(row.last_seen) : null
  }));

  return {
    summary: {
      target: normalizedTarget,
      rank: numeric(summary?.rank),
      backlinks: Number(summary?.backlinks || 0),
      referring_domains: Number(summary?.referring_domains || summary?.referring_main_domains || 0),
      referring_pages: Number(summary?.referring_pages || 0),
      referring_ips: Number(summary?.referring_ips || 0),
      referring_subnets: Number(summary?.referring_subnets || 0),
      dofollow: numeric(summary?.referring_links_attributes?.dofollow),
      nofollow: numeric(summary?.referring_links_attributes?.nofollow),
      broken_backlinks: numeric(summary?.broken_backlinks),
      spam_score: numeric(summary?.backlinks_spam_score ?? summary?.target_spam_score),
      crawled_pages: numeric(summary?.crawled_pages),
      checked_at: new Date().toISOString()
    },
    backlinks: item
  };
}
