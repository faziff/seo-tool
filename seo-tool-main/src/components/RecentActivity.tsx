import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  PlayCircle,
  ArrowUpRight,
  Activity
} from 'lucide-react';
import { ScanReport, RecentScanItem } from '../types';

interface RecentActivityProps {
  report: ScanReport | null;
  recentScans: RecentScanItem[];
  onViewAllActivity: () => void;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  report,
  recentScans,
  onViewAllActivity
}) => {
  // Generate real activity items from actual stored scans
  const activities: Array<{
    id: string | number;
    title: string;
    desc: string;
    time: string;
    icon: any;
    iconColor: string;
    bgColor: string;
  }> = [];

  if (report) {
    if (report.status === 'completed') {
      activities.push({
        id: `scan-${report.scan_id}`,
        title: 'Scan completed successfully',
        desc: `${report.domain} • ${report.pages_crawled} pages crawled`,
        time: report.completed_at ? new Date(report.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
        icon: CheckCircle2,
        iconColor: 'text-emerald-500',
        bgColor: 'bg-emerald-50'
      });
    }

    if (report.broken_links_found > 0) {
      activities.push({
        id: `broken-${report.scan_id}`,
        title: 'HTTP errors detected',
        desc: `${report.broken_links_found} broken internal or external link(s)`,
        time: 'Audit finding',
        icon: AlertTriangle,
        iconColor: 'text-amber-500',
        bgColor: 'bg-amber-50'
      });
    }

    activities.push({
      id: `report-${report.scan_id}`,
      title: 'Audit report generated',
      desc: `Health Score: ${report.health_score}/100 with ${report.issues.length} issue(s)`,
      time: 'Report ready',
      icon: FileCheck,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50'
    });
  }

  // Add historical scans to activity
  recentScans.slice(0, 2).forEach((s) => {
    if (report && s.id === report.scan_id) return;
    activities.push({
      id: `hist-${s.id}`,
      title: `Scan: ${s.domain}`,
      desc: `Health Score: ${s.health_score}/100 • ${s.pages_crawled} pages`,
      time: new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      icon: PlayCircle,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50'
    });
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-4">Recent Activity</h2>

        {activities.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-1">
            <Activity className="w-5 h-5 mx-auto text-slate-300 mb-1" />
            <p className="text-xs font-medium text-slate-500">No activity recorded yet</p>
            <p className="text-[11px] text-slate-400">Scan events will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, 4).map((act) => {
              const Icon = act.icon;
              return (
                <div key={act.id} className="flex items-start gap-3 text-xs">
                  <div className={`w-7 h-7 rounded-lg ${act.bgColor} ${act.iconColor} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-slate-800 truncate">{act.title}</p>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">{act.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{act.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-slate-100">
        <button
          onClick={onViewAllActivity}
          className="w-full flex items-center justify-between text-xs font-semibold text-indigo-600 hover:text-indigo-700 group"
        >
          <span>View all reports</span>
          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
