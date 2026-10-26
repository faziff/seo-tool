import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, Check, CheckCircle2, CircleDashed, Clipboard,
  Code2, FileCode2, LoaderCircle, Search, ShieldCheck, Sparkles, WandSparkles, XCircle
} from 'lucide-react';
import { ScanReport, FixDraft, FixStatus } from '../types';
import { generateFixDrafts, getFixDrafts, updateFixDraft } from '../services/api';

interface FixCenterPageProps {
  report: ScanReport | null;
  onFocusScanner: () => void;
}

type FilterKey = 'all' | FixStatus;

const severityStyles: Record<string, string> = {
  Critical: 'bg-rose-50 text-rose-700 border-rose-200',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-sky-50 text-sky-700 border-sky-200'
};

const statusStyles: Record<FixStatus, string> = {
  draft: 'bg-violet-50 text-violet-700 border-violet-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-slate-100 text-slate-500 border-slate-200'
};

function humanStatus(status: FixStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const FixCenterPage: React.FC<FixCenterPageProps> = ({ report, onFocusScanner }) => {
  const [fixes, setFixes] = useState<FixDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [remainingCount, setRemainingCount] = useState(0);
  const [busyFixId, setBusyFixId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!report) {
      setFixes([]);
      setRemainingCount(0);
      return;
    }
    setLoading(true);
    setFeedback(null);
    getFixDrafts(report.scan_id)
      .then((items) => {
        if (!active) return;
        setFixes(items);
        const unresolvedWithoutDraft = report.issues.filter((issue) =>
          !issue.resolved && !items.some((fix) => fix.issue_id === issue.id)
        ).length;
        setRemainingCount(unresolvedWithoutDraft);
      })
      .catch((error: any) => {
        if (active) setFeedback({ type: 'error', text: error?.message || 'Could not load saved fix drafts.' });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [report?.scan_id]);

  const counts = useMemo(() => ({
    all: fixes.length,
    draft: fixes.filter((fix) => fix.status === 'draft').length,
    approved: fixes.filter((fix) => fix.status === 'approved').length,
    rejected: fixes.filter((fix) => fix.status === 'rejected').length
  }), [fixes]);

  const visibleFixes = useMemo(() => {
    const text = query.trim().toLowerCase();
    return fixes.filter((fix) => {
      const matchesFilter = filter === 'all' || fix.status === filter;
      const matchesText = !text || [fix.issue_title, fix.affected_url, fix.category, fix.recommendation, fix.fix_explanation]
        .some((value) => String(value || '').toLowerCase().includes(text));
      return matchesFilter && matchesText;
    });
  }, [fixes, filter, query]);

  const handleGenerate = async () => {
    if (!report) return;
    setGenerating(true);
    setFeedback({ type: 'info', text: 'NOVA is preparing drafts from the audit evidence. Existing drafts will be kept.' });
    try {
      const result = await generateFixDrafts(report.scan_id, 15);
      setFixes(result.fixes);
      setRemainingCount(result.remaining_count);
      setFeedback({ type: result.generated_count ? 'success' : 'info', text: result.message });
    } catch (error: any) {
      setFeedback({ type: 'error', text: error?.message || 'Fix generation failed. Check the server logs and try again.' });
    } finally {
      setGenerating(false);
    }
  };

  const saveCode = async (fixId: string, code: string) => {
    setBusyFixId(fixId);
    try {
      const updated = await updateFixDraft(fixId, { code_snippet: code });
      setFixes((current) => current.map((item) => item.id === fixId ? updated : item));
      setFeedback({ type: 'success', text: 'Draft saved.' });
    } catch (error: any) {
      setFeedback({ type: 'error', text: error?.message || 'Draft could not be saved.' });
    } finally {
      setBusyFixId(null);
    }
  };

  const changeStatus = async (fix: FixDraft, status: FixStatus) => {
    setBusyFixId(fix.id);
    try {
      const updated = await updateFixDraft(fix.id, { status });
      setFixes((current) => current.map((item) => item.id === fix.id ? updated : item));
      setFeedback({ type: 'success', text: `Draft marked ${status}.` });
    } catch (error: any) {
      setFeedback({ type: 'error', text: error?.message || 'Could not update draft status.' });
    } finally {
      setBusyFixId(null);
    }
  };

  const copyCode = async (fix: FixDraft) => {
    try {
      await navigator.clipboard.writeText(fix.code_snippet);
      setFeedback({ type: 'success', text: `Code copied for “${fix.issue_title}”.` });
    } catch {
      setFeedback({ type: 'error', text: 'Clipboard access is unavailable in this browser context. Select the code and copy it manually.' });
    }
  };

  if (!report) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <div className="rounded-[28px] overflow-hidden bg-[#100d24] text-white p-8 sm:p-10 relative shadow-xl shadow-violet-950/10">
          <div className="absolute -right-16 -top-16 w-60 h-60 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="relative w-14 h-14 rounded-2xl border border-white/15 bg-white/10 flex items-center justify-center mb-6"><WandSparkles className="w-7 h-7 text-cyan-200" /></div>
          <p className="relative text-xs uppercase tracking-[0.2em] text-violet-200 font-bold">CROX remediation workspace</p>
          <h1 className="relative text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">Fix Center</h1>
          <p className="relative text-sm sm:text-base leading-7 text-slate-300 mt-4 max-w-xl">Turn audit findings into practical, reviewable code drafts. First run a website audit; Fix Center will use its recorded evidence to build the fix queue.</p>
          <button onClick={onFocusScanner} className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-white text-slate-950 px-5 py-3 text-sm font-bold hover:bg-cyan-50 transition-colors">Run a website audit <ArrowRight className="w-4 h-4" /></button>
        </div>
      </div>
    );
  }

  const filterButtons: { id: FilterKey; label: string; count: number }[] = [
    { id: 'all', label: 'All drafts', count: counts.all },
    { id: 'draft', label: 'Needs review', count: counts.draft },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'rejected', label: 'Rejected', count: counts.rejected }
  ];

  return (
    <div className="space-y-6 max-w-[1440px]">
      <section className="relative overflow-hidden rounded-[28px] bg-[#100d24] text-white p-6 sm:p-8 shadow-xl shadow-violet-950/10">
        <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute right-48 -bottom-28 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[11px] uppercase tracking-[0.15em] text-violet-100 font-bold"><Sparkles className="w-3.5 h-3.5 text-cyan-200" /> NOVA remediation studio</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4">Fix Center<span className="text-cyan-200">.</span></h1>
            <p className="text-sm text-slate-300 leading-6 mt-3">Review suggested changes for <span className="text-white font-semibold">{report.domain}</span>. Drafts are saved to this workspace, remain editable, and are never silently applied to the live website.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 min-w-32"><p className="text-[10px] tracking-wider uppercase text-slate-400 font-bold">Health score</p><p className="text-2xl font-extrabold mt-1">{report.health_score}<span className="text-xs font-medium text-slate-400"> / 100</span></p></div>
            <button onClick={handleGenerate} disabled={generating || loading || report.status !== 'completed' || report.issues.every((issue) => issue.resolved) || (remainingCount === 0 && fixes.length > 0)} className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-bold shadow-lg shadow-violet-950/25 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-w-48">
              {generating ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <WandSparkles className="w-4 h-4" />}
              {generating ? 'Generating drafts…' : fixes.length ? 'Generate more drafts' : 'Generate fix drafts'}
            </button>
          </div>
        </div>
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4"><p className="text-[11px] text-slate-400">Unresolved findings</p><p className="text-xl font-bold mt-1">{report.issues.filter((issue) => !issue.resolved).length}</p></div>
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4"><p className="text-[11px] text-slate-400">Saved drafts</p><p className="text-xl font-bold mt-1">{counts.all}</p></div>
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4"><p className="text-[11px] text-slate-400">Approved</p><p className="text-xl font-bold mt-1 text-emerald-200">{counts.approved}</p></div>
          <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4"><p className="text-[11px] text-slate-400">Not yet drafted</p><p className="text-xl font-bold mt-1 text-cyan-100">{remainingCount}</p></div>
        </div>
      </section>

      {feedback && <div className={`rounded-2xl border px-4 py-3 text-sm flex items-start gap-2.5 ${feedback.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-violet-200 bg-violet-50 text-violet-900'}`}><span className="mt-0.5">{feedback.type === 'error' ? <AlertCircle className="w-4 h-4" /> : feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <CircleDashed className="w-4 h-4" />}</span><span>{feedback.text}</span></div>}

      <div className="flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm w-full xl:w-auto overflow-x-auto">
          {filterButtons.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`shrink-0 flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${filter === item.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><span>{item.label}</span><span className={`px-1.5 py-0.5 rounded-md text-[10px] ${filter === item.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.count}</span></button>)}
        </div>
        <div className="relative w-full xl:max-w-sm"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issue, URL or recommendation…" className="w-full rounded-xl bg-white border border-slate-200 pl-10 pr-4 py-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/15 focus:border-violet-300" /></div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><LoaderCircle className="w-7 h-7 animate-spin text-violet-600 mx-auto" /><p className="text-sm font-semibold text-slate-700 mt-3">Loading saved fix drafts…</p></div>
      ) : visibleFixes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center mx-auto"><FileCode2 className="w-7 h-7" /></div>
          <h2 className="text-lg font-extrabold text-slate-900 mt-4">{fixes.length === 0 ? 'Your fix queue is ready' : 'No drafts match this view'}</h2>
          <p className="text-sm text-slate-500 leading-6 max-w-xl mx-auto mt-2">{fixes.length === 0 ? 'Generate drafts from unresolved findings in this audit. Up to 15 are created per batch, with local fallback guidance available when Gemini is not configured.' : 'Try a different status filter or clear the search field.'}</p>
          {fixes.length === 0 && <button onClick={handleGenerate} disabled={generating || loading || report.status !== 'completed' || report.issues.every((issue) => issue.resolved)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"><WandSparkles className="w-4 h-4" /> Generate first drafts</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
          {visibleFixes.map((fix) => (
            <article key={fix.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-violet-200/80 transition-all">
              <div className="p-5 pb-4">
                <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${severityStyles[fix.severity] || severityStyles.Medium}`}>{fix.severity} priority</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">{fix.category}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyles[fix.status]}`}>{humanStatus(fix.status)}</span><span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-400">{fix.generated_by === 'gemini' ? <Sparkles className="w-3 h-3 text-violet-500" /> : <Code2 className="w-3 h-3" />}{fix.generated_by === 'gemini' ? 'NOVA + Gemini' : 'Local rule-based'}</span></div>
                <h2 className="text-base font-extrabold text-slate-900 mt-3 leading-6">{fix.issue_title}</h2>
                <p className="text-[11px] font-mono text-slate-500 mt-1.5 break-all">{fix.affected_url}</p>
                <p className="text-sm text-slate-600 leading-6 mt-3">{fix.fix_explanation}</p>
                {fix.evidence && <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Audit evidence</p><p className="text-xs text-amber-950/80 leading-5 mt-1 break-words">{fix.evidence}</p></div>}
              </div>
              <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-2.5"><div className="flex items-center gap-2 text-[11px] font-bold text-slate-700"><FileCode2 className="w-4 h-4 text-violet-600" /> Editable fix draft</div><button onClick={() => copyCode(fix)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-violet-700 hover:border-violet-200"><Clipboard className="w-3.5 h-3.5" /> Copy code</button></div>
                <textarea value={fix.code_snippet} onChange={(event) => setFixes((current) => current.map((item) => item.id === fix.id ? { ...item, code_snippet: event.target.value } : item))} onBlur={(event) => { void saveCode(fix.id, event.currentTarget.value); }} rows={Math.min(9, Math.max(3, fix.code_snippet.split('\n').length))} aria-label={`Edit fix draft for ${fix.issue_title}`} className="w-full resize-y min-h-24 rounded-xl border border-slate-200 bg-[#111323] text-cyan-100 font-mono text-[11px] leading-5 p-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15" />
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400"><ShieldCheck className="w-3.5 h-3.5" /> Review before using on production</div>
                  <div className="flex items-center gap-2">
                    {fix.status !== 'rejected' && <button disabled={busyFixId === fix.id} onClick={() => void changeStatus(fix, 'rejected')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50"><XCircle className="w-3.5 h-3.5" /> Reject</button>}
                    {fix.status !== 'approved' ? <button disabled={busyFixId === fix.id} onClick={() => void changeStatus(fix, 'approved')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white shadow-sm disabled:opacity-50">{busyFixId === fix.id ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve draft</button> : <button disabled={busyFixId === fix.id} onClick={() => void changeStatus(fix, 'draft')} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 disabled:opacity-50"><CheckCircle2 className="w-3.5 h-3.5" /> Approved · Reopen</button>}
                    {fix.status === 'rejected' && <button disabled={busyFixId === fix.id} onClick={() => void changeStatus(fix, 'draft')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 disabled:opacity-50">Reopen draft</button>}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center leading-5">Fix drafts are stored in the CROX workspace data file. Approving a draft records your review state only; it does not deploy or modify a live site.</p>
    </div>
  );
};
