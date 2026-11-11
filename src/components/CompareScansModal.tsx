import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { RecentScanItem, ScanReport } from '../types';
import { compareScans } from '../services/api';

interface CompareScansModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentScans: RecentScanItem[];
  currentReport: ScanReport | null;
}

export const CompareScansModal: React.FC<CompareScansModalProps> = ({
  isOpen,
  onClose,
  recentScans,
  currentReport
}) => {
  const completedScans = recentScans.filter((s) => s.status === 'completed');

  const [baseId, setBaseId] = useState<string>('');
  const [compareId, setCompareId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  useEffect(() => {
    if (completedScans.length >= 2) {
      setBaseId(completedScans[1].id);
      setCompareId(completedScans[0].id);
    } else if (completedScans.length === 1 && currentReport && currentReport.scan_id !== completedScans[0].id) {
      setBaseId(completedScans[0].id);
      setCompareId(currentReport.scan_id);
    }
  }, [completedScans.length, currentReport?.scan_id]);

  useEffect(() => {
    if (isOpen && baseId && compareId && baseId !== compareId) {
      runComparison(baseId, compareId);
    }
  }, [isOpen, baseId, compareId]);

  const runComparison = async (bId: string, cId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await compareScans(bId, cId);
      setComparisonResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to compare the selected scans.');
      setComparisonResult(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Compare Website Scans</h3>
              <p className="text-[11px] text-slate-500">Track health score progression & resolved issues</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {completedScans.length < 2 && !(completedScans.length === 1 && currentReport && currentReport.scan_id !== completedScans[0].id) ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <Layers className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">Insufficient Scan History</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Comparing audit progression requires at least two completed scans for your domain. Run another scan to start tracking health improvements.
              </p>
            </div>
          ) : (
            <>
              {/* Select Scans Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Baseline Scan (Earlier)
                  </label>
                  <select
                    value={baseId}
                    onChange={(e) => setBaseId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                  >
                    {completedScans.map((s) => (
                      <option key={`base-${s.id}`} value={s.id}>
                        {s.domain} ({new Date(s.created_at).toLocaleDateString()}) - {s.health_score}/100
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Comparison Scan (Recent)
                  </label>
                  <select
                    value={compareId}
                    onChange={(e) => setCompareId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                  >
                    {completedScans.map((s) => (
                      <option key={`compare-${s.id}`} value={s.id}>
                        {s.domain} ({new Date(s.created_at).toLocaleDateString()}) - {s.health_score}/100
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading && (
                <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Computing audit diff...</span>
                </div>
              )}

              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {comparisonResult && !loading && (
                <div className="space-y-4">
                  {/* Score Delta Highlight */}
                  <div className={`flex items-center justify-between p-4 rounded-xl border ${
                    comparisonResult.score_diff >= 0
                      ? 'bg-emerald-50/70 border-emerald-200/80'
                      : 'bg-rose-50/70 border-rose-200/80'
                  }`}>
                    <div>
                      <p className="text-xs font-medium text-slate-700">Health Score Progression</p>
                      <p className="text-2xl font-extrabold text-slate-900 font-mono mt-0.5">
                        {comparisonResult.base_health_score} → {comparisonResult.compare_health_score}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 bg-white rounded-full text-xs font-bold shadow-2xs font-mono ${
                      comparisonResult.score_diff >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {comparisonResult.score_diff >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-rose-600" />
                      )}
                      <span>
                        {comparisonResult.score_diff > 0 ? `+${comparisonResult.score_diff}` : comparisonResult.score_diff} Points
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                      <p className="text-[10px] text-emerald-700 font-bold uppercase">Resolved Issues</p>
                      <p className="text-lg font-extrabold text-emerald-900 font-mono mt-0.5">
                        {comparisonResult.resolved_issues?.length || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                      <p className="text-[10px] text-rose-700 font-bold uppercase">New Issues</p>
                      <p className="text-lg font-extrabold text-rose-900 font-mono mt-0.5">
                        {comparisonResult.new_issues?.length || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-[10px] text-slate-600 font-bold uppercase">Persistent Issues</p>
                      <p className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">
                        {comparisonResult.persistent_issues?.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* Resolved Issues List */}
                  {comparisonResult.resolved_issues?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Resolved Issues ({comparisonResult.resolved_issues.length})</span>
                      </h4>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {comparisonResult.resolved_issues.map((iss: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100 flex items-center justify-between">
                            <div className="truncate mr-2">
                              <p className="font-semibold text-slate-800 truncate">{iss.title}</p>
                              <p className="text-[11px] text-slate-500 font-mono truncate">{iss.affected_url}</p>
                            </div>
                            <span className="text-[11px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                              Resolved
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* New Issues List */}
                  {comparisonResult.new_issues?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>New Findings ({comparisonResult.new_issues.length})</span>
                      </h4>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {comparisonResult.new_issues.map((iss: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-rose-50/40 border border-rose-100 flex items-center justify-between">
                            <div className="truncate mr-2">
                              <p className="font-semibold text-slate-800 truncate">{iss.title}</p>
                              <p className="text-[11px] text-slate-500 font-mono truncate">{iss.affected_url}</p>
                            </div>
                            <span className="text-[11px] font-semibold text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200 shrink-0">
                              New
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
