import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, BarChart3, CalendarDays, Check, ChevronDown,
  CircleHelp, Clock3, Copy, ExternalLink, Globe2, MoreHorizontal,
  Monitor, Plus, Search, Share2, ShieldCheck, Sparkles, TrendingUp,
  Zap, AlertTriangle, Download, Settings2, Link2, FolderKanban
} from 'lucide-react';
import type { Issue, Project, RecentScanItem, ScanReport } from '../types';
import { getGoogleDataDashboard, type GoogleDataDashboard } from '../services/api';

interface DashboardOverviewProps {
  userName: string;
  report: ScanReport | null;
  recentScans: RecentScanItem[];
  projects: Project[];
  onOpenProjects: () => void;
  onOpenTab: (tab: string) => void;
  onOpenAI: () => void;
  onSelectScan: (scanId: string) => void;
  onSelectIssue: (issue: Issue) => void;
}

const number = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat().format(value);
const dateLabel = (value?: string | null) => {
  if (!value) return 'No audit yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const shortDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function SiteHealthGauge({ score }: { score: number | null }) {
  const safeScore = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div className="crox-ref-health-gauge" aria-label={score == null ? 'Site health not available' : `Site health ${score} percent`}>
      <svg viewBox="0 0 164 92" role="img" aria-hidden="true">
        <path className="crox-ref-gauge-track" d="M 13 82 A 69 69 0 0 1 151 82" pathLength="100" />
        <path className="crox-ref-gauge-value" d="M 13 82 A 69 69 0 0 1 151 82" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - safeScore} />
        <path className="crox-ref-gauge-needle" d="M82 82 L45 54" />
        <circle cx="82" cy="82" r="5" className="crox-ref-gauge-hub" />
      </svg>
      <div className="crox-ref-gauge-copy"><strong>{score == null ? '—' : score}</strong><small>{score == null ? 'No audit' : '% Health'}</small></div>
    </div>
  );
}

function MetricCard({ label, value, note, accent, children }: {
  label: string; value: string; note: string; accent?: string; children?: React.ReactNode;
}) {
  return (
    <article className="crox-ref-metric-card">
      <div className="crox-ref-metric-label">{label}</div>
      <div className={`crox-ref-metric-value ${accent || ''}`}>{value}</div>
      <div className="crox-ref-metric-note">{note}</div>
      {children}
    </article>
  );
}

