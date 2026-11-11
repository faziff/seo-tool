import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Menu, ChevronDown, Moon, Sun, LogOut, ArrowRight,
  Sparkles, SlidersHorizontal, Settings2, CreditCard, Building2, X, Plus
} from 'lucide-react';
import { CreditSnapshot } from '../types';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenAI: () => void;
  onAskAI: (message: string) => void;
  onOpenSettings: () => void;
  onOpenProjects: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  userName: string;
  credits: CreditSnapshot | null;
}

const searchCommands = [
  { label: 'Dashboard', terms: ['dashboard', 'seo overview', 'overview'], query: 'seo overview', description: 'Open the CROX executive dashboard' },
  { label: 'Projects', terms: ['project', 'projects'], query: 'projects', description: 'Create projects and run website audits' },
  { label: 'Site Audit', terms: ['site audit', 'audit', 'crawl', 'pages'], query: 'site audit', description: 'Crawl your website and inspect findings' },
  { label: 'SEO Analysis', terms: ['seo analysis', 'metadata', 'title tag'], query: 'seo analysis', description: 'Inspect on-page SEO signals' },
  { label: 'Performance', terms: ['performance', 'speed', 'vitals'], query: 'performance', description: 'Review technical performance signals' },
  { label: 'Keyword Research', terms: ['keyword', 'keywords'], query: 'keyword research', description: 'Explore keyword ideas and intent' },
  { label: 'Competitor Analysis', terms: ['competitor', 'market research'], query: 'market research', description: 'Compare competitor page signals' },
  { label: 'Backlink Analysis', terms: ['backlink', 'backlinks', 'link building'], query: 'backlinks', description: 'Open backlink analysis' },
  { label: 'Rank Tracking', terms: ['rank tracking', 'position tracking', 'rankings'], query: 'position tracking', description: 'Open keyword position tracking' },
  { label: 'Reports', terms: ['report', 'export', 'pdf', 'csv'], query: 'reports', description: 'Open saved reports and exports' },
  { label: 'Settings & Integrations', terms: ['setting', 'api', 'provider', 'key', 'integration'], query: 'settings', description: 'Manage AI providers and integrations' }
];

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu, onOpenAI, onAskAI, onOpenSettings, onOpenProjects,
  onToggleTheme, onLogout, theme, userName, credits
}) => {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return searchCommands.slice(0, 5);
    const matched = searchCommands.filter(item => item.terms.some(term => term.includes(clean) || clean.includes(term)));
    return matched.length ? matched.slice(0, 6) : searchCommands.slice(0, 4);
  }, [query]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMoreOpen(false);
      }
    };
    const onOutside = (event: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) setSearchOpen(false);
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    window.addEventListener('keydown', onShortcut);
    document.addEventListener('mousedown', onOutside);
    return () => {
      window.removeEventListener('keydown', onShortcut);
      document.removeEventListener('mousedown', onOutside);
    };
  }, []);

  const openSearchTarget = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    window.dispatchEvent(new CustomEvent('crox:search', { detail: { query: clean } }));
    setQuery(clean);
    setSearchOpen(false);
  };

  const askAI = (value: string) => {
    const clean = value.trim();
    if (!clean) onOpenAI();
    else onAskAI(clean);
    setSearchOpen(false);
  };

  const isAssistantRequest = (value: string): boolean => {
    const clean = value.trim();
    const words = clean.split(/\s+/).filter(Boolean).length;
    if (words >= 4 && clean.endsWith('?')) return true;
    const english = /^(how|why|what|when|where|who|can you|could you|would you|help me|please|analyse|analyze|audit|explain|write|create|build|make|give me|recommend|compare|review|tell me|find out)\b|\b(my website|my business|my brand|my strategy|what should i|how can i|how do i|why is|create a plan|make a strategy)\b/i;
    const romanUrdu = /^(kya|kaise|kyun|kab|kahan|mujhe|mere liye|batao|samjhao)\b|\b(batao|samjhao|kar do|kardo|bana do|banado|check karo|meri website|mera business|mere liye|kaise karun|kya karun)\b/i;
    return words >= 3 && (english.test(clean) || romanUrdu.test(clean));
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    const normalized = value.toLowerCase();
    const toolMatch = searchCommands.find(item => item.label.toLowerCase() === normalized || item.terms.some(term => term === normalized));
    if (toolMatch) openSearchTarget(toolMatch.query);
    else if (/^(ask\s+)?ai\b/i.test(value) || isAssistantRequest(value)) askAI(value.replace(/^(ask\s+)?ai\s*[:,]?\s*/i, ''));
    else openSearchTarget(value);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const initials = (userName || 'C').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const remaining = credits ? credits.audits.remaining + credits.ai.remaining + credits.keywords.remaining : null;

  return (
    <header className="crox-ref-topbar">
      <div className="crox-ref-brand-area">
        <button type="button" className="crox-ref-mobile-menu" onClick={onOpenMobileMenu} aria-label="Open navigation menu"><Menu size={21} /></button>
        <div className="crox-ref-brand-lockup"><span className="crox-ref-brand-icon"><img src="/crox-reference-logo.png" alt="" /></span><span>Crox</span></div>
      </div>

      <div className="crox-ref-search-wrap" ref={searchWrapRef}>
        <form onSubmit={submitSearch} className="crox-ref-search">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={event => { setQuery(event.target.value); setSearchOpen(true); }}
            placeholder="Go to tools..."
            aria-label="Go to CROX tools or ask AI"
            aria-expanded={searchOpen}
            aria-controls="crox-ref-search-menu"
          />
          <kbd>⌘ K</kbd>
          <button type="submit" aria-label="Search tools"><Search size={20} /></button>
        </form>
        {searchOpen && (
          <div id="crox-ref-search-menu" className="crox-ref-search-menu" role="listbox">
            <div className="crox-ref-search-menu-label">Quick navigation</div>
            {suggestions.map(item => (
              <button key={item.query} type="button" role="option" onMouseDown={event => event.preventDefault()} onClick={() => openSearchTarget(item.query)}>
                <span className="crox-ref-search-result-icon"><SlidersHorizontal size={15} /></span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                <ArrowRight size={14} />
              </button>
            ))}
            <button type="button" className="crox-ref-search-ai" onMouseDown={event => event.preventDefault()} onClick={() => askAI(query)}>
              <span className="crox-ref-search-result-icon ai"><Sparkles size={16} /></span>
              <span><strong>Ask CROX AI</strong><small>Ask a question about SEO or your workspace</small></span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="crox-ref-top-actions">
        <button type="button" className="crox-ref-create-tool" onClick={onOpenProjects}><Sparkles size={17} /> <span>Create a Tool</span></button>
        <button type="button" className="crox-ref-top-link" onClick={onOpenSettings}><CreditCard size={15} /> <span>Pricing</span></button>
        <button type="button" className="crox-ref-top-link enterprise" onClick={onOpenAI}><Building2 size={15} /> <span>Enterprise</span></button>
        <div className="crox-ref-more-wrap" ref={menuRef}>
          <button type="button" className="crox-ref-top-link" onClick={() => setMoreOpen(value => !value)} aria-expanded={moreOpen}>More <ChevronDown size={15} /></button>
          {moreOpen && <div className="crox-ref-more-menu">
            <button type="button" onClick={() => { setMoreOpen(false); onOpenAI(); }}><Sparkles size={15} /> CROX AI Assistant</button>
            <button type="button" onClick={() => { setMoreOpen(false); onOpenSettings(); }}><Settings2 size={15} /> Settings & Integrations</button>
            <button type="button" onClick={() => { setMoreOpen(false); onToggleTheme(); }}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} Switch theme</button>
            <button type="button" onClick={() => { setMoreOpen(false); onLogout(); }}><LogOut size={15} /> Sign out</button>
          </div>}
        </div>
        <div className="crox-ref-user-wrap">
          <button type="button" className="crox-ref-avatar" onClick={() => setMoreOpen(value => !value)} aria-label={`Account menu for ${userName}`} title={userName}>{initials.slice(0, 1)}</button>
          {remaining !== null && <span className="crox-ref-credit-count" title="Available daily credits">{remaining}</span>}
        </div>
      </div>
    </header>
  );
};
