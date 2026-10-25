import React, { useState } from 'react';
import {
  Zap,
  Gauge,
  Smartphone,
  Monitor,
  Loader2,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { ScanReport } from '../types';
import { fetchPageSpeed } from '../services/api';

interface PerformancePageProps {
  report: ScanReport;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ report }) => {
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile');
  const [loading, setLoading] = useState(false);
  const [pageSpeedResult, setPageSpeedResult] = useState<any>(null);

  const runPageSpeedTest = async () => {
    setLoading(true);
    try {
      const data = await fetchPageSpeed(report.target_url, strategy);
      setPageSpeedResult(data);
    } catch (e: any) {
      setPageSpeedResult({
        status: 'error',
        message: e.message || 'Failed to connect to PageSpeed Insights'
      });
    } finally {
      setLoading(false);
    }
  };

  const perfIssues = report.issues.filter((i) => i.category === 'Performance');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Performance & Speed Lab
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Core Web Vitals, server TTFB, and PageSpeed metrics for {report.domain}
          </p>
        </div>

        {/* Live PageSpeed Controls */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200/80 shadow-xs">
          <button
            onClick={() => setStrategy('mobile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              strategy === 'mobile'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile</span>
          </button>
          <button
            onClick={() => setStrategy('desktop')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              strategy === 'desktop'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop</span>
          </button>
          <button
            onClick={runPageSpeedTest}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span>Run Test</span>
          </button>
        </div>
      </div>

      {/* PageSpeed API Results Box */}
      {pageSpeedResult && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900">
                Google PageSpeed Insights Results ({strategy.toUpperCase()})
              </h3>
            </div>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold ${
              pageSpeedResult.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {pageSpeedResult.status}
            </span>
          </div>

          {pageSpeedResult.status === 'success' && pageSpeedResult.data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-slate-500 font-medium">Performance Score</p>
                <p className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
                  {pageSpeedResult.data.performance_score}/100
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-slate-500 font-medium">Largest Contentful Paint (LCP)</p>
                <p className="text-lg font-bold text-slate-900 font-mono mt-1">
                  {pageSpeedResult.data.lcp}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-slate-500 font-medium">Cumulative Layout Shift (CLS)</p>
                <p className="text-lg font-bold text-slate-900 font-mono mt-1">
                  {pageSpeedResult.data.cls}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-slate-500 font-medium">First Contentful Paint (FCP)</p>
                <p className="text-lg font-bold text-slate-900 font-mono mt-1">
                  {pageSpeedResult.data.fcp}
                </p>
              </div>
            </div>
          )}

          {pageSpeedResult.status === 'not_configured' && (
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 space-y-1">
              <p className="font-semibold">PageSpeed API Key Not Configured</p>
              <p className="text-slate-600">{pageSpeedResult.message}</p>
              <p className="text-[11px] text-slate-500 pt-1">
                You can obtain an API key from Google Cloud Console and set <code className="font-mono bg-white px-1 py-0.5 rounded">PAGESPEED_API_KEY</code>.
              </p>
            </div>
          )}

          {pageSpeedResult.status === 'error' && (
            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div><p className="font-semibold">PageSpeed test could not be completed</p><p className="text-rose-700 mt-1">{pageSpeedResult.message || pageSpeedResult.detail || 'Check the API key and try again.'}</p></div>
            </div>
          )}

          {pageSpeedResult.status === 'success' && pageSpeedResult.data && (
            <p className="text-[11px] text-slate-400">Measured by Google PageSpeed Insights · {strategy} · {pageSpeedResult.fetched_at ? new Date(pageSpeedResult.fetched_at).toLocaleString() : 'Just now'}</p>
          )}
        </div>
      )}

      {/* Crawled Performance Benchmarks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <Clock className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900">Average Response Time</h3>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-extrabold text-slate-900">
              {Math.round(report.pages.reduce((a, b) => a + b.response_time_ms, 0) / Math.max(1, report.pages.length))}ms
            </span>
            <span className="text-xs text-slate-500">across {report.pages_crawled} pages</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Target threshold: &lt; 600ms Time to First Byte (TTFB).
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900">Performance audit score</h3>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-extrabold text-slate-900">
              {report.performance_score}/100
            </span>
            <span className="text-xs text-slate-500 font-semibold">CROX audit</span>
          </div>
          <p className="text-[11px] text-slate-500">
            A crawl-based score from findings recorded by CROX; use PageSpeed Insights above for a Lighthouse lab score.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <Gauge className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900">Performance Issues</h3>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-extrabold text-slate-900">
              {perfIssues.length}
            </span>
            <span className="text-xs text-amber-600 font-semibold">Active Findings</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Issues impacting user retention and Core Web Vitals.
          </p>
        </div>
      </div>

      {/* Performance Findings Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900">Detected Performance Opportunities</h3>
        <div className="space-y-2 text-xs">
          {perfIssues.length === 0 ? (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No severe performance bottlenecks detected. Page response times are within normal range.</span>
            </div>
          ) : (
            perfIssues.map((iss) => (
              <div key={iss.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{iss.title}</p>
                    <span className="text-[11px] font-mono text-slate-500">{iss.pages_affected} pages affected</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 font-mono">{iss.evidence}</p>
                  <p className="text-[11px] text-indigo-700 mt-1 font-medium">{iss.recommendation}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
