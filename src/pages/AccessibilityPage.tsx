import React from 'react';
import {
  Eye,
  CheckCircle2,
  AlertTriangle,
  Info,
  Check,
  ShieldCheck,
  ListCheck
} from 'lucide-react';
import { ScanReport } from '../types';

interface AccessibilityPageProps {
  report: ScanReport;
}

export const AccessibilityPage: React.FC<AccessibilityPageProps> = ({ report }) => {
  const accIssues = report.issues.filter((i) => i.category === 'Accessibility');

  const manualChecklist = [
    { title: 'Keyboard Tab Order', desc: 'Verify all interactive links and buttons can be reached via Tab key without keyboard traps.' },
    { title: 'Visible Focus Indicators', desc: 'Ensure interactive elements show high-contrast visible focus rings when focused.' },
    { title: 'ARIA Roles & Landmarks', desc: 'Confirm semantic header, nav, main, and footer elements exist for assistive screen readers.' },
    { title: 'Skip to Main Content', desc: 'Provide an accessible skip-link for keyboard users navigating long header menus.' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Accessibility (WCAG 2.1 AA) Audit
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Automated compliance checks and assistive navigation review for {report.domain}
        </p>
      </div>

      {/* Accessibility Score Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Automated Accessibility Score
          </span>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-4xl font-extrabold text-slate-900">{report.accessibility_score}</span>
            <span className="text-sm text-slate-500 font-semibold">/100</span>
          </div>
          <p className="text-xs text-slate-600 max-w-md pt-1">
            Automated evaluation covers image alternative text, mobile viewport compliance, document language declarations, and contrast indicators.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
          <ShieldCheck className="w-8 h-8 text-teal-600 shrink-0" />
          <div>
            <p className="font-bold text-slate-900">WCAG 2.1 Level AA Benchmark</p>
            <p className="text-slate-500 text-[11px]">
              {accIssues.length === 0
                ? 'Zero automated accessibility violations detected.'
                : `${accIssues.length} automated issue(s) require remediation.`}
            </p>
          </div>
        </div>
      </div>

      {/* Automated Findings */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900">Automated Audit Findings</h3>

        <div className="space-y-2 text-xs">
          {accIssues.length === 0 ? (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>All tested templates passed automated accessibility checks!</span>
            </div>
          ) : (
            accIssues.map((iss) => (
              <div key={iss.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{iss.title}</p>
                    <span className="text-[11px] font-mono text-slate-500">{iss.pages_affected} pages affected</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 font-mono">{iss.evidence}</p>
                  <p className="text-[11px] text-indigo-700 mt-1 font-medium">{iss.recommendation}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Manual Accessibility Review Checklist */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <ListCheck className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900">
            Recommended Manual Accessibility Review
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Automated tools capture approximately 35% of accessibility barriers. We recommend verifying these user interactions:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {manualChecklist.map((item, idx) => (
            <div key={idx} className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1 text-xs">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-teal-600" />
                <span>{item.title}</span>
              </p>
              <p className="text-[11px] text-slate-500 pl-5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
