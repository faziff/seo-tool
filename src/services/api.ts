import { ScanReport, ScanProgress, RecentScanItem, Issue, User, FixDraft, CreditSnapshot, Project } from '../types';

const TOKEN_KEY = 'crox_auth_token';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function removeStoredToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

// ==========================================
// AUTHENTICATION CLIENT
// ==========================================

type AuthApiResponse = { access_token: string; user: User };

/** Parse API responses defensively: a static-hosting 404 often returns index.html,
 * which otherwise shows an unhelpful JSON parse error on the sign-in screen. */
async function readAuthResponse(res: Response, action: 'sign-in' | 'account creation'): Promise<AuthApiResponse> {
  const contentType = res.headers.get('content-type') || '';
  let payload: any;
  if (contentType.includes('application/json')) {
    payload = await res.json().catch(() => null);
  } else {
    // Consume the body so the connection can be reused; do not expose HTML to the user.
    await res.text().catch(() => '');
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error('CROX could not reach its account service. The website frontend is open, but its /api backend is not responding. Start the full-stack server with `npm run dev`, or deploy the Node.js server alongside the built website.');
    }
  }

  if (!res.ok) {
    throw new Error(payload?.detail || payload?.message || `${action === 'sign-in' ? 'Sign-in' : 'Account creation'} failed (HTTP ${res.status}).`);
  }
  if (!payload?.access_token || !payload?.user?.email) {
    throw new Error('The CROX account service returned an incomplete response. Check that the latest backend version is running.');
  }
  return payload as AuthApiResponse;
}

async function authRequest(path: string, body: Record<string, string>, action: 'sign-in' | 'account creation'): Promise<AuthApiResponse> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('CROX account service is unreachable. Run the full-stack app with `npm run dev`; opening the frontend by itself will not save accounts or sign users in.');
  }
  return readAuthResponse(res, action);
}

export async function registerUser(name: string, email: string, password: string, confirmPassword: string): Promise<AuthApiResponse> {
  const data = await authRequest('/api/auth/register', {
    name: name.trim(), email: email.trim().toLowerCase(), password, confirm_password: confirmPassword
  }, 'account creation');
  setStoredToken(data.access_token);
  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthApiResponse> {
  const data = await authRequest('/api/auth/login', { email: email.trim().toLowerCase(), password }, 'sign-in');
  setStoredToken(data.access_token);
  return data;
}

export async function checkAccountService(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { headers: { Accept: 'application/json' } });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) return false;
    const data = await res.json();
    return data?.status === 'healthy';
  } catch {
    return false;
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      removeStoredToken();
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchCreditSnapshot(): Promise<CreditSnapshot> {
  const res = await fetch('/api/credits', { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Could not load usage credits.');
  return data as CreditSnapshot;
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() });
  } catch {}
  removeStoredToken();
}

export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<{ status: string; message: string }> {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Password update failed.' }));
    throw new Error(err.detail || 'Password update failed');
  }
  return res.json();
}

// ==========================================
// PROJECTS
// ==========================================

export async function listProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects', { headers: getAuthHeaders() });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error(data?.detail || 'Could not load projects.');
  return Array.isArray(data) ? data as Project[] : [];
}

export async function createProject(input: { name: string; target_url: string; country?: string }): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || 'Could not create this project.');
  return data as Project;
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE', headers: getAuthHeaders()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || 'Could not delete this project.');
}

// ==========================================
// SCANS & CRAWLER CLIENT
// ==========================================

export async function startScan(url: string, maxPages: number = 50): Promise<ScanProgress> {
  const res = await fetch('/api/scans', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ url, max_pages: maxPages })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to initiate website scan.' }));
    throw new Error(err.detail || 'Failed to start scan');
  }
  return res.json();
}