function exportAudit(report: ScanReport | null, domain: string) {
  if (!report) return;
  const payload = {
    product: 'CROX',
    domain,
    exported_at: new Date().toISOString(),
    site_health: report.health_score,
    performance_score: report.performance_score,
    pages_crawled: report.pages_crawled,
    total_urls_found: report.total_urls_found,
    redirects_found: report.redirects_found,
    broken_links_found: report.broken_links_found,
    severity_counts: report.severity_counts,
    issues: report.issues.map(issue => ({
      title: issue.title, category: issue.category, severity: issue.severity,
      pages_affected: issue.pages_affected, affected_url: issue.affected_url,
      recommendation: issue.recommendation, resolved: issue.resolved
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `crox-audit-${domain.replace(/[^a-z0-9.-]/gi, '-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  userName, report, recentScans, projects, onOpenProjects, onOpenTab,
  onOpenAI, onSelectScan, onSelectIssue
}) => {
  const [chartMetric, setChartMetric] = useState<'health' | 'pages'>('health');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [source, setSource] = useState<'crox' | 'analytics' | 'search-console'>('crox');
  const device = 'Desktop';
  const market = 'US';
  const [period, setPeriod] = useState('Last 30 days');
  const searchEngine = 'Google Search';
  const [trackKeywords, setTrackKeywords] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share');
  const [googleData, setGoogleData] = useState<GoogleDataDashboard | null>(null);
  const [googleDataLoading, setGoogleDataLoading] = useState(false);
  const [googleDataError, setGoogleDataError] = useState('');
  const googleDays = period === 'Last 7 days' ? 7 : period === 'Last 90 days' ? 90 : 30;
  useEffect(() => { if (!selectedProjectId && projects.length) setSelectedProjectId(projects[0].id); }, [projects, selectedProjectId]);
  const selectedProject = projects.find(project => project.id === selectedProjectId) || projects[0];
  const dashboardProjectId = selectedProject?.id || '';

  useEffect(() => {
    let active = true;
    if (!dashboardProjectId) {
      setGoogleData(null);
      setGoogleDataError('Create a CROX project before connecting its Google properties.');
      return () => { active = false; };
    }
    setGoogleDataLoading(true);
    setGoogleDataError('');
    getGoogleDataDashboard(dashboardProjectId, googleDays)
      .then(data => { if (active) setGoogleData(data); })
      .catch(error => { if (active) setGoogleDataError(error instanceof Error ? error.message : 'Google analytics data could not be loaded.'); })
      .finally(() => { if (active) setGoogleDataLoading(false); });
    return () => { active = false; };
  }, [dashboardProjectId, googleDays]);

  const completedScans = useMemo(() => {
    const now = Date.now();
    const rangeDays = period === 'Last 7 days' ? 7 : period === 'Last 30 days' ? 30 : period === 'Last 90 days' ? 90 : null;
    return recentScans
      .filter(scan => scan.status === 'completed')
      .filter(scan => {
        if (rangeDays == null) return true;
        const timestamp = new Date(scan.completed_at || scan.created_at).getTime();
        return Number.isFinite(timestamp) && timestamp >= now - rangeDays * 24 * 60 * 60 * 1000;
      })
      .slice(0, 12)
      .reverse();
  }, [recentScans, period]);
  const unresolvedIssues = report?.issues.filter(issue => !issue.resolved) ?? [];
  const targetDomain = selectedProject?.domain || report?.domain || selectedProject?.name || 'your website';
  const indexedPages = report?.pages?.filter(page => page.is_indexable).length ?? null;
  const severity = report?.severity_counts ?? { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const warningCount = severity.Medium + severity.Low;
  const chartValues = completedScans.map(scan => chartMetric === 'health' ? scan.health_score : scan.pages_crawled);
  const maxChartValue = chartMetric === 'health' ? 100 : Math.max(10, ...chartValues, 1);
  const chartPoints = completedScans.map((scan, index) => {
    const value = chartMetric === 'health' ? scan.health_score : scan.pages_crawled;
    return {
      scan, value,
      x: completedScans.length === 1 ? 500 : 40 + (index / (completedScans.length - 1)) * 920,
      y: 190 - (Math.max(0, value) / maxChartValue) * 160
    };
  });
  const linePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = chartPoints.length > 1 ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} 196 L ${chartPoints[0].x} 196 Z` : '';
  const siteHealth = report?.health_score ?? null;
  const latestDate = report ? dateLabel(report.completed_at || report.created_at) : 'No audit yet';
  const firstPriorityIssue = unresolvedIssues.find(issue => issue.severity === 'Critical' || issue.severity === 'High') || unresolvedIssues[0];

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareLabel('Copied');
      window.setTimeout(() => setShareLabel('Share'), 1600);
    } catch {
      setShareLabel('Copy unavailable');
      window.setTimeout(() => setShareLabel('Share'), 1600);
    }
  };

  const openGoogleSearch = () => {
    const domain = report?.domain || projects[0]?.domain;
    if (domain) window.open(`https://www.google.com/search?q=${encodeURIComponent(`site:${domain}`)}`, '_blank', 'noopener,noreferrer');
    else window.open('https://www.google.com/search', '_blank', 'noopener,noreferrer');
  };

  const selectSource = (next: 'crox' | 'analytics' | 'search-console') => {
    setSource(next);
  };

  return (
    <div className="crox-ref-dashboard">
      <div className="crox-ref-breadcrumb"><span>Home</span><ChevronDown size={13} className="crox-ref-breadcrumb-chevron" /><strong>SEO</strong></div>

      <div className="crox-ref-page-heading">
        <div className="crox-ref-heading-copy">
          <h1>SEO Executive Dashboard: {targetDomain}</h1>
          <p>Track website health, search performance and technical SEO activity from one workspace.</p>
        </div>
        <div className="crox-ref-heading-actions">
          <label className="crox-ref-track-keywords"><input type="checkbox" checked={trackKeywords} onChange={event => { setTrackKeywords(event.target.checked); if (event.target.checked) onOpenTab('position-tracking'); }} /> Track Keywords</label>
          <button type="button" className="crox-ref-dark-button" onClick={onOpenProjects}><Plus size={16} /> Create Project</button>
          <button type="button" className="crox-ref-outline-button" onClick={openGoogleSearch}><Search size={16} /> Google Search</button>
          <button type="button" className="crox-ref-outline-button share" onClick={handleShare}><Share2 size={15} /> {shareLabel}</button>
          <div className="crox-ref-dashboard-more-wrap">
            <button type="button" className="crox-ref-round-button" onClick={() => setMoreOpen(value => !value)} aria-label="More dashboard actions" aria-expanded={moreOpen}><MoreHorizontal size={18} /></button>
            {moreOpen && <div className="crox-ref-dashboard-menu">
              <button type="button" onClick={() => { setMoreOpen(false); onOpenTab('reports'); }}><Download size={14} /> Open reports & exports</button>
              <button type="button" onClick={() => { setMoreOpen(false); onOpenTab('settings'); }}><Settings2 size={14} /> Manage integrations</button>
              <button type="button" onClick={() => { setMoreOpen(false); onOpenAI(); }}><Sparkles size={14} /> Ask CROX AI</button>
            </div>}
          </div>
        </div>
      </div>

      <div className="crox-ref-filter-row" aria-label="Dashboard filters">
        {projects.length > 1 && <label className="crox-ref-filter" title="Choose which CROX project to view"><FolderKanban size={15} /><select value={selectedProjectId} onChange={event => setSelectedProjectId(event.target.value)} aria-label="Dashboard project">{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.domain}</option>)}</select><ChevronDown size={13} /></label>}
        <label className="crox-ref-filter" title="Device segmentation becomes available after an analytics source is connected"><Monitor size={15} /><select value={device} disabled aria-label="Device (connect analytics to enable)"><option>Desktop</option><option>Mobile</option><option>Tablet</option></select><ChevronDown size={13} /></label>
        <label className="crox-ref-filter" title="Market segmentation becomes available after an analytics source is connected"><Globe2 size={15} /><select value={market} disabled aria-label="Market (connect analytics to enable)"><option value="US">🇺🇸 US</option><option value="UK">🇬🇧 UK</option><option value="PK">🇵🇰 PK</option></select><ChevronDown size={13} /></label>
        <label className="crox-ref-filter"><CalendarDays size={15} /><select value={period} onChange={event => setPeriod(event.target.value)} aria-label="Date range"><option>Last 30 days</option><option>Last 7 days</option><option>Last 90 days</option></select><ChevronDown size={13} /></label>
        <label className="crox-ref-filter search-engine" title="Search engine segmentation becomes available after a search analytics source is connected"><Search size={15} /><select value={searchEngine} disabled aria-label="Search engine (connect analytics to enable)"><option>Google Search</option><option>Bing Search</option><option>All search engines</option></select><ChevronDown size={13} /></label>
        <span className="crox-ref-filter-note">{device} · {market} · {period} · {searchEngine}</span>
      </div>

      <section className="crox-ref-metrics-grid" aria-label="SEO overview metrics">
        <MetricCard label="Organic Traffic" value={googleData?.google_analytics.sessions == null ? 'n/a' : number(googleData.google_analytics.sessions)} note={googleData?.google_analytics.status === 'connected' ? `GA4 organic-search sessions · ${googleDays} days` : googleData?.google_analytics.error || (googleDataLoading ? 'Loading Google data…' : 'Connect GA4 in Settings to show measured organic sessions')} />
        <MetricCard label="Authority Score" value="n/a" note="Backlink authority provider not connected" />
        <MetricCard label="AI Visibility" value="n/a" note="AI search visibility source not connected" />
        <MetricCard label="Mentions" value="n/a" note="Brand mention monitoring not connected">
          <div className="crox-ref-mentions-list"><span><Sparkles size={13} /> ChatGPT <b>—</b></span><span><Search size={13} /> AI Overview <b>—</b></span><span><Globe2 size={13} /> Gemini <b>—</b></span></div>
        </MetricCard>
        <article className="crox-ref-metric-card crox-ref-site-health-card">
          <div className="crox-ref-metric-label">Site Health</div>
          <div className="crox-ref-health-content">
            <SiteHealthGauge score={siteHealth} />
            <div className="crox-ref-health-facts">
              <span>Crawled: <b>{number(report?.pages_crawled ?? 0)}</b></span>
              <span>Indexed: <b>{number(indexedPages ?? 0)}</b></span>
              <span>Issues: <b>{number(report ? unresolvedIssues.length : 0)}</b></span>
              <span>% Health: <b>{siteHealth == null ? '—' : `${siteHealth}%`}</b></span>
            </div>
          </div>
          <button type="button" className="crox-ref-view-audit" onClick={() => onOpenTab('site-audit')}>View Audit Result <ArrowRight size={13} /></button>
        </article>
      </section>

      <section className="crox-ref-chart-card">
        <div className="crox-ref-source-tabs" role="tablist" aria-label="Analytics data source">
          <button type="button" role="tab" aria-selected={source === 'crox'} className={source === 'crox' ? 'active' : ''} onClick={() => selectSource('crox')}><TrendingUp size={15} /> CROX Audit Data</button>
          <button type="button" role="tab" aria-selected={source === 'analytics'} className={source === 'analytics' ? 'active' : ''} onClick={() => selectSource('analytics')}><span className="crox-ref-ga-mark">G</span> Google Analytics</button>
          <button type="button" role="tab" aria-selected={source === 'search-console'} className={source === 'search-console' ? 'active' : ''} onClick={() => selectSource('search-console')}><Search size={14} /> Google Search Console</button>
        </div>

        {source === 'crox' ? <>
          <div className="crox-ref-chart-options">
            <label><input type="radio" name="crox-chart-metric" checked={chartMetric === 'health'} onChange={() => setChartMetric('health')} /> Site Health</label>
            <label><input type="radio" name="crox-chart-metric" checked={chartMetric === 'pages'} onChange={() => setChartMetric('pages')} /> Pages Crawled</label>
            <span className="crox-ref-chart-date"><Clock3 size={12} /> Audit history</span>
          </div>
          {chartPoints.length > 0 ? <>
            <div className="crox-ref-chart-plot">
              <div className="crox-ref-chart-ylabels">{(chartMetric === 'health' ? [100, 75, 50, 25, 0] : [1, .75, .5, .25, 0].map(ratio => Math.round(maxChartValue * ratio))).map((value, index) => <span key={`${value}-${index}`}>{number(value)}</span>)}</div>
              <svg viewBox="0 0 1000 210" preserveAspectRatio="none" role="img" aria-label={chartMetric === 'health' ? 'Site health history' : 'Pages crawled history'}>
                {[22, 63, 104, 145, 186].map(y => <line key={y} x1="0" y1={y} x2="1000" y2={y} className="crox-ref-gridline" />)}
                {areaPath && <path d={areaPath} className="crox-ref-chart-area" />}
                <path d={linePath} className="crox-ref-chart-line" />
                {chartPoints.map(point => <circle key={point.scan.id} cx={point.x} cy={point.y} r="4.5" className="crox-ref-chart-point" role="button" tabIndex={0} aria-label={`Open audit from ${shortDate(point.scan.created_at)}`} onClick={() => onSelectScan(point.scan.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectScan(point.scan.id); } }}><title>{point.scan.domain}: {number(point.value)} — open audit</title></circle>)}
              </svg>
            </div>
            <div className="crox-ref-chart-xlabels">{chartPoints.map(point => <span key={point.scan.id}>{shortDate(point.scan.created_at)}</span>)}</div>
          </> : <div className="crox-ref-chart-empty"><BarChart3 size={26} /><strong>Your audit trend will appear here</strong><span>Run a site audit to build a history using real CROX crawl data.</span><button type="button" onClick={onOpenProjects}>Create a project <ArrowRight size={13} /></button></div>}
        </> : source === 'analytics' ? (
          <div className="space-y-4 p-4">
            {googleData?.google_analytics.status === 'connected' ? <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[['Organic sessions', googleData.google_analytics.sessions], ['Active users', googleData.google_analytics.active_users], ['Page views', googleData.google_analytics.page_views]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><span className="text-[9px] font-semibold text-slate-500">{label}</span><strong className="mt-1 block text-xl font-extrabold text-slate-900">{number(value as number | null)}</strong></div>)}
              </div>
              <div className="rounded-xl border border-slate-100 p-3"><div className="mb-2 flex items-center justify-between"><strong className="text-[10px] text-slate-700">Daily organic sessions</strong><span className="text-[9px] text-slate-400">Last {googleDays} days · Google Analytics 4</span></div>
                <div className="flex h-28 items-end gap-1">{googleData.google_analytics.trend.slice(-30).map(point => { const max = Math.max(1, ...googleData.google_analytics.trend.map(item => item.sessions)); return <div key={point.date} title={`${point.date}: ${number(point.sessions)} organic sessions`} className="min-w-0 flex-1 rounded-t-sm bg-sky-500/80 hover:bg-sky-600" style={{ height: `${Math.max(2, point.sessions / max * 100)}%` }} />; })}</div>
                <p className="mt-2 text-[9px] text-slate-400">Only GA4 sessions in the “Organic Search” default channel group are counted. Missing provider rows are not estimated.</p>
              </div>
            </> : <div className="crox-ref-integration-empty"><div><Link2 size={23} /></div><strong>{googleData?.google_analytics.error || googleDataError || (googleDataLoading ? 'Loading Google Analytics…' : 'Google Analytics property not selected')}</strong><span>{googleData?.note || 'Connect Google in Settings and map a GA4 property to this CROX project.'}</span><button type="button" onClick={() => onOpenTab('settings')}>Open Integrations <ArrowRight size={13} /></button></div>}
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {googleData?.search_console.status === 'connected' ? <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Clicks', googleData.search_console.clicks], ['Impressions', googleData.search_console.impressions], ['CTR', googleData.search_console.ctr == null ? null : `${(googleData.search_console.ctr * 100).toFixed(2)}%`], ['Average position', googleData.search_console.average_position]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><span className="text-[9px] font-semibold text-slate-500">{label}</span><strong className="mt-1 block text-lg font-extrabold text-slate-900">{value == null ? '—' : typeof value === 'number' ? number(value) : value}</strong></div>)}</div>
              <div className="overflow-x-auto rounded-xl border border-slate-100"><div className="border-b border-slate-100 px-3 py-2"><strong className="text-[10px] text-slate-700">Top search queries</strong><span className="ml-2 text-[9px] text-slate-400">Google Search Console · sample of top rows</span></div><table className="w-full min-w-[540px] text-left"><thead className="bg-slate-50"><tr>{['Query', 'Clicks', 'Impressions', 'CTR', 'Position'].map(label => <th key={label} className="px-3 py-2 text-[8px] font-bold uppercase tracking-wide text-slate-400">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{googleData.search_console.top_queries.slice(0, 12).map(row => <tr key={row.query}><td className="max-w-[270px] truncate px-3 py-2 text-[9px] text-slate-700">{row.query}</td><td className="px-3 py-2 text-[9px] tabular-nums">{number(row.clicks)}</td><td className="px-3 py-2 text-[9px] tabular-nums">{number(row.impressions)}</td><td className="px-3 py-2 text-[9px] tabular-nums">{(row.ctr * 100).toFixed(2)}%</td><td className="px-3 py-2 text-[9px] tabular-nums">{row.position.toFixed(1)}</td></tr>)}</tbody></table>{!googleData.search_console.top_queries.length && <p className="p-4 text-center text-[9px] text-slate-500">Google returned no query rows for this period.</p>}</div>
              <p className="text-[9px] leading-4 text-slate-400">Search Console data is delayed and the API may return only top rows. Query tables are not guaranteed to be exhaustive.</p>
            </> : <div className="crox-ref-integration-empty"><div><Link2 size={23} /></div><strong>{googleData?.search_console.error || googleDataError || (googleDataLoading ? 'Loading Search Console…' : 'Search Console property not selected')}</strong><span>{googleData?.note || 'Connect Google in Settings and map a Search Console site to this CROX project.'}</span><button type="button" onClick={() => onOpenTab('settings')}>Open Integrations <ArrowRight size={13} /></button></div>}
          </div>
        )}
      </section>

      <section className="crox-ref-bottom-grid">
        <article className="crox-ref-bottom-card">
          <div className="crox-ref-card-title-row">
            <div className="crox-ref-card-title"><span className="performance"><Zap size={17} /></span><div><h2>Site Performance</h2><p>Performance overview</p></div></div>
            <button type="button" className="crox-ref-small-link" onClick={() => onOpenTab('performance')}>View Details <ArrowRight size={13} /></button>
          </div>
          <div className="crox-ref-performance-heading"><strong>{report ? `${report.performance_score}/100` : '—'}</strong><span>Performance Score</span><div className="crox-ref-performance-bar"><i style={{ width: `${report ? Math.max(0, Math.min(100, report.performance_score)) : 0}%` }} /></div></div>
          <div className="crox-ref-performance-controls">
            <label title="Device-specific metrics require an analytics integration"><Monitor size={14} /><select aria-label="Performance device (analytics required)" value={device} disabled><option>Desktop</option><option>Mobile</option><option>Tablet</option></select><ChevronDown size={12} /></label>
            <label><CalendarDays size={14} /><select aria-label="Performance period" value={period} onChange={event => setPeriod(event.target.value)}><option>Last 30 days</option><option>Last 7 days</option><option>Last 90 days</option></select><ChevronDown size={12} /></label>
            <span className="crox-ref-position-trend">Crawl Health <i><b style={{ width: `${siteHealth ?? 0}%` }} /></i></span>
          </div>
          <div className="crox-ref-performance-stats">
            <div><span>Pages Crawled</span><strong>{number(report?.pages_crawled ?? 0)}</strong></div>
            <div><span>URLs Found</span><strong>{number(report?.total_urls_found ?? 0)}</strong></div>
            <div><span>Broken Links</span><strong>{number(report?.broken_links_found ?? 0)}</strong></div>
          </div>
          <button type="button" className="crox-ref-card-footer-action" onClick={() => onOpenTab('performance')}>Open Performance Metrics <ArrowRight size={13} /></button>
        </article>

        <article className="crox-ref-bottom-card">
          <div className="crox-ref-card-title-row">
            <div className="crox-ref-card-title"><span className="audit"><ShieldCheck size={17} /></span><div><h2>Audit Summary</h2><p>Updated: {latestDate}</p></div></div>
            <button type="button" className="crox-ref-view-details" onClick={() => onOpenTab('site-audit')}>View Details <ArrowRight size={14} /></button>
          </div>
          <div className="crox-ref-audit-summary-row">
            <div><span>Site Health <i className="green" /></span><strong>{siteHealth == null ? '—' : siteHealth}</strong></div>
            <div><span>Errors <i className="red" /></span><strong>{report ? severity.Critical + severity.High : '—'}</strong></div>
            <div><span>Warnings <i className="amber" /></span><strong>{report ? warningCount : '—'}</strong></div>
          </div>
          <div className="crox-ref-audit-summary-footer">
            <span>{report ? `${unresolvedIssues.length} unresolved findings in latest crawl` : 'Run a crawl to generate your first audit summary.'}</span>
            <div>
              <button type="button" className="crox-ref-export-button" onClick={() => exportAudit(report, targetDomain)} disabled={!report}><Download size={14} /> Export</button>
              <button type="button" className="crox-ref-help-button" onClick={onOpenAI} aria-label="Ask CROX AI" title="Ask CROX AI"><CircleHelp size={19} /></button>
            </div>
          </div>
          {firstPriorityIssue && <button type="button" className="crox-ref-priority-issue" onClick={() => onSelectIssue(firstPriorityIssue)}><AlertTriangle size={13} /><span>{firstPriorityIssue.title}</span><ArrowRight size={12} /></button>}
        </article>
      </section>

      <div className="crox-ref-dashboard-footnote"><Activity size={13} /> CROX audit metrics come from saved website scans. Device, market and search-engine segmentation plus external traffic, rankings, authority and AI-mention metrics require their respective integrations.</div>
    </div>
  );
};
