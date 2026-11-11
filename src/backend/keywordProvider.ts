import { AIService } from './ai_service.js';
import { KeywordIntelligenceService, KeywordResult } from './keywords.js';
import { secretFingerprint, withRequestCache } from './request_cache.js';

export interface KeywordRow {
  keyword: string;
  intent: KeywordResult['intent'];
  difficulty: number;
  difficulty_label: 'Easy' | 'Medium' | 'Hard';
  difficulty_source: 'estimate' | 'provider';
  volume: number | null;
  volume_label: 'estimate' | 'provider' | 'unavailable';
  cpc: number | null;
  cpc_label: 'estimate' | 'provider' | 'unavailable';
  trend: number | null;
  cluster: string;
  source: string;
}

export interface KeywordResearchInput {
  seed: string;
  country: string;
  city?: string;
  language: string;
  niche: string;
  website?: string;
  goal: string;
  use_ai?: boolean;
  limit?: number;
}

export interface KeywordBuckets {
  target: KeywordRow[];
  avoid: Array<KeywordRow & { reason: string }>;
  quick_wins: KeywordRow[];
}

const COUNTRY_GL: Record<string, string> = {
  PK: 'pk', US: 'us', GB: 'gb', AE: 'ae', IN: 'in', CA: 'ca', AU: 'au', DE: 'de', SA: 'sa', FR: 'fr'
};
const COUNTRY_NAMES: Record<string, string> = {
  PK: 'Pakistan', US: 'United States', GB: 'United Kingdom', AE: 'United Arab Emirates', IN: 'India',
  CA: 'Canada', AU: 'Australia', DE: 'Germany', SA: 'Saudi Arabia', FR: 'France'
};

function difficultyLabel(score: number): KeywordRow['difficulty_label'] {
  return score < 36 ? 'Easy' : score < 66 ? 'Medium' : 'Hard';
}

function estimateVolume(keyword: string, difficulty: number): number {
  const words = keyword.trim().split(/\s+/).length;
  const base = words >= 5 ? 180 : words === 4 ? 420 : words === 3 ? 1400 : words === 2 ? 5400 : 18000;
  return Math.max(40, Math.round(base * (1 - difficulty / 220)));
}

function estimateCpc(intent: KeywordRow['intent'], difficulty: number): number {
  const base = intent === 'Transactional' ? 1.8 : intent === 'Commercial' ? 1.1 : intent === 'Navigational' ? 0.4 : 0.35;
  return Number((base + difficulty / 90).toFixed(2));
}

function generatedFallbackRow(keyword: string, source: string): KeywordRow {
  const generated = KeywordIntelligenceService.generateKeywords(keyword)[0];
  const difficulty = generated?.difficulty_score ?? 45;
  const intent = generated?.intent ?? 'Informational';
  return {
    keyword,
    intent,
    difficulty,
    difficulty_label: difficultyLabel(difficulty),
    difficulty_source: 'estimate',
    volume: estimateVolume(keyword, difficulty),
    volume_label: 'estimate',
    cpc: estimateCpc(intent, difficulty),
    cpc_label: 'estimate',
    trend: null,
    cluster: generated?.cluster || 'Generated keyword ideas',
    source
  };
}

async function googleAutocomplete(seed: string, country: string, language: string): Promise<string[]> {
  const gl = COUNTRY_GL[country.toUpperCase()] || country.slice(0, 2).toLowerCase();
  const hl = language.slice(0, 2).toLowerCase() || 'en';
  try {
    return await withRequestCache<string[]>(
      'google-autocomplete',
      { seed, country: gl, language: hl },
      async () => {
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(7000),
          headers: { 'User-Agent': 'CROX-KeywordProvider/2.0', Accept: 'application/json' }
        });
        if (!res.ok) throw new Error(`Google autocomplete returned HTTP ${res.status}.`);
        const data = await res.json();
        const list = Array.isArray(data?.[1]) ? data[1] : [];
        return list.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 20);
      },
      { ttlSeconds: 1800, maxEntries: 1000 }
    );
  } catch {
    return [];
  }
}

interface LabsKeywordItem {
  keyword?: string;
  keyword_info?: { search_volume?: number; cpc?: number; search_volume_trend?: { monthly?: number }; competition_level?: string };
  keyword_properties?: { keyword_difficulty?: number };
  keyword_difficulty?: number;
}