export async function getScanStatus(scanId: string): Promise<ScanProgress> {
  const res = await fetch(`/api/scans/${scanId}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to retrieve scan status');
  return res.json();
}

export async function getScanReport(scanId: string): Promise<ScanReport> {
  const res = await fetch(`/api/scans/${scanId}/report`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to load full scan report');
  return res.json();
}

export async function listRecentScans(): Promise<RecentScanItem[]> {
  try {
    const res = await fetch('/api/scans?limit=10', {
      headers: getAuthHeaders()
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function deleteScan(scanId: string): Promise<void> {
  const res = await fetch(`/api/scans/${scanId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete scan');
}

// ==========================================
// ISSUES & ACTIONS
// ==========================================

export async function updateIssueStatus(issueId: string, resolved: boolean): Promise<any> {
  const res = await fetch(`/api/issues/${issueId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ resolved })
  });
  return res.json();
}

export async function generateAIFix(issue: Issue): Promise<any> {
  const res = await fetch('/api/ai/fix', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      title: issue.title,
      category: issue.category,
      affected_url: issue.affected_url,
      evidence: issue.evidence,
      explanation: issue.explanation
    })
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(readApiError(payload, 'Could not generate this AI fix.'));
  window.dispatchEvent(new Event('crox:credits-refresh'));
  return payload;
}

function readApiError(payload: any, fallback: string): string {
  return typeof payload?.detail === 'string' ? payload.detail
    : typeof payload?.message === 'string' ? payload.message
    : fallback;
}

export async function getFixDrafts(scanId: string): Promise<FixDraft[]> {
  const res = await fetch(`/api/fixes?scan_id=${encodeURIComponent(scanId)}`, { headers: getAuthHeaders() });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(readApiError(payload, 'Could not load fix drafts.'));
  return Array.isArray(payload) ? payload as FixDraft[] : [];
}

export async function generateFixDrafts(scanId: string, maxItems = 15): Promise<{ fixes: FixDraft[]; generated_count: number; remaining_count: number; provider_mode: string; message: string }> {
  const res = await fetch('/api/fixes/generate', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ scan_id: scanId, max_items: maxItems })
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(readApiError(payload, 'Could not generate fix drafts.'));
  window.dispatchEvent(new Event('crox:credits-refresh'));
  return payload;
}

export async function updateFixDraft(id: string, updates: Partial<Pick<FixDraft, 'status' | 'code_snippet' | 'fix_explanation'>>): Promise<FixDraft> {
  const res = await fetch(`/api/fixes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(readApiError(payload, 'Could not save this fix draft.'));
  return payload as FixDraft;
}

export async function askCROXAI(message: string, scanId?: string): Promise<{ reply: string; suggestions?: string[] }> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message, scan_id: scanId })
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(readApiError(payload, 'Failed to communicate with NOVA AI'));
  }
  const payload = await res.json();
  window.dispatchEvent(new Event('crox:credits-refresh'));
  return payload;
}

export async function fetchPageSpeed(url: string, strategy: 'mobile' | 'desktop' = 'mobile'): Promise<any> {
  const res = await fetch(`/api/pagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}`, {
    headers: getAuthHeaders()
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(readApiError(payload, 'Could not complete the PageSpeed Insights request.'));
  }
  return payload;
}

export async function getIntegrationsStatus(): Promise<any> {
  const res = await fetch('/api/integrations/status', {
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function compareScans(baseScanId: string, compareScanId: string): Promise<any> {
  const res = await fetch('/api/scans/compare', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ base_scan_id: baseScanId, compare_scan_id: compareScanId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to compare scans.' }));
    throw new Error(err.detail || 'Failed to compare scans');
  }
  return res.json();
}

export async function getHealthStatus(): Promise<any> {
  const res = await fetch('/api/health');
  return res.json();
}

// ==========================================
// KEYWORD & COMPETITOR INTELLIGENCE
// ==========================================

export interface CROXKeywordIdea {
  keyword: string;
  intent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  difficulty_score: number;
  difficulty_label: 'Easy' | 'Medium' | 'Hard';
  cluster: string;
  source: 'seed_expansion' | 'page_content' | 'competitor_gap' | 'ai_generated';
  cpc_estimate_available: boolean;
  search_volume_provider_status: 'live' | 'provider_not_configured';
}

export interface KeywordStrategyResponse {
  seed_phrase: string;
  niche: string;
  market: string;
  total_keywords: number;
  keywords: CROXKeywordIdea[];
  ai_mode: 'gemini' | 'heuristic';
  provider_status: string;
}

export async function analyzeKeywords(seedPhrase: string, niche: string, market: string): Promise<KeywordStrategyResponse> {
  const res = await fetch('/api/keywords/analyze', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ seed_phrase: seedPhrase, niche, market })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Keyword research could not be completed.');
  window.dispatchEvent(new Event('crox:credits-refresh'));
  return data;
}

export interface CompetitorComparisonResponse {
  target_domain: string;
  competitor_domain: string;
  target: {
    domain: string;
    normalized_url?: string;
    available: boolean;
    status_code: number | null;
    response_time_ms: number | null;
    title: string | null;
    description: string | null;
    h1: string[];
    canonical: string | null;
    indexed_hints: string[];
    note: string;
  };
  competitor: {
    domain: string;
    normalized_url?: string;
    available: boolean;
    status_code: number | null;
    response_time_ms: number | null;
    title: string | null;
    description: string | null;
    h1: string[];
    canonical: string | null;
    indexed_hints: string[];
    note: string;
  };
  comparison_summary: string;
  gap_recommendations: string[];
  data_scope: string;
}

export async function compareCompetitorDomains(targetDomain: string, competitorDomain: string): Promise<CompetitorComparisonResponse> {
  const res = await fetch('/api/competitor/compare', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ target_domain: targetDomain, competitor_domain: competitorDomain })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Competitor analysis could not be completed.');
  return data;
}


export interface MarketBriefResponse {
  brief: string;
  ai_mode: 'gemini' | 'heuristic';
  note: string;
}

export async function generateMarketBrief(niche: string, market: string, goal: string): Promise<MarketBriefResponse> {
  const res = await fetch('/api/market/brief', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ niche, market, goal })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Market brief could not be generated.');
  window.dispatchEvent(new Event('crox:credits-refresh'));
  return data;
}
