import { createHash, randomBytes } from 'node:crypto';
import { db, GoogleDataConnectionEntity } from './db.js';
import { decryptProviderKey, encryptProviderKey } from './ai_key_vault.js';
import { secretFingerprint, withRequestCache } from './request_cache.js';

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly'
];

interface GoogleTokenPayload {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GoogleResourceList {
  analytics_properties: Array<{ id: string; name: string; account: string }>;
  search_console_sites: Array<{ site_url: string; permission_level: string }>;
  analytics_error?: string;
  search_console_error?: string;
}

function oauthConfig() {
  return {
    clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.GOOGLE_DATA_REDIRECT_URI || '').trim()
  };
}

export function googleDataOAuthConfigured(): boolean {
  const config = oauthConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

export function createGoogleDataAuthorizationUrl(userId: number): string {
  const config = oauthConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error('Google Analytics and Search Console OAuth are not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_DATA_REDIRECT_URI on the server.');
  }

  const state = randomBytes(32).toString('hex');
  const stateHash = createHash('sha256').update(state).digest('hex');
  db.createGoogleOAuthState(stateHash, userId, new Date(Date.now() + 10 * 60_000).toISOString());

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  }).toString();
  return authUrl.toString();
}

async function jsonRequest<T>(url: string, init: RequestInit, label: string): Promise<T> {
  const response = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(18_000) });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    const apiMessage = String(payload?.error?.message || payload?.error_description || payload?.error || '');
    if (response.status === 401) throw new Error(`${label}: Google rejected the access token. Reconnect the Google account in Settings.`);
    if (response.status === 403) throw new Error(`${label}: Google denied access. Confirm that the selected Google account can access this property and the required API is enabled.`);
    throw new Error(`${label}: Google returned HTTP ${response.status}${apiMessage ? ` — ${apiMessage.slice(0, 180)}` : ''}.`);
  }
  return payload as T;
}

function decryptToken(connection: GoogleDataConnectionEntity, kind: 'access' | 'refresh'): string {
  if (kind === 'access') {
    return decryptProviderKey({
      encrypted_key: connection.access_token_encrypted,
      iv: connection.access_token_iv,
      auth_tag: connection.access_token_tag
    });
  }
  return decryptProviderKey({
    encrypted_key: connection.refresh_token_encrypted,
    iv: connection.refresh_token_iv,
    auth_tag: connection.refresh_token_tag
  });
}

function encryptedFields(value: string) {
  const encrypted = encryptProviderKey(value);
  return { encrypted: encrypted.encrypted_key, iv: encrypted.iv, tag: encrypted.auth_tag };
}

async function fetchGoogleEmail(accessToken: string, userId: number): Promise<string> {
  try {
    const profile = await withRequestCache<{ email?: string }>(
      'google-data:userinfo',
      { userId, token: secretFingerprint(accessToken) },
      () => jsonRequest('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
      }, 'Google account profile'),
      { ttlSeconds: 900, maxEntries: 500 }
    );
    return String(profile.email || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export async function completeGoogleDataOAuth(code: string, state: string): Promise<number> {
  const cleanCode = String(code || '').trim();
  const cleanState = String(state || '').trim();
  if (!cleanCode || cleanCode.length > 4096 || !/^[a-f0-9]{64}$/i.test(cleanState)) {
    throw new Error('Google returned an invalid authorization response. Start the connection again.');
  }

  const stateHash = createHash('sha256').update(cleanState).digest('hex');
  const savedState = db.consumeGoogleOAuthState(stateHash);
  if (!savedState || new Date(savedState.expires_at).getTime() <= Date.now()) {
    throw new Error('The Google connection request expired or was already used. Start the connection again.');
  }

  const config = oauthConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error('Google OAuth is not configured on the server.');
  }

  const tokenPayload = await withRequestCache<GoogleTokenPayload>(
    'google-data:oauth-code-exchange',
    { userId: savedState.user_id, code: secretFingerprint(cleanCode), clientId: config.clientId },
    () => jsonRequest<GoogleTokenPayload>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code: cleanCode,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
      })
    }, 'Google OAuth token exchange'),
    { ttlSeconds: 0, maxEntries: 100 }
  );

  if (!tokenPayload.access_token) throw new Error('Google did not return an access token. Check OAuth consent and redirect URI settings.');
  const existing = db.getGoogleDataConnection(savedState.user_id);
  let refreshToken = tokenPayload.refresh_token || '';
  if (!refreshToken && existing) {
    try { refreshToken = decryptToken(existing, 'refresh'); } catch { /* Reconnect with consent if the old refresh token cannot be decrypted. */ }
  }
  if (!refreshToken) throw new Error('Google did not issue offline access. Remove CROX from your Google account permissions, then connect again and approve offline access.');

  const access = encryptedFields(tokenPayload.access_token);
  const refresh = encryptedFields(refreshToken);
  const now = new Date().toISOString();
  const email = await fetchGoogleEmail(tokenPayload.access_token, savedState.user_id);
  db.saveGoogleDataConnection({
    user_id: savedState.user_id,
    google_email: email || existing?.google_email || '',
    access_token_encrypted: access.encrypted,
    access_token_iv: access.iv,
    access_token_tag: access.tag,
    refresh_token_encrypted: refresh.encrypted,
    refresh_token_iv: refresh.iv,
    refresh_token_tag: refresh.tag,
    expires_at: new Date(Date.now() + Math.max(60, Number(tokenPayload.expires_in || 3600)) * 1000).toISOString(),
    scopes: String(tokenPayload.scope || GOOGLE_SCOPES.join(' ')),
    connected_at: existing?.connected_at || now,
    updated_at: now
  });
  return savedState.user_id;
}

