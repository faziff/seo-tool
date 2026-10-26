import React from 'react';
import {
  Download,
  Sliders,
  FileSpreadsheet,
  Globe,
  ArrowRight
} from 'lucide-react';
import { ScanReport, RecentScanItem } from '../types';

interface ReportsPageProps {
  currentReport: ScanReport | null;
  recentScans: RecentScanItem[];
  onSelectScan: (scanId: string) => void;
  onOpenCompare: () => void;
  onFocusScanner?: () => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  currentReport,
  recentScans,
  onSelectScan,
  onOpenCompare,
  onFocusScanner
}) => {
  const handleExportCSV = (scanId: string) => {
    window.location.href = `/api/scans/${scanId}/export/csv`;
  };

  const allScans: RecentScanItem[] = recentScans.length > 0
    ? recentScans
    : currentReport
    ? [
        {
          id: currentReport.scan_id,
          domain: currentReport.domain,
          target_url: currentReport.target_url,
          status: currentReport.status,
          health_score: currentReport.health_score,
          pages_crawled: currentReport.pages_crawled,
          created_at: currentReport.created_at
        }
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Audit Reports & Scan History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Download persistent CSV reports and compare historical scans
            {currentReport ? ` for ${currentReport.domain}` : ''}
          </p>
        </div>

        {allScans.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCompare}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>Compare Two Scans</span>
            </button>

            {currentReport && (
              <button
                onClick={() => handleExportCSV(currentReport.scan_id)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Current CSV</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reports Table or Empty State */}
      {allScans.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto space-y-4 shadow-xs">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Globe className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Audit Reports Saved Yet</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Every audit you run generates a persistent, downloadable report containing technical SEO issues, crawl diagnostics, and status codes.
          </p>
          {onFocusScanner && (
            <button
              onClick={onFocusScanner}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <span>Scan Your First Website</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">Stored Audit Reports</h3>
            <span className="text-xs text-slate-500 font-mono">{allScans.length} reports in database</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Domain</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Health Score</th>
                  <th className="py-3 px-3 text-right">Pages Crawled</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allScans.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {s.domain}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono">
                      {new Date(s.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {s.health_score}/100
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      {s.pages_crawled}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        s.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : s.status === 'failed'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right space-x-2">
                      <button
                        onClick={() => onSelectScan(s.id)}
                        className="px-2.5 py-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        View Report
                      </button>
                      <button
                        onClick={() => handleExportCSV(s.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium"
                        title="Download CSV"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 inline-block mr-1" />
                        CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
