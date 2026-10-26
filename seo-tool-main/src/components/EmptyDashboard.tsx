import React from 'react';
import {
  Globe,
  ShieldCheck,
  Zap,
  Eye,
  Sparkles,
  ArrowRight,
  Code2,
  FileCheck
} from 'lucide-react';

interface EmptyDashboardProps {
  onFocusScanner: () => void;
}

export const EmptyDashboard: React.FC<EmptyDashboardProps> = ({ onFocusScanner }) => {
  return (
    <div className="space-y-6">
      {/* Onboarding Banner Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs text-center max-w-3xl mx-auto space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-blue-500/10 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
          <Globe className="w-7 h-7" />
        </div>

        <div className="space-y-2 max-w-lg mx-auto">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Ready for Your First Website Audit
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Enter any public website URL in the scanner above to crawl its pages, detect SEO issues, and generate a real-time health score.
          </p>
        </div>

        {/* 3 Step Workflow */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              1
            </span>
            <p className="text-xs font-bold text-slate-900">Enter Domain URL</p>
            <p className="text-[11px] text-slate-500">
              Provide any public HTTPS/HTTP domain. Submissions are verified against SSRF safety filters.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              2
            </span>
            <p className="text-xs font-bold text-slate-900">Live Crawl & Audit</p>
            <p className="text-[11px] text-slate-500">
              Our asynchronous crawler parses robots.txt, sitemaps, titles, meta tags, and headings.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              3
            </span>
            <p className="text-xs font-bold text-slate-900">Actionable Fixes</p>
            <p className="text-[11px] text-slate-500">
              Review evidence-backed recommendations, code snippets, and export persistent reports.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onFocusScanner}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-2 transition-all"
          >
            <span>Scan a Website Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Feature Capabilities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Code2 className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-900">Technical SEO Checks</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Detects broken 404 links, redirect chains, canonical inconsistencies, and HTTPS mixed content.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-900">Performance & TTFB</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Measures Time to First Byte and connects to Google PageSpeed Insights for Core Web Vitals.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Eye className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-900">WCAG 2.1 Accessibility</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Automated image alt text verification, viewport responsiveness, and language tag declarations.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-900">NOVA AI Copilot</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Generates custom meta tags, Schema.org JSON-LD scripts, and production code remediation.
          </p>
        </div>
      </div>
    </div>
  );
};
