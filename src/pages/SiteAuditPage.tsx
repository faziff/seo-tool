import React, { useState } from 'react';
import {
  Globe,
  Search,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  FileText,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { ScanReport, ScannedPage } from '../types';

interface SiteAuditPageProps {
  report: ScanReport;
}

export const SiteAuditPage: React.FC<SiteAuditPageProps> = ({ report }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const pages = report.pages || [];

  const filteredPages = pages.filter((page) => {
    // Filter by category
    if (filterType === '200' && page.status_code !== 200) return false;
    if (filterType === '3xx' && (!page.status_code || page.status_code < 300 || page.status_code >= 400)) return false;
    if (filterType === '4xx' && (!page.status_code || page.status_code < 400)) return false;
    if (filterType === 'noindex' && page.is_indexable) return false;

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const urlMatch = page.url.toLowerCase().includes(q);
      const titleMatch = (page.title || '').toLowerCase().includes(q);
      return urlMatch || titleMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Site Audit & Page Explorer
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Detailed crawler findings for {report.domain} ({pages.length} pages indexed)
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by URL or title..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All Pages', count: pages.length },
          { id: '200', label: '200 OK', count: pages.filter((p) => p.status_code === 200).length },
          { id: '3xx', label: 'Redirects', count: report.redirects_found },
          { id: '4xx', label: 'Errors (4xx/5xx)', count: report.broken_links_found },
          { id: 'noindex', label: 'Non-Indexable', count: pages.filter((p) => !p.is_indexable).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filterType === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[11px] font-mono opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Scanned Pages Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">URL</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">TTFB</th>
                <th className="py-3 px-3">Page Title</th>
                <th className="py-3 px-3">Meta Description</th>
                <th className="py-3 px-3 text-right">Words</th>
                <th className="py-3 px-3 text-right">H1 Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No pages matched the selected filters.
                  </td>
                </tr>
              ) : (
                filteredPages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 max-w-xs">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-800 hover:text-indigo-600 flex items-center gap-1.5 truncate group"
                      >
                        <span className="truncate">{p.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      </a>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded font-mono font-semibold text-[11px] ${
                        p.status_code === 200
                          ? 'bg-emerald-50 text-emerald-700'
                          : p.status_code && p.status_code >= 400
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {p.status_code || 'Err'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {p.response_time_ms}ms
                    </td>
                    <td className="py-3 px-3 max-w-xs truncate text-slate-700">
                      {p.title || <span className="text-rose-500 italic">Missing title</span>}
                    </td>
                    <td className="py-3 px-3 max-w-xs truncate text-slate-500">
                      {p.meta_description || <span className="text-amber-500 italic">Missing description</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      {p.word_count}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className={p.h1_count === 1 ? 'text-emerald-600' : 'text-amber-600'}>
                        {p.h1_count}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
