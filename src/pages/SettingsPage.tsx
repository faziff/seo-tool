import React, { useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Cloud, ExternalLink, Eye, EyeOff, Gauge, Globe2,
  KeyRound, LockKeyhole, RefreshCw, Save, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, UserRound, XCircle, Database, CreditCard, BellRing
} from 'lucide-react';
import { changeUserPassword, getIntegrationsStatus } from '../services/api';
import type { User } from '../types';

interface IntegrationStatus {
  ai?: { provider: string; configured: boolean; mode: 'live' | 'demo'; model: string; note: string };
  gemini?: { configured: boolean; model?: string };
  pagespeed?: { configured: boolean };
  dataforseo?: { configured: boolean };
  agent?: { configured: boolean };
  google_search_console?: { status: string; description: string };
  stripe_billing?: { status: string; description: string };
  gemini_ai?: { status: string; description: string };
  pagespeed_insights?: { status: string; description: string };
}

type TabId = 'general' | 'integrations' | 'security' | 'usage';

const defaultPreferences = {
  compactTables: false,
  reduceMotion: false,
  confirmBeforeApprovingFixes: true,
  showScanNotifications: true,
  defaultCrawlDepth: '50'
};

export const SettingsPage: React.FC<{ user?: User | null; theme?: 'light' | 'dark'; onToggleTheme?: () => void }> = ({ user, theme = 'light', onToggleTheme }) => {
  const [tab, setTab] = useState<TabId>('general');
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [savedMessage, setSavedMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    let active = true;
    getIntegrationsStatus()
      .then((data) => { if (active) setIntegrations(data); })
      .catch(() => { if (active) setStatusError('Integration status is unavailable. Check that the CROX API server is running.'); });
    try {
      const raw = localStorage.getItem('crox_workspace_preferences');
      if (raw) {
        const restored = { ...defaultPreferences, ...JSON.parse(raw) };
        setPreferences(restored);
        document.documentElement.dataset.croxCompactTables = String(restored.compactTables);
        document.documentElement.dataset.croxReduceMotion = String(restored.reduceMotion);
      }
    } catch { /* Keep defaults when browser storage is unavailable. */ }
    return () => { active = false; };
  }, []);

  const updatePreference = <K extends keyof typeof defaultPreferences>(key: K, value: typeof defaultPreferences[K]) => {
    setPreferences(previous => ({ ...previous, [key]: value }));
    setSavedMessage('');
  };

  const savePreferences = () => {
    try {
      localStorage.setItem('crox_workspace_preferences', JSON.stringify(preferences));
      document.documentElement.dataset.croxCompactTables = String(preferences.compactTables);
      document.documentElement.dataset.croxReduceMotion = String(preferences.reduceMotion);
      setSavedMessage('Preferences saved in this browser.');
    } catch {
      setSavedMessage('Browser storage is unavailable. Your preferences could not be saved.');
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (passwordForm.next.length < 8) return setPasswordError('Use at least 8 characters for your new password.');
    if (passwordForm.next !== passwordForm.confirm) return setPasswordError('The new passwords do not match.');
    setPasswordBusy(true);
    try {
      const result = await changeUserPassword(passwordForm.current, passwordForm.next);
      setPasswordSuccess(result.message || 'Password updated.');
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not update password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const Status = ({ configured, label }: { configured?: boolean; label?: string }) => configured
    ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700"><CheckCircle2 size={11} /> {label || 'Connected'}</span>
    : <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-800"><AlertCircle size={11} /> Not configured</span>;

  const IntegrationCard = ({ title, description, configured, icon: Icon, env, detail }: { title: string; description: string; configured?: boolean; icon: React.ElementType; env: string; detail?: string }) => (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-700"><Icon size={18} /></span><Status configured={configured} /></div>
      <h3 className="mt-3 text-xs font-extrabold text-slate-900">{title}</h3>
      <p className="mt-1 min-h-10 text-[10px] leading-5 text-slate-500">{description}</p>
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2"><p className="text-[9px] font-bold text-slate-500">SERVER VARIABLE</p><code className="mt-1 block break-all text-[10px] font-semibold text-indigo-700">{env}</code></div>
      {detail && <p className="mt-2 text-[9px] leading-4 text-slate-400">{detail}</p>}
    </article>
  );

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'general', label: 'Workspace', icon: Settings2 },
    { id: 'integrations', label: 'Integrations', icon: Cloud },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'usage', label: 'Plans & Usage', icon: CreditCard }
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="relative overflow-hidden rounded-[26px] bg-[#0D1B36] p-5 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" /><div className="pointer-events-none absolute right-1/3 -bottom-24 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-3 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.19em] text-cyan-200"><SlidersHorizontal size={13} /> Control center</div><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Workspace settings</h1><p className="mt-2 max-w-2xl text-[11px] leading-6 text-slate-300">Manage your CROX workspace, AI and search data connections, account security and product preferences.</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-cyan-200"><UserRound size={17} /></span><div className="min-w-0"><p className="max-w-[200px] truncate text-[11px] font-bold text-white">{user?.name || 'CROX workspace'}</p><p className="max-w-[200px] truncate text-[9px] text-slate-300">{user?.email || 'Account details unavailable'}</p></div></div></div>
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-[10px] font-bold transition ${tab === item.id ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><Icon size={13} /> {item.label}</button>; })}
      </div>

      {statusError && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900"><AlertCircle size={14} className="mt-0.5 shrink-0" />{statusError}</div>}

      {tab === 'general' && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><SlidersHorizontal size={16} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Interface preferences</h2><p className="mt-1 text-[10px] text-slate-500">Saved locally in this browser.</p></div></div>
          <div className="mt-5 divide-y divide-slate-100">
            <PreferenceRow title="Compact data tables" description="Reduce row spacing in dense reports and keyword tables." checked={preferences.compactTables} onChange={value => updatePreference('compactTables', value)} />
            <PreferenceRow title="Reduce interface motion" description="Limit decorative transitions and animated effects." checked={preferences.reduceMotion} onChange={value => updatePreference('reduceMotion', value)} />
            <PreferenceRow title="Confirm before approving fixes" description="Keep a confirmation step before approving AI-generated code suggestions." checked={preferences.confirmBeforeApprovingFixes} onChange={value => updatePreference('confirmBeforeApprovingFixes', value)} />
            <PreferenceRow title="Show scan notifications" description="Display progress and completion messages while a scan runs." checked={preferences.showScanNotifications} onChange={value => updatePreference('showScanNotifications', value)} />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold text-slate-800">Default crawl size</p><p className="mt-1 text-[9px] text-slate-500">Applied to new website crawls started from the workspace dashboard.</p></div><select value={preferences.defaultCrawlDepth} onChange={event => updatePreference('defaultCrawlDepth', event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 outline-none focus:border-indigo-400"><option value="25">25 pages</option><option value="50">50 pages</option></select></div>
          <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={savePreferences} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[10px] font-bold text-white hover:bg-indigo-950"><Save size={13} /> Save preferences</button>{savedMessage && <span role="status" className="text-[9px] font-semibold text-emerald-700">{savedMessage}</span>}</div>
        </section>
        <section className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Eye size={16} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Appearance</h2><p className="mt-1 text-[10px] text-slate-500">Choose how the workspace looks.</p></div></div><div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="text-[10px] font-bold text-slate-800">Dark mode</p><p className="mt-1 text-[9px] text-slate-500">Current theme: {theme}</p></div><button type="button" onClick={onToggleTheme} disabled={!onToggleTheme} className={`rounded-full px-3 py-2 text-[9px] font-bold ${theme === 'dark' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'} disabled:opacity-50`}>{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}</button></div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Globe2 size={16} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Workspace identity</h2><p className="mt-1 text-[10px] text-slate-500">Signed-in account details</p></div></div><dl className="mt-4 space-y-3 text-[10px]"><div><dt className="text-slate-400">Name</dt><dd className="mt-0.5 font-semibold text-slate-800">{user?.name || '—'}</dd></div><div><dt className="text-slate-400">Email</dt><dd className="mt-0.5 break-all font-semibold text-slate-800">{user?.email || '—'}</dd></div><div><dt className="text-slate-400">Plan</dt><dd className="mt-0.5 font-semibold capitalize text-slate-800">{user?.plan || 'Free'}</dd></div><div><dt className="text-slate-400">Member since</dt><dd className="mt-0.5 font-semibold text-slate-800">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</dd></div></dl></div></section>
      </div>}

      {tab === 'integrations' && <div className="space-y-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-sm font-extrabold text-slate-900">Connected services & data sources</h2><p className="mt-1 text-[10px] text-slate-500">Statuses are read from the CROX server. API secrets must only be configured in the server environment.</p></div><button type="button" onClick={() => { setStatusError(''); getIntegrationsStatus().then(setIntegrations).catch(() => setStatusError('Could not refresh integration status.')); }} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={12} /> Refresh status</button></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <IntegrationCard title="NOVA · AI Provider" description={`${integrations?.ai?.provider || 'AI provider'} · ${integrations?.ai?.model || 'Model not reported'}. ${integrations?.ai?.note || 'Connect a supported provider for live AI responses.'}`} configured={integrations?.ai?.configured} icon={Sparkles} env="AI_PROVIDER + provider API key" />
          <IntegrationCard title="Google PageSpeed Insights" description="Lighthouse and field/lab performance diagnostics when supported by the API response." configured={integrations?.pagespeed?.configured} icon={Gauge} env="PAGESPEED_API_KEY" />
          <IntegrationCard title="DataForSEO" description="Live keyword volume and CPC data for supported countries and languages." configured={integrations?.dataforseo?.configured} icon={Database} env="DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD" />
          <IntegrationCard title="External NOVA Agent" description="Optional external agent endpoint for custom agent orchestration." configured={integrations?.agent?.configured} icon={Cloud} env="AGENT_API_URL + AGENT_API_KEY" />
          <IntegrationCard title="Google Search Console" description="Search performance, query clicks and impressions are not connected in this build." configured={integrations?.google_search_console?.status === 'connected'} icon={SearchConsoleIcon} env="OAuth integration not implemented" detail="Do not treat crawl-derived checks as Search Console performance data." />
          <IntegrationCard title="Billing provider" description="Subscription checkout, invoices and payment webhooks are not implemented in this build." configured={integrations?.stripe_billing?.status === 'connected'} icon={CreditCard} env="Billing integration not implemented" />
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex items-start gap-3"><KeyRound size={16} className="mt-0.5 shrink-0 text-indigo-700" /><div><p className="text-[10px] font-extrabold text-indigo-950">Configure provider credentials safely</p><p className="mt-1 text-[10px] leading-5 text-indigo-900/80">Add the listed variables to the server-side <code>.env</code> file or your hosting provider's environment settings, then restart the Node.js service. Never place private keys in React components, browser storage or committed source files.</p></div></div></div>
      </div>}

      {tab === 'security' && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-700"><LockKeyhole size={16} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Change password</h2><p className="mt-1 text-[10px] text-slate-500">Update the password for your CROX account.</p></div></div>
          <form onSubmit={submitPassword} className="mt-5 space-y-3"><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-700">Current password</span><input type={showPasswords ? 'text' : 'password'} autoComplete="current-password" value={passwordForm.current} onChange={event => setPasswordForm(value => ({ ...value, current: event.target.value }))} required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-indigo-400" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-700">New password</span><input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={passwordForm.next} onChange={event => setPasswordForm(value => ({ ...value, next: event.target.value }))} required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-indigo-400" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-700">Confirm new password</span><input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={passwordForm.confirm} onChange={event => setPasswordForm(value => ({ ...value, confirm: event.target.value }))} required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-indigo-400" /></label><button type="button" onClick={() => setShowPasswords(value => !value)} className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-slate-500">{showPasswords ? <EyeOff size={12} /> : <Eye size={12} />} {showPasswords ? 'Hide passwords' : 'Show passwords'}</button>{passwordError && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-[10px] text-rose-700">{passwordError}</p>}{passwordSuccess && <p role="status" className="rounded-lg bg-emerald-50 p-2.5 text-[10px] text-emerald-700">{passwordSuccess}</p>}<button type="submit" disabled={passwordBusy} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[10px] font-bold text-white hover:bg-indigo-950 disabled:opacity-50">{passwordBusy ? 'Updating…' : 'Update password'}</button></form>
        </section>
        <section className="space-y-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><ShieldCheck size={17} className="text-emerald-600" /><h2 className="text-xs font-extrabold text-slate-900">Security checklist</h2></div><div className="mt-4 space-y-3 text-[10px]"><SecurityStatus label="Password hashes use bcrypt" passed /><SecurityStatus label="Core workspace API routes require authentication" passed /><SecurityStatus label="JWT logout revocation" passed={false} /><SecurityStatus label="Email verification and password reset" passed={false} /><SecurityStatus label="Two-factor authentication" passed={false} /></div><p className="mt-4 text-[9px] leading-5 text-slate-400">Some security controls are not implemented yet. Do not treat this checklist as a formal security certification.</p></div></section>
      </div>}

      {tab === 'usage' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><CreditCard size={16} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Current plan</h2><p className="mt-1 text-[10px] text-slate-500">Your account entitlement</p></div></div><p className="mt-4 text-2xl font-extrabold capitalize text-slate-900">{user?.plan || 'Free'}</p><p className="mt-1 text-[10px] leading-5 text-slate-500">Plan values are currently assigned in the CROX account system. Paid checkout, subscription management and invoices are not enabled.</p><span className="mt-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-800">Billing not connected</span></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-700"><BellRing size={16} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Usage and limits</h2><p className="mt-1 text-[10px] text-slate-500">Daily product allowances</p></div></div><div className="mt-4 space-y-3">{[['Site audits', user?.credits?.audits], ['NOVA messages', user?.credits?.ai], ['Keyword searches', user?.credits?.keywords]].map(([label, counter]: any) => <div key={label}><div className="flex items-center justify-between text-[10px]"><span className="font-semibold text-slate-700">{label}</span><span className="tabular-nums text-slate-500">{counter ? `${counter.used}/${counter.daily_limit}` : 'Refresh account to load'}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${counter ? Math.min(100, counter.daily_limit ? counter.used / counter.daily_limit * 100 : 0) : 0}%` }} /></div></div>)}</div></div></div>}
    </div>
  );
};

function PreferenceRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 py-3.5"><div className="min-w-0"><p className="text-[10px] font-bold text-slate-800">{title}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">{description}</p></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-6' : 'left-1'}`} /></button></div>;
}

function SecurityStatus({ label, passed }: { label: string; passed: boolean }) {
  return <div className="flex items-center gap-2">{passed ? <CheckCircle2 size={13} className="text-emerald-600" /> : <XCircle size={13} className="text-amber-600" />}<span className="text-slate-600">{label}</span><span className={`ml-auto text-[8px] font-bold ${passed ? 'text-emerald-700' : 'text-amber-700'}`}>{passed ? 'Present' : 'Not implemented'}</span></div>;
}

function SearchConsoleIcon(props: { size?: number }) {
  return <SearchConsoleMark size={props.size || 18} />;
}

function SearchConsoleMark({ size }: { size: number }) {
  return <span style={{ width: size, height: size }} className="inline-flex items-center justify-center rounded bg-slate-200 text-[8px] font-black text-slate-700">GSC</span>;
}