async function getAccessToken(userId: number): Promise<string> {
  const connection = db.getGoogleDataConnection(userId);
  if (!connection) throw new Error('Connect a Google account in Settings before requesting Google Analytics or Search Console data.');

  if (new Date(connection.expires_at).getTime() > Date.now() + 60_000) {
    return decryptToken(connection, 'access');
  }

  const refreshToken = decryptToken(connection, 'refresh');
  const config = oauthConfig();
  if (!config.clientId || !config.clientSecret) throw new Error('Google OAuth credentials are not configured on the CROX server.');

  const payload = await withRequestCache<GoogleTokenPayload>(
    'google-data:token-refresh',
    { userId, refresh: secretFingerprint(refreshToken), clientId: config.clientId },
    () => jsonRequest<GoogleTokenPayload>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    }, 'Google token refresh'),
    { ttlSeconds: 0, maxEntries: 100 }
  );
  if (!payload.access_token) throw new Error('Google could not refresh the connection. Reconnect the account in Settings.');

  const access = encryptedFields(payload.access_token);
  db.updateGoogleDataAccessToken(userId, {
    encrypted: access.encrypted,
    iv: access.iv,
    tag: access.tag,
    expiresAt: new Date(Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000).toISOString()
  });
  return payload.access_token;
}

async function googleApi<T>(userId: number, url: string, body?: unknown, cacheNamespace = 'google-data:api', ttlSeconds = 300): Promise<T> {
  const accessToken = await getAccessToken(userId);
  const method = body === undefined ? 'GET' : 'POST';
  return withRequestCache<T>(
    cacheNamespace,
    { userId, url, method, body: body ?? null, token: secretFingerprint(accessToken) },
    () => jsonRequest<T>(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }, 'Google data request'),
    { ttlSeconds, maxEntries: 1200 }
  );
}

export function getGoogleDataConnectionStatus(userId: number) {
  const connection = db.getGoogleDataConnection(userId);
  return {
    oauth_configured: googleDataOAuthConfigured(),
    connected: Boolean(connection),
    google_email: connection?.google_email || null,
    connected_at: connection?.connected_at || null
  };
}

