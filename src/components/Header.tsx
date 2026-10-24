import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, LogOut, User as UserIcon, Settings, ChevronDown } from 'lucide-react';
import { User } from '../types';
import { NovaOrb } from './NovaOrb';

interface HeaderProps {
  user: User | null;
  onOpenMobileMenu: () => void;
  onOpenAI: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenMobileMenu,
  onOpenAI,
  onOpenAuth,
  onLogout,
  onOpenSettings
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name[0] || 'U').toUpperCase();
  };

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search projects, domains, or reports..."
            className="w-full pl-9 pr-14 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-slate-200 rounded shadow-2xs font-mono">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        <button
          onClick={onOpenAI}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 transition-colors"
          title="Open NOVA AI Assistant"
        >
          <NovaOrb size={21} />
          <span className="hidden sm:inline">Ask NOVA</span>
        </button>

        <button
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-slate-200" />

        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 pl-1 cursor-pointer group focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-[#1E293B] text-white flex items-center justify-center text-xs font-bold tracking-tight shadow-xs">
                {getInitials(user.name)}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                  {user.name}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="font-semibold text-slate-900 truncate">{user.name}</p>
                  <p className="text-[11px] text-slate-500 truncate font-mono">{user.email}</p>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Account Settings</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                    className="w-full px-4 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              Register
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
