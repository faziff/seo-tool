import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Code,
  ShieldAlert,
  Loader2,
  FileCode
} from 'lucide-react';
import { Issue } from '../types';
import { generateAIFix, updateIssueStatus } from '../services/api';

interface IssueDetailModalProps {
  issue: Issue | null;
  onClose: () => void;
  onStatusChanged: (issueId: string, resolved: boolean) => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  onClose,
  onStatusChanged
}) => {
  const [copied, setCopied] = useState(false);
  const [aiFixText, setAiFixText] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!issue) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateAI = async () => {
    setIsLoadingAI(true);
    try {
      const res = await generateAIFix(issue);
      if (res.status === 'success') {
        setAiFixText(res.fix_content);
      } else if (res.remediation_guide) {
        setAiFixText(res.remediation_guide);
      } else {
        setAiFixText(res.message || 'Unable to generate automated fix at this time.');
      }
    } catch (e: any) {
      setAiFixText(`Error generating fix: ${e.message}`);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleToggleResolved = async () => {
    setIsUpdatingStatus(true);
    try {
      const nextResolved = !issue.resolved;
      await updateIssueStatus(issue.id, nextResolved);
      onStatusChanged(issue.id, nextResolved);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              issue.severity === 'Critical' || issue.severity === 'High'
                ? 'bg-rose-100 text-rose-700'
                : issue.severity === 'Medium'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {issue.severity}
            </span>
            <span className="text-xs font-mono text-slate-500">{issue.rule_id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleResolved}
              disabled={isUpdatingStatus}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                issue.resolved
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{issue.resolved ? 'Marked as Resolved' : 'Mark as Resolved'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              {issue.title}
            </h2>
            <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
              <span>Affected URL:</span>
              <a
                href={issue.affected_url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline flex items-center gap-1 truncate max-w-md"
              >
                <span>{issue.affected_url}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>

          {/* Evidence Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
              <ShieldAlert className="w-4 h-4 text-slate-600" />
              <span>Technical Evidence</span>
            </div>
            <p className="font-mono text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/80 break-all">
              {issue.evidence}
            </p>
          </div>

          {/* Explanation */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Why This Matters</h4>
            <p className="leading-relaxed">{issue.explanation}</p>
          </div>

          {/* Recommendation */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Recommended Solution</h4>
            <p className="leading-relaxed">{issue.recommendation}</p>
          </div>

          {/* Suggested Fix Code Box */}
          {issue.suggested_fix && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <span>Code / Config Snippet</span>
                </span>
                <button
                  onClick={() => handleCopy(issue.suggested_fix || '')}
                  className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy snippet'}</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto selection:bg-indigo-600">
                <code>{issue.suggested_fix}</code>
              </pre>
            </div>
          )}

          {/* Dynamic AI Fix Container */}
          {aiFixText && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-bold">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>NOVA AI Remediation Guide</span>
              </div>
              <div className="text-slate-800 whitespace-pre-wrap font-mono text-[11px] bg-white p-3 rounded-lg border border-indigo-100 max-h-56 overflow-y-auto">
                {aiFixText}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleGenerateAI}
            disabled={isLoadingAI}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
          >
            {isLoadingAI ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Consulting NOVA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate AI Fix</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
