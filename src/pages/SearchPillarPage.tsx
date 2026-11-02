import React from 'react';
import {
  Activity, AlertCircle, ArrowRight, BookOpenText, CheckCircle2, CircleHelp,
  ClipboardCheck, ExternalLink, FileSearch, Globe2, Info, Layers3, Lightbulb,
  Network, Quote, Search, ShieldCheck, Sparkles, Target, WandSparkles
} from 'lucide-react';
import type { ScanReport, ScannedPage } from '../types';
import { assessAEO, assessGEO, getReadinessRecommendations, type ReadinessAssessment, type ReadinessCheck } from '../utils/searchReadiness';

type Pillar = 'aeo' | 'geo';

interface SearchPillarPageProps {
  pillar: Pillar;
  report: ScanReport | null;
  onRunAudit: () => void;
  onOpenTab: (tab: string) => void;
}

const statusStyle: Record<string, string> = {
  strong: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  improve: 'border-amber-200 bg-amber-50 text-amber-800',
  weak: 'border-rose-200 bg-rose-50 text-rose-700',
  'not-measured': 'border-slate-200 bg-slate-100 text-slate-500'
};

function countPages(pages: ScannedPage[], predicate: (page: ScannedPage) => boolean): number {
  return pages.filter(predicate).length;
}

function StatCard({ label, value, caption, icon: Icon }: { label: string; value: string | number; caption: string; icon: React.ElementType }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</span><span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-50 text-slate-500"><Icon size={15} /></span></div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">{caption}</p>
    </div>
  );
}

function CheckRow({ check, index }: { check: ReadinessCheck; index: number }) {
  const Icon = check.status === 'strong' ? CheckCircle2 : check.status === 'not-measured' ? Info : AlertCircle;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600"><Icon size={17} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-bold text-slate-900">{index + 1}. {check.title}</h3><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusStyle[check.status]}`}>{check.status === 'strong' ? 'Good' : check.status === 'improve' ? 'Improve' : check.status === 'weak' ? 'Needs work' : 'Not measured'}</span></div>
          <p className="mt-1.5 text-[10px] leading-5 text-slate-500">{check.description}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${check.status === 'strong' ? 'bg-emerald-500' : check.status === 'improve' ? 'bg-amber-500' : check.status === 'weak' ? 'bg-rose-500' : 'bg-slate-300'}`} style={{ width: `${check.score}%` }} /></div>
            <span className="w-10 text-right text-[10px] font-bold tabular-nums text-slate-700">{check.evaluated ? `${check.score}%` : '—'}</span>
            <span className="w-20 text-right text-[9px] text-slate-400">{check.evaluated ? `${check.affected} / ${check.evaluated} need work` : 'No crawl data'}</span>
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Recommended action</p><p className="mt-1 text-[10px] leading-5 text-slate-700">{check.recommendation}</p></div>
        </div>
      </div>
    </article>
  );
}

