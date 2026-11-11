import React from 'react';
import { ArrowUpRight, BarChart2 } from 'lucide-react';
import { ScanReport, RecentScanItem } from '../types';

interface CrawlStatsCardProps {
  report: ScanReport;
  recentScans: RecentScanItem[];
  onViewDetails: () => void;
}

export const CrawlStatsCard: React.FC<CrawlStatsCardProps> = ({
  report,
  recentScans,
  onViewDetails
}) => {
  const { pages_crawled, total_urls_found, redirects_found, broken_links_found } = report;

  // Use real completed scans for historical trend if 2 or more exist
  const validHistory = recentScans
    .filter((s) => s.status === 'completed' && s.pages_crawled > 0)
    .slice(0, 7)
    .reverse();

  const hasHistory = validHistory.length >= 2;

  // Chart geometry
  const width = 360;
  const height = 90;
  const paddingX = 20;
  const paddingY = 15;

  let points: { x: number; y: number; date: string; count: number }[] = [];
  let linePath = '';
  let areaPath = '';

  if (hasHistory) {
    const minVal = Math.min(...validHistory.map((h) => h.pages_crawled), 1);
    const maxVal = Math.max(...validHistory.map((h) => h.pages_crawled), pages_crawled || 10);
    const range = Math.max(1, maxVal - minVal);

    points = validHistory.map((d, i) => {
      const x = paddingX + (i / (validHistory.length - 1)) * (width - 2 * paddingX);
      const normalizedY = (d.pages_crawled - minVal) / range;
      const y = height - paddingY - normalizedY * (height - 2 * paddingY);
      const dateLabel = new Date(d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return { x, y, date: dateLabel, count: d.pages_crawled };
    });

    linePath = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
    areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between h-full">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-slate-900">Crawl Statistics</h2>
        <button
          onClick={onViewDetails}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
        >
          <span>View details</span>
          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* 4 Crawl KPI Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="space-y-0.5">
          <p className="text-xs text-slate-500 font-medium">Pages Crawled</p>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-extrabold text-slate-900">{pages_crawled}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <p className="text-xs text-slate-500 font-medium">Total URLs Found</p>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-extrabold text-slate-900">{total_urls_found}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <p className="text-xs text-slate-500 font-medium">Redirects</p>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-extrabold text-slate-900">{redirects_found}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <p className="text-xs text-slate-500 font-medium">Broken Links</p>
          <div className="flex items-baseline gap-2 font-mono">
            <span className={`text-2xl font-extrabold ${broken_links_found > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {broken_links_found}
            </span>
          </div>
        </div>
      </div>

      {/* Area Chart: Driven by Real Scan History */}
      <div className="mt-auto pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
          <span>Pages Crawled Trend</span>
          <span>{hasHistory ? `${validHistory.length} recorded scans` : 'Initial Scan'}</span>
        </div>

        {hasHistory ? (
          <div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
              <defs>
                <linearGradient id="realCrawlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#realCrawlGradient)" />
              <path d={linePath} fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r="3" className="fill-white stroke-indigo-600 stroke-2" />
              ))}
            </svg>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              {points.map((p, i) => (
                <span key={i}>{p.date}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-4 text-center bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 space-y-1">
            <BarChart2 className="w-4 h-4 text-slate-400 mx-auto" />
            <p className="font-medium text-slate-600">No prior scans to plot trend</p>
            <p className="text-[11px] text-slate-400">Future crawls of this domain will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
