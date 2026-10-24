import React, { useState } from 'react';
import {
  Link as LinkIcon,
  ArrowRight,
  X,
  Loader2,
  AlertCircle,
  FileText,
  Sliders,
  Sparkles,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { ScanProgress } from '../types';

interface ScannerHeroProps {
  onStartScan: (url: string) => void;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  onOpenReports: () => void;
  onOpenCompare: () => void;
  onOpenAI: () => void;
  onQuickAudit: () => void;
}

export const ScannerHero: React.FC<ScannerHeroProps> = ({
  onStartScan,
  isScanning,
  scanProgress,
  onOpenReports,
  onOpenCompare,
  onOpenAI,
  onQuickAudit
}) => {
  const [urlInput, setUrlInput] = useState('example.com');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setValidationError('Please enter a website URL or domain.');
      return;
    }

    if (
      trimmed.toLowerCase().includes('localhost') ||
      trimmed.startsWith('127.') ||
      trimmed.startsWith('192.168.') ||
      trimmed.startsWith('10.') ||
      trimmed.startsWith('169.254.')
    ) {
      setValidationError('Scanning localhost, private IP addresses, or internal endpoints is restricted for security.');
      return;
    }

    onStartScan(trimmed);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-indigo-50/40 via-purple-50/30 to-pink-50/20 p-6 md:p-8 mb-6 shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Headline and Scanner */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-widest text-indigo-600 uppercase">
              WEBSITE AUDIT & SEO INTELLIGENCE
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Discover What’s Holding<br />
            Your Website Back.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl">
            Analyze technical SEO, page performance, accessibility, and website health in one place.
          </p>

          {/* Scanner Card Form */}
          <form onSubmit={handleSubmit} className="pt-2 max-w-xl">
            <div className="flex flex-col sm:flex-row items-center gap-2 p-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
              <div className="flex items-center gap-2.5 flex-1 w-full pl-3 pr-2 py-1.5">
                <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  disabled={isScanning}
                  placeholder="Enter your website URL or domain"
                  className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
                {urlInput && !isScanning && (
                  <button
                    type="button"
                    onClick={() => setUrlInput('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                    aria-label="Clear input"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isScanning}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze Website</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Validation Error Message */}
            {validationError && (
              <div className="mt-2.5 flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200/80 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Live Crawl Progress Indicator */}
            {isScanning && scanProgress && (
              <div className="mt-3 bg-white/90 border border-indigo-100 rounded-xl p-3 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-indigo-700 font-medium truncate">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-indigo-600" />
                    <span className="truncate">{scanProgress.current_action}</span>
                  </div>
                  <span className="font-semibold text-indigo-600 shrink-0 font-mono">
                    {scanProgress.progress}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, scanProgress.progress)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Crawled: {scanProgress.pages_crawled} pages</span>
                  <span>URLs found: {scanProgress.total_urls_found}</span>
                </div>
              </div>
            )}

            {/* Subtext and Example Link */}
            {!isScanning && (
              <p className="mt-2 text-xs text-slate-500 pl-2">
                Example:{' '}
                <button
                  type="button"
                  onClick={() => setUrlInput('example.com')}
                  className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                >
                  example.com
                </button>
                <span className="mx-2 text-slate-300">·</span>
                <span className="text-slate-400">Respects robots.txt & SSRF safety rules</span>
              </p>
            )}
          </form>
        </div>

        {/* Right Column: Quick Actions Card */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900 tracking-wider px-1">
              Quick Actions
            </h3>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={onQuickAudit}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      New Website Audit
                    </p>
                    <p className="text-[11px] text-slate-500">Scan a new domain</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={onOpenReports}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                      View Reports
                    </p>
                    <p className="text-[11px] text-slate-500">Access past audit reports</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={onOpenCompare}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                      Compare Scans
                    </p>
                    <p className="text-[11px] text-slate-500">Track improvements over time</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={onOpenAI}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
                      AI Assistant
                    </p>
                    <p className="text-[11px] text-slate-500">Get SEO insights & suggestions</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
