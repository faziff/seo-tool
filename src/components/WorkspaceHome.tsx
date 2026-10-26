import React, { useMemo, useState } from 'react';
import {
  Activity, ArrowRight, BarChart3, BookOpen, Check, ChevronDown, ChevronRight,
  CircleHelp, Code2, FileText, Globe2, Layers3, MapPin, Plus, Search, ShieldCheck,
  Sparkles, Target, TrendingUp, X, Zap
} from 'lucide-react';
import { NovaOrb } from './NovaOrb';
import type { Project, RecentScanItem, ScanProgress, ScanReport } from '../types';

interface WorkspaceHomeProps {
  userName: string;
  projects: Project[];
  recentScans: RecentScanItem[];
  report: ScanReport | null;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  onAnalyzeTarget: (target: string) => void;
  onOpenTab: (tab: string) => void;
  onOpenAI: () => void;
  onCreateProject: (input: { name: string; target_url: string; country: string }) => Promise<Project>;
  onSelectScan: (scanId: string) => void;
}

const productCards = [
  { id: 'site-audit', title: 'SEO Toolkit', description: 'Audit your website, find technical issues and uncover keyword opportunities.', icon: Search, tint: 'bg-emerald-50 text-emerald-600', available: true, tag: 'Available now' },
  { id: 'ai-visibility', title: 'AI Visibility', description: 'Prepare to track brand mentions and citations across AI answer engines.', icon: Sparkles, tint: 'bg-violet-50 text-violet-600', available: false, tag: 'Roadmap' },
  { id: 'market-research', title: 'Traffic & Market', description: 'Compare competitor positioning and explore market opportunities.', icon: BarChart3, tint: 'bg-blue-50 text-blue-600', available: true, tag: 'Available now' },
  { id: 'local-seo', title: 'Local', description: 'A future workspace for local listings, map rankings and review insights.', icon: MapPin, tint: 'bg-amber-50 text-amber-600', available: false, tag: 'Roadmap' },
  { id: 'content', title: 'Content', description: 'Find content gaps and shape a search-focused editorial workflow.', icon: FileText, tint: 'bg-teal-50 text-teal-600', available: true, tag: 'Starter tools' },
  { id: 'advertising', title: 'Advertising', description: 'A planned hub for competitor ad research and campaign planning.', icon: Target, tint: 'bg-orange-50 text-orange-600', available: false, tag: 'Roadmap' }
];

const countryOptions = [
  { value: 'PK', label: 'Pakistan' },
  { value: 'IN', label: 'India' },
  { value: 'BD', label: 'Bangladesh' },
  { value: 'LK', label: 'Sri Lanka' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'GLOBAL', label: 'Global' }
];