function ReadinessHero({ pillar, assessment, domain }: { pillar: Pillar; assessment: ReadinessAssessment; domain?: string }) {
  const aeo = pillar === 'aeo';
  return (
    <section className={`relative overflow-hidden rounded-[26px] p-5 text-white shadow-sm sm:p-7 ${aeo ? 'bg-gradient-to-br from-[#142D55] via-[#253E78] to-[#5146A8]' : 'bg-gradient-to-br from-[#102F3B] via-[#145469] to-[#176F75]'}`}>
      <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.14em] text-white/80"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {aeo ? 'Answer engine readiness' : 'Generative engine readiness'}</span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{aeo ? 'Answer Engine Optimization' : 'Generative Engine Optimization'}</h1>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-white/75">{aeo ? 'Evaluate whether your pages are easy to discover, understand and extract as direct answers to user questions.' : 'Evaluate the crawlable, entity, evidence and content foundations that can help generative search systems understand and reference your website.'}</p>
          {domain && <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/80"><Globe2 size={12} /> {domain}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-[9px] text-white/75"><span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5">Based on {assessment.pagesEvaluated} crawled pages</span><span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5">Rule-based readiness assessment</span><span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5">Not an AI citation/rank guarantee</span></div>
        </div>
        <div className="flex items-center gap-5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm lg:flex-col lg:gap-2 lg:p-5">
          <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${assessment.score !== null && assessment.score >= 80 ? '#6EE7B7' : assessment.score !== null && assessment.score >= 55 ? '#FCD34D' : '#FDA4AF'} ${assessment.score ?? 0}%, rgba(255,255,255,.16) 0)` }}>
            <div className="grid h-[84px] w-[84px] place-items-center rounded-full bg-[#182B53] text-center"><span className="text-3xl font-extrabold tabular-nums">{assessment.score === null ? '—' : assessment.score}</span><span className="-mt-2 text-[9px] text-white/60">out of 100</span></div>
          </div>
          <div className="min-w-0"><p className="text-sm font-bold">{assessment.label}</p><p className="mt-1 text-[10px] leading-5 text-white/70">{assessment.score === null ? 'Run a website crawl to calculate readiness.' : `${assessment.strongChecks} strong checks · ${assessment.improvementCount} improvement areas`}</p></div>
        </div>
      </div>
    </section>
  );
}

export const SearchPillarPage: React.FC<SearchPillarPageProps> = ({ pillar, report, onRunAudit, onOpenTab }) => {
  const aeo = pillar === 'aeo';
  const pages = (report?.pages || []).filter(page => /html|xhtml/i.test(page.content_type || '') && Number(page.extra?.search_signals_version || 0) >= 1);
  const assessment = aeo ? assessAEO(report) : assessGEO(report);
  const recommended = getReadinessRecommendations(assessment).slice(0, 4);
  const schemaCoverage = countPages(pages, page => (Array.isArray(page.extra?.schema_types) ? page.extra.schema_types.length : Number(page.extra?.schema_blocks || 0)) > 0);
  const answerCoverage = countPages(pages, page => (Number(page.extra?.question_headings || 0) > 0 && Number(page.extra?.answer_blocks || 0) > 0) || Number(page.extra?.faq_schema_count || 0) > 0);
  const entityCoverage = countPages(pages, page => (Array.isArray(page.extra?.schema_types) ? page.extra.schema_types : []).some((type: unknown) => /organization|person|localbusiness|brand|product/i.test(String(type))) || Boolean(page.extra?.site_name || page.extra?.publisher_name));
  const evidenceCoverage = countPages(pages, page => Number(page.extra?.list_count || 0) > 0 || Number(page.extra?.table_count || 0) > 0 || Number(page.extra?.external_citations || 0) > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.18em] text-slate-500"><span className={`grid h-7 w-7 place-items-center rounded-lg ${aeo ? 'bg-violet-50 text-violet-700' : 'bg-teal-50 text-teal-700'}`}>{aeo ? <CircleHelp size={14} /> : <Network size={14} />}</span> CROX · {aeo ? 'AEO workspace' : 'GEO workspace'}</div><p className="text-[10px] text-slate-500">{report ? `Latest crawl: ${report.domain} · ${new Date(report.completed_at || report.created_at).toLocaleString()}` : 'No website crawl selected'}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onOpenTab('seo-analysis')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"><Search size={13} /> SEO Workspace</button><button type="button" onClick={onRunAudit} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-[10px] font-bold text-white hover:bg-indigo-950"><Activity size={13} /> {report ? 'Run fresh crawl' : 'Start website audit'}</button></div>
      </div>

      {!report ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <div className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${aeo ? 'bg-violet-50 text-violet-600' : 'bg-teal-50 text-teal-600'}`}>{aeo ? <BookOpenText size={25} /> : <Sparkles size={25} />}</div>
          <h2 className="mt-4 text-lg font-extrabold text-slate-900">Your {aeo ? 'AEO' : 'GEO'} assessment starts with a crawl</h2>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-slate-500">CROX needs page-level crawl evidence before it can score content structure, indexability, entity signals and extractable information. No readiness score will be invented before a scan.</p>
          <button type="button" onClick={onRunAudit} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-950">Analyze a website <ArrowRight size={14} /></button>
        </div>
      ) : pages.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50/60 px-6 py-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-amber-700"><Activity size={24} /></div>
          <h2 className="mt-4 text-lg font-extrabold text-slate-900">A fresh crawl is needed for this assessment</h2>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-slate-600">This saved scan does not contain the detailed answer, entity and evidence signals used by the new {aeo ? 'AEO' : 'GEO'} workspace. Run a fresh crawl to collect them. CROX will not turn missing historical data into a zero score.</p>
          <button type="button" onClick={onRunAudit} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-950">Run a fresh crawl <ArrowRight size={14} /></button>
        </div>
      ) : (
        <>
          <ReadinessHero pillar={pillar} assessment={assessment} domain={report.domain} />

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Pages evaluated" value={pages.length} caption="Pages included in the latest crawl" icon={FileSearch} />
            <StatCard label="Indexable pages" value={`${countPages(pages, page => page.is_indexable)}/${pages.length}`} caption="Pages not blocked by the crawl/indexability checks" icon={ShieldCheck} />
            <StatCard label={aeo ? 'Answer structures' : 'Entity signals'} value={aeo ? answerCoverage : entityCoverage} caption={aeo ? 'Pages with question, answer or FAQ patterns' : 'Pages with recognizable entity/schema signals'} icon={aeo ? CircleHelp : Network} />
            <StatCard label={aeo ? 'Structured data' : 'Evidence structure'} value={aeo ? schemaCoverage : evidenceCoverage} caption={aeo ? 'Pages with detected JSON-LD schema types' : 'Pages with lists, tables or external references'} icon={aeo ? Layers3 : Quote} />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-sm font-extrabold text-slate-900">Detailed readiness checks</h2><p className="mt-1 text-[10px] text-slate-500">Each check shows the number of evaluated pages that currently meet the signal.</p></div><span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[9px] font-semibold text-slate-500">{assessment.checks.length} checks</span></div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{assessment.checks.map((check, index) => <CheckRow key={check.id} check={check} index={index} />)}</div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-700"><Lightbulb size={15} /></span><div><h2 className="text-sm font-bold text-slate-900">Priority opportunities</h2><p className="mt-0.5 text-[10px] text-slate-500">The most impactful areas from this crawl-based assessment.</p></div></div>
              {recommended.length ? <div className="mt-4 space-y-2">{recommended.map((check, index) => <div key={check.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white text-[10px] font-extrabold text-slate-500">0{index + 1}</span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-slate-800">{check.title}</p><p className="mt-1 text-[10px] leading-5 text-slate-500">{check.recommendation}</p></div><span className="shrink-0 text-[10px] font-bold tabular-nums text-rose-600">{check.affected} pages</span></div>)}</div> : <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">No weak or improving checks were identified in the current assessment. Keep reviewing new crawls as your content changes.</p>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><ClipboardCheck size={15} /></span><h2 className="text-sm font-bold text-slate-900">Recommended workflow</h2></div>
              <ol className="mt-4 space-y-3 text-[10px] leading-5 text-slate-600"><li className="flex gap-2"><span className="font-extrabold text-indigo-600">01</span><span>Fix crawl/indexability blockers before optimizing answer formatting.</span></li><li className="flex gap-2"><span className="font-extrabold text-indigo-600">02</span><span>Improve page structure, topic coverage and source evidence.</span></li><li className="flex gap-2"><span className="font-extrabold text-indigo-600">03</span><span>Use accurate structured data that matches visible page content.</span></li><li className="flex gap-2"><span className="font-extrabold text-indigo-600">04</span><span>Re-crawl after publishing changes and compare the new assessment.</span></li></ol>
              <button type="button" onClick={() => onOpenTab('fix-center')} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-[10px] font-bold text-slate-700 hover:bg-slate-50">Open Fix Center <ArrowRight size={12} /></button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Page-level evidence</h2><p className="mt-1 text-[10px] text-slate-500">These are the actual page records collected by the current crawler, not external AI search results.</p></div><span className="text-[9px] font-semibold text-slate-400">Showing up to 12 pages</span></div>
            <div className="mt-4 space-y-2">{pages.slice(0, 12).map(page => {
              const extra = page.extra || {};
              const pageSignals = aeo
                ? [((Number(extra.question_headings || 0) > 0 && Number(extra.answer_blocks || 0) > 0) || Number(extra.faq_schema_count || 0) > 0) ? 'Answer pattern detected' : 'No answer pattern detected', ((Array.isArray(extra.schema_types) && extra.schema_types.length > 0) || Number(extra.schema_blocks || 0) > 0) ? 'Structured data found' : 'No JSON-LD detected', page.is_indexable ? 'Indexable' : 'Not indexable']
                : [((Array.isArray(extra.schema_types) ? extra.schema_types : []).some((type: unknown) => /organization|person|localbusiness|brand|product/i.test(String(type))) || Boolean(extra.site_name || extra.publisher_name)) ? 'Entity schema found' : 'Entity schema not detected', hasTextEvidence(page) ? 'Content evidence found' : 'Limited evidence structure', hasTrustMetadata(page) ? 'Attribution metadata found' : 'Attribution not detected'];
              return <div key={page.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-slate-800">{page.title || page.url}</p><p className="mt-1 truncate text-[9px] text-slate-400">{page.url}</p></div><div className="flex flex-wrap gap-1.5">{pageSignals.map(signal => <span key={signal} className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold text-slate-600">{signal}</span>)}</div></div>;
            })}</div>
          </section>
        </>
      )}

      <section className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sky-950"><Info size={16} className="mt-0.5 shrink-0 text-sky-700" /><div><p className="text-[10px] font-bold">What this score does — and does not — mean</p><p className="mt-1 text-[10px] leading-5 text-sky-900/80">This is a transparent, crawl-derived readiness score based on the page signals listed above. It does not measure actual mentions, citations, answer inclusion or rankings inside ChatGPT, Gemini, Perplexity or Google AI features. Those outcomes require repeated tests against each platform or a connected data provider. No platform placement is guaranteed.</p></div>
      </section>

      {aeo ? <div className="flex flex-wrap items-center gap-2 text-[9px] text-slate-400"><span className="inline-flex items-center gap-1"><BookOpenText size={12} /> AEO focuses on questions and direct answers</span><span>·</span><button type="button" onClick={() => onOpenTab('geo')} className="font-semibold text-teal-700 hover:underline">Explore GEO workspace</button></div> : <div className="flex flex-wrap items-center gap-2 text-[9px] text-slate-400"><span className="inline-flex items-center gap-1"><WandSparkles size={12} /> GEO focuses on generative discovery and citations</span><span>·</span><button type="button" onClick={() => onOpenTab('ai-visibility')} className="font-semibold text-indigo-700 hover:underline">AI Visibility tracking setup</button></div>}
    </div>
  );
};

function hasTextEvidence(page: ScannedPage): boolean {
  const extra = page.extra || {};
  return page.word_count >= 250 && (Number(extra.list_count || 0) > 0 || Number(extra.table_count || 0) > 0 || Number(extra.external_citations || 0) > 0);
}

function hasTrustMetadata(page: ScannedPage): boolean {
  const extra = page.extra || {};
  return Boolean(extra.author || extra.date_published || extra.date_modified || extra.publisher_name);
}
