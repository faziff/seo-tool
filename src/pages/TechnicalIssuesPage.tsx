import React, { useState } from 'react';
import {
  Terminal,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { ScanReport, Issue, Severity, IssueCategory } from '../types';

interface TechnicalIssuesPageProps {
  report: ScanReport;
  onSelectIssue: (issue: Issue) => void;
  onQuickResolve: (issueId: string, resolved: boolean) => void;
}

export const TechnicalIssuesPage: React.FC<TechnicalIssuesPageProps> = ({
  report,
  onSelectIssue,
  onQuickResolve
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');

  const issues = report.issues || [];

  const filtered = issues.filter((iss) => {
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = iss.title.toLowerCase().includes(q);
      const matchUrl = iss.affected_url.toLowerCase().includes(q);
      const matchEvidence = iss.evidence.toLowerCase().includes(q);
      if (!matchTitle && !matchUrl && !matchEvidence) return false;
    }
    // Category
    if (selectedCategory !== 'All' && iss.category.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }
    // Severity
    if (selectedSeverity !== 'All' && iss.severity.toLowerCase() !== selectedSeverity.toLowerCase()) {
      return false;
    }
    // Status
    if (statusFilter === 'unresolved' && iss.resolved) return false;
    if (statusFilter === 'resolved' && !iss.resolved) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Issue Management & Diagnostics
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Prioritized technical, SEO, and structural findings for {report.domain} ({issues.length} total)
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search issues by name, evidence, or affected URL..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="All">All Categories</option>
              <option value="SEO">SEO</option>
              <option value="Technical">Technical</option>
              <option value="Performance">Performance</option>
              <option value="Accessibility">Accessibility</option>
            </select>

            {/* Severity Select */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Status Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl shrink-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('unresolved')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  statusFilter === 'unresolved' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Open
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  statusFilter === 'resolved' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Resolved
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-3">Issue Title</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3 text-right">Pages</th>
                <th className="py-3 px-3">Affected URL</th>
                <th className="py-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No issues match the current filter selection.
                  </td>
                </tr>
              ) : (
                filtered.map((iss) => (
                  <tr key={iss.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onQuickResolve(iss.id, !iss.resolved)}
                        className={`p-1 rounded-md transition-colors ${
                          iss.resolved ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-300 hover:text-slate-500'
                        }`}
                        title={iss.resolved ? 'Reopen issue' : 'Mark as resolved'}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors cursor-pointer"
                        onClick={() => onSelectIssue(iss)}>
                      {iss.title}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {iss.category}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        iss.severity === 'Critical'
                          ? 'bg-red-100 text-red-800'
                          : iss.severity === 'High'
                          ? 'bg-rose-50 text-rose-700'
                          : iss.severity === 'Medium'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {iss.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      {iss.pages_affected}
                    </td>
                    <td className="py-3 px-3 max-w-xs truncate text-slate-500 font-mono">
                      {iss.affected_url}
                    </td>
                    <td className="py-3 pr-4 text-right space-x-2">
                      <button
                        onClick={() => onSelectIssue(iss)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-700 font-medium transition-colors"
                      >
                        How to Fix
                      </button>
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
