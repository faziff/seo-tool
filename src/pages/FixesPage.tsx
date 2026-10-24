import React, { useMemo, useState } from 'react';
import { Check, Copy, RefreshCw, Sparkles, Wrench, X, AlertTriangle, CircleCheck } from 'lucide-react';
import { ScanReport, Issue } from '../types';
import { generateAIFix } from '../services/api';

interface FixesPageProps { report: ScanReport | null; onRunAudit: () => void; }
type FixState = { status: 'draft' | 'approved' | 'rejected'; content: string; loading?: boolean; message?: string };

export const FixesPage: React.FC<FixesPageProps> = ({ report, onRunAudit }) => {
  const [fixes, setFixes] = useState<Record<string, FixState>>({});
  const [filter, setFilter] = useState<'all' | 'open' | 'approved'>('all');
  const issues = useMemo(() => (report?.issues || []).filter(i => !i.resolved), [report]);
  const visibleIssues = issues.filter(i => filter === 'all' || (filter === 'open' ? !fixes[i.id] || fixes[i.id].status === 'draft' : fixes[i.id]?.status === 'approved'));

  const createFix = async (issue: Issue) => {
    setFixes(prev => ({ ...prev, [issue.id]: { ...(prev[issue.id] || { status: 'draft', content: '' }), status: 'draft', loading: true, message: undefined } }));
    try {
      const result = await generateAIFix(issue);
      const content = result.fix_content || result.remediation_guide || result.message || 'No fix was returned. Check the AI integration settings and try again.';
      setFixes(prev => ({ ...prev, [issue.id]: { status: 'draft', content, loading: false, message: result.status === 'unconfigured' ? 'Rule-based guidance — connect Gemini for AI-generated fixes.' : undefined } }));
    } catch (error: any) {
      setFixes(prev => ({ ...prev, [issue.id]: { status: 'draft', content: '', loading: false, message: error?.message || 'Could not generate a fix. Check that the API server is running.' } }));
    }
  };

  const copyFix = async (content: string) => {
    try { await navigator.clipboard.writeText(content); } catch { /* Clipboard permissions may be unavailable on non-HTTPS origins. */ }
  };

  return <div className="space-y-6">
    <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-7 md:p-9 text-white shadow-xl">
      <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="max-w-2xl"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-violet-200"><Sparkles className="h-3.5 w-3.5"/> CROX REMEDIATION STUDIO</div>
          <h1 className="mt-4 text-2xl md:text-3xl font-bold tracking-tight">Find it. Fix it. Verify it.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Turn audit findings into actionable implementation guidance. Review every draft before making changes to your website.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 shrink-0"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">Open issues</p><p className="mt-1 text-2xl font-bold">{issues.length}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">Approved drafts</p><p className="mt-1 text-2xl font-bold">{Object.values(fixes).filter(f => f.status === 'approved').length}</p></div></div>
      </div>
    </div>
    {!report ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Wrench className="h-6 w-6"/></div><h2 className="mt-4 text-lg font-bold text-slate-900">Run an audit to start fixing issues</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">CROX will list detected problems here and help you prepare fixes based on the audit evidence.</p><button onClick={onRunAudit} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Run website audit</button></div> : issues.length === 0 ? <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-10 text-center"><CircleCheck className="mx-auto h-10 w-10 text-emerald-600"/><h2 className="mt-3 text-lg font-bold text-slate-900">No open issues in this scan</h2><p className="mt-1 text-sm text-slate-600">Run another audit after publishing changes to verify your site again.</p></div> : <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Recommended fixes</h2><p className="mt-1 text-xs text-slate-500">For {report.domain} · {issues.length} unresolved findings</p></div><div className="flex gap-2">{(['all','open','approved'] as const).map(v => <button key={v} onClick={() => setFilter(v)} className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize ${filter === v ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{v === 'all' ? 'All issues' : v === 'open' ? 'Needs review' : 'Approved'}</button>)}</div></div>
      <div className="space-y-4">{visibleIssues.map(issue => { const fix = fixes[issue.id]; return <article key={issue.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="p-5 md:p-6"><div className="flex flex-col md:flex-row md:items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${issue.severity === 'Critical' ? 'bg-rose-100 text-rose-700' : issue.severity === 'High' ? 'bg-orange-100 text-orange-700' : issue.severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{issue.severity}</span><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">{issue.category}</span><span className="text-xs text-slate-400">{issue.pages_affected} page{issue.pages_affected === 1 ? '' : 's'} affected</span></div><h3 className="mt-3 text-base font-bold text-slate-900">{issue.title}</h3><p className="mt-1 break-all text-xs text-slate-500">{issue.affected_url}</p><p className="mt-3 text-sm leading-6 text-slate-600">{issue.explanation}</p>{issue.evidence && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-700">Evidence: </span>{issue.evidence}</div>}</div><button disabled={!!fix?.loading} onClick={() => createFix(issue)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${fix?.loading ? 'animate-spin' : ''}`}/>{fix?.content ? 'Regenerate draft' : 'Generate fix'}</button></div>
      {fix && <div className="mt-5 border-t border-slate-100 pt-5">{fix.loading ? <div className="flex items-center gap-3 rounded-xl bg-violet-50 p-4 text-sm text-violet-700"><RefreshCw className="h-4 w-4 animate-spin"/> Preparing remediation guidance…</div> : <><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-bold text-slate-900">Fix draft</h4><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${fix.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : fix.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{fix.status}</span></div>{fix.message && <p className="mt-2 flex items-start gap-2 text-xs text-amber-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{fix.message}</p>}{fix.content && <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">{fix.content}</pre>}<div className="mt-3 flex flex-wrap gap-2"><button onClick={() => copyFix(fix.content)} disabled={!fix.content} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Copy className="h-3.5 w-3.5"/>Copy draft</button><button onClick={() => setFixes(p => ({...p, [issue.id]: {...p[issue.id], status: 'approved'}}))} disabled={!fix.content} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check className="h-3.5 w-3.5"/>Approve</button><button onClick={() => setFixes(p => ({...p, [issue.id]: {...p[issue.id], status: 'rejected'}}))} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"><X className="h-3.5 w-3.5"/>Reject</button></div><p className="mt-3 text-[11px] text-slate-400">Approval saves this review state in the current session only. CROX does not automatically publish changes to your website.</p></>}</div>}</div></article>; })}</div>
    </>}
  </div>;
};
