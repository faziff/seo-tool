import React, { useMemo } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, BarChart3, CheckCircle2,
  ChevronRight, Clock3, FolderKanban,
  Gauge, Globe2, Link2, ShieldCheck, Sparkles, TrendingUp, Zap
} from 'lucide-react';
import type { Issue, Project, RecentScanItem, ScanReport } from '../types';

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
  if (!value) return 'No scan yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

function Sparkline({ values, tone = 'violet' }: { values: number[]; tone?: 'violet' | 'blue' | 'green' | 'orange' }) {
  if (values.length < 2) return <div className="crox-spark-empty"><span /></div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = 3 + (index / (values.length - 1)) * 94;
    const y = 26 - ((value - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className={`crox-spark crox-spark-${tone}`} viewBox="0 0 100 30" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HealthRing({ score }: { score: number | null }) {
  const safeScore = score == null ? 0 : Math.max(0, Math.min(100, score));
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="crox-health-ring" role="img" aria-label={score == null ? 'No audit score yet' : `SEO health score ${score} out of 100`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} className="crox-ring-track" />
        <circle cx="50" cy="50" r={radius} className="crox-ring-value" strokeDasharray={circumference} strokeDashoffset={circumference - (safeScore / 100) * circumference} />
      </svg>
      <div><strong>{score == null ? '—' : score}</strong><span>{score == null ? 'Not scanned' : 'Health score'}</span></div>
    </div>
  );
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  userName, report, recentScans, projects, onOpenProjects, onOpenTab,
  onOpenAI, onSelectScan, onSelectIssue
}) => {
  const completedScans = useMemo(
    () => recentScans.filter(scan => scan.status === 'completed').slice(0, 8).reverse(),
    [recentScans]
  );
  const healthHistory = completedScans.map(scan => scan.health_score).filter(value => Number.isFinite(value));
  const crawlHistory = completedScans.map(scan => scan.pages_crawled).filter(value => Number.isFinite(value));

  const severity = report?.severity_counts ?? { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const severityTotal = severity.Critical + severity.High + severity.Medium + severity.Low;
  const severityStops = (() => {
    if (!severityTotal) return '#eceaf4 0% 100%';
    let cursor = 0;
    const colors = [
      ['Critical', '#f04468'], ['High', '#fb923c'], ['Medium', '#f5c451'], ['Low', '#4a83f5']
    ] as const;
    return colors.map(([key, color]) => {
      const start = cursor;
      cursor += (severity[key] / severityTotal) * 100;
      return `${color} ${start}% ${cursor}%`;
    }).join(', ');
  })();

  const chartPoints = completedScans.map((scan, index) => ({
    x: completedScans.length === 1 ? 280 : 22 + (index / (completedScans.length - 1)) * 536,
    y: 130 - (Math.max(0, Math.min(100, scan.health_score)) / 100) * 112,
    scan
  }));
  const linePath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = chartPoints.length > 1 ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} 140 L ${chartPoints[0].x} 140 Z` : '';
  const topIssues = report?.issues.filter(issue => !issue.resolved).slice(0, 4) ?? [];
  const recentActivity = [...recentScans].slice(0, 4);
  const greeting = userName.trim().split(/\s+/)[0] || 'there';

  const cards = [
    { label: 'SEO Health Score', value: report ? `${report.health_score}` : '—', suffix: report ? '/100' : '', note: report ? `Latest audit · ${dateLabel(report.completed_at || report.created_at)}` : 'Run a site audit to get started', icon: Gauge, tone: 'violet' as const, trend: healthHistory },
    { label: 'Pages Crawled', value: number(report?.pages_crawled), suffix: '', note: report ? `${number(report.total_urls_found)} URLs discovered` : 'No crawl data available', icon: Globe2, tone: 'blue' as const, trend: crawlHistory },
    { label: 'Open Issues', value: number(report?.issues.filter(issue => !issue.resolved).length), suffix: '', note: report ? `${severity.Critical} critical · ${severity.High} high` : 'Issues appear after an audit', icon: AlertTriangle, tone: 'orange' as const, trend: [] },
    { label: 'Broken Links', value: number(report?.broken_links_found), suffix: '', note: report ? 'Found in the latest crawl' : 'No link data available', icon: Link2, tone: 'green' as const, trend: [] }
  ];

  return (
    <div className="crox-dashboard-page">
      <div className="crox-dashboard-heading-row">
        <div>
          <div className="crox-dashboard-eyebrow"><Sparkles size={13} /> CROX SEARCH INTELLIGENCE</div>
          <h1>Dashboard</h1>
          <p>Welcome back, {greeting}. Track your SEO health and grow your organic visibility.</p>
        </div>
        <div className="crox-dashboard-heading-actions">
          <span className="crox-dashboard-updated"><Clock3 size={13} /> {report ? `Updated ${dateLabel(report.completed_at || report.created_at)}` : 'Waiting for first audit'}</span>
          <button className="crox-dashboard-primary" onClick={onOpenProjects}><Zap size={14} /> Run New Audit</button>
        </div>
      </div>

      <section className="crox-kpi-grid" aria-label="SEO overview metrics">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <article className="crox-dashboard-card crox-kpi-card" key={card.label}>
              <div className={`crox-kpi-icon crox-tone-${card.tone}`}><Icon size={17} /></div>
              <div className="crox-kpi-copy">
                <span>{card.label}</span>
                <strong>{card.value}<small>{card.suffix}</small></strong>
                <em>{card.note}</em>
              </div>
              <Sparkline values={card.trend} tone={card.tone} />
            </article>
          );
        })}
      </section>

      <section className="crox-dashboard-main-grid">
        <article className="crox-dashboard-card crox-panel crox-traffic-panel">
          <div className="crox-panel-heading">
            <div><span className="crox-panel-icon violet"><TrendingUp size={15} /></span><div><h2>SEO Health Overview</h2><p>Health score across your recent completed audits</p></div></div>
            <button className="crox-panel-link" onClick={() => onOpenTab('reports')}>View Reports <ArrowRight size={13} /></button>
          </div>
          {chartPoints.length > 0 ? (
            <>
              <div className="crox-health-chart-wrap">
                <div className="crox-chart-ylabels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
                <svg className="crox-health-chart" viewBox="0 0 580 150" preserveAspectRatio="none" role="img" aria-label="SEO health score history chart">
                  <defs><linearGradient id="croxHealthFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7548ef" stopOpacity=".24" /><stop offset="100%" stopColor="#7548ef" stopOpacity=".015" /></linearGradient></defs>
                  {[18, 46, 74, 102, 130].map(y => <line key={y} x1="0" y1={y} x2="580" y2={y} className="crox-chart-gridline" />)}
                  {areaPath && <path d={areaPath} fill="url(#croxHealthFill)" />}
                  {linePath && <path d={linePath} className="crox-chart-line" />}
                  {chartPoints.map(point => <circle key={point.scan.id} cx={point.x} cy={point.y} r="4" className="crox-chart-point"><title>{point.scan.domain}: {point.scan.health_score}/100</title></circle>)}
                </svg>
              </div>
              <div className="crox-chart-xlabels">{chartPoints.map(point => <span key={point.scan.id}>{dateLabel(point.scan.created_at)}</span>)}</div>
              {chartPoints.length === 1 && <p className="crox-chart-footnote">Complete another audit to build a trend over time.</p>}
            </>
          ) : (
            <div className="crox-dashboard-empty-chart"><BarChart3 size={24} /><strong>Your SEO trend will appear here</strong><span>Run your first audit to start building a real performance history.</span><button onClick={onOpenProjects}>Start an audit <ArrowRight size={13} /></button></div>
          )}
        </article>

        <article className="crox-dashboard-card crox-panel crox-severity-panel">
          <div className="crox-panel-heading">
            <div><span className="crox-panel-icon blue"><ShieldCheck size={15} /></span><div><h2>Issue Distribution</h2><p>Latest audit findings by severity</p></div></div>
            <button className="crox-icon-button" onClick={() => onOpenTab('technical')} aria-label="Open technical issues"><ChevronRight size={16} /></button>
          </div>
          <div className="crox-severity-body">
            <div className="crox-severity-donut" style={{ background: `conic-gradient(${severityStops})` }}>
              <div><strong>{number(severityTotal)}</strong><span>Total issues</span></div>
            </div>
            <div className="crox-severity-legend">
              {([
                ['Critical', '#f04468'], ['High', '#fb923c'], ['Medium', '#f5c451'], ['Low', '#4a83f5']
              ] as const).map(([label, color]) => (
                <div key={label}><i style={{ background: color }} /><span>{label}</span><b>{number(severity[label as keyof typeof severity])}</b></div>
              ))}
            </div>
          </div>
          {!report && <p className="crox-severity-empty">Severity data will be calculated after your first site audit.</p>}
          <button className="crox-panel-footer-link" onClick={() => onOpenTab('technical')}>Review all issues <ArrowRight size={13} /></button>
        </article>
      </section>

      <section className="crox-dashboard-bottom-grid">
        <article className="crox-dashboard-card crox-panel crox-site-health-panel">
          <div className="crox-panel-heading compact">
            <div><span className="crox-panel-icon green"><ShieldCheck size={15} /></span><div><h2>Site Audit</h2><p>{report ? report.domain : 'Your website health'}</p></div></div>
            <button className="crox-panel-link" onClick={() => onOpenTab('site-audit')}>Details <ArrowRight size={12} /></button>
          </div>
          <div className="crox-site-health-content">
            <HealthRing score={report?.health_score ?? null} />
            <div className="crox-site-audit-stats">
              <div><i className="critical" /><span>Critical</span><b>{number(report?.severity_counts.Critical)}</b></div>
              <div><i className="high" /><span>High</span><b>{number(report?.severity_counts.High)}</b></div>
              <div><i className="notice" /><span>Notices</span><b>{number(report ? report.severity_counts.Medium + report.severity_counts.Low : null)}</b></div>
            </div>
          </div>
          <button className="crox-dashboard-wide-button" onClick={onOpenProjects}>Run New Audit <ArrowRight size={13} /></button>
        </article>

        <article className="crox-dashboard-card crox-panel crox-issues-panel">
          <div className="crox-panel-heading compact">
            <div><span className="crox-panel-icon orange"><AlertCircle size={15} /></span><div><h2>Top Issues</h2><p>Priority items from your latest scan</p></div></div>
            <button className="crox-panel-link" onClick={() => onOpenTab('technical')}>View All <ArrowRight size={12} /></button>
          </div>
          {topIssues.length ? (
            <div className="crox-issue-list">
              {topIssues.map(issue => (
                <button key={issue.id} className="crox-issue-row" onClick={() => onSelectIssue(issue)}>
                  <span className={`crox-issue-severity ${issue.severity.toLowerCase()}`} />
                  <span className="crox-issue-title"><strong>{issue.title}</strong><small>{number(issue.pages_affected)} pages affected</small></span>
                  <span className={`crox-issue-badge ${issue.severity.toLowerCase()}`}>{issue.severity}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          ) : (
            <div className="crox-dashboard-empty-list"><CheckCircle2 size={21} /><strong>{report ? 'No open issues found' : 'No audit issues yet'}</strong><span>{report ? 'Your latest scan has no unresolved issues.' : 'Run a website audit to identify technical and SEO opportunities.'}</span></div>
          )}
          <button className="crox-panel-footer-link" onClick={() => onOpenTab('technical')}>Open issue manager <ArrowRight size={13} /></button>
        </article>

        <article className="crox-dashboard-card crox-panel crox-activity-panel">
          <div className="crox-panel-heading compact">
            <div><span className="crox-panel-icon violet"><Activity size={15} /></span><div><h2>Recent Activity</h2><p>Your latest website scans</p></div></div>
            <button className="crox-icon-button" onClick={() => onOpenTab('reports')} aria-label="Open reports"><ChevronRight size={16} /></button>
          </div>
          {recentActivity.length ? (
            <div className="crox-activity-list">
              {recentActivity.map(scan => (
                <button key={scan.id} onClick={() => onSelectScan(scan.id)} className="crox-activity-row">
                  <span className={`crox-activity-mark ${scan.status === 'completed' ? 'complete' : scan.status === 'failed' ? 'failed' : 'pending'}`}><Globe2 size={13} /></span>
                  <span className="crox-activity-copy"><strong>{scan.domain}</strong><small>{dateLabel(scan.created_at)}</small></span>
                  <span className="crox-activity-score">{scan.status === 'completed' ? `${scan.health_score}/100` : scan.status}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="crox-dashboard-empty-list compact-empty"><FolderKanban size={21} /><strong>No activity yet</strong><span>Your completed site audits will appear here.</span></div>
          )}
          <div className="crox-activity-bottom">
            <span><FolderKanban size={13} /> {projects.length} project{projects.length === 1 ? '' : 's'}</span>
            <button onClick={onOpenProjects}>Manage projects <ArrowRight size={12} /></button>
          </div>
        </article>
      </section>


    </div>
  );
};
