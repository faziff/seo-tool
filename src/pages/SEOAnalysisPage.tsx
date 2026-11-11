import React from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Code2,
  Layers,
  Link2
} from 'lucide-react';
import { ScanReport } from '../types';

interface SEOAnalysisPageProps {
  report: ScanReport;
}

export const SEOAnalysisPage: React.FC<SEOAnalysisPageProps> = ({ report }) => {
  const seoIssues = report.issues.filter((i) => i.category === 'SEO');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          SEO Deep-Dive Analysis
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Comprehensive on-page and indexing diagnostics for {report.domain}
        </p>
      </div>

      {/* SEO Score Summary Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-purple-200 uppercase tracking-wider">
            Overall SEO Health Score
          </span>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-4xl font-extrabold">{report.seo_score}</span>
            <span className="text-sm text-purple-200">/100</span>
          </div>
          <p className="text-xs text-purple-200 max-w-md pt-1">
            Based on {report.pages_crawled} crawled pages, title tags, meta descriptions, canonicalization, and heading semantics.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xs rounded-xl p-4 border border-white/10 text-xs space-y-1.5 w-full sm:w-auto font-mono">
          <div className="flex justify-between gap-6">
            <span className="text-purple-200">Total SEO Issues:</span>
            <span className="font-bold">{seoIssues.length}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-purple-200">Critical SEO Blockers:</span>
            <span className="font-bold text-rose-300">
              {seoIssues.filter((i) => i.severity === 'Critical').length}
            </span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-purple-200">Optimization Opportunities:</span>
            <span className="font-bold text-amber-300">
              {seoIssues.filter((i) => i.severity === 'High' || i.severity === 'Medium').length}
            </span>
          </div>
        </div>
      </div>

      {/* Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Title Tag Analysis */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Title Tag Optimization</h3>
              <p className="text-[11px] text-slate-500">Length recommended: 50–60 characters</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Search engines rely on title tags to determine page topical relevance and render the clickable headline in organic search results.
          </p>
          <div className="space-y-1.5 pt-1 text-xs">
            {seoIssues.filter((i) => i.rule_id.startsWith('TITLE')).length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>All evaluated titles adhere to character length and uniqueness rules.</span>
              </div>
            ) : (
              seoIssues.filter((i) => i.rule_id.startsWith('TITLE')).map((iss) => (
                <div key={iss.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">{iss.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{iss.recommendation}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Meta Descriptions */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Meta Descriptions</h3>
              <p className="text-[11px] text-slate-500">Target length: 120–155 characters</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Meta descriptions drive click-through rate (CTR). Missing or duplicated descriptions lead Google to generate fallback snippets.
          </p>
          <div className="space-y-1.5 pt-1 text-xs">
            {seoIssues.filter((i) => i.rule_id.startsWith('META_DESC')).map((iss) => (
              <div key={iss.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">{iss.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{iss.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Headings & Content Structure */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Headings & Semantic Outline</h3>
              <p className="text-[11px] text-slate-500">Exact H1 hierarchy check</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every page must contain exactly one informative H1 tag representing the primary topic, followed by logical H2 and H3 subsections.
          </p>
          <div className="space-y-1.5 pt-1 text-xs">
            {seoIssues.filter((i) => i.rule_id.startsWith('H1')).length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Proper single H1 heading hierarchy detected across templates.</span>
              </div>
            ) : (
              seoIssues.filter((i) => i.rule_id.startsWith('H1')).map((iss) => (
                <div key={iss.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">{iss.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{iss.recommendation}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Canonicals & Structured Data */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Canonicalization & Schema.org</h3>
              <p className="text-[11px] text-slate-500">Duplicate prevention & rich snippets</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Canonical tags resolve duplicate URL parameters. JSON-LD structured data communicates organizational entities and breadcrumbs.
          </p>
          <div className="space-y-1.5 pt-1 text-xs">
            {seoIssues.filter((i) => i.rule_id.includes('CANONICAL') || i.rule_id.includes('STRUCTURED')).map((iss) => (
              <div key={iss.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800">{iss.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{iss.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
