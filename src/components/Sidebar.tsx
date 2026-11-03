import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Globe,
  Search,
  Zap,
  Eye,
  Terminal,
  FileText,
  Sparkles,
  BarChart3,
  Crown,
  ChevronRight,
  X,
  History,
  Telescope,
  Compass,
  Wrench,
  ListChecks,
  Link2,
  MapPin,
  Megaphone,
  MessageSquareText,
  Plug,
  Activity,
  GitCompare,
  TrendingUp,
  CircleHelp,
  Network,
  SearchCheck
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const navGroups = [
    { title: 'Workspace', items: [
      { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, available: true },
      { id: 'projects', label: 'Projects', icon: FolderKanban, available: true }
    ]},
    { title: 'Search Intelligence', items: [
      { id: 'seo-analysis', label: 'SEO Analysis', icon: SearchCheck, available: true },
      { id: 'aeo', label: 'AEO', icon: CircleHelp, available: true },
      { id: 'geo', label: 'GEO', icon: Network, available: true },
    ]},
    { title: 'SEO Toolkit', items: [
      { id: 'site-audit', label: 'Site Audit', icon: Globe, available: true },
      { id: 'audit-checklist', label: 'Audit Checklist', icon: ListChecks, available: true },
      { id: 'keyword-research', label: 'Keyword Research', icon: Telescope, available: true },
      { id: 'position-tracking', label: 'Rank Tracking', icon: TrendingUp, available: false },
      { id: 'keyword-gap', label: 'Keyword Gap', icon: GitCompare, available: false },
      { id: 'backlinks', label: 'Backlink Analysis', icon: Link2, available: false },
      { id: 'technical', label: 'Technical SEO', icon: Terminal, available: true },
      { id: 'performance', label: 'Performance', icon: Zap, available: true },
      { id: 'accessibility', label: 'Accessibility', icon: Eye, available: true },
      { id: 'fix-center', label: 'Fix Center', icon: Wrench, available: true }
    ]},
    { title: 'AI & Visibility', items: [
      { id: 'ai-visibility', label: 'AI Visibility', icon: Sparkles, available: false },
      { id: 'ai-assistant', label: 'NOVA AI', icon: Sparkles, available: true }
    ]},
    { title: 'Traffic & Growth', items: [
      { id: 'market-research', label: 'Competitor Analysis', icon: Compass, available: true },
      { id: 'local-seo', label: 'Local SEO', icon: MapPin, available: false },
      { id: 'content', label: 'Content', icon: FileText, available: true },
      { id: 'advertising', label: 'Advertising', icon: Megaphone, available: false },
      { id: 'ai-pr', label: 'AI PR & Brand', icon: MessageSquareText, available: false },
      { id: 'social', label: 'Social', icon: Activity, available: false }
    ]},
    { title: 'Workspace Tools', items: [
      { id: 'reports', label: 'Reports', icon: BarChart3, available: true },
      { id: 'settings', label: 'Settings', icon: Plug, available: true }
    ]}
  ];

  const content = (
    <div className="crox-sidebar-shell w-[194px] min-w-[194px] h-full border-r flex flex-col justify-between select-none">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {/* Brand Logo Lockup */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#100d21] flex items-center justify-center border border-violet-100/80 shadow-sm">
              <BrandMark size={33} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white font-sans">
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

        {/* Grouped navigation mirrors a search-intelligence suite without hiding the tools already implemented. */}
        <nav aria-label="CROX main navigation" className="space-y-3">
          {navGroups.map(group => {
            const isCollapsed = collapsedGroups[group.title] === true;
            const groupHasActiveItem = group.items.some(item => item.id === currentTab);
            return (
              <section key={group.title}>
                <button type="button" onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.title]: !isCollapsed }))} aria-expanded={!isCollapsed} className="mb-1 flex w-full items-center justify-between gap-2 px-3 py-1 text-left text-[9px] font-extrabold uppercase tracking-[.15em] text-[#918BA9] hover:text-white">
                  <span>{group.title}</span>
                  <ChevronRight className={`h-3 w-3 transition-transform ${!isCollapsed ? 'rotate-90' : ''} ${groupHasActiveItem ? 'text-indigo-500' : ''}`} />
                </button>
                {!isCollapsed && <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button key={item.id} type="button" onClick={() => { onSelectTab(item.id); if (isMobileOpen) onCloseMobile(); }} aria-current={isActive ? 'page' : undefined} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-[11px] font-medium transition-colors ${isActive ? 'bg-[#5528D8] text-white font-semibold shadow-lg shadow-violet-950/30' : 'text-[#B8B2CC] hover:text-white hover:bg-white/5'}`}>
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-[#8D87A6]'}`} />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {!item.available && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-400">Soon</span>}
                      </button>
                    );
                  })}
                </div>}
              </section>
            );
          })}
        </nav>

        {/* Recent Scans Section */}
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between px-3 mb-2.5">
            <span className="text-[10px] font-semibold text-[#A7A1BC] tracking-wider uppercase">
              Recent Scans
            </span>
            <span className="text-[10px] text-[#817B99] font-mono">{recentScans.length}</span>
          </div>

          <div className="space-y-1">
            {recentScans.length === 0 ? (
              <div className="px-3 py-3 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                <History className="w-4 h-4 text-[#817B99] mx-auto mb-1" />
                <p className="text-[11px] text-[#B8B2CC]">No scans completed yet</p>
                <p className="text-[10px] text-[#817B99] mt-0.5">Open Projects to start</p>
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
                      isCurrent ? 'bg-white/10 font-medium' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                      scan.status === 'completed' ? 'bg-emerald-500' : scan.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#F0EDFA] truncate">{scan.domain}</p>
                      <p className="text-[10px] text-[#8983A2] truncate font-mono">
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
      <div className="p-3 border-t border-white/10 bg-[#141225]">
        <div className="bg-white/5 rounded-xl border border-white/10 p-3 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#E6E1F3] mb-1.5">
            <span className="font-semibold text-white">Workspace Status</span>
            <Crown className="w-4 h-4 text-violet-300" />
          </div>
          <p className="text-[10px] text-[#A29BB9] mb-2 font-mono">
            {recentScans.length} scan{recentScans.length !== 1 ? 's' : ''} stored
          </p>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#8255F5] rounded-full" style={{ width: `${Math.min(100, Math.max(10, recentScans.length * 20))}%` }} />
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
