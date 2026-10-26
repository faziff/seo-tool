import React, { useState } from 'react';
import { AlertCircle, ArrowLeftRight, ArrowRight, CheckCircle2, Compass, Globe2, Lightbulb, Search, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { compareCompetitorDomains, CompetitorComparisonResponse, generateMarketBrief, MarketBriefResponse } from '../services/api';
import { CompetitorProfile, MarketProfileCard } from '../components/MarketProfileCard';
import { NovaOrb } from '../components/NovaOrb';

function renderBrief(brief: string) {
  return brief.split('\n').map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={index} className="h-2" />;
    if (trimmed.startsWith('## ')) return <h3 key={index} className="text-base font-bold text-slate-900 mt-4 mb-2">{trimmed.slice(3)}</h3>;
    if (trimmed.startsWith('### ')) return <h4 key={index} className="text-sm font-bold text-slate-800 mt-4 mb-1.5">{trimmed.slice(4)}</h4>;
    if (/^\d+\.\s/.test(trimmed)) return <div key={index} className="flex items-start gap-2.5 my-2"><span className="w-5 h-5 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center shrink-0 text-[10px] font-bold">{trimmed.match(/^\d+/)?.[0]}</span><p className="text-xs leading-6 text-slate-600">{trimmed.replace(/^\d+\.\s/, '')}</p></div>;
    if (trimmed.startsWith('- ')) return <div key={index} className="flex items-start gap-2 my-1.5 ml-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" /><p className="text-xs leading-6 text-slate-600">{trimmed.slice(2)}</p></div>;
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) return <p key={index} className="text-xs font-bold text-slate-700 mt-3">{trimmed.replace(/\*\*/g, '')}</p>;
    return <p key={index} className="text-xs leading-6 text-slate-600">{trimmed.replace(/\*\*/g, '')}</p>;
  });
}

