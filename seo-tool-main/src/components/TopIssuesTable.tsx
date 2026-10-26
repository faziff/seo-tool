import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react';
import { Issue, Severity } from '../types';

interface TopIssuesTableProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  onViewAllIssues: () => void;
}

export const TopIssuesTable: React.FC<TopIssuesTableProps> = ({
  issues,
  onSelectIssue,
  onViewAllIssues
}) => {
  const [activeSeverity, setActiveSeverity] = useState<string>('All');

  // Count by severity
  const counts = {
    All: issues.length,
    Critical: issues.filter((i) => i.severity === 'Critical').length,
    High: issues.filter((i) => i.severity === 'High').length,
    Medium: issues.filter((i) => i.severity === 'Medium').length,
    Low: issues.filter((i) => i.severity === 'Low').length,
  };

  const filteredIssues = issues.filter((i) => {
    if (activeSeverity === 'All') return true;
    return i.severity.toLowerCase() === activeSeverity.toLowerCase();
  });

  const getSeverityBadge = (severity: Severity) => {
    switch (severity) {
      case 'Critical':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-800 border border-red-200">
            Critical
          </span>
        );
      case 'High':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            High
          </span>
        );
      case 'Medium':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            Medium
          </span>
        );
      case 'Low':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            Low
          </span>
        );
    }
  };

  const getSeverityIcon = (severity: Severity) => {
    switch (severity) {
      case 'Critical':
      case 'High':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'Medium':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'Low':
        return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
      {/* Table Header and Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <h2 className="text-sm font-bold text-slate-900">Top Issues</h2>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map((tab) => {
            const count = counts[tab];
            const isActive = activeSeverity === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveSeverity(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span>{tab}</span>
                <span className={`text-[10px] font-mono ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onViewAllIssues}
          className="hidden md:flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 group shrink-0"
        >
          <span>View all issues</span>
          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="pb-3 pl-1 font-semibold">Issue</th>
              <th className="pb-3 px-3 font-semibold">Type</th>
              <th className="pb-3 px-3 font-semibold">Severity</th>
              <th className="pb-3 px-3 font-semibold text-right">Pages Affected</th>
              <th className="pb-3 px-3 font-semibold hidden md:table-cell">Recommendation</th>
              <th className="pb-3 pr-1 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80 text-xs">
            {filteredIssues.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="font-medium text-slate-600">No {activeSeverity !== 'All' ? activeSeverity : ''} issues detected</p>
                  <p className="text-[11px] text-slate-400">All corresponding audit checks passed successfully.</p>
                </td>
              </tr>
            ) : (
              filteredIssues.slice(0, 6).map((issue) => (
                <tr
                  key={issue.id}
                  onClick={() => onSelectIssue(issue)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 pl-1 pr-3">
                    <div className="flex items-center gap-2.5">
                      {getSeverityIcon(issue.severity)}
                      <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {issue.title}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-600 font-medium">
                    {issue.category}
                  </td>
                  <td className="py-3.5 px-3">
                    {getSeverityBadge(issue.severity)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                    {issue.pages_affected}
                  </td>
                  <td className="py-3.5 px-3 text-slate-500 truncate max-w-xs hidden md:table-cell">
                    {issue.recommendation}
                  </td>
                  <td className="py-3.5 pr-1 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all inline-block" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Showing {Math.min(6, filteredIssues.length)} of {filteredIssues.length} issues</span>
        <button
          onClick={onViewAllIssues}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
        >
          View Complete Issues List →
        </button>
      </div>
    </div>
  );
};
