import React, { useState } from 'react';
import { Search, Menu, Settings2, Command } from 'lucide-react';
import { NovaOrb } from './NovaOrb';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenAI: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, onOpenAI, onOpenSettings }) => {
  const [query, setQuery] = useState('');

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (value) window.dispatchEvent(new CustomEvent('crox:search', { detail: { query: value } }));
  };

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <form onSubmit={submitSearch} className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search scans, URLs, issues…"
            aria-label="Search CROX workspace"
            className="w-full pl-9 pr-14 py-2 bg-slate-50/90 border border-slate-200/80 rounded-xl text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs font-mono"><Command className="w-2.5 h-2.5" /> K</kbd>
          </div>
        </form>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={onOpenAI}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-violet-800 bg-gradient-to-r from-violet-50 to-cyan-50 hover:from-violet-100 hover:to-cyan-100 border border-violet-200/70 transition-all shadow-sm"
          title="Open NOVA AI Assistant"
        >
          <NovaOrb size={22} />
          <span className="hidden sm:inline">Ask NOVA</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="p-2 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-xl border border-transparent hover:border-violet-100 transition-colors"
          aria-label="Open workspace settings"
          title="Workspace settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200">
          <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_0_3px_rgba(16,185,129,0.10)]" />
          <span className="text-[11px] font-semibold text-slate-500">Workspace ready</span>
        </div>
      </div>
    </header>
  );
};
