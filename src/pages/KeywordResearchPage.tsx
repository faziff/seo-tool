import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownWideNarrow, ArrowRight, Check, ChevronDown, Clipboard, Download,
  Globe2, HelpCircle, Lightbulb, Search, SlidersHorizontal, Sparkles,
  Target, TrendingUp, Zap, WandSparkles, X, MessageCircle, Database
} from 'lucide-react';
import { askCROXAI, researchKeywordIdeas, type CROXKeywordResearchResponse, type CROXResearchKeywordRow } from '../services/api';
import { NovaOrb } from '../components/NovaOrb';

type SearchMode = 'auto' | 'keywords' | 'nova';
type ResolvedMode = 'keywords' | 'nova';
type IntentFilter = 'All intents' | 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';

const countries = [
  ['PK', 'Pakistan'], ['US', 'United States'], ['GB', 'United Kingdom'], ['AE', 'United Arab Emirates'],
  ['IN', 'India'], ['CA', 'Canada'], ['AU', 'Australia'], ['DE', 'Germany'], ['GLOBAL', 'Global']
];
const niches = ['General / not specified', 'SaaS & software', 'E-commerce & retail', 'Local business', 'Agency & professional services', 'Education & courses', 'Health & wellness', 'Food & hospitality', 'Finance & business', 'Travel & tourism', 'Content & media'];

function isDomainQuery(value: string): boolean {
  return /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:\/[^\s]*)?$/i.test(value.trim());
}

function inferSearchMode(value: string): ResolvedMode {
  const query = value.trim();
  const words = query.split(/\s+/).filter(Boolean).length;
  const assistantPatterns = /^(how|why|what|when|where|who|can you|could you|would you|help me|please|analyse|analyze|audit|explain|write|create|build|make|give me|recommend|compare|review|tell me|find out|investigate)\b/i;
  const intentPatterns = /\b(my website|my business|my brand|my competitors|my seo|my content|my rankings|my strategy|what should i|how can i|how do i|why is|what does|create a plan|make a strategy|explain this|analyze this|analyse this)\b/i;
  const romanUrduPatterns = /^(kya|kaise|kyun|kab|kahan|mujhe|mere liye|batao|samjhao)\b|\b(batao|samjhao|kar do|kardo|bana do|banado|check karo|meri website|mera business|mere liye|kaise karun|kya karun)\b/i;
  if (query.endsWith('?') && words >= 4) return 'nova';
  if ((assistantPatterns.test(query) || intentPatterns.test(query) || romanUrduPatterns.test(query)) && words >= 3) return 'nova';
  return 'keywords';
}

function domainDetails(value: string): { website?: string; seed: string } {
  if (!isDomainQuery(value)) return { seed: value.trim() };
  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, '');
    const brand = host.split('.').slice(0, -1).join(' ').replace(/[-_]/g, ' ').trim() || host;
    return { website: `${parsed.protocol}//${host}`, seed: brand };
  } catch {
    return { website: undefined, seed: value.trim() };
  }
}

function difficultyTone(value: number) {
  if (value <= 35) return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (value <= 65) return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-rose-100 bg-rose-50 text-rose-700';
}

function compactNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function currency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function intentTone(intent: string) {
  if (intent === 'Transactional') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (intent === 'Commercial') return 'border-violet-100 bg-violet-50 text-violet-700';
  if (intent === 'Navigational') return 'border-sky-100 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export const KeywordResearchPage: React.FC = () => {
  const [query, setQuery] = useState(() => {
    try {
      const pending = sessionStorage.getItem('crox_keyword_seed');
      if (pending) { sessionStorage.removeItem('crox_keyword_seed'); return pending.slice(0, 180); }
    } catch { /* Session storage can be blocked in private browsing. */ }
    return '';
  });
  const [pendingGlobalSearch, setPendingGlobalSearch] = useState<string | null>(() => query || null);
  const [mode, setMode] = useState<SearchMode>('auto');
  const [resolvedMode, setResolvedMode] = useState<ResolvedMode>('keywords');
  const [country, setCountry] = useState('US');
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState('English');
  const [niche, setNiche] = useState('General / not specified');
  const [website, setWebsite] = useState('');
  const [goal, setGoal] = useState('Grow qualified organic traffic');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<CROXKeywordResearchResponse | null>(null);
  const [novaReply, setNovaReply] = useState('');
  const [novaProvider, setNovaProvider] = useState('');
  const [intentFilter, setIntentFilter] = useState<IntentFilter>('All intents');
  const [difficultyMax, setDifficultyMax] = useState(100);
  const [longTailOnly, setLongTailOnly] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'difficulty' | 'volume' | 'cpc'>('relevance');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');

  const sourceRows = result?.rows || [];
  const filteredKeywords = useMemo(() => {
    let rows = sourceRows.filter(item =>
      (intentFilter === 'All intents' || item.intent === intentFilter) &&
      item.difficulty <= difficultyMax &&
      (!longTailOnly || item.keyword.trim().split(/\s+/).length >= 4) &&
      (!tableSearch || item.keyword.toLowerCase().includes(tableSearch.toLowerCase()))
    );
    if (sortBy === 'difficulty') rows = [...rows].sort((a, b) => a.difficulty - b.difficulty);
    if (sortBy === 'volume') rows = [...rows].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    if (sortBy === 'cpc') rows = [...rows].sort((a, b) => (b.cpc || 0) - (a.cpc || 0));
    return rows;
  }, [sourceRows, intentFilter, difficultyMax, longTailOnly, tableSearch, sortBy]);
  const pageCount = Math.max(1, Math.ceil(filteredKeywords.length / pageSize));
  const visibleKeywords = filteredKeywords.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (pendingGlobalSearch) {
      setPendingGlobalSearch(null);
      void runSearch(undefined, 'auto', pendingGlobalSearch);
    }
  }, [pendingGlobalSearch]);

  useEffect(() => {
    const handleGlobalKeywordSearch = (event: Event) => {
      const value = String((event as CustomEvent<{ query?: string }>).detail?.query || '').trim();
      if (!value) return;
      setQuery(value.slice(0, 180));
      setMode('auto');
      setPendingGlobalSearch(value.slice(0, 180));
    };
    window.addEventListener('crox:keyword-search', handleGlobalKeywordSearch);
    return () => window.removeEventListener('crox:keyword-search', handleGlobalKeywordSearch);
  }, []);

  useEffect(() => { setPage(1); }, [intentFilter, difficultyMax, longTailOnly, tableSearch, sortBy, pageSize, sourceRows.length]);

  const clusters = useMemo(() => {
    const counts = new Map<string, number>();
    sourceRows.forEach(item => counts.set(item.cluster, (counts.get(item.cluster) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [sourceRows]);

  const averageDifficulty = sourceRows.length
    ? Math.round(sourceRows.reduce((sum, row) => sum + row.difficulty, 0) / sourceRows.length)
    : null;
  const liveVolumeCount = sourceRows.filter(row => row.volume_label === 'provider').length;
  const liveCpcCount = sourceRows.filter(row => row.cpc_label === 'provider').length;

  const runSearch = async (event?: React.FormEvent, forcedMode?: SearchMode, queryOverride?: string) => {
    event?.preventDefault();
    setError(''); setToast('');
    const cleanQuery = String(queryOverride ?? query).trim();
    if (!cleanQuery) { setError('Enter a keyword, a question for NOVA, or a website domain.'); return; }
    const selectedMode = forcedMode || mode;
    const actualMode = selectedMode === 'auto' ? inferSearchMode(cleanQuery) : selectedMode;
    setResolvedMode(actualMode);
    setLoading(true);
    setPage(1);
    setResult(null);
    setNovaReply('');
    try {
      if (actualMode === 'nova') {
        const response = await askCROXAI(cleanQuery);
        setNovaReply(response.reply || 'NOVA did not return a response.');
        setNovaProvider('Automatic provider routing');
      } else {
        const domain = domainDetails(cleanQuery);
        const response = await researchKeywordIdeas({
          seed: domain.seed,
          country,
          city: city.trim() || undefined,
          language,
          niche,
          website: website.trim() || domain.website,
          goal,
          use_ai: false
        });
        setResult(response);
        setIntentFilter('All intents');
        setDifficultyMax(100);
        setLongTailOnly(false);
        setTableSearch('');
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const copyKeywords = async () => {
    try {
      await navigator.clipboard.writeText(filteredKeywords.map(item => item.keyword).join('\n'));
      setCopied(true); window.setTimeout(() => setCopied(false), 1600);
    } catch { setError('Clipboard access is blocked. Use the CSV export instead.'); }
  };

  const exportCsv = () => {
    const rows = [
      ['Keyword', 'Intent', 'Difficulty (estimated)', 'Difficulty score', 'Search volume', 'Volume source', 'CPC USD', 'CPC source', 'Topic cluster'],
      ...filteredKeywords.map(item => [item.keyword, item.intent, item.difficulty_label, String(item.difficulty), item.volume === null ? '' : String(item.volume), item.volume_label, item.cpc === null ? '' : String(item.cpc), item.cpc_label, item.cluster])
    ];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `crox-keyword-research-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  const copyOne = async (item: CROXResearchKeywordRow) => {
    try { await navigator.clipboard.writeText(item.keyword); setToast(`Copied “${item.keyword}”.`); }
    catch { setError('Clipboard access is blocked by this browser.'); }
  };

  const promptSuggestions = ['Find low-competition keyword opportunities for my niche', 'Explain which keyword intent I should target first', 'Create a 30-day SEO content plan from my keyword ideas'];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-indigo-600"><span className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-50"><Search size={13} /></span> CROX Intelligence / Keyword Research</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Find keywords worth winning.</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">One smart search for keywords, domains and NOVA questions. CROX chooses the right workflow automatically.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600"><Globe2 size={12} /> {countries.find(([code]) => code === country)?.[1] || 'Global market'}</span>
          <button type="button" onClick={() => { setQuery(''); setResult(null); setNovaReply(''); setError(''); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><X size={12} /> New search</button>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#11172B] text-cyan-200 shadow-sm"><NovaOrb size={30} /></div><div><h2 className="text-sm font-extrabold text-slate-900">Smart Search</h2><p className="mt-0.5 text-[10px] text-slate-500">Auto-detects keyword research vs. an assistant task</p></div></div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 p-1">
            {([{ id: 'auto', label: 'Auto', icon: Zap }, { id: 'keywords', label: 'Keywords', icon: Search }, { id: 'nova', label: 'Ask NOVA', icon: Sparkles }] as const).map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setMode(item.id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition ${mode === item.id ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><Icon size={12} />{item.label}</button>; })}
          </div>
        </div>
        <form onSubmit={runSearch} className="relative mt-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-[0_12px_40px_-28px_rgba(49,46,129,.5)] transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 sm:flex-row sm:items-center">
            <Search size={18} className="ml-2 hidden shrink-0 text-slate-400 sm:block" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Try: email marketing software · example.com · How can I improve my AEO?" aria-label="Keyword, domain or NOVA question" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:px-1" maxLength={8000} />
            <button type="submit" disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#11172B] px-5 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-950 disabled:cursor-wait disabled:opacity-60">{loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Working…</> : <>{mode === 'nova' ? <Sparkles size={14} /> : <Search size={14} />}{mode === 'nova' ? 'Ask NOVA' : mode === 'keywords' ? 'Research keywords' : 'Search'}<ArrowRight size={14} /></>}</button>
          </div>
          <div className="mt-2 flex flex-col gap-2 px-1 text-[9px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5"><WandSparkles size={11} /> {mode === 'auto' ? 'Auto mode: simple topics use keyword data; questions and tasks go to NOVA.' : mode === 'keywords' ? 'Keyword mode: no AI call; uses autocomplete, local intent grouping and connected volume data.' : 'NOVA mode: uses your enabled AI providers and automatic safe failover.'}</span>
            <span className="inline-flex items-center gap-1"><HelpCircle size={11} /> Press Enter to run</span>
          </div>
        </form>
        <div className="relative mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Market</span><select value={country} onChange={event => setCountry(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-700 outline-none focus:border-indigo-400">{countries.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
          <label className="min-w-0 flex-1"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Business type</span><select value={niche} onChange={event => setNiche(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-700 outline-none focus:border-indigo-400">{niches.map(item => <option key={item}>{item}</option>)}</select></label>
          <button type="button" onClick={() => setShowAdvanced(value => !value)} className="inline-flex h-[38px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><SlidersHorizontal size={12} /> Advanced options <ChevronDown size={12} className={`transition ${showAdvanced ? 'rotate-180' : ''}`} /></button>
        </div>
        {showAdvanced && <div className="relative mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label><span className="mb-1.5 block text-[9px] font-bold text-slate-500">City / region</span><input value={city} onChange={event => setCity(event.target.value)} placeholder="e.g. Lahore" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] outline-none focus:border-indigo-400" /></label>
          <label><span className="mb-1.5 block text-[9px] font-bold text-slate-500">Website domain (optional)</span><input value={website} onChange={event => setWebsite(event.target.value)} placeholder="https://example.com" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] outline-none focus:border-indigo-400" /></label>
          <label><span className="mb-1.5 block text-[9px] font-bold text-slate-500">Language</span><select value={language} onChange={event => setLanguage(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] outline-none"><option>English</option><option>Urdu</option><option>Arabic</option><option>German</option><option>French</option><option>Spanish</option></select></label>
          <label><span className="mb-1.5 block text-[9px] font-bold text-slate-500">Research goal</span><input value={goal} onChange={event => setGoal(event.target.value)} maxLength={240} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] outline-none focus:border-indigo-400" /></label>
        </div>}
        {error && <div role="alert" className="relative mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[10px] leading-5 text-rose-700">{error}</div>}
        {toast && <div role="status" className="relative mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] text-emerald-700">{toast}</div>}
      </section>

      {loading && <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-[11px] text-indigo-800"><span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />{resolvedMode === 'nova' ? 'NOVA is selecting an authorized provider and preparing your answer…' : 'Collecting autocomplete suggestions and keyword data…'}</div>}

      {novaReply && <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 bg-gradient-to-r from-[#10152B] via-[#231E49] to-[#16304C] p-5 text-white sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/10"><NovaOrb size={32} /></div><div><h2 className="text-sm font-extrabold">NOVA response</h2><p className="mt-1 text-[10px] text-slate-300">Automatic provider routing · {novaProvider || 'AI / local guidance'}</p></div></div><span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-[9px] font-bold text-cyan-100"><Sparkles size={11} /> Assistant task detected</span></div>
        <div className="p-5"><div className="whitespace-pre-wrap text-xs leading-7 text-slate-700">{novaReply}</div><div className="mt-5 flex flex-wrap gap-2">{promptSuggestions.map(item => <button key={item} onClick={() => { setQuery(item); setMode('nova'); }} className="rounded-full border border-slate-200 px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">{item}</button>)}</div></div>
      </section>}

      {resolvedMode === 'keywords' && result && <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={Search} label="Keyword ideas" value={sourceRows.length.toLocaleString()} detail={`For “${result.briefing.website || query}”`} tone="violet" />
          <MetricCard icon={TrendingUp} label="Average difficulty" value={averageDifficulty === null ? '—' : `${averageDifficulty}/100`} detail="CROX estimate · not a live SERP metric" tone="amber" />
          <MetricCard icon={Database} label="Live volume coverage" value={`${liveVolumeCount}/${sourceRows.length}`} detail={liveVolumeCount ? 'Loaded from connected data provider' : 'Connect DataForSEO for live search volume'} tone="blue" />
          <MetricCard icon={Target} label="Live CPC coverage" value={`${liveCpcCount}/${sourceRows.length}`} detail={liveCpcCount ? 'Provider-reported cost per click' : 'Estimates are labelled separately'} tone="green" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-xs font-extrabold text-slate-900">Filters</h2><button onClick={() => { setIntentFilter('All intents'); setDifficultyMax(100); setLongTailOnly(false); setTableSearch(''); }} className="text-[9px] font-semibold text-indigo-600 hover:text-indigo-800">Reset</button></div>
            <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Keyword intent</p><div className="mt-2 space-y-2">{(['All intents', 'Informational', 'Commercial', 'Transactional', 'Navigational'] as IntentFilter[]).map(item => <label key={item} className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-600"><input type="radio" checked={intentFilter === item} onChange={() => setIntentFilter(item)} className="accent-indigo-600" />{item}</label>)}</div></div>
            <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Difficulty</p><span className="text-[9px] font-semibold tabular-nums text-slate-500">0–{difficultyMax}</span></div><input type="range" min="0" max="100" value={difficultyMax} onChange={event => setDifficultyMax(Number(event.target.value))} className="mt-3 w-full accent-indigo-600" /><div className="mt-1 flex justify-between text-[8px] text-slate-400"><span>Easy</span><span>Hard</span></div></div>
            <div className="mt-4 border-t border-slate-100 pt-4"><label className="flex cursor-pointer items-center gap-2 text-[10px] font-medium text-slate-600"><input type="checkbox" checked={longTailOnly} onChange={event => setLongTailOnly(event.target.checked)} className="accent-indigo-600" />Long-tail keywords only</label></div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold text-slate-600">Data quality</p><p className="mt-1 text-[9px] leading-4 text-slate-500">Search volume/CPC values marked “Est.” are CROX models, not measured demand. Trend history is not connected.</p></div>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-sm font-extrabold text-slate-900">Keyword opportunities</h2><p className="mt-1 text-[10px] text-slate-500">Showing {filteredKeywords.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredKeywords.length)} of {filteredKeywords.length} filtered ideas · {result.provider === 'dataforseo' ? 'DataForSEO connected' : 'Autocomplete + estimates'}</p></div><div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[170px] flex-1 sm:flex-none"><Search size={12} className="absolute left-3 top-2.5 text-slate-400" /><input value={tableSearch} onChange={event => setTableSearch(event.target.value)} placeholder="Filter keywords" className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-[10px] outline-none focus:border-indigo-400" /></div><select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-600 outline-none"><option value="relevance">Sort: relevance</option><option value="difficulty">Lowest difficulty</option><option value="volume">Highest volume</option><option value="cpc">Highest CPC</option></select><button onClick={copyKeywords} type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">{copied ? <Check size={12} /> : <Clipboard size={12} />}{copied ? 'Copied' : 'Copy'}</button><button onClick={exportCsv} type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-bold text-white hover:bg-indigo-950"><Download size={12} />Export CSV</button></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50/90"><tr>{['Keyword', 'Intent', 'Search volume', 'Difficulty', 'CPC (USD)', 'Trend', 'Actions'].map(item => <th key={item} className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 first:pl-5">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleKeywords.map((item, index) => <KeywordTableRow key={`${item.keyword}-${index}`} item={item} onCopy={() => copyOne(item)} onUse={() => { setQuery(item.keyword); setMode('keywords'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />)}</tbody></table></div>
            {!visibleKeywords.length && <div className="p-10 text-center"><Search size={18} className="mx-auto text-slate-300" /><p className="mt-2 text-xs font-semibold text-slate-600">No keywords match the current filters.</p><p className="mt-1 text-[10px] text-slate-400">Reset the filters or try a broader search.</p></div>}
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[9px] leading-5 text-slate-500">{result.provider_status}</p><div className="flex shrink-0 items-center justify-between gap-3"><label className="flex items-center gap-1.5 text-[9px] text-slate-500">Rows per page <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-700"><option value={10}>10</option><option value={20}>20</option><option value={40}>40</option></select></label><div className="flex items-center gap-1"><button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-30" aria-label="Previous page">‹</button><span className="min-w-[44px] text-center text-[9px] font-semibold tabular-nums text-slate-600">{page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 disabled:opacity-30" aria-label="Next page">›</button></div></div></div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-xs font-extrabold text-slate-900">Topic clusters</h2><p className="mt-1 text-[9px] text-slate-500">Related queries grouped into content themes</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">{clusters.length} groups</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{clusters.map(([name, count]) => <div key={name} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-3"><span className="truncate text-[10px] font-bold text-slate-700">{name}</span><span className="text-[9px] tabular-nums text-slate-400">{count} ideas</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.max(8, count / Math.max(1, sourceRows.length) * 100)}%` }} /></div></div>)}</div></section>
          <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-4 shadow-sm"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl border border-violet-100 bg-white"><NovaOrb size={26} /></div><div><h2 className="text-xs font-extrabold text-slate-900">NOVA’s next move</h2><p className="mt-0.5 text-[9px] text-slate-500">Ask for strategy only when you need it</p></div></div><p className="mt-3 text-[10px] leading-5 text-slate-600">Keyword lookup ran without an AI call. When you need intent strategy, competitor interpretation or a content plan, use Ask NOVA above and the provider gateway selects the next available authorized provider.</p><button onClick={() => { setMode('nova'); setQuery(`Build a keyword strategy for ${query || result.briefing.website || 'my business'} in ${countries.find(([code]) => code === country)?.[1] || 'my market'}. Prioritize search intent and content opportunities.`); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-bold text-white hover:bg-indigo-950"><MessageCircle size={11} /> Ask NOVA for strategy <ArrowRight size={11} /></button></section>
        </div>
      </>}

      {!result && !novaReply && !loading && <div className="grid gap-3 md:grid-cols-3">
        <InfoCard icon={Target} title="Keyword data first" description="Simple phrases use autocomplete, intent grouping and any connected volume provider. No AI key is needed for this workflow." tone="violet" />
        <InfoCard icon={WandSparkles} title="NOVA when you ask" description="Questions, instructions and strategy requests go through the AI gateway and its configured provider fallback chain." tone="cyan" />
        <InfoCard icon={Lightbulb} title="Honest metrics" description="Live provider values and modelled estimates are labelled separately. CROX never invents historical trends or ranking data." tone="amber" />
      </div>}
    </div>
  );
};

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: React.ElementType; label: string; value: string; detail: string; tone: 'violet' | 'amber' | 'blue' | 'green' }) {
  const tones = { violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-sky-50 text-sky-700', green: 'bg-emerald-50 text-emerald-700' };
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span><span className={`grid h-8 w-8 place-items-center rounded-xl ${tones[tone]}`}><Icon size={15} /></span></div><p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">{value}</p><p className="mt-1 truncate text-[9px] text-slate-500">{detail}</p></article>;
}

function InfoCard({ icon: Icon, title, description, tone }: { icon: React.ElementType; title: string; description: string; tone: 'violet' | 'cyan' | 'amber' }) {
  const tones = { violet: 'bg-violet-50 text-violet-700', cyan: 'bg-cyan-50 text-cyan-700', amber: 'bg-amber-50 text-amber-700' };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}><Icon size={16} /></span><h3 className="mt-3 text-xs font-extrabold text-slate-900">{title}</h3><p className="mt-1.5 text-[10px] leading-5 text-slate-500">{description}</p></article>;
}

function KeywordTableRow({ item, onCopy, onUse }: { item: CROXResearchKeywordRow; onCopy: () => void; onUse: () => void }) {
  return <tr className="transition-colors hover:bg-indigo-50/30"><td className="max-w-[280px] px-3 py-3.5 pl-5"><p className="truncate text-[11px] font-bold text-slate-800">{item.keyword}</p><p className="mt-1 text-[8px] text-slate-400">{item.source === 'ai_generated' ? 'NOVA suggestion' : item.source === 'seed_expansion' ? 'Seed + autocomplete' : item.source}</p></td><td className="px-3 py-3.5"><span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[8px] font-bold ${intentTone(item.intent)}`}>{item.intent}</span></td><td className="px-3 py-3.5"><span className="text-[10px] font-semibold tabular-nums text-slate-700">{compactNumber(item.volume)}</span><span className={`ml-1 text-[8px] ${item.volume_label === 'provider' ? 'text-emerald-600' : 'text-slate-400'}`}>{item.volume_label === 'provider' ? 'live' : 'est.'}</span></td><td className="px-3 py-3.5"><span className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${difficultyTone(item.difficulty)}`}>{item.difficulty}</span><span className="ml-1 text-[8px] text-slate-400">{item.difficulty_label}</span></td><td className="px-3 py-3.5"><span className="text-[10px] font-semibold tabular-nums text-slate-700">{currency(item.cpc)}</span><span className={`ml-1 text-[8px] ${item.cpc_label === 'provider' ? 'text-emerald-600' : 'text-slate-400'}`}>{item.cpc_label === 'provider' ? 'live' : 'est.'}</span></td><td className="px-3 py-3.5"><span className="text-[10px] text-slate-300" title="Historical trend data is not connected">—</span></td><td className="px-3 py-3.5"><div className="flex items-center gap-1"><button onClick={onCopy} title="Copy keyword" className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-indigo-600"><Clipboard size={12} /></button><button onClick={onUse} title="Research this keyword" className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-indigo-600"><ArrowDownWideNarrow size={12} /></button></div></td></tr>;
}
