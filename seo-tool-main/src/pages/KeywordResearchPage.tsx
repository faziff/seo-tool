import React, { useMemo, useState } from 'react';
import {
  ArrowDownWideNarrow, ArrowRight, Check, ChevronDown, Clipboard, Download,
  Filter, Lightbulb, Search, Sparkles, Target, TrendingUp, Zap
} from 'lucide-react';
import { analyzeKeywords, CROXKeywordIdea, KeywordStrategyResponse } from '../services/api';
import { NovaOrb } from '../components/NovaOrb';

const intentOptions = ['All intents', 'Informational', 'Commercial', 'Transactional', 'Navigational'] as const;

type IntentFilter = typeof intentOptions[number];

function difficultyClass(label: string) {
  return label === 'Easy' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : label === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100';
}

export const KeywordResearchPage: React.FC = () => {
  const [seed, setSeed] = useState('website audit tool');
  const [niche, setNiche] = useState('SaaS & software');
  const [market, setMarket] = useState('United States / Global');
  const [intentFilter, setIntentFilter] = useState<IntentFilter>('All intents');
  const [result, setResult] = useState<KeywordStrategyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const visibleKeywords = useMemo(() => {
    if (!result) return [];
    return intentFilter === 'All intents' ? result.keywords : result.keywords.filter(item => item.intent === intentFilter);
  }, [result, intentFilter]);

  const clusters = useMemo(() => {
    if (!result) return [];
    const counts = new Map<string, number>();
    result.keywords.forEach(item => counts.set(item.cluster, (counts.get(item.cluster) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [result]);

  const runResearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!seed.trim()) return setError('Enter a core keyword or topic to start.');
    setLoading(true);
    try {
      const response = await analyzeKeywords(seed.trim(), niche, market);
      setResult(response);
      setIntentFilter('All intents');
    } catch (researchError) {
      setError(researchError instanceof Error ? researchError.message : 'Keyword research failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyKeywords = async () => {
    const value = visibleKeywords.map(item => item.keyword).join('\n');
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access is blocked by this browser. Use Export CSV instead.');
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const rows = [
      ['Keyword', 'Search intent', 'Estimated difficulty', 'Estimated difficulty score', 'Topic cluster', 'Source', 'Search volume status', 'CPC available'],
      ...visibleKeywords.map(item => [item.keyword, item.intent, item.difficulty_label, String(item.difficulty_score), item.cluster, item.source, item.search_volume_provider_status, String(item.cpc_estimate_available)])
    ];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `crox-keyword-ideas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] font-bold text-indigo-600 mb-2"><span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50"><Search size={13} /></span> Keyword intelligence</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Find your next search opportunity.</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-6">Turn one seed phrase into a structured list of keyword ideas, search intent and topical clusters—with NOVA helping you explore what to target next.</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 shadow-sm"><NovaOrb size={24} /><span><strong className="text-slate-900">NOVA</strong> research assistant</span></div>
      </div>

      <form onSubmit={runResearch} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-100 via-pink-50 to-cyan-50 flex items-center justify-center text-indigo-600"><Sparkles size={18} /></div><div><h2 className="font-bold text-slate-900">Build a keyword map</h2><p className="text-xs text-slate-500 mt-0.5">Describe your niche and the audience you want to reach.</p></div></div><span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] rounded-full bg-slate-50 px-3 py-1.5 border border-slate-100 text-slate-500"><Zap size={12} /> AI-assisted ideation</span></div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <label className="lg:col-span-5 block"><span className="block text-xs font-semibold text-slate-700 mb-2">Seed keyword or topic</span><div className="relative"><Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" /><input value={seed} onChange={event => setSeed(event.target.value)} placeholder="e.g. organic skincare, SEO tool, florist" className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-400 focus:bg-white transition" maxLength={180} /></div></label>
          <label className="lg:col-span-3 block"><span className="block text-xs font-semibold text-slate-700 mb-2">Business niche</span><div className="relative"><select value={niche} onChange={event => setNiche(event.target.value)} className="appearance-none w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 pr-9 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-400"><option>SaaS & software</option><option>E-commerce & retail</option><option>Local business</option><option>Agency & professional services</option><option>Education & courses</option><option>Health & wellness</option><option>Food & hospitality</option><option>Finance & business</option><option>Travel & tourism</option><option>Content & media</option><option>Other / general</option></select><ChevronDown size={15} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" /></div></label>
          <label className="lg:col-span-4 block"><span className="block text-xs font-semibold text-slate-700 mb-2">Target market / location</span><input value={market} onChange={event => setMarket(event.target.value)} placeholder="e.g. Pakistan, UK, global" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-400 focus:bg-white transition" maxLength={100} /></label>
        </div>
        {error && <p role="alert" className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><p className="text-[11px] leading-5 text-slate-400 max-w-xl">Difficulty is an estimate for prioritization—not a live SERP score. Search volume and CPC stay unreported until a data provider is connected.</p><button type="submit" disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-indigo-950 disabled:opacity-60 text-white px-5 py-3 text-xs font-bold transition shadow-sm">{loading ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Researching keywords…</> : <><Sparkles size={15} /> Generate keyword ideas <ArrowRight size={15} /></>}</button></div>
      </form>

      {!result ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="w-9 h-9 flex items-center justify-center rounded-xl bg-violet-50 text-violet-600 mb-3"><Target size={17} /></div><h3 className="font-bold text-sm text-slate-900">Search intent</h3><p className="text-xs text-slate-500 leading-5 mt-2">Separate learning queries from commercial comparisons and purchase-ready searches.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="w-9 h-9 flex items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 mb-3"><TrendingUp size={17} /></div><h3 className="font-bold text-sm text-slate-900">Topic clusters</h3><p className="text-xs text-slate-500 leading-5 mt-2">Group related ideas into page themes to plan content hubs and supporting articles.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-50 text-amber-700 mb-3"><Lightbulb size={17} /></div><h3 className="font-bold text-sm text-slate-900">Practical next steps</h3><p className="text-xs text-slate-500 leading-5 mt-2">Use the map to outline landing pages, FAQs, comparisons and content briefs.</p></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ideas generated</p><p className="text-2xl font-extrabold text-slate-900 mt-2">{result.total_keywords}</p><p className="text-[10px] text-slate-500 mt-1">For “{result.seed_phrase}”</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Topic clusters</p><p className="text-2xl font-extrabold text-slate-900 mt-2">{clusters.length}</p><p className="text-[10px] text-slate-500 mt-1">Groups to organize content</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Long-tail ideas</p><p className="text-2xl font-extrabold text-slate-900 mt-2">{result.keywords.filter(item => item.keyword.trim().split(/\s+/).length >= 4).length}</p><p className="text-[10px] text-slate-500 mt-1">More specific phrasing</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live volume / CPC</p><p className="text-xl font-extrabold text-slate-900 mt-2">Not connected</p><p className="text-[10px] text-slate-500 mt-1">No values invented</p></div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <section className="xl:col-span-8 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h2 className="font-bold text-slate-900">Keyword ideas</h2><p className="text-xs text-slate-500 mt-1">Filter, copy or export this working list.</p></div><div className="flex flex-wrap items-center gap-2"><div className="relative"><Filter size={13} className="absolute left-2.5 top-2.5 text-slate-400" /><select value={intentFilter} onChange={event => setIntentFilter(event.target.value as IntentFilter)} className="appearance-none pl-8 pr-7 py-2 rounded-lg border border-slate-200 text-[11px] text-slate-600 bg-white outline-none"><option>All intents</option><option>Informational</option><option>Commercial</option><option>Transactional</option><option>Navigational</option></select><ChevronDown size={12} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" /></div><button onClick={copyKeywords} type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">{copied ? <Check size={13} /> : <Clipboard size={13} />}{copied ? 'Copied' : 'Copy'}</button><button onClick={exportCsv} type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-2.5 py-2 text-[11px] font-semibold text-white"><Download size={13} /> CSV</button></div></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-slate-50/80"><tr><th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Keyword</th><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Intent</th><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400"><span className="inline-flex items-center gap-1"><ArrowDownWideNarrow size={11} /> Est. difficulty</span></th><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Topic cluster</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleKeywords.map((item, index) => <tr key={`${item.keyword}-${index}`} className="hover:bg-slate-50/70 transition-colors"><td className="px-5 py-3.5"><div className="font-semibold text-xs text-slate-800">{item.keyword}</div><div className="text-[10px] text-slate-400 mt-1">{item.source === 'ai_generated' ? 'NOVA idea' : 'Seed expansion'}</div></td><td className="px-4 py-3.5"><span className="inline-flex rounded-full border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600">{item.intent}</span></td><td className="px-4 py-3.5"><div className="flex items-center gap-2"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${difficultyClass(item.difficulty_label)}`}>{item.difficulty_label}</span><span className="text-[10px] text-slate-400 tabular-nums">{item.difficulty_score}/100</span></div></td><td className="px-4 py-3.5"><span className="text-[11px] text-slate-600">{item.cluster}</span></td></tr>)}</tbody></table></div>
              {visibleKeywords.length === 0 && <div className="p-10 text-center text-xs text-slate-500">No keyword ideas match this search intent.</div>}
              <div className="p-4 border-t border-slate-100 bg-slate-50/60 text-[10px] text-slate-500">{result.ai_mode === 'gemini' ? 'NOVA powered by Gemini' : 'Heuristic mode'} · These are generated ideas, not verified search-volume or rankings data.</div>
            </section>
            <aside className="xl:col-span-4 space-y-5">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between mb-4"><h2 className="font-bold text-sm text-slate-900">Topic clusters</h2><span className="text-[10px] text-slate-400">{clusters.length} groups</span></div><div className="space-y-4">{clusters.map(([name, count]) => <div key={name}><div className="flex items-center justify-between gap-3 mb-1.5"><span className="text-xs font-semibold text-slate-700 truncate">{name}</span><span className="text-[10px] text-slate-500">{count}</span></div><div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-indigo-500" style={{ width: `${Math.max(12, count / Math.max(1, result.total_keywords) * 100)}%` }} /></div></div>)}</div></section>
              <section className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-5"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-xl bg-white border border-violet-100 flex items-center justify-center"><NovaOrb size={24} /></div><div><h2 className="font-bold text-sm text-slate-900">NOVA’s next move</h2><p className="text-[10px] text-slate-500">Action plan starter</p></div></div><ol className="mt-4 space-y-3">{[
                `Choose one primary phrase from ${result.seed_phrase}.`,
                'Map each cluster to one page; avoid targeting the same intent on multiple pages.',
                'Validate the final shortlist with Google Search Console or a connected keyword data provider.'
              ].map((item, index) => <li key={item} className="flex items-start gap-2.5 text-[11px] leading-5 text-slate-600"><span className="w-5 h-5 rounded-full bg-white border border-violet-100 shrink-0 flex items-center justify-center font-bold text-[10px] text-violet-600">{index + 1}</span><span>{item}</span></li>)}</ol></section>
            </aside>
          </div>
          <p className="text-[10px] text-slate-400 leading-5">{result.provider_status}</p>
        </>
      )}
    </div>
  );
};
