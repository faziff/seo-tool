import React from 'react';
import {
  LayoutDashboard,
  Globe,
  Search,
  Zap,
  Eye,
  Terminal,
  FileText,
  Sparkles,
  BarChart3,
  Settings,
  Crown,
  ChevronRight,
  X,
  History,
  Telescope,
  Compass,
  Wrench
} from 'lucide-react';
import { BrandMark } from './BrandMark';
import { RecentScanItem } from '../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  recentScans: RecentScanItem[];
  onSelectScan: (scanId: string) => void;
  activeScanId?: string;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  hasActiveReport: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  recentScans,
  onSelectScan,
  activeScanId,
  isMobileOpen,
  onCloseMobile,
  hasActiveReport
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'site-audit', label: 'Site Audit', icon: Globe },
    { id: 'seo-analysis', label: 'SEO Analysis', icon: Search },
    { id: 'keyword-research', label: 'Keyword Research', icon: Telescope },
    { id: 'market-research', label: 'Market Research', icon: Compass },
    { id: 'performance', label: 'Performance', icon: Zap },
    { id: 'accessibility', label: 'Accessibility', icon: Eye },
    { id: 'technical', label: 'Technical Issues', icon: Terminal },
    { id: 'fix-center', label: 'Fix Center', icon: Wrench },
    { id: 'content', label: 'Content Opportunities', icon: FileText },
    { id: 'ai-assistant', label: 'NOVA AI Assistant', icon: Sparkles },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Workspace Settings', icon: Settings },
  ];

  const content = (
    <div className="w-64 h-full bg-white border-r border-slate-200/80 flex flex-col justify-between select-none">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {/* Brand Logo Lockup */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#100d21] flex items-center justify-center border border-violet-100/80 shadow-sm">
              <BrandMark size={33} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 font-sans">
              CROX
            </span>
          </div>
          {isMobileOpen && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Primary Navigation Rail */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (isMobileOpen) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#4F46E5] font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#4F46E5]' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Recent Scans Section */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between px-3 mb-2.5">
            <span className="text-xs font-semibold text-slate-500 tracking-wider">
              Recent Scans
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{recentScans.length}</span>
          </div>

          <div className="space-y-1">
            {recentScans.length === 0 ? (
              <div className="px-3 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <History className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                <p className="text-[11px] text-slate-500">No scans completed yet</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Submit a domain above</p>
              </div>
            ) : (
              recentScans.map((scan) => {
                const isCurrent = activeScanId === scan.id;
                return (
                  <button
                    key={scan.id}
                    onClick={() => {
                      onSelectScan(scan.id);
                      onSelectTab('overview');
                      if (isMobileOpen) onCloseMobile();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors group flex items-start gap-2.5 ${
                      isCurrent ? 'bg-slate-100/90 font-medium' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                      scan.status === 'completed' ? 'bg-emerald-500' : scan.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 truncate">{scan.domain}</p>
                      <p className="text-[11px] text-slate-500 truncate font-mono">
                        {typeof scan.created_at === 'string' && scan.created_at.includes('T')
                          ? new Date(scan.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
                          : scan.created_at}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Free Plan Usage Box */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/50">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
            <span className="font-semibold text-slate-900">Workspace Status</span>
            <Crown className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xs text-slate-500 mb-2 font-mono">
            {recentScans.length} scan{recentScans.length !== 1 ? 's' : ''} stored
          </p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min(100, Math.max(10, recentScans.length * 20))}%` }} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-screen sticky top-0 shrink-0">
        {content}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