async function dataForSeoLabSuggestions(input: KeywordResearchInput, limit: number): Promise<KeywordRow[]> {
  const login = (process.env.DATAFORSEO_LOGIN || '').trim();
  const password = (process.env.DATAFORSEO_PASSWORD || '').trim();
  if (!login || !password || input.seed.trim().length < 3) return [];

  const auth = Buffer.from(`${login}:${password}`).toString('base64');
  const countryName = COUNTRY_NAMES[input.country.toUpperCase()];
  const locationName = input.country.toUpperCase() === 'GLOBAL'
    ? undefined
    : input.city?.trim() && countryName ? `${input.city.trim()}, ${countryName}` : countryName;
  const languageName = input.language.trim() || 'English';
  try {
    return await withRequestCache(
      'dataforseo:labs:google-keyword-suggestions',
      {
        seed: input.seed.trim().toLowerCase(), country: input.country.toUpperCase(), city: input.city || '',
        language: languageName, limit, credential: secretFingerprint(`${login}:${password}`)
      },
      async () => {
        const task: Record<string, unknown> = {
          keyword: input.seed.trim(),
          language_name: languageName,
          include_seed_keyword: true,
          exact_match: false,
          limit,
          order_by: ['keyword_info.search_volume,desc']
        };
        if (locationName) task.location_name = locationName;
        const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live', {
          method: 'POST',
          signal: AbortSignal.timeout(25_000),
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify([task])
        });
        if (!response.ok) throw new Error(`DataForSEO Labs returned HTTP ${response.status}.`);
        const payload: any = await response.json().catch(() => null);
        const taskResult = payload?.tasks?.[0];
        if (taskResult?.status_code && Number(taskResult.status_code) >= 40000) {
          throw new Error(String(taskResult.status_message || 'DataForSEO Labs rejected the keyword request.'));
        }
        const items: LabsKeywordItem[] = Array.isArray(taskResult?.result?.[0]?.items) ? taskResult.result[0].items : [];
        return items.slice(0, limit).map(item => {
          const keyword = String(item.keyword || '').trim();
          const generated = KeywordIntelligenceService.generateKeywords(keyword)[0];
          const providerDifficulty = Number(item.keyword_properties?.keyword_difficulty ?? item.keyword_difficulty);
          const hasProviderDifficulty = Number.isFinite(providerDifficulty) && providerDifficulty >= 0 && providerDifficulty <= 100;
          const volume = Number(item.keyword_info?.search_volume);
          const cpc = Number(item.keyword_info?.cpc);
          const trend = Number(item.keyword_info?.search_volume_trend?.monthly);
          const difficulty = hasProviderDifficulty ? providerDifficulty : (generated?.difficulty_score ?? 45);
          return {
            keyword,
            intent: generated?.intent ?? 'Informational',
            difficulty,
            difficulty_label: difficultyLabel(difficulty),
            difficulty_source: hasProviderDifficulty ? 'provider' : 'estimate',
            volume: Number.isFinite(volume) ? volume : null,
            volume_label: Number.isFinite(volume) ? 'provider' : 'unavailable',
            cpc: Number.isFinite(cpc) ? Number(cpc.toFixed(2)) : null,
            cpc_label: Number.isFinite(cpc) ? 'provider' : 'unavailable',
            trend: Number.isFinite(trend) ? trend : null,
            cluster: generated?.cluster || 'DataForSEO suggestions',
            source: 'dataforseo_labs'
          } satisfies KeywordRow;
        }).filter(row => row.keyword);
      },
      { ttlSeconds: 1800, maxEntries: 500 }
    );
  } catch (err: any) {
    console.warn('[CROX Keywords] DataForSEO Labs request failed:', String(err?.message || 'unknown error').slice(0, 220));
    return [];
  }
}

function buildLocalIdeas(seed: string, autocomplete: string[], limit: number): KeywordRow[] {
  const unique = new Map<string, KeywordRow>();
  const push = (term: string, source: string) => {
    const clean = term.trim().replace(/\s+/g, ' ');
    const key = clean.toLowerCase();
    if (!clean || clean.length > 110 || unique.has(key)) return;
    unique.set(key, generatedFallbackRow(clean, source));
  };
  push(seed, 'seed');
  autocomplete.forEach(term => push(term, 'google_autocomplete'));
  KeywordIntelligenceService.generateKeywords(seed).forEach(item => push(item.keyword, 'seed_expansion'));

  const prefixes = ['best', 'top', 'affordable', 'professional', 'local', 'online', 'small business', 'for beginners', 'for ecommerce', 'for startups', 'near me'];
  const suffixes = ['services', 'company', 'agency', 'software', 'tools', 'platform', 'pricing', 'cost', 'reviews', 'alternatives', 'guide', 'checklist', 'for small businesses', 'in 2026', 'in Pakistan'];
  prefixes.forEach(prefix => push(`${prefix} ${seed}`, 'pattern_expansion'));
  suffixes.forEach(suffix => push(`${seed} ${suffix}`, 'pattern_expansion'));
  ['how to choose', 'how to use', 'what is', 'benefits of', 'types of'].forEach(prefix => push(`${prefix} ${seed}`, 'pattern_expansion'));

  return [...unique.values()].slice(0, limit);
}