function looksLikeWebsite(value: string): boolean {
  return /^(https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value.trim());
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const WorkspaceHome: React.FC<WorkspaceHomeProps> = ({
  userName, projects, recentScans, report, isScanning, scanProgress,
  onAnalyzeTarget, onOpenTab, onOpenAI, onCreateProject, onSelectScan
}) => {
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [country, setCountry] = useState('PK');
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [monitoringOpen, setMonitoringOpen] = useState(false);
  const [createSuccess, setCreateSuccess] = useState('');

  const greetingName = userName.trim().split(/\s+/)[0] || 'there';
  const scanByDomain = useMemo(() => {
    const map = new Map<string, RecentScanItem>();
    recentScans.forEach(scan => {
      const key = scan.domain.toLowerCase();
      if (!map.has(key)) map.set(key, scan);
    });
    return map;
  }, [recentScans]);

  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (looksLikeWebsite(value)) {
      onAnalyzeTarget(value);
    } else {
      try { sessionStorage.setItem('crox_keyword_seed', value); } catch { /* storage can be unavailable in private browsing */ }
      onOpenTab('keyword-research');
    }
  };

  const saveProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setProjectError('');
    setCreateSuccess('');
    const cleanUrl = projectUrl.trim();
    if (!projectName.trim()) return setProjectError('Enter a name for this project.');
    if (!cleanUrl) return setProjectError('Enter a public website domain or URL.');
    setProjectSaving(true);
    try {
      const saved = await onCreateProject({ name: projectName.trim(), target_url: cleanUrl, country });
      setShowCreate(false);
      setProjectName('');
      setProjectUrl('');
      setCountry('PK');
      setCreateSuccess(saved.already_exists ? `A project for ${saved.domain} already exists. It is shown below.` : `Project created for ${saved.domain}.`);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Project creation failed.');
    } finally {
      setProjectSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-slate-500"><Layers3 size={13} /> CROX Workspace</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">Welcome back, {greetingName}</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Your search performance, projects and growth tools in one place.</p>
        </div>
        <div className="mt-2 flex items-center gap-2 sm:mt-0">
          <button type="button" onClick={onOpenAI} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 transition hover:bg-violet-100"><NovaOrb size={18} /> Ask NOVA</button>
          <button type="button" onClick={() => { setShowCreate(true); setProjectError(''); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-950"><Plus size={15} /> Create Project</button>
        </div>
      </div>

      <form onSubmit={runSearch} className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:flex sm:items-center sm:gap-2 sm:p-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 sm:py-2.5">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input value={query} onChange={event => setQuery(event.target.value)} disabled={isScanning} placeholder="Enter website or keyword" aria-label="Enter a website or keyword to analyze" className="w-full min-w-0 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0" />
          {query && <button type="button" onClick={() => setQuery('')} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Clear search"><X size={14} /></button>}
        </div>
        <button type="submit" disabled={!query.trim() || isScanning} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white transition hover:bg-indigo-950 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><span>{isScanning ? 'Analyzing…' : 'Analyze'}</span>{isScanning ? <Activity size={14} className="animate-pulse" /> : <ArrowRight size={14} />}</button>
      </form>

      {isScanning && scanProgress && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-semibold text-indigo-900">{scanProgress.current_action}</span><span className="font-bold tabular-nums text-indigo-700">{scanProgress.progress}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.max(4, Math.min(100, scanProgress.progress))}%` }} /></div>
          <p className="mt-2 text-[10px] text-indigo-700">{scanProgress.pages_crawled} pages crawled · {scanProgress.total_urls_found} URLs discovered</p>
        </div>
      )}

      <section aria-labelledby="product-categories-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 id="product-categories-title" className="text-sm font-bold text-slate-900">Explore CROX tools</h2><span className="text-[10px] text-slate-400">Modules unlock in phases</span></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {productCards.map(card => {
            const Icon = card.icon;
            return (
              <button key={card.id} type="button" onClick={() => onOpenTab(card.id)} className="group flex min-h-[150px] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/25">
                <div className="mb-3 flex items-center justify-between gap-2"><span className={`grid h-8 w-8 place-items-center rounded-xl ${card.tint}`}><Icon size={16} /></span><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${card.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{card.tag}</span></div>
                <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">{card.title}</span>
                <span className="mt-1.5 flex-1 text-[10px] leading-[1.6] text-slate-500">{card.description}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 group-hover:text-indigo-600">{card.available ? 'Open module' : 'View roadmap'} <ChevronRight size={12} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><h2 className="text-sm font-bold text-slate-900">Projects</h2><p className="mt-1 text-[10px] text-slate-500">Save domains to organize audits and future monitoring in your workspace.</p></div>
          <button type="button" onClick={() => { setShowCreate(true); setProjectError(''); }} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 sm:self-auto"><Plus size={13} /> Create Project</button>
        </div>
        {createSuccess && <div className="mx-4 mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-800 sm:mx-5">{createSuccess}</div>}
        {projects.length === 0 ? (
          <div className="px-5 py-9 text-center"><div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><Globe2 size={18} /></div><p className="text-xs font-semibold text-slate-800">No projects yet</p><p className="mx-auto mt-1 max-w-md text-[10px] leading-5 text-slate-500">Create a project to save its domain and country. Run a website audit to populate the Site Health metric. CROX never fabricates live traffic, keyword or backlink data.</p><button type="button" onClick={() => { setShowCreate(true); setProjectError(''); }} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-semibold text-white hover:bg-indigo-950"><Plus size={13} /> Create your first project</button></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map(project => {
              const scan = scanByDomain.get(project.domain.toLowerCase());
              const activeScore = report?.domain.toLowerCase() === project.domain.toLowerCase() ? report.health_score : scan?.health_score;
              const scoreAvailable = scan?.status === 'completed' || report?.domain.toLowerCase() === project.domain.toLowerCase();
              return (
                <div key={project.id} className="grid grid-cols-1 gap-3 px-4 py-4 transition hover:bg-slate-50/70 sm:px-5 lg:grid-cols-[minmax(180px,1.4fr)_repeat(4,minmax(90px,.7fr))_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Globe2 size={17} /></div><div className="min-w-0"><button type="button" onClick={() => onAnalyzeTarget(project.target_url)} className="block max-w-full truncate text-left text-xs font-bold text-indigo-700 hover:underline">{project.name}</button><p className="mt-0.5 truncate text-[10px] text-slate-500">{project.domain} <span className="mx-1 text-slate-300">·</span>{project.country}</p><p className="mt-1 text-[9px] text-slate-400">Added {formatDate(project.created_at)}</p></div></div>
                  <div><p className="text-[10px] font-semibold text-slate-700">Site Health</p><p className="mt-1 text-sm font-extrabold tabular-nums text-slate-900">{scoreAvailable && typeof activeScore === 'number' ? <>{Math.round(activeScore)}<span className="ml-0.5 text-[9px] font-medium text-slate-400">/100</span></> : <span className="text-xs font-medium text-slate-400">Not audited</span>}</p>{scan?.status === 'completed' && <p className="text-[9px] text-emerald-600">Audit completed</p>}</div>
                  <div><p className="text-[10px] font-semibold text-slate-700">AI Visibility</p><p className="mt-1 text-xs font-semibold text-slate-400">Not tracked</p></div>
                  <div><p className="text-[10px] font-semibold text-slate-700">Organic Traffic</p><p className="mt-1 text-xs font-semibold text-slate-400">Connect analytics</p></div>
                  <div><p className="text-[10px] font-semibold text-slate-700">Backlinks</p><p className="mt-1 text-xs font-semibold text-slate-400">Provider needed</p></div>
                  <div className="flex items-center gap-2 lg:justify-end"><button type="button" onClick={() => onAnalyzeTarget(project.target_url)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-semibold text-white hover:bg-indigo-950"><Search size={12} /> Analyze</button><button type="button" title="Open reports for this project" onClick={() => { const match = recentScans.find(item => item.domain.toLowerCase() === project.domain.toLowerCase()); if (match) onSelectScan(match.id); else onOpenTab('reports'); }} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-white hover:text-indigo-700"><FileText size={13} /></button></div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <button type="button" onClick={() => setMonitoringOpen(value => !value)} aria-expanded={monitoringOpen} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"><span><span className="block text-xs font-bold text-slate-900">Domains for monitoring</span><span className="mt-1 block text-[10px] text-slate-500">Your saved project domains, ready for future scheduled tracking.</span></span><span className="inline-flex items-center gap-2 text-[10px] font-semibold text-slate-500">{monitoringOpen ? 'Close' : 'Open'} <ChevronDown size={14} className={`transition-transform ${monitoringOpen ? 'rotate-180' : ''}`} /></span></button>
        {monitoringOpen && <div className="border-t border-slate-100 px-4 py-3 sm:px-5">{projects.length ? <div className="flex flex-wrap gap-2">{projects.map(project => <span key={project.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-600"><Globe2 size={11} /> {project.domain}</span>)}</div> : <p className="text-[10px] text-slate-500">Create a project to add your first domain. Scheduled tracking is part of a later phase.</p>}</div>}
      </section>

      {recentScans.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">Recent activity</h2><button type="button" onClick={() => onOpenTab('reports')} className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline">All reports <ArrowRight size={12} /></button></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{recentScans.slice(0, 3).map(scan => <button key={scan.id} onClick={() => onSelectScan(scan.id)} type="button" className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50"><span className={`h-2 w-2 shrink-0 rounded-full ${scan.status === 'completed' ? 'bg-emerald-500' : scan.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{scan.domain}</span><span className="mt-1 block text-[10px] text-slate-500">{scan.status === 'completed' ? `Site Health ${Math.round(scan.health_score)}/100` : scan.status.charAt(0).toUpperCase() + scan.status.slice(1)} · {formatDate(scan.created_at)}</span></span><ChevronRight size={14} className="shrink-0 text-slate-400" /></button>)}</div></section>}

      {report && <div className="flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50/70 p-4"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-violet-700"><BookOpen size={15} /></div><div className="min-w-0 flex-1"><p className="text-xs font-bold text-violet-950">Your next best action</p><p className="mt-1 text-[10px] leading-5 text-violet-800">{report.issues.length ? `Review the ${report.issues[0].severity.toLowerCase()} priority issue “${report.issues[0].title}” from ${report.domain} and prepare a safe fix.` : `Review the latest scan for ${report.domain} and keep an eye on technical health.`}</p></div><button type="button" onClick={() => onOpenTab(report.issues.length ? 'fix-center' : 'site-audit')} className="shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-2 text-[10px] font-semibold text-violet-800 hover:bg-violet-100">Review</button></div>}

      {showCreate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !projectSaving) setShowCreate(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-project-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-3"><div><div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Layers3 size={17} /></div><h2 id="create-project-title" className="text-lg font-extrabold text-slate-900">Create a project</h2><p className="mt-1 text-xs leading-5 text-slate-500">Save a domain, choose its target market and keep related SEO work organized.</p></div><button type="button" onClick={() => setShowCreate(false)} disabled={projectSaving} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close create project dialog"><X size={17} /></button></div>
            <form onSubmit={saveProject} className="space-y-4">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Project name</span><input value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="e.g. Night Might Store" maxLength={80} required className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Website URL or domain</span><div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/15"><Globe2 size={15} className="shrink-0 text-slate-400" /><input value={projectUrl} onChange={event => setProjectUrl(event.target.value)} placeholder="https://example.com" maxLength={2048} required className="w-full min-w-0 bg-transparent py-3 text-sm text-slate-900 outline-none" /></div><span className="mt-1 block text-[10px] text-slate-400">Only public websites can be saved.</span></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Target market</span><select value={country} onChange={event => setCountry(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15">{countryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              {projectError && <p role="alert" className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{projectError}</p>}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowCreate(false)} disabled={projectSaving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={projectSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-950 disabled:opacity-60">{projectSaving ? <><Activity size={14} className="animate-pulse" /> Creating…</> : <><Check size={14} /> Create project</>}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
