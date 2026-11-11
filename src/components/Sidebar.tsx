import React, { useEffect, useMemo, useState } from 'react';
import {
  House, ShieldCheck, ChartNoAxesCombined, ChartColumnIncreasing, Globe,
  CircleAlert, Crosshair, Link2, Users, Telescope, Compass, LayoutDashboard,
  Trophy, Files, Send, Search, Lightbulb, WandSparkles, Mail, Goal,
  ClipboardCheck, PenTool, Crown, Settings2, X, ChevronDown, ChevronRight,
  FolderKanban, MapPinned, BrainCircuit, FileText, Gauge, Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const navGroups = [
  {
    id: 'workspace', label: 'Workspace', icon: House,
    children: [
      { label: 'Overview', tab: 'overview', icon: LayoutDashboard },
      { label: 'Projects', tab: 'projects', icon: FolderKanban },
      { label: 'Reports & Exports', tab: 'reports', icon: FileText }
    ]
  },
  {
    id: 'seo', label: 'SEO & Site Health', icon: ShieldCheck,
    children: [
      { label: 'SEO Analysis', tab: 'seo-analysis', icon: ChartNoAxesCombined },
      { label: 'Site Audit', tab: 'site-audit', icon: Globe },
      { label: 'Technical Issues', tab: 'technical', icon: CircleAlert },
      { label: 'Performance', tab: 'performance', icon: Gauge },
      { label: 'Accessibility', tab: 'accessibility', icon: ClipboardCheck }
    ]
  },
  {
    id: 'keywords', label: 'Keyword Intelligence', icon: Telescope,
    children: [
      { label: 'Keyword Research', tab: 'keyword-research', icon: Search },
      { label: 'Keyword Gap', tab: 'keyword-gap', icon: ChartColumnIncreasing }
    ]
  },
  {
    id: 'competitive', label: 'Competitor Research', icon: Users,
    children: [
      { label: 'Competitor Analysis', tab: 'market-research', icon: Compass },
      { label: 'Market Intelligence', tab: 'market-research', icon: Telescope }
    ]
  },
  {
    id: 'rankings', label: 'Rank Tracking', icon: Crosshair,
    children: [
      { label: 'Position Tracking', tab: 'position-tracking', icon: Trophy }
    ]
  },
  {
    id: 'backlinks', label: 'Backlink Intelligence', icon: Link2,
    children: [
      { label: 'Backlink Analysis', tab: 'backlinks', icon: Link2 }
    ]
  },
  {
    id: 'content', label: 'Content Tools', icon: Lightbulb,
    children: [
      { label: 'Content Ideas & Briefs', tab: 'content', icon: Lightbulb },
      { label: 'SEO Writing Assistant', tab: 'ai-assistant', icon: PenTool },
      { label: 'Clip / Publish', tab: 'content', icon: Send }
    ]
  },
  {
    id: 'ai-search', label: 'AI Search · AEO · GEO', icon: BrainCircuit,
    children: [
      { label: 'AEO Readiness', tab: 'aeo', icon: Sparkles },
      { label: 'GEO Readiness', tab: 'geo', icon: Globe },
      { label: 'AI Visibility Tracking', tab: 'ai-visibility', icon: Search },
      { label: 'Brand Mentions', tab: 'ai-pr', icon: Mail }
    ]
  },
  {
    id: 'local', label: 'Local SEO', icon: MapPinned,
    children: [
      { label: 'Local Rankings & Grid', tab: 'local-seo', icon: MapPinned }
    ]
  },
  {
    id: 'strategy', label: 'Strategy', icon: Goal,
    children: [
      { label: 'SEO Strategy', tab: 'aeo', icon: Goal },
      { label: 'Content Strategy', tab: 'content', icon: Lightbulb }
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, isMobileOpen, onCloseMobile }) => {
  const activeGroupId = useMemo(() => navGroups.find(group => group.children.some(child => child.tab === currentTab))?.id || 'workspace', [currentTab]);
  const [openGroupId, setOpenGroupId] = useState<string>(activeGroupId);

  useEffect(() => { setOpenGroupId(activeGroupId); }, [activeGroupId]);

  const select = (tab: string) => {
    onSelectTab(tab);
    if (isMobileOpen) onCloseMobile();
  };

  return (
    <>
      {isMobileOpen && <button type="button" className="crox-ref-sidebar-backdrop" onClick={onCloseMobile} aria-label="Close navigation" />}
      <aside className={`crox-ref-sidebar ${isMobileOpen ? 'mobile-open' : ''}`} aria-label="CROX sidebar">
        <div className="crox-ref-mobile-sidebar-head"><strong>Tools & Workspace</strong><button type="button" onClick={onCloseMobile} aria-label="Close sidebar"><X size={19} /></button></div>
        <div className="crox-ref-sidebar-scroll">
          <nav className="crox-ref-navigation" aria-label="CROX tools">
            {navGroups.map(group => {
              const GroupIcon = group.icon;
              const expanded = openGroupId === group.id;
              const groupActive = group.children.some(child => child.tab === currentTab);
              return (
                <div
                  key={group.id}
                  className={`crox-ref-nav-group ${expanded ? 'expanded' : ''}`}
                  onMouseEnter={() => setOpenGroupId(group.id)}
                  onMouseLeave={() => setOpenGroupId(activeGroupId)}
                  onFocus={() => setOpenGroupId(group.id)}
                >
                  <button
                    type="button"
                    className={`crox-ref-nav-group-head ${groupActive ? 'active' : ''}`}
                    onClick={() => setOpenGroupId(previous => previous === group.id ? '__closed__' : group.id)}
                    aria-expanded={expanded}
                    aria-controls={`crox-nav-${group.id}`}
                  >
                    <GroupIcon size={17} strokeWidth={1.9} />
                    <span>{group.label}</span>
                    {expanded ? <ChevronDown size={14} className="crox-ref-nav-chevron" /> : <ChevronRight size={14} className="crox-ref-nav-chevron" />}
                  </button>
                  {expanded && <div id={`crox-nav-${group.id}`} className="crox-ref-nav-group-children">
                    {group.children.map((child, index) => {
                      const ChildIcon = child.icon;
                      const active = child.tab === currentTab && group.children.findIndex(item => item.tab === currentTab) === index;
                      return <button key={`${child.label}-${index}`} type="button" className={`crox-ref-nav-child ${active ? 'active' : ''}`} onClick={() => select(child.tab)} aria-current={active ? 'page' : undefined}>
                        <ChildIcon size={14} strokeWidth={1.9} /><span>{child.label}</span>
                      </button>;
                    })}
                  </div>}
                </div>
              );
            })}
            <div className="crox-ref-nav-divider" />
            <button type="button" className={`crox-ref-nav-item ${currentTab === 'settings' ? 'active' : ''}`} onClick={() => select('settings')} aria-current={currentTab === 'settings' ? 'page' : undefined}>
              <Settings2 size={17} strokeWidth={1.9} /><span>Settings & Integrations</span>
            </button>
          </nav>
        </div>
        <div className="crox-ref-sidebar-footer">
          <div className="crox-ref-upgrade-card">
            <div className="crox-ref-upgrade-title"><Crown size={17} fill="currentColor" /> Upgrade to Pro</div>
            <p>Unlock higher limits and advanced workflows.</p>
            <button type="button" onClick={() => select('settings')}>View plans <Settings2 size={13} /></button>
          </div>
        </div>
      </aside>
    </>
  );
};
