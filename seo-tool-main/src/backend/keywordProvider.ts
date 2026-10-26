import { KeywordIntelligenceService, KeywordResult } from './keywords.js';
import { AIService } from './ai_service.js';

export interface KeywordRow {
  keyword: string;
  intent: KeywordResult['intent'];
  difficulty: number;
  difficulty_label: 'Easy' | 'Medium' | 'Hard';
  volume: number | null;
  volume_label: 'estimate' | 'provider';
  cpc: number | null;
  cpc_label: 'estimate' | 'provider';
  trend: 'up' | 'flat' | 'down';
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
}

export interface KeywordBuckets {
  target: KeywordRow[];
  avoid: Array<KeywordRow & { reason: string }>;
  quick_wins: KeywordRow[];
}

const COUNTRY_GL: Record<string, string> = {
  PK: 'pk', US: 'us', GB: 'gb', AE: 'ae', IN: 'in', CA: 'ca', AU: 'au', DE: 'de', SA: 'sa', FR: 'fr'
};

function difficultyLabel(score: number): KeywordRow['difficulty_label'] {
  return score < 36 ? 'Easy' : score < 66 ? 'Medium' : 'Hard';
}

function hashTrend(keyword: string): KeywordRow['trend'] {
  const n = keyword.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return n % 5 === 0 ? 'down' : n % 3 === 0 ? 'up' : 'flat';
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

async function googleAutocomplete(seed: string, country: string, language: string): Promise<string[]> {
  const gl = COUNTRY_GL[country.toUpperCase()] || country.slice(0, 2).toLowerCase();
  const hl = language.slice(0, 2).toLowerCase() || 'en';
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { 'User-Agent': 'CROX-KeywordProvider/1.0', Accept: 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.[1]) ? data[1] : [];
    return list.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 20);
  } catch {
    return [];
  }
}

async function dataForSeoVolumes(keywords: string[], locationName: string, language: string): Promise<Map<string, { volume: number; cpc: number; difficulty?: number }>> {
  const login = (process.env.DATAFORSEO_LOGIN || '').trim();
  const password = (process.env.DATAFORSEO_PASSWORD || '').trim();
  const map = new Map<string, { volume: number; cpc: number; difficulty?: number }>();
  if (!login || !password || keywords.length === 0) return map;

  const auth = Buffer.from(`${login}:${password}`).toString('base64');
  try {
    const res = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        keywords: keywords.slice(0, 20),
        location_name: locationName,
        language_name: language
      }])
    });
    const payload: any = await res.json().catch(() => null);
    const items = payload?.tasks?.[0]?.result || [];
    for (const item of items) {
      const key = String(item?.keyword || '').toLowerCase();
      if (!key) continue;
      map.set(key, {
        volume: Number(item.search_volume) || 0,
        cpc: Number(item.cpc) || 0
      });
    }
  } catch (err: any) {
    console.warn('[CROX Keywords] DataForSEO request failed:', err?.message || err);
  }
  return map;
}

function toRow(base: KeywordResult, live?: { volume: number; cpc: number }): KeywordRow {
  const volumeLive = live && Number.isFinite(live.volume);
  const cpcLive = live && Number.isFinite(live.cpc);
  return {
    keyword: base.keyword,
    intent: base.intent,
    difficulty: base.difficulty_score,
    difficulty_label: difficultyLabel(base.difficulty_score),
    volume: volumeLive ? live!.volume : estimateVolume(base.keyword, base.difficulty_score),
    volume_label: volumeLive ? 'provider' : 'estimate',
    cpc: cpcLive ? Number(live!.cpc.toFixed(2)) : estimateCpc(base.intent, base.difficulty_score),
    cpc_label: cpcLive ? 'provider' : 'estimate',
    trend: hashTrend(base.keyword),
    cluster: base.cluster,
    source: base.source
  };
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
    .filter(r => r.difficulty <= 40 && (r.intent === 'Informational' || r.intent === 'Commercial'))
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 8);
  const quickSet = new Set(quick.map(r => r.keyword));
  const target = rest.filter(r => !quickSet.has(r.keyword)).slice(0, 24);
  return { target, avoid: avoid.slice(0, 10), quick_wins: quick };
}

export async function researchKeywords(input: KeywordResearchInput): Promise<{
  provider: 'dataforseo' | 'google_autocomplete+estimates';
  provider_status: string;
  rows: KeywordRow[];
  buckets: KeywordBuckets;
  briefing: { country: string; city?: string; language: string; niche: string; website?: string; goal: string };
}> {
  const seed = input.seed.trim();
  const location = [input.city, input.country].filter(Boolean).join(', ');
  const suggestions = await googleAutocomplete(seed, input.country, input.language);
  const strategy = await AIService.generateKeywordStrategy(
    seed,
    `${input.niche}${input.city ? ` in ${input.city}` : ''}`,
    location || input.country
  );

  const mergedTerms = new Set<string>();
  const bases: KeywordResult[] = [];
  const pushTerm = (term: string, source: KeywordResult['source']) => {
    const keyword = term.trim();
    const key = keyword.toLowerCase();
    if (!keyword || mergedTerms.has(key)) return;
    mergedTerms.add(key);
    const generated = KeywordIntelligenceService.generateKeywords(keyword)[0];
    bases.push({
      ...(generated || {
        keyword,
        intent: 'Informational',
        difficulty_score: 45,
        difficulty_label: 'Medium',
        cluster: 'Suggestions',
        source,
        cpc_estimate_available: false,
        search_volume_provider_status: 'provider_not_configured'
      }),
      keyword,
      source
    });
  };

  pushTerm(seed, 'seed_expansion');
  suggestions.forEach(term => pushTerm(term, 'seed_expansion'));
  strategy.keywords.forEach(item => {
    const key = item.keyword.toLowerCase();
    if (mergedTerms.has(key)) return;
    mergedTerms.add(key);
    bases.push(item);
  });

  const liveConfigured = !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
  const live = liveConfigured
    ? await dataForSeoVolumes(bases.map(b => b.keyword), location || input.country, input.language)
    : new Map();

  const rows = bases.slice(0, 40).map(base => toRow(base, live.get(base.keyword.toLowerCase())));
  const buckets = bucketize(rows, input.goal);
  return {
    provider: liveConfigured && live.size ? 'dataforseo' : 'google_autocomplete+estimates',
    provider_status: liveConfigured && live.size
      ? 'Live search volume and CPC loaded from DataForSEO. Difficulty still includes modelled scores where the provider does not return KD.'
      : 'Suggestions from Google autocomplete plus CROX estimates. Volume and CPC are labelled estimate until DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are set.',
    rows,
    buckets,
    briefing: {
      country: input.country,
      city: input.city,
      language: input.language,
      niche: input.niche,
      website: input.website,
      goal: input.goal
    }
  };
}

export function dataForSeoConfigured(): boolean {
  return !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}
