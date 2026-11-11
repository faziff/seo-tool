import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, ExternalLink, FileSearch, Search, ShieldAlert } from 'lucide-react';
import { ScanReport, PageChecklistItem } from '../types';

interface AuditChecklistPageProps { report: ScanReport; }
type Filter = 'all' | 'Missing' | 'Problem' | 'Found';

const statusIcon = (status: PageChecklistItem['status']) => {
  if (status === 'Found') return <CheckCircle2 size={16} />;
  if (status === 'Missing') return <ShieldAlert size={16} />;
  return <AlertTriangle size={16} />;
};

export const AuditChecklistPage: React.FC<AuditChecklistPageProps> = ({ report }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(report.pages?.[0]?.url || null);
  const pages = report.pages || [];

  const counts = useMemo(() => {
    const all = pages.flatMap(page => page.checklist?.items || []);
    return {
      total: all.length,
      found: all.filter(item => item.status === 'Found').length,
      problem: all.filter(item => item.status === 'Problem').length,
      missing: all.filter(item => item.status === 'Missing').length,
    };
  }, [pages]);

  const filteredPages = pages.map(page => ({
    ...page,
    checklistItems: (page.checklist?.items || []).filter(item => {
      if (filter !== 'all' && item.status !== filter) return false;
      const term = query.trim().toLowerCase();
      return !term || `${page.url} ${page.title || ''} ${item.label} ${item.detail}`.toLowerCase().includes(term);
    })
  })).filter(page => page.checklistItems.length > 0 || (!filter && !query));

  const statusClass = (status: PageChecklistItem['status']) => status === 'Found'
    ? 'audit-check-found' : status === 'Missing' ? 'audit-check-missing' : 'audit-check-problem';

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] font-bold text-indigo-600 mb-2"><span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-50"><ClipboardCheck size={14} /></span> Page-level quality checks</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Audit checklist</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-6">Review metadata, headings, canonical tags, image alt text, structured data, social tags and HTTPS one page at a time.</p>
      </div>
      <a className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800" href={report.target_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open audited site</a>
    </div>

    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Checks recorded</div><div className="mt-2 text-2xl font-extrabold text-slate-900">{counts.total}</div><div className="mt-1 text-[10px] text-slate-400">Across {pages.length} crawled pages</div></div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><div className="text-xs text-emerald-700">Found</div><div className="mt-2 text-2xl font-extrabold text-emerald-800">{counts.found}</div><div className="mt-1 text-[10px] text-emerald-700/70">Checks detected as present</div></div>
      <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4"><div className="text-xs text-amber-700">Needs review</div><div className="mt-2 text-2xl font-extrabold text-amber-800">{counts.problem}</div><div className="mt-1 text-[10px] text-amber-700/70">Present, but may need work</div></div>
      <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4"><div className="text-xs text-rose-700">Missing</div><div className="mt-2 text-2xl font-extrabold text-rose-800">{counts.missing}</div><div className="mt-1 text-[10px] text-rose-700/70">Not found by this crawl</div></div>
    </div>

    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div><h2 className="font-bold text-sm text-slate-900">Page checklist details</h2><p className="text-xs text-slate-500 mt-1">Results are based on the HTML captured during this scan.</p></div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative"><Search size={14} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search URLs or checks" className="w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-xs outline-none focus:border-indigo-400" /></div>
          <select value={filter} onChange={e => setFilter(e.target.value as Filter)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-indigo-400"><option value="all">All statuses</option><option value="Missing">Missing</option><option value="Problem">Needs review</option><option value="Found">Found</option></select>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {filteredPages.map(page => {
          const key = page.url;
          const isOpen = expanded === key;
          const pageItems = page.checklistItems;
          const issues = pageItems.filter(item => item.status !== 'Found').length;
          return <article key={key} className="audit-check-page">
            <button type="button" className="w-full px-4 sm:px-5 py-4 text-left flex items-center gap-3 hover:bg-slate-50/80 transition-colors" onClick={() => setExpanded(isOpen ? null : key)} aria-expanded={isOpen}>
              <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><FileSearch size={17} /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-800 truncate">{page.title || 'Untitled page'}</span><span className="block text-[10px] text-slate-400 mt-1 truncate">{page.url}</span></span>
              <span className="hidden sm:inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{pageItems.length} checks</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${issues ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{issues ? `${issues} to review` : 'All found'}</span>
              {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
            </button>
            {isOpen && <div className="px-4 sm:px-5 pb-5 pt-1 space-y-2">
              {pageItems.map(item => <div key={`${key}-${item.key}`} className="rounded-2xl border border-slate-100 p-4 grid grid-cols-1 lg:grid-cols-[170px_minmax(0,1fr)] gap-3">
                <div><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>{statusIcon(item.status)}{item.status === 'Problem' ? 'Needs review' : item.status}</span><h3 className="text-xs font-bold text-slate-800 mt-2">{item.label}</h3></div>
                <div className="min-w-0"><p className="text-xs leading-5 text-slate-600 break-words">{item.detail}</p><div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Recommended next step</p><p className="text-xs leading-5 text-slate-600">{item.fix}</p></div></div>
              </div>)}
            </div>}
          </article>;
        })}
        {filteredPages.length === 0 && <div className="p-12 text-center"><Search size={22} className="mx-auto text-slate-300 mb-3" /><h3 className="font-bold text-sm text-slate-700">No checklist items match</h3><p className="text-xs text-slate-500 mt-1">Try a broader search or another status filter.</p></div>}
      </div>
    </section>
    <p className="text-[10px] text-slate-400 leading-5">Checklist status is generated from the page content available to the crawler. A “Found” result confirms presence, not a guarantee that a page meets every search-engine guideline.</p>
  </div>;
};