export async function listGoogleDataResources(userId: number): Promise<GoogleResourceList> {
  if (!db.getGoogleDataConnection(userId)) throw new Error('Connect your Google account before loading available properties.');
  const [analyticsResult, searchConsoleResult] = await Promise.allSettled([
    googleApi<any>(userId, 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', undefined, 'google-data:analytics-properties', 600),
    googleApi<any>(userId, 'https://www.googleapis.com/webmasters/v3/sites', undefined, 'google-data:search-console-sites', 600)
  ]);

  const analyticsProperties: GoogleResourceList['analytics_properties'] = [];
  if (analyticsResult.status === 'fulfilled') {
    const accounts = Array.isArray(analyticsResult.value?.accountSummaries) ? analyticsResult.value.accountSummaries : [];
    for (const account of accounts) {
      const props = Array.isArray(account?.propertySummaries) ? account.propertySummaries : [];
      for (const property of props) {
        const fullName = String(property?.property || '');
        const id = fullName.replace(/^properties\//, '');
        if (/^\d+$/.test(id)) analyticsProperties.push({ id, name: String(property?.displayName || `GA4 property ${id}`), account: String(account?.displayName || '') });
      }
    }
  }

  const searchConsoleSites: GoogleResourceList['search_console_sites'] = [];
  if (searchConsoleResult.status === 'fulfilled') {
    const sites = Array.isArray(searchConsoleResult.value?.siteEntry) ? searchConsoleResult.value.siteEntry : [];
    for (const site of sites) {
      if (site?.siteUrl) searchConsoleSites.push({ site_url: String(site.siteUrl), permission_level: String(site.permissionLevel || 'unknown') });
    }
  }

  if (analyticsResult.status === 'rejected' && searchConsoleResult.status === 'rejected') {
    throw new Error('Google connected, but neither Analytics nor Search Console properties could be loaded. Enable the required Google APIs and confirm this account has property access.');
  }
  return {
    analytics_properties: analyticsProperties,
    search_console_sites: searchConsoleSites,
    ...(analyticsResult.status === 'rejected' ? { analytics_error: analyticsResult.reason instanceof Error ? analyticsResult.reason.message : 'Google Analytics properties could not be loaded.' } : {}),
    ...(searchConsoleResult.status === 'rejected' ? { search_console_error: searchConsoleResult.reason instanceof Error ? searchConsoleResult.reason.message : 'Search Console sites could not be loaded.' } : {})
  };
}

export function saveGoogleDataSelection(input: {
  userId: number;
  projectId: string;
  gaPropertyId: string | null;
  gaPropertyName: string | null;
  gscSiteUrl: string | null;
}) {
  return db.saveGoogleDataPropertySelection({
    user_id: input.userId,
    project_id: input.projectId,
    ga_property_id: input.gaPropertyId,
    ga_property_name: input.gaPropertyName,
    gsc_site_url: input.gscSiteUrl,
    updated_at: new Date().toISOString()
  });
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function gaDate(value: string): string {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getAnalyticsReport(userId: number, propertyId: string, days: number) {
  const startDate = `${days}daysAgo`;
  const endDate = 'yesterday';
  const dimensionFilter = { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } };
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const [summary, trendPayload] = await Promise.all([
    googleApi<any>(userId, endpoint, {
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      dimensionFilter
    }, 'google-data:ga4-summary', 600),
    googleApi<any>(userId, endpoint, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      dimensionFilter,
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: 100
    }, 'google-data:ga4-dashboard', 600)
  ]);
  const summaryValues = summary?.rows?.[0]?.metricValues || [];
  const rows = Array.isArray(trendPayload?.rows) ? trendPayload.rows : [];
  const trend = rows.map((row: any) => ({
    date: gaDate(String(row?.dimensionValues?.[0]?.value || '')),
    sessions: numeric(row?.metricValues?.[0]?.value),
    active_users: numeric(row?.metricValues?.[1]?.value),
    page_views: numeric(row?.metricValues?.[2]?.value)
  })).filter((row: any) => row.date);
  return {
    status: 'connected',
    property_id: propertyId,
    sessions: summaryValues.length ? numeric(summaryValues[0]?.value) : 0,
    active_users: summaryValues.length ? numeric(summaryValues[1]?.value) : 0,
    page_views: summaryValues.length ? numeric(summaryValues[2]?.value) : 0,
    trend
  };
}

async function getSearchConsoleReport(userId: number, siteUrl: string, days: number) {
  // Search Console data can lag by a few days. The API returns only available top rows.
  const startDate = dateDaysAgo(days + 3);
  const endDate = dateDaysAgo(3);
  const baseUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const [summary, trend, queries] = await Promise.all([
    googleApi<any>(userId, baseUrl, { startDate, endDate, rowLimit: 1 }, 'google-data:gsc-summary', 600),
    googleApi<any>(userId, baseUrl, { startDate, endDate, dimensions: ['date'], rowLimit: 1000 }, 'google-data:gsc-date-trend', 600),
    googleApi<any>(userId, baseUrl, { startDate, endDate, dimensions: ['query'], rowLimit: 25 }, 'google-data:gsc-top-queries', 600)
  ]);
  const totals = Array.isArray(summary?.rows) ? summary.rows[0] : null;
  const trendRows = Array.isArray(trend?.rows) ? trend.rows : [];
  const queryRows = Array.isArray(queries?.rows) ? queries.rows : [];
  return {
    status: 'connected',
    site_url: siteUrl,
    clicks: totals ? numeric(totals.clicks) : 0,
    impressions: totals ? numeric(totals.impressions) : 0,
    ctr: totals ? numeric(totals.ctr) : 0,
    average_position: totals ? numeric(totals.position) : 0,
    trend: trendRows.map((row: any) => ({
      date: String(row?.keys?.[0] || ''),
      clicks: numeric(row?.clicks),
      impressions: numeric(row?.impressions),
      ctr: numeric(row?.ctr),
      position: numeric(row?.position)
    })).sort((a: any, b: any) => a.date.localeCompare(b.date)),
    top_queries: queryRows.map((row: any) => ({
      query: String(row?.keys?.[0] || ''),
      clicks: numeric(row?.clicks),
      impressions: numeric(row?.impressions),
      ctr: numeric(row?.ctr),
      position: numeric(row?.position)
    }))
  };
}

export async function getGoogleDataDashboard(userId: number, projectId: string, days = 30) {
  const connection = db.getGoogleDataConnection(userId);
  if (!connection) {
    return {
      status: 'not_connected',
      sampled_at: new Date().toISOString(),
      google_analytics: { status: 'not_connected', sessions: null, active_users: null, page_views: null, trend: [] },
      search_console: { status: 'not_connected', clicks: null, impressions: null, ctr: null, average_position: null, trend: [], top_queries: [] },
      note: 'Connect a Google account with Analytics and Search Console read access to display live performance data.'
    };
  }
  const selection = db.getGoogleDataPropertySelection(userId, projectId);
  if (!selection) {
    return {
      status: 'property_not_selected',
      sampled_at: new Date().toISOString(),
      google_analytics: { status: 'property_not_selected', sessions: null, active_users: null, page_views: null, trend: [] },
      search_console: { status: 'property_not_selected', clicks: null, impressions: null, ctr: null, average_position: null, trend: [], top_queries: [] },
      note: 'Choose the matching Google Analytics 4 property and Search Console site for this CROX project in Settings.'
    };
  }

  const safeDays = Math.min(90, Math.max(7, Math.floor(days || 30)));
  const [analytics, searchConsole] = await Promise.allSettled([
    selection.ga_property_id ? getAnalyticsReport(userId, selection.ga_property_id, safeDays) : Promise.resolve({ status: 'not_selected', property_id: null, sessions: null, active_users: null, page_views: null, trend: [] }),
    selection.gsc_site_url ? getSearchConsoleReport(userId, selection.gsc_site_url, safeDays) : Promise.resolve({ status: 'not_selected', site_url: null, clicks: null, impressions: null, ctr: null, average_position: null, trend: [], top_queries: [] })
  ]);

  const analyticsValue = analytics.status === 'fulfilled' ? analytics.value : {
    status: 'unavailable', sessions: null, active_users: null, page_views: null, trend: [], error: analytics.reason instanceof Error ? analytics.reason.message : 'Google Analytics data is unavailable.'
  };
  const searchConsoleValue = searchConsole.status === 'fulfilled' ? searchConsole.value : {
    status: 'unavailable', clicks: null, impressions: null, ctr: null, average_position: null, trend: [], top_queries: [], error: searchConsole.reason instanceof Error ? searchConsole.reason.message : 'Search Console data is unavailable.'
  };
  return {
    status: analyticsValue.status === 'connected' || searchConsoleValue.status === 'connected' ? 'connected' : 'unavailable',
    sampled_at: new Date().toISOString(),
    days: safeDays,
    google_analytics: analyticsValue,
    search_console: searchConsoleValue,
    note: 'These are Google-reported measurements for the selected property and date window. Search Console rows are subject to Google’s reporting limits and data delay.'
  };
}

export function disconnectGoogleData(userId: number): void {
  db.deleteGoogleDataConnection(userId);
}
