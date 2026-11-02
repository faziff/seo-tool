import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Menu, Settings2, Command, Moon, Sun, LogOut, Coins, ShieldCheck, ArrowRight, Sparkles, SlidersHorizontal } from 'lucide-react';
import { NovaOrb } from './NovaOrb';
import { CreditSnapshot } from '../types';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenAI: () => void;
  onAskNOVA: (message: string) => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  userName: string;
  credits: CreditSnapshot | null;
}

const searchCommands = [
  { label: 'SEO overview', terms: ['seo overview', 'overview', 'organic overview'], query: 'seo overview', description: 'Open the main SEO dashboard and optimization workspace' },
  { label: 'SEO analysis', terms: ['seo analysis', 'on-page seo', 'metadata', 'title tag'], query: 'seo analysis', description: 'Inspect titles, descriptions, headings and on-page signals' },
  { label: 'AEO workspace', terms: ['aeo', 'answer engine', 'featured snippet', 'faq'], query: 'aeo', description: 'Answer engine optimization and answer readiness' },
  { label: 'GEO workspace', terms: ['geo', 'generative engine', 'ai search'], query: 'geo', description: 'Generative engine visibility readiness' },
  { label: 'Site audit', terms: ['audit', 'crawl', 'pages'], query: 'site audit', description: 'Crawl your website and inspect findings' },
  { label: 'Keyword research', terms: ['keyword', 'keywords'], query: 'keyword research', description: 'Explore topics, intent and keyword ideas' },
  { label: 'Keyword Gap', terms: ['keyword gap', 'keyword opportunities', 'competitor keywords'], query: 'keyword gap', description: 'Compare keyword opportunities across sites' },
  { label: 'Backlink Analytics', terms: ['backlink', 'backlinks', 'link building'], query: 'backlinks', description: 'Inspect link signals and provider availability' },
  { label: 'Position Tracking', terms: ['rank tracking', 'position tracking', 'keyword positions'], query: 'position tracking', description: 'Open tracked keyword positions' },
  { label: 'Fix Center', terms: ['fix', 'fix center', 'remediation'], query: 'fix center', description: 'Review suggested fixes from your latest audit' },
  { label: 'Reports', terms: ['report', 'export', 'pdf', 'csv'], query: 'reports', description: 'Open exports and scan comparisons' },
  { label: 'Settings & API keys', terms: ['setting', 'api', 'provider', 'key', 'integration'], query: 'settings', description: 'Manage integrations and NOVA providers' },
  { label: 'AI Visibility', terms: ['ai visibility', 'ai mentions', 'chatgpt visibility'], query: 'ai visibility', description: 'Review AI search visibility tools and roadmap' },
  { label: 'Local SEO', terms: ['local seo', 'maps', 'local listings'], query: 'local seo', description: 'Open local search workspace' },
  { label: 'Market Research', terms: ['market research', 'competitor', 'competitor analysis'], query: 'market research', description: 'Compare competitor page signals and positioning' },
  { label: 'Content Ideas', terms: ['content', 'content ideas', 'content marketing'], query: 'content', description: 'Open content planning and ideas' },
  { label: 'Accessibility', terms: ['accessibility', 'wcag', 'accessible'], query: 'accessibility', description: 'Review page accessibility signals' },
  { label: 'Performance', terms: ['speed', 'performance', 'vitals'], query: 'performance', description: 'Review technical performance signals' }
];

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, onOpenAI, onAskNOVA, onOpenSettings, onToggleTheme, onLogout, theme, userName, credits }) => {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
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
      if (event.key === 'Escape') setSearchOpen(false);
    };
    const onOutside = (event: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) setSearchOpen(false);
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

  const askNova = (value: string) => {
    const clean = value.trim();
    if (!clean) {
      onOpenAI();
      setSearchOpen(false);
      return;
    }
    onAskNOVA(clean);
    setSearchOpen(false);
  };

  const openKeywordSearch = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    try { sessionStorage.setItem('crox_keyword_seed', clean.slice(0, 180)); } catch { /* The keyword page also supports manual entry if storage is blocked. */ }
    window.dispatchEvent(new CustomEvent('crox:keyword-search', { detail: { query: clean } }));
    openSearchTarget('keyword research');
  };

  const isAssistantRequest = (value: string): boolean => {
    const clean = value.trim();
    const words = clean.split(/\s+/).filter(Boolean).length;
    if (words >= 4 && clean.endsWith('?')) return true;
    const english = /^(how|why|what|when|where|who|can you|could you|would you|help me|please|analyse|analyze|audit|explain|write|create|build|make|give me|recommend|compare|review|tell me|find out|investigate)\b|\b(my website|my business|my brand|my strategy|what should i|how can i|how do i|why is|create a plan|make a strategy|explain this)\b/i;
    const romanUrdu = /^(kya|kaise|kyun|kab|kahan|mujhe|mere liye|batao|samjhao)\b|\b(batao|samjhao|kar do|kardo|bana do|banado|check karo|meri website|mera business|mere liye|kaise karun|kya karun)\b/i;
    return words >= 3 && (english.test(clean) || romanUrdu.test(clean));
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (/^(ask\s+)?nova\b/i.test(value)) askNova(value.replace(/^(ask\s+)?nova\s*[:,]?\s*/i, ''));
    else {
      const normalized = value.toLowerCase();
      const toolMatch = searchCommands.find(item => item.label.toLowerCase() === normalized || item.terms.some(term => term === normalized));
      if (toolMatch) openSearchTarget(toolMatch.query);
      else if (isAssistantRequest(value)) askNova(value);
      else openKeywordSearch(value);
    }
  };

  const totalCredits = credits ? credits.audits.remaining + credits.ai.remaining + credits.keywords.remaining : 0;

  return (
    <header className="crox-app-header h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0 max-w-3xl">
        <button onClick={onOpenMobileMenu} className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg" aria-label="Open navigation menu"><Menu className="w-5 h-5" /></button>
        <div className="relative w-full" ref={searchWrapRef}>
          <form onSubmit={submitSearch} className="relative flex w-full items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400"><Search className="w-4 h-4" /></div>
              <input ref={inputRef} type="search" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder="Search tools, scans or ask NOVA anything…" aria-label="Search CROX or ask NOVA" aria-expanded={searchOpen} aria-controls="crox-global-search-menu" className="w-full pl-9 pr-14 py-2.5 bg-slate-50/90 border border-slate-200/80 rounded-xl text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs font-mono"><Command className="w-2.5 h-2.5" /> K</kbd></div>
            </div>
            <button type="button" onClick={() => askNova(query)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-cyan-50 px-2.5 py-2.5 text-[10px] font-bold text-violet-800 shadow-sm hover:border-violet-300 hover:from-violet-100 hover:to-cyan-100 sm:px-3" title="Ask NOVA"><NovaOrb size={19} /><span className="hidden sm:inline">Ask NOVA</span></button>
          </form>

          {searchOpen && <div id="crox-global-search-menu" role="listbox" className="absolute left-0 right-0 top-[calc(100%+9px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
            <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-cyan-50 p-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => askNova(query)} className="flex min-w-0 items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-violet-50">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#100d21]"><NovaOrb size={22} /></span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-slate-900">Ask NOVA{query.trim() ? `: ${query.trim().slice(0, 44)}` : ' anything'}</strong><small className="mt-0.5 block text-[9px] text-slate-500">Chat with your AI copilot</small></span>
                  <ArrowRight size={14} className="shrink-0 text-violet-600" />
                </button>
                <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => openSearchTarget(query)} disabled={!query.trim()} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-45">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-800"><Search size={15} /></span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-slate-900">Search CROX{query.trim() ? `: ${query.trim().slice(0, 44)}` : ''}</strong><small className="mt-0.5 block text-[9px] text-slate-500">Find scans, issues and workspaces</small></span>
                  <ArrowRight size={14} className="shrink-0 text-cyan-700" />
                </button>
              </div>
            </div>
            <div className="p-2"><div className="flex items-center justify-between px-2 py-1.5"><span className="text-[9px] font-extrabold uppercase tracking-[.14em] text-slate-400">Quick navigation</span><span className="text-[9px] text-slate-400">Choose a workspace</span></div>
              {suggestions.map(item => <button key={item.query} type="button" role="option" aria-selected="false" onMouseDown={event => event.preventDefault()} onClick={() => openSearchTarget(item.query)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"><span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600"><SlidersHorizontal size={13} /></span><span className="min-w-0 flex-1"><strong className="block text-[10px] text-slate-800">{item.label}</strong><small className="block text-[9px] text-slate-500">{item.description}</small></span><ArrowRight size={12} className="text-slate-300" /></button>)}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[9px] text-slate-400"><span>Enter opens a matching tool or asks NOVA · Search CROX finds scans and issues</span><span>ESC to close</span></div>
          </div>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {credits && <div className="crox-credit-group" title={`Daily usage resets in ${credits.resets_in} · Pakistan time`}>
          <span className="crox-credit-total"><Coins size={14} /><b>{totalCredits}</b><small>credits left</small></span>
          <span className="crox-credit-pill"><ShieldCheck size={11} /> Audit {credits.audits.remaining}</span>
          <span className="crox-credit-pill"><Search size={11} /> Keywords {credits.keywords.remaining}</span>
          <span className="crox-credit-pill"><NovaOrb size={13} /> AI {credits.ai.remaining}</span>
        </div>}
        <button onClick={onOpenAI} className="hidden items-center gap-1.5 rounded-xl border border-violet-200/70 bg-gradient-to-r from-violet-50 to-cyan-50 px-2.5 py-2 text-xs font-semibold text-violet-800 shadow-sm transition-all hover:from-violet-100 hover:to-cyan-100 xl:inline-flex" title="Open NOVA AI Assistant"><NovaOrb size={21} /><span>Copilot</span></button>
        <button onClick={onToggleTheme} className="p-2 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-xl border border-transparent hover:border-violet-100 transition-colors" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
        <button onClick={onOpenSettings} className="p-2 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-xl border border-transparent hover:border-violet-100 transition-colors" aria-label="Open workspace settings" title="Workspace settings"><Settings2 className="w-4 h-4" /></button>
        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 max-w-32"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-100 to-cyan-100 border border-violet-100 text-violet-800 text-[10px] font-extrabold grid place-items-center shrink-0">{(userName || 'C').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><span className="text-[11px] font-semibold text-slate-600 truncate" title={userName}>{userName}</span></div>
        <button onClick={onLogout} className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" aria-label="Sign out" title="Sign out"><LogOut className="w-4 h-4" /></button>
      </div>
    </header>
  );
};