function bucketize(rows: KeywordRow[], goal: string): KeywordBuckets {
  const unique = new Map<string, KeywordRow>();
  for (const row of rows) {
    const key = row.keyword.toLowerCase();
    if (!unique.has(key)) unique.set(key, row);
  }
  const all = [...unique.values()];
  const avoid: Array<KeywordRow & { reason: string }> = [];
  const rest: KeywordRow[] = [];
  for (const row of all) {
    if (row.difficulty >= 78 && (row.volume || 0) > 8000) {
      avoid.push({ ...row, reason: 'Very competitive head term — better as a supporting mention than a primary page target.' });
    } else if (row.intent === 'Navigational' && !/brand|login|official/i.test(goal)) {
      avoid.push({ ...row, reason: 'Navigational query is likely to send people to an existing brand destination, not a new page.' });
    } else {
      rest.push(row);
    }
  }
  const quick = rest
    .filter(row => row.difficulty_source === 'provider' && row.difficulty <= 40 && (row.intent === 'Informational' || row.intent === 'Commercial'))
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 12);
  const quickSet = new Set(quick.map(row => row.keyword));
  const target = rest.filter(row => !quickSet.has(row.keyword)).slice(0, 1000);
  return { target, avoid: avoid.slice(0, 50), quick_wins: quick };
}

export async function researchKeywords(input: KeywordResearchInput, userId?: number): Promise<{
  provider: 'dataforseo' | 'google_autocomplete+estimates';
  provider_status: string;
  rows: KeywordRow[];
  buckets: KeywordBuckets;
  briefing: { country: string; city?: string; language: string; niche: string; website?: string; goal: string };
}> {
  const seed = input.seed.trim();
  const limit = Math.min(250, Math.max(25, Math.floor(Number(input.limit) || 100)));
  const location = [input.city, input.country].filter(Boolean).join(', ');
  const liveRows = await dataForSeoLabSuggestions(input, limit);

  if (liveRows.length > 0) {
    const rows = liveRows;
    const buckets = bucketize(rows, input.goal);
    return {
      provider: 'dataforseo',
      provider_status: `DataForSEO Labs returned ${rows.length} live keyword suggestions for this seed and market. Search volume, CPC and monthly trend are provider values where available; missing SEO difficulty remains labelled as an estimate. DataForSEO charges per request.`,
      rows,
      buckets,
      briefing: { country: input.country, city: input.city, language: input.language, niche: input.niche, website: input.website, goal: input.goal }
    };
  }

  const suggestions = await googleAutocomplete(seed, input.country, input.language);
  const strategy = input.use_ai
    ? await AIService.generateKeywordStrategy(seed, `${input.niche}${input.city ? ` in ${input.city}` : ''}`, location || input.country, userId)
    : {
        keywords: KeywordIntelligenceService.generateKeywords(seed),
        ai_mode: 'heuristic' as const,
        provider_status: 'Rule-based keyword expansion and Google autocomplete. No AI provider was called for this keyword lookup.'
      };
  const rowsByKeyword = new Map(buildLocalIdeas(seed, suggestions, limit).map(row => [row.keyword.toLowerCase(), row]));
  for (const item of strategy.keywords) {
    const key = item.keyword.toLowerCase();
    if (!rowsByKeyword.has(key)) rowsByKeyword.set(key, generatedFallbackRow(item.keyword, item.source));
  }
  const rows = [...rowsByKeyword.values()].slice(0, limit);
  return {
    provider: 'google_autocomplete+estimates',
    provider_status: `${strategy.provider_status} Returned ${rows.length} keyword ideas from autocomplete and explicit pattern expansion. Search volume, CPC and difficulty are heuristic estimates; historical trends and live provider metrics are unavailable until DataForSEO Labs is configured.`,
    rows,
    buckets: bucketize(rows, input.goal),
    briefing: { country: input.country, city: input.city, language: input.language, niche: input.niche, website: input.website, goal: input.goal }
  };
}

export function dataForSeoConfigured(): boolean {
  return Boolean(String(process.env.DATAFORSEO_LOGIN || '').trim() && String(process.env.DATAFORSEO_PASSWORD || '').trim());
}
