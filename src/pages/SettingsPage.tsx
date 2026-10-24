import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  Key,
  Shield,
  Sliders,
  Cpu,
  Info,
  User as UserIcon,
  Lock,
  Loader2,
  LogOut
} from 'lucide-react';
import { User } from '../types';
import { changeUserPassword, getIntegrationsStatus } from '../services/api';

interface SettingsPageProps {
  user: User | null;
  onLogout: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onLogout, onOpenAuth }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [integrations, setIntegrations] = useState<{
    gemini?: { configured: boolean; model: string };
    pagespeed?: { configured: boolean };
  } | null>(null);

  useEffect(() => {
    getIntegrationsStatus()
      .then((data) => setIntegrations(data))
      .catch(() => {});
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Password successfully updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Platform Settings & Account
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your CROX credentials, security parameters, and external integrations
        </p>
      </div>

      {/* Account Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
              {user ? user.name.slice(0, 2).toUpperCase() : <UserIcon className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {user ? user.name : 'Guest User'}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {user ? user.email : 'Not signed in'}
              </p>
            </div>
          </div>

          {user ? (
            <button
              onClick={onLogout}
              className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              onClick={() => onOpenAuth('login')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Sign In to Your Account
            </button>
          )}
        </div>

        {user && (
          <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900">Change Password</h3>
            </div>

            {passwordMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {passwordMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                {isChangingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Feature Transparency Card */}
      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-5 text-xs text-indigo-950 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-indigo-900">
          <Info className="w-4 h-4 text-indigo-600" />
          <span>Feature Availability & API Key Requirements</span>
        </div>
        <p className="text-slate-700 leading-relaxed">
          <strong>Fully Functional Without Any API Keys:</strong> Python website crawler, SSRF security validation, robots.txt & sitemap.xml parser, all 15+ SEO audit rules, accessibility checks, performance TTFB timings, health scoring engine, issue management, and CSV report exports.
        </p>
        <p className="text-slate-700 leading-relaxed">
          <strong>Requires Optional API Keys:</strong> NOVA AI real-time fix generator (uses <code className="font-mono bg-white px-1 py-0.5 rounded text-indigo-700">GEMINI_API_KEY</code>) and Google PageSpeed Insights (uses <code className="font-mono bg-white px-1 py-0.5 rounded text-indigo-700">PAGESPEED_API_KEY</code>).
        </p>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gemini AI Integration */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Google Gemini API</h3>
                <p className="text-[11px] text-slate-500">Powering NOVA AI Assistant & Code Fixes</p>
              </div>
            </div>
            {integrations?.gemini?.configured ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>Key Not Set</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Injected securely on the server-side from environment variables. The API key is never exposed to client-side browsers or code bundles.
          </p>
        </div>

        {/* PageSpeed Insights */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Google PageSpeed Insights</h3>
                <p className="text-[11px] text-slate-500">Lighthouse Core Web Vitals (LCP, INP, CLS)</p>
              </div>
            </div>
            {integrations?.pagespeed?.configured ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Optional
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Optional API key for retrieving lab Core Web Vitals metrics. Configure <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">PAGESPEED_API_KEY</code> in <code className="font-mono">.env</code> to enable live tests.
          </p>
        </div>
      </div>

      {/* Crawl Parameters Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-900">Crawler Configuration</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <p className="text-slate-500 font-medium">Max Crawl Pages</p>
            <p className="text-lg font-bold text-slate-900 font-mono">50 pages</p>
            <p className="text-[11px] text-slate-400">Default per scan limit</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <p className="text-slate-500 font-medium">Request Timeout</p>
            <p className="text-lg font-bold text-slate-900 font-mono">15 seconds</p>
            <p className="text-[11px] text-slate-400">Per HTTP request</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <p className="text-slate-500 font-medium">Concurrency Limit</p>
            <p className="text-lg font-bold text-slate-900 font-mono">5 workers</p>
            <p className="text-[11px] text-slate-400">Async asyncio workers</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <p className="text-slate-500 font-medium">SSRF Protection</p>
            <p className="text-lg font-bold text-emerald-600 font-mono">Enforced</p>
            <p className="text-[11px] text-slate-400">RFC1918 & metadata blocked</p>
          </div>
        </div>
      </div>

      {/* Security Architecture */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-slate-900">Security Architecture & SSRF Guard</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          The CROX crawler resolves domain DNS records and verifies IP addresses against private subnets (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, and cloud metadata 169.254.169.254) before initiating HTTP GET requests, protecting against SSRF attacks and internal host scans.
        </p>
      </div>
    </div>
  );
};
