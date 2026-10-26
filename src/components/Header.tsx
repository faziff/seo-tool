import React, { useState } from 'react';
import { Search, Menu, Settings2, Command, Moon, Sun, LogOut, Coins, ShieldCheck } from 'lucide-react';
import { NovaOrb } from './NovaOrb';
import { CreditSnapshot } from '../types';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenAI: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  userName: string;
  credits: CreditSnapshot | null;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, onOpenAI, onOpenSettings, onToggleTheme, onLogout, theme, userName, credits }) => {
  const [query, setQuery] = useState('');

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (value) window.dispatchEvent(new CustomEvent('crox:search', { detail: { query: value } }));
  };
  const totalCredits = credits ? credits.audits.remaining + credits.ai.remaining + credits.keywords.remaining : 0;

  return (
    <header className="crox-app-header h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between gap-3 sm:gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0 max-w-2xl">
        <button onClick={onOpenMobileMenu} className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg" aria-label="Open navigation menu"><Menu className="w-5 h-5" /></button>
        <form onSubmit={submitSearch} className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400"><Search className="w-4 h-4" /></div>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search scans, tools, issues…" aria-label="Search CROX workspace" className="w-full pl-9 pr-14 py-2 bg-slate-50/90 border border-slate-200/80 rounded-xl text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs font-mono"><Command className="w-2.5 h-2.5" /> K</kbd></div>
        </form>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {credits && <div className="crox-credit-group" title={`Daily usage resets in ${credits.resets_in} · Pakistan time`}>
          <span className="crox-credit-total"><Coins size={14} /><b>{totalCredits}</b><small>credits left</small></span>
          <span className="crox-credit-pill"><ShieldCheck size={11} /> Audit {credits.audits.remaining}</span>
          <span className="crox-credit-pill"><Search size={11} /> Keywords {credits.keywords.remaining}</span>
          <span className="crox-credit-pill"><NovaOrb size={13} /> AI {credits.ai.remaining}</span>
        </div>}
        <button onClick={onOpenAI} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold text-violet-800 bg-gradient-to-r from-violet-50 to-cyan-50 hover:from-violet-100 hover:to-cyan-100 border border-violet-200/70 transition-all shadow-sm" title="Open NOVA AI Assistant"><NovaOrb size={22} /><span className="hidden xl:inline">Ask NOVA</span></button>
        <button onClick={onToggleTheme} className="p-2 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-xl border border-transparent hover:border-violet-100 transition-colors" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
        <button onClick={onOpenSettings} className="p-2 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-xl border border-transparent hover:border-violet-100 transition-colors" aria-label="Open workspace settings" title="Workspace settings"><Settings2 className="w-4 h-4" /></button>
        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200 max-w-32"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-100 to-cyan-100 border border-violet-100 text-violet-800 text-[10px] font-extrabold grid place-items-center shrink-0">{(userName || 'C').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><span className="text-[11px] font-semibold text-slate-600 truncate" title={userName}>{userName}</span></div>
        <button onClick={onLogout} className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" aria-label="Sign out" title="Sign out"><LogOut className="w-4 h-4" /></button>
      </div>
    </header>
  );
};
