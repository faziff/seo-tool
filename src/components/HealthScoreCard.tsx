import React from 'react';
import {
  ExternalLink,
  Code2,
  Gauge,
  Eye,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { ScanReport } from '../types';

interface HealthScoreCardProps {
  report: ScanReport;
  onViewCategory: (categoryName: string) => void;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({
  report,
  onViewCategory
}) => {
  const { health_score, domain, target_url, severity_counts, category_scores } = report;
  const criticalCount = severity_counts.Critical;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (health_score / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 65) return '#0D9488';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const formattedDate = report.completed_at
    ? new Date(report.completed_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : 'Just now';

  const techScore = category_scores['Technical SEO']?.score ?? report.technical_score;
  const perfScore = category_scores['Performance']?.score ?? report.performance_score;
  const accScore = category_scores['Accessibility']?.score ?? report.accessibility_score;
  const seoScore = category_scores['SEO Opportunities']?.score ?? report.seo_score;

  return (
    <div className="space-y-4">
      {/* Primary Health Score Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-5">Website Health Score</h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 lg:gap-8">
          {/* Circular SVG Score Meter */}
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 128 128">
              <circle
                cx="64"
                cy="64"
                r={radius}
                className="text-slate-100"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r={radius}
                stroke={getScoreColor(health_score)}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {health_score}
              </span>
              <span className="text-xs font-semibold text-slate-500 font-mono">/100</span>
            </div>
          </div>

          {/* Details & Real Status Summary */}
          <div className="space-y-2.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900 truncate">
                {domain}
              </span>
              <a
                href={target_url}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-slate-700 transition-colors"
                title={`Open ${target_url}`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <p className="text-xs text-slate-500 font-mono">
              Last scanned: {formattedDate}
            </p>

            <div>
              {criticalCount === 0 ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>No critical issues</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/80">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>{criticalCount} critical blocker{criticalCount > 1 ? 's' : ''} detected</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed max-w-lg">
              {health_score >= 80
                ? `Excellent overall health. ${report.pages_crawled} pages scanned with high indexability and proper semantic structure.`
                : health_score >= 60
                ? `Website is functional, but ${report.issues.length} technical & SEO areas can be improved for better search crawling.`
                : `Multiple severe issues detected across ${report.pages_crawled} pages requiring priority remediation.`}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Category Score Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Technical SEO */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Code2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Technical SEO</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 font-mono">
              {category_scores['Technical SEO']?.status || 'Active'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-extrabold text-slate-900">{techScore}</span>
              <span className="text-xs text-slate-500 font-semibold">/100</span>
            </div>
            <button
              onClick={() => onViewCategory('technical')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
            >
              <span>View details</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Performance */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Gauge className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Performance</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 font-mono">
              {category_scores['Performance']?.status || 'Active'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-extrabold text-slate-900">{perfScore}</span>
              <span className="text-xs text-slate-500 font-semibold">/100</span>
            </div>
            <button
              onClick={() => onViewCategory('performance')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
            >
              <span>View details</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Accessibility */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Accessibility</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 font-mono">
              {category_scores['Accessibility']?.status || 'Active'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-extrabold text-slate-900">{accScore}</span>
              <span className="text-xs text-slate-500 font-semibold">/100</span>
            </div>
            <button
              onClick={() => onViewCategory('accessibility')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
            >
              <span>View details</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* SEO Opportunities */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800">SEO Opportunities</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 font-mono">
              {category_scores['SEO Opportunities']?.status || 'Active'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-extrabold text-slate-900">{seoScore}</span>
              <span className="text-xs text-slate-500 font-semibold">/100</span>
            </div>
            <button
              onClick={() => onViewCategory('seo')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group"
            >
              <span>View details</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
