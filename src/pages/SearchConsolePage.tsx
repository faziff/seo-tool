import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, CheckCircle2, ExternalLink, Globe2, Link2, MousePointer2, RefreshCw, Search, Settings2, TrendingUp } from 'lucide-react';
import type { Project } from '../types';
import { getGoogleDataDashboard, getGoogleDataStatus, type GoogleDataDashboard } from '../services/api';

const number = (value: number | null | undefined) => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const percent = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${(value * 100).toFixed(2)}%`;

export const SearchConsolePage: React.FC<{ projects: Project[]; onOpenSettings: () => void }> = ({ projects, onOpenSettings }) => {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [report, setReport] = useState<GoogleDataDashboard | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0].id); }, [projects, projectId]);

  const load = async () => {
    setBusy(true); setError('');
    try {
      const status = await getGoogleDataStatus();
      setConnected(status.connected);
      if (!status.connected) { setReport(null); return; }
      if (!projectId) { setReport(null); setError('Create a project first, then select its Search Console property in Settings & Integrations.'); return; }
      const data = await getGoogleDataDashboard(projectId, 28);
      setReport(data);
      if (data.search_console?.status !== 'connected') setError(data.search_console?.error || 'Select a Search Console property for this project in Settings & Integrations.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Search Console data could not be loaded.'); }
    finally { setBusy(false); }
  };

  useEffect(() => { void load(); /* project switching triggers a fresh report */ }, [projectId]);

  const topQueries = useMemo(() => report?.search_console?.top_queries || [], [report]);
  const trend = report?.search_console?.trend || [];
  const maxClicks = Math.max(1, ...trend.map(row => row.clicks || 0));

  return <div className="crox-product-page">
    <div className="crox-product-heading">
      <div>
        <div className="crox-eyebrow"><Search size={13} /> ORGANIC SEARCH DATA</div>
        <h1>Search Console</h1>
        <p>Connect verified Google Search Console properties and review clicks, impressions, CTR, rankings and search queries inside CROX.</p>
      </div>
      <div className="crox-product-actions">
        <select value={projectId} onChange={event => setProjectId(event.target.value)} aria-label="Select project">
          <option value="">Select project</option>
          {projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.domain}</option>)}
        </select>
        <button type="button" className="crox-btn-secondary" onClick={load} disabled={busy}><RefreshCw size={15} className={busy ? 'crox-spin' : ''} /> Refresh</button>
      </div>
    </div>

    <div className="crox-integration-banner">
      <div className="crox-integration-icon"><Globe2 size={20} /></div>
      <div className="crox-integration-copy">
        <strong>{connected ? 'Google account connected' : 'Connect Google Search Console'}</strong>
        <span>{connected ? 'Choose a verified Search Console property for the selected project in Settings & Integrations.' : 'CROX uses Google read-only access. Your Google account remains in control of permissions.'}</span>
      </div>
      <div className={`crox-status-pill ${connected ? 'is-good' : 'is-muted'}`}>{connected ? <><CheckCircle2 size={13} /> Connected</> : 'Not connected'}</div>
      <button type="button" className="crox-btn-primary" onClick={onOpenSettings}><Settings2 size={15} /> {connected ? 'Manage connection' : 'Connect Google'}</button>
    </div>

    {error && <div className="crox-inline-alert"><Activity size={16} /><span>{error}</span><button type="button" onClick={onOpenSettings}>Open settings <ArrowUpRight size={13} /></button></div>}

    {busy && <div className="crox-loading-panel"><span className="crox-loader" /><strong>Fetching organic search performance</strong><small>Reading the selected property from Google Search Console.</small></div>}

    {!busy && report?.search_console?.status === 'connected' && <>
      <div className="crox-report-meta"><span><CheckCircle2 size={13} /> Property: <strong>{report.search_console.site_url}</strong></span><span>Last available 28-day window · Google data may be delayed by several days</span></div>
      <div className="crox-product-metrics">
        <Metric icon={<MousePointer2 size={17} />} label="Total clicks" value={number(report.search_console.clicks)} note="Organic search clicks" />
        <Metric icon={<Activity size={17} />} label="Impressions" value={number(report.search_console.impressions)} note="Search result appearances" />
        <Metric icon={<TrendingUp size={17} />} label="Average CTR" value={percent(report.search_console.ctr)} note="Clicks ÷ impressions" />
        <Metric icon={<BarChart3 size={17} />} label="Average position" value={report.search_console.average_position == null ? '—' : report.search_console.average_position.toFixed(1)} note="Lower position is stronger" />
      </div>
      <div className="crox-product-grid-2">
        <section className="crox-product-card">
          <div className="crox-card-title"><div><strong>Daily click activity</strong><small>Organic clicks across the selected date range</small></div><span className="crox-card-icon"><BarChart3 size={17} /></span></div>
          {trend.length ? <div className="crox-mini-bars" role="img" aria-label="Daily organic clicks chart">{trend.slice(-28).map((row, index) => <div key={`${row.date}-${index}`} title={`${row.date}: ${row.clicks} clicks`}><i style={{ height: `${Math.max(4, (row.clicks / maxClicks) * 100)}%` }} /></div>)}</div> : <div className="crox-empty-inline">No daily trend rows were returned for this date range.</div>}
          <div className="crox-chart-foot"><span>Daily totals</span><span>{trend.length} data points</span></div>
        </section>
        <section className="crox-product-card">
          <div className="crox-card-title"><div><strong>Search performance overview</strong><small>How people discover your pages in Google</small></div><span className="crox-card-icon"><Search size={17} /></span></div>
          <div className="crox-summary-list">
            <SummaryRow label="Clicks" value={number(report.search_console.clicks)} />
            <SummaryRow label="Impressions" value={number(report.search_console.impressions)} />
            <SummaryRow label="Click-through rate" value={percent(report.search_console.ctr)} />
            <SummaryRow label="Average position" value={report.search_console.average_position == null ? '—' : report.search_console.average_position.toFixed(1)} />
          </div>
        </section>
      </div>
      <section className="crox-product-card crox-table-card">
        <div className="crox-card-title"><div><strong>Top search queries</strong><small>Queries receiving impressions for this property</small></div><span className="crox-card-icon"><Search size={17} /></span></div>
        {topQueries.length ? <div className="crox-responsive-table"><table><thead><tr><th>Search query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>{topQueries.map((row, index) => <tr key={`${row.query}-${index}`}><td className="crox-query-cell">{row.query}</td><td>{number(row.clicks)}</td><td>{number(row.impressions)}</td><td>{percent(row.ctr)}</td><td>{row.position == null ? '—' : row.position.toFixed(1)}</td></tr>)}</tbody></table></div> : <div className="crox-empty-inline">Google returned no query rows for this selected range.</div>}
      </section>
      <div className="crox-source-note"><ExternalLink size={13} /> Source: Google Search Console API · read-only access · <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Open Search Console</a></div>
    </>}

    {!busy && !report && !error && <div className="crox-empty-state"><div className="crox-empty-icon"><Link2 size={26} /></div><h2>Your search data will appear here</h2><p>Connect Google, select a verified property for a CROX project, and this workspace will populate with real Search Console metrics.</p><button type="button" className="crox-btn-primary" onClick={onOpenSettings}>Set up Search Console <ArrowUpRight size={15} /></button></div>}
  </div>;
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string; note: string }> = ({ icon, label, value, note }) => <div className="crox-product-metric"><span>{icon}</span><small>{label}</small><strong>{value}</strong><em>{note}</em></div>;
const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="crox-summary-row"><span>{label}</span><strong>{value}</strong></div>;