export const MarketResearchPage: React.FC = () => {
  const [yourDomain, setYourDomain] = useState('');
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [comparison, setComparison] = useState<CompetitorComparisonResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState('');

  const [niche, setNiche] = useState('E-commerce skincare brand');
  const [market, setMarket] = useState('Pakistan');
  const [goal, setGoal] = useState('Find high-intent organic search opportunities and improve conversions');
  const [brief, setBrief] = useState<MarketBriefResponse | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState('');

  const runComparison = async (event: React.FormEvent) => {
    event.preventDefault();
    setCompareError('');
    setComparison(null);
    if (!yourDomain.trim() || !competitorDomain.trim()) return setCompareError('Enter both your website and one competitor domain.');
    setComparing(true);
    try {
      setComparison(await compareCompetitorDomains(yourDomain.trim(), competitorDomain.trim()));
    } catch (error) {
      setCompareError(error instanceof Error ? error.message : 'Could not compare these websites.');
    } finally {
      setComparing(false);
    }
  };

  const runBrief = async (event: React.FormEvent) => {
    event.preventDefault();
    setBriefError('');
    setBriefLoading(true);
    try {
      setBrief(await generateMarketBrief(niche.trim(), market.trim(), goal.trim()));
    } catch (error) {
      setBriefError(error instanceof Error ? error.message : 'Could not create the market brief.');
    } finally {
      setBriefLoading(false);
    }
  };

  const targetProfile = comparison?.target as CompetitorProfile | undefined;
  const competitorProfile = comparison?.competitor as CompetitorProfile | undefined;

  return (
    <div className="space-y-7 pb-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] font-bold text-violet-600 mb-2"><span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-violet-50"><Compass size={13} /></span> Market intelligence</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Understand your market. Find your angle.</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-6">Compare publicly accessible homepage SEO signals, find practical gaps, and turn your niche into a focused research brief with NOVA.</p>
        </div>
        <div className="inline-flex items-center gap-2 text-[11px] text-slate-500 rounded-xl border border-slate-200 bg-white px-3 py-2 self-start md:self-auto"><NovaOrb size={24} /><span><strong className="text-slate-800">NOVA</strong> market copilot</span></div>
      </div>

      <section className="rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden p-5 sm:p-7 bg-[#0c0a18] text-white">
          <div className="absolute -right-16 -top-28 w-80 h-80 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="relative flex items-start gap-3"><div className="w-11 h-11 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center"><ArrowLeftRight size={20} className="text-violet-200" /></div><div><p className="text-[10px] uppercase tracking-[0.17em] text-violet-200 font-bold">Competitor gap explorer</p><h2 className="text-xl sm:text-2xl font-bold mt-1 tracking-tight">Compare two homepage signals.</h2><p className="text-xs text-slate-400 mt-2 leading-5 max-w-2xl">CROX safely inspects public homepage title tags, meta descriptions, H1 headings, canonical tags and response behavior. It does not pretend these are traffic or ranking metrics.</p></div></div>
        </div>
        <form onSubmit={runComparison} className="p-5 sm:p-7">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <label><span className="block text-xs font-semibold text-slate-700 mb-2">Your website</span><div className="relative"><Globe2 size={15} className="absolute left-3 top-3.5 text-slate-400" /><input value={yourDomain} onChange={event => setYourDomain(event.target.value)} placeholder="yourbrand.com" className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-400" maxLength={260} /></div></label>
            <div className="hidden md:flex items-center justify-center h-10 w-10 mb-0.5 rounded-xl border border-slate-200 bg-white text-slate-400"><ArrowLeftRight size={16} /></div>
            <label><span className="block text-xs font-semibold text-slate-700 mb-2">Competitor website</span><div className="relative"><Globe2 size={15} className="absolute left-3 top-3.5 text-slate-400" /><input value={competitorDomain} onChange={event => setCompetitorDomain(event.target.value)} placeholder="competitor.com" className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-400" maxLength={260} /></div></label>
          </div>
          {compareError && <div className="mt-4 text-xs text-rose-600 flex items-start gap-2"><AlertCircle size={14} className="mt-0.5 shrink-0" />{compareError}</div>}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><p className="text-[10px] text-slate-400 leading-5 max-w-xl"><ShieldCheck size={12} className="inline mr-1" />Private/local addresses are blocked by the server URL safety check; redirects are not followed automatically.</p><button type="submit" disabled={comparing} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-5 py-3 text-xs font-bold disabled:opacity-60 transition">{comparing ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Inspecting homepages…</> : <><Search size={14} /> Compare websites <ArrowRight size={14} /></>}</button></div>
        </form>
      </section>

      {comparison && targetProfile && competitorProfile && <section className="space-y-4 animate-in fade-in"><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><div><h2 className="text-lg font-bold text-slate-900">Homepage comparison</h2><p className="text-xs text-slate-500 mt-1">{comparison.comparison_summary}</p></div><span className="inline-flex self-start rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] text-slate-500">Observed from live request</span></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-4"><MarketProfileCard profile={targetProfile} label="Your site" /><MarketProfileCard profile={competitorProfile} label="Competitor" /></div><div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><Lightbulb size={17} /></div><div><h3 className="font-bold text-slate-900">Recommended gaps to investigate</h3><p className="text-xs text-slate-500 mt-1">Grounded in the homepage signals CROX was able to read.</p></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">{comparison.gap_recommendations.map((recommendation, index) => <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100" key={`${recommendation}-${index}`}><CheckCircle2 size={15} className="text-violet-600 mt-0.5 shrink-0" /><p className="text-xs leading-5 text-slate-700">{recommendation}</p></div>)}</div><p className="mt-4 text-[10px] leading-5 text-slate-400">{comparison.data_scope}</p></div></section>}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm">
        <div className="flex items-start gap-3 mb-5"><div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-100 via-pink-50 to-cyan-50 flex items-center justify-center"><NovaOrb size={34} /></div><div><p className="text-[10px] uppercase tracking-[0.16em] text-violet-600 font-bold">NOVA strategy studio</p><h2 className="text-lg font-bold text-slate-900 mt-1">Generate a niche research brief.</h2><p className="text-xs text-slate-500 mt-1 leading-5">Get hypotheses to test, audience segments, search-intent clusters, competitor questions and a 30-day plan.</p></div></div>
        <form onSubmit={runBrief} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label><span className="block text-xs font-semibold text-slate-700 mb-2">Niche / industry</span><input value={niche} onChange={event => setNiche(event.target.value)} placeholder="e.g. online modest fashion store" className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-400" maxLength={180} required /></label>
          <label><span className="block text-xs font-semibold text-slate-700 mb-2">Target market</span><input value={market} onChange={event => setMarket(event.target.value)} placeholder="e.g. Pakistan, UK, global" className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-400" maxLength={120} /></label>
          <label className="md:col-span-2"><span className="block text-xs font-semibold text-slate-700 mb-2">Main business goal</span><input value={goal} onChange={event => setGoal(event.target.value)} placeholder="e.g. attract qualified visitors, find content gaps, increase leads" className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-400" maxLength={320} /></label>
          {briefError && <p role="alert" className="md:col-span-2 text-xs text-rose-600">{briefError}</p>}
          <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><p className="text-[10px] leading-5 text-slate-400">The brief is directional. It does not include independently verified market size, live search trends or competitor traffic.</p><button type="submit" disabled={briefLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-indigo-950 disabled:opacity-60 text-white px-5 py-3 text-xs font-bold transition">{briefLoading ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Building strategy…</> : <><Sparkles size={14} /> Create market brief <ArrowRight size={14} /></>}</button></div>
        </form>
        {brief && <div className="mt-6 rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/50 p-5 sm:p-7"><div className="flex items-start justify-between gap-3 mb-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-xl bg-white border border-violet-100 flex items-center justify-center"><NovaOrb size={25} /></div><div><h3 className="font-bold text-slate-900">Your market starting brief</h3><p className="text-[10px] text-slate-500 mt-0.5">{brief.ai_mode === 'gemini' ? 'NOVA powered by Gemini' : 'Local starter template'}</p></div></div><button type="button" onClick={() => navigator.clipboard?.writeText(brief.brief)} className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Copy brief</button></div><div>{renderBrief(brief.brief)}</div><p className="mt-5 border-t border-violet-100 pt-4 text-[10px] leading-5 text-slate-500">{brief.note}</p></div>}
      </section>
    </div>
  );
};
