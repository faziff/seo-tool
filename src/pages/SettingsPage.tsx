import React, { useEffect, useState } from 'react';
import {
  Activity, AlertCircle, CheckCircle2, Cloud, ExternalLink, Eye, EyeOff, Gauge, Globe2,
  KeyRound, LockKeyhole, RefreshCw, Save, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, UserRound, XCircle, Database, CreditCard, BellRing, Trash2, PlugZap, ChevronUp, ChevronDown,
} from 'lucide-react';
import { changeUserPassword, getIntegrationsStatus, getAIProviderSettings, getAIProviderUsage, saveAIProviderKey, testAIProviderConnection, removeAIProviderKey, saveAIProviderPreferences, updateAIProviderModel, getGoogleDataStatus, getGoogleDataResources, getGoogleDataSelection, startGoogleDataConnect, saveGoogleDataSelection, disconnectGoogleData, type GoogleDataStatus, type GoogleDataResources, type AIProviderUsageResponse, type AIProviderSettingsResponse, type AIProviderCardSetting } from '../services/api';
import type { Project, User } from '../types';

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

export const SettingsPage: React.FC<{ user?: User | null; projects: Project[]; theme?: 'light' | 'dark'; onToggleTheme?: () => void }> = ({ user, projects, theme = 'light', onToggleTheme }) => {
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
  const [aiProviderSettings, setAIProviderSettings] = useState<AIProviderSettingsResponse | null>(null);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, string>>({});
  const [providerModelDrafts, setProviderModelDrafts] = useState<Record<string, string>>({});
  const [providerRevealed, setProviderRevealed] = useState<Record<string, boolean>>({});
  const [providerBusy, setProviderBusy] = useState<string | null>(null);
  const [providerFeedback, setProviderFeedback] = useState<Record<string, { type: 'success' | 'error' | 'info'; text: string }>>({});
  const [providerPriority, setProviderPriority] = useState<AIProviderCardSetting['provider'][]>([]);
  const [providerFallback, setProviderFallback] = useState(true);
  const [providerUsage, setProviderUsage] = useState<AIProviderUsageResponse | null>(null);
  const [googleDataStatus, setGoogleDataStatus] = useState<GoogleDataStatus | null>(null);
  const [googleDataResources, setGoogleDataResources] = useState<GoogleDataResources | null>(null);
  const [googleProjectId, setGoogleProjectId] = useState(projects[0]?.id || '');
  const [gaPropertyId, setGaPropertyId] = useState('');
  const [gscSiteUrl, setGscSiteUrl] = useState('');
  const [googleDataBusy, setGoogleDataBusy] = useState(false);
  const [googleDataFeedback, setGoogleDataFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    getIntegrationsStatus()
      .then((data) => { if (active) setIntegrations(data); })
      .catch(() => { if (active) setStatusError('Integration status is unavailable. Check that the CROX API server is running.'); });
    getAIProviderSettings()
      .then((data) => {
        if (!active) return;
        setAIProviderSettings(data);
        setProviderPriority(data.order);
        setProviderFallback(data.fallback_enabled);
        setProviderModelDrafts(Object.fromEntries(data.providers.map(item => [item.provider, item.model])));
      })
      .catch(() => { if (active) setProviderFeedback({ global: { type: 'error', text: 'Could not load AI provider settings. Check that the latest CROX backend is running.' } }); });
    getAIProviderUsage(30).then(data => { if (active) setProviderUsage(data); }).catch(() => { /* Usage panel will show an unavailable state. */ });
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

  useEffect(() => {
    let active = true;
    getGoogleDataStatus().then(async status => {
      if (!active) return;
      setGoogleDataStatus(status);
      if (status.connected) {
        try { const resources = await getGoogleDataResources(); if (active) setGoogleDataResources(resources); }
        catch (error) { if (active) setGoogleDataFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Could not load Google properties.' }); }
      }
    }).catch(error => {
      if (active) setGoogleDataFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Google connection status is unavailable.' });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!googleProjectId && projects.length) setGoogleProjectId(projects[0].id);
  }, [projects, googleProjectId]);

  useEffect(() => {
    let active = true;
    if (!googleDataStatus?.connected || !googleProjectId) return;
    getGoogleDataSelection(googleProjectId).then(selection => {
      if (!active) return;
      setGaPropertyId(selection.ga_property_id || '');
      setGscSiteUrl(selection.gsc_site_url || '');
    }).catch(() => { if (active) { setGaPropertyId(''); setGscSiteUrl(''); } });
    return () => { active = false; };
  }, [googleDataStatus?.connected, googleProjectId]);

  const connectGoogleData = async () => {
    setGoogleDataBusy(true);
    setGoogleDataFeedback({ type: 'info', text: 'Opening Google’s read-only authorization screen…' });
    try {
      const result = await startGoogleDataConnect();
      window.location.assign(result.authorization_url);
    } catch (error) {
      setGoogleDataFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Could not start Google connection.' });
      setGoogleDataBusy(false);
    }
  };

  const saveGoogleProperties = async () => {
    if (!googleProjectId) return setGoogleDataFeedback({ type: 'error', text: 'Create or select a CROX project first.' });
    if (!gaPropertyId && !gscSiteUrl) return setGoogleDataFeedback({ type: 'error', text: 'Select a GA4 property, a Search Console site, or both.' });
    setGoogleDataBusy(true);
    try {
      await saveGoogleDataSelection({ project_id: googleProjectId, ga_property_id: gaPropertyId || undefined, gsc_site_url: gscSiteUrl || undefined });
      setGoogleDataFeedback({ type: 'success', text: 'Google properties saved to this CROX project. Dashboard reports will load from Google’s reporting APIs.' });
    } catch (error) {
      setGoogleDataFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Could not save the selected Google properties.' });
    } finally { setGoogleDataBusy(false); }
  };

  const removeGoogleData = async () => {
    if (!window.confirm('Disconnect this Google account and remove its saved access tokens and property mappings from CROX?')) return;
    setGoogleDataBusy(true);
    try {
      await disconnectGoogleData();
      setGoogleDataStatus(previous => previous ? { ...previous, connected: false, google_email: null } : previous);
      setGoogleDataResources(null); setGaPropertyId(''); setGscSiteUrl('');
      setGoogleDataFeedback({ type: 'success', text: 'Google data connection and saved property mappings removed.' });
    } catch (error) {
      setGoogleDataFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Could not disconnect Google.' });
    } finally { setGoogleDataBusy(false); }
  };

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

  const refreshProviderSettings = async () => {
    const data = await getAIProviderSettings();
    setAIProviderSettings(data);
    setProviderPriority(data.order);
    setProviderFallback(data.fallback_enabled);
    setProviderModelDrafts(previous => ({ ...Object.fromEntries(data.providers.map(item => [item.provider, item.model])), ...previous }));
  };

  const saveProvider = async (provider: AIProviderCardSetting['provider']) => {
    const apiKey = (providerDrafts[provider] || '').trim();
    if (!apiKey) {
      setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'error', text: 'Paste the API key first.' } }));
      return;
    }
    setProviderBusy(provider);
    setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'info', text: 'Saving encrypted key…' } }));
    try {
      const result: any = await saveAIProviderKey(provider, apiKey, providerModelDrafts[provider] || '');
      setProviderDrafts(previous => ({ ...previous, [provider]: '' }));
      if (result?.settings) setAIProviderSettings(result.settings);
      else await refreshProviderSettings();
      setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'success', text: result?.message || 'Provider key saved securely.' } }));
    } catch (error) {
      setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'error', text: error instanceof Error ? error.message : 'Could not save this provider key.' } }));
    } finally { setProviderBusy(null); }
  };

  const saveProviderModel = async (provider: AIProviderCardSetting['provider']) => {
    const model = (providerModelDrafts[provider] || '').trim();
    if (!model) return setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'error', text: 'Enter a model name.' } }));
    setProviderBusy(provider);
    try {
      const result: any = await updateAIProviderModel(provider, model);
      if (result?.settings) setAIProviderSettings(result.settings);
      setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'success', text: 'Model preference saved.' } }));
    } catch (error) {
      setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'error', text: error instanceof Error ? error.message : 'Could not save model preference.' } }));
    } finally { setProviderBusy(null); }
  };

  const testProvider = async (provider: AIProviderCardSetting['provider']) => {
    setProviderBusy(provider);
    setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'info', text: 'Testing a real provider response…' } }));
    try {
      const result: any = await testAIProviderConnection(provider);
      setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'success', text: `${result.provider} connected · ${result.model}` } }));
      await refreshProviderSettings();
      getAIProviderUsage(30).then(setProviderUsage).catch(() => undefined);
    } catch (error) {
      setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'error', text: error instanceof Error ? error.message : 'Provider connection test failed.' } }));
    } finally { setProviderBusy(null); }
  };

  const removeProvider = async (provider: AIProviderCardSetting['provider']) => {
    if (!window.confirm(`Remove the saved ${provider} API key from this account?`)) return;
    setProviderBusy(provider);
    try {
      const result: any = await removeAIProviderKey(provider);
      if (result?.settings) setAIProviderSettings(result.settings);
      else await refreshProviderSettings();
      setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'success', text: 'Saved account key removed.' } }));
    } catch (error) {
      setProviderFeedback(previous => ({ ...previous, [provider]: { type: 'error', text: error instanceof Error ? error.message : 'Could not remove provider key.' } }));
    } finally { setProviderBusy(null); }
  };

  const moveProviderPriority = (provider: AIProviderCardSetting['provider'], direction: -1 | 1) => {
    setProviderPriority(previous => {
      const current = [...previous];
      const index = current.indexOf(provider);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      [current[index], current[next]] = [current[next], current[index]];
      return current;
    });
  };

  const saveProviderOrder = async () => {
    setProviderBusy('priority');
    try {
      const result: any = await saveAIProviderPreferences(providerPriority, providerFallback);
      if (result?.settings) setAIProviderSettings(result.settings);
      setSavedMessage('CROX AI provider priority saved.');
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Could not save provider priority.');
    } finally { setProviderBusy(null); }
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

      {tab === 'integrations' && <div className="space-y-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-sm font-extrabold text-slate-900">Connected services & data sources</h2><p className="mt-1 text-[10px] text-slate-500">Connect your own AI providers here. Keys are encrypted on the server and never sent back to the browser.</p></div><button type="button" onClick={() => { setStatusError(''); getIntegrationsStatus().then(setIntegrations).catch(() => setStatusError('Could not refresh integration status.')); }} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-[9px] font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={12} /> Refresh status</button></div>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Globe2 size={18} /></span><div><h3 className="text-xs font-extrabold text-slate-900">Google Analytics 4 + Search Console</h3><p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">Connect a Google account with read-only access. CROX stores encrypted refresh credentials on the server and maps each GA4 property / Search Console site to one of your CROX projects.</p><p className="mt-1 text-[9px] text-slate-500">Status: {googleDataStatus?.connected ? `Connected as ${googleDataStatus.google_email || 'Google account'}` : googleDataStatus?.oauth_configured ? 'Not connected' : 'Server OAuth configuration missing'}</p></div></div>
            <div className="flex flex-wrap gap-2">{googleDataStatus?.connected ? <button type="button" onClick={removeGoogleData} disabled={googleDataBusy} className="rounded-lg border border-rose-200 px-3 py-2 text-[9px] font-bold text-rose-700 disabled:opacity-50">Disconnect</button> : <button type="button" onClick={connectGoogleData} disabled={googleDataBusy || googleDataStatus?.oauth_configured === false} className="rounded-lg bg-blue-600 px-3 py-2 text-[9px] font-bold text-white hover:bg-blue-700 disabled:opacity-50">{googleDataBusy ? 'Opening…' : 'Connect Google account'}</button>}</div>
          </div>
          {!googleDataStatus?.oauth_configured && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900">Configure the OAuth client ID, client secret and exact callback URL in the server environment. The redirect URI must be <code>/api/integrations/google-data/callback</code> on your CROX domain, and the Analytics Data API, Analytics Admin API and Search Console API must be enabled in Google Cloud.</div>}
          {googleDataStatus?.connected && <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="block"><span className="mb-1 block text-[9px] font-bold text-slate-600">CROX project</span><select value={googleProjectId} onChange={event => setGoogleProjectId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] text-slate-700"><option value="">Select project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.domain}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-[9px] font-bold text-slate-600">Google Analytics 4 property</span><select value={gaPropertyId} onChange={event => setGaPropertyId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] text-slate-700"><option value="">Not selected</option>{googleDataResources?.analytics_properties.map(property => <option key={property.id} value={property.id}>{property.name} · {property.id}</option>)}</select></label>
            <label className="block"><span className="mb-1 block text-[9px] font-bold text-slate-600">Google Search Console site</span><select value={gscSiteUrl} onChange={event => setGscSiteUrl(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] text-slate-700"><option value="">Not selected</option>{googleDataResources?.search_console_sites.map(site => <option key={site.site_url} value={site.site_url}>{site.site_url} · {site.permission_level}</option>)}</select></label>
          </div>}
          {googleDataStatus?.connected && googleDataResources?.analytics_error && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[9px] leading-4 text-amber-800">GA4 properties: {googleDataResources.analytics_error}</p>}
          {googleDataStatus?.connected && googleDataResources?.search_console_error && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[9px] leading-4 text-amber-800">Search Console sites: {googleDataResources.search_console_error}</p>}
          {googleDataStatus?.connected && <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={saveGoogleProperties} disabled={googleDataBusy || !googleProjectId} className="rounded-lg bg-slate-950 px-3.5 py-2 text-[9px] font-bold text-white disabled:opacity-50">{googleDataBusy ? 'Saving…' : 'Save project properties'}</button><button type="button" onClick={() => getGoogleDataResources().then(setGoogleDataResources).catch(error => setGoogleDataFeedback({ type: 'error', text: error.message || 'Could not refresh Google properties.' }))} className="rounded-lg border border-slate-200 px-3.5 py-2 text-[9px] font-bold text-slate-600">Refresh properties</button><span className="text-[9px] text-slate-500">{googleDataResources ? `${googleDataResources.analytics_properties.length} GA4 properties · ${googleDataResources.search_console_sites.length} Search Console sites` : 'Loading Google properties…'}</span></div>}
          {googleDataFeedback && <p role="status" className={`mt-3 rounded-lg p-2.5 text-[10px] ${googleDataFeedback.type === 'error' ? 'bg-rose-50 text-rose-800' : googleDataFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>{googleDataFeedback.text}</p>}
          <p className="mt-3 text-[9px] leading-4 text-slate-400">Data is sampled from Google’s reporting APIs. Search Console reporting can lag and may return only the top rows; it is not a guaranteed exhaustive query export.</p>
        </section>
        <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#100d21] text-cyan-200"><PlugZap size={17} /></span><div><h3 className="text-xs font-extrabold text-slate-900">CROX AI multi-provider setup</h3><p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-600">Add several provider keys, choose which one CROX AI tries first, and keep fallback providers ready. API usage may be billed by each provider.</p></div></div><span className="rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-[9px] font-bold text-violet-800">6 providers supported</span></div>
          {!aiProviderSettings?.encryption_ready && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-900"><strong>Secure key storage needs one server secret.</strong> Set a stable <code>AI_KEYS_ENCRYPTION_SECRET</code> (32+ characters) in your hosting environment, or set a stable <code>JWT_SECRET</code>. This is an encryption secret, not an AI provider key. Never commit it to GitHub.</div>}
          {providerFeedback.global && <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[10px] leading-5 text-rose-800">{providerFeedback.global.text}</div>}
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(aiProviderSettings?.providers || []).map(provider => {
              const feedback = providerFeedback[provider.provider];
              const busy = providerBusy === provider.provider;
              return <article key={provider.provider} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                <div className="flex items-start justify-between gap-2"><div><h4 className="text-[11px] font-extrabold text-slate-900">{provider.label}</h4><p className="mt-1 text-[9px] text-slate-500">{provider.source === 'account' ? 'Encrypted account key' : provider.source === 'server' ? 'Backend environment key pool' : provider.source === 'mixed' ? 'Account key + backend key pool' : 'Not connected yet'} · {provider.key_count} key(s) ready</p></div><span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${provider.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{provider.configured ? 'Configured' : 'Not connected'}</span></div>
                <label className="mt-3 block"><span className="mb-1 block text-[9px] font-semibold text-slate-600">Model</span><input value={providerModelDrafts[provider.provider] ?? provider.model} onChange={event => setProviderModelDrafts(previous => ({ ...previous, [provider.provider]: event.target.value }))} placeholder={provider.model} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-800 outline-none focus:border-violet-400" /></label>
                <label className="mt-2 block"><span className="mb-1 block text-[9px] font-semibold text-slate-600">Add an account key (optional backup)</span><div className="flex gap-2"><input type={providerRevealed[provider.provider] ? 'text' : 'password'} autoComplete="off" value={providerDrafts[provider.provider] || ''} onChange={event => setProviderDrafts(previous => ({ ...previous, [provider.provider]: event.target.value }))} placeholder={provider.key_hint || 'Paste one authorized provider key'} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-800 outline-none focus:border-violet-400" /><button type="button" onClick={() => setProviderRevealed(previous => ({ ...previous, [provider.provider]: !previous[provider.provider] }))} className="grid w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label={providerRevealed[provider.provider] ? 'Hide API key' : 'Show API key'}>{providerRevealed[provider.provider] ? <EyeOff size={13} /> : <Eye size={13} />}</button></div></label>
                {feedback && <p role="status" className={`mt-2 rounded-lg px-2.5 py-2 text-[9px] leading-4 ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : feedback.type === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-sky-50 text-sky-800'}`}>{feedback.text}</p>}
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || !providerDrafts[provider.provider]?.trim()} onClick={() => void saveProvider(provider.provider)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-bold text-white hover:bg-violet-950 disabled:cursor-not-allowed disabled:opacity-40"><Save size={11} /> Save key</button><button type="button" disabled={busy || !provider.configured} onClick={() => void testProvider(provider.provider)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[9px] font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw size={11} /> Test connection</button>{(provider.source === 'account' || provider.source === 'mixed') && <button type="button" disabled={busy} onClick={() => void saveProviderModel(provider.provider)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-[9px] font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"><Save size={11} /> Save model</button>}{(provider.source === 'account' || provider.source === 'mixed') && <button type="button" disabled={busy} onClick={() => void removeProvider(provider.provider)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[9px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={11} /> Remove key</button>}</div>
              </article>;
            })}
            {!aiProviderSettings && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-[10px] text-slate-500">Loading AI provider settings…</div>}
          </div>
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-3.5">
            <div className="flex items-start gap-2"><KeyRound size={14} className="mt-0.5 shrink-0 text-sky-700" /><div className="min-w-0"><h4 className="text-[10px] font-extrabold text-sky-950">Multiple server keys (recommended for deployments)</h4><p className="mt-1 text-[9px] leading-5 text-sky-900/80">Add secrets in your hosting provider’s environment settings—not in frontend code or Git. Use one key per line or comma-separated in a plural variable. Example:</p><pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-[9px] leading-5 text-emerald-200">OPENAI_API_KEYS=key_one,key_two{`\n`}GEMINI_API_KEYS=key_one,key_two{`\n`}ANTHROPIC_API_KEYS=key_one,key_two{`\n`}GROQ_API_KEYS=key_one,key_two</pre><p className="mt-2 text-[9px] leading-5 text-sky-900/80">CROX reads these only on the backend. Do not place multiple keys from the same organisation in an attempt to evade its shared quota; on quota exhaustion CROX moves to the next separately configured provider.</p></div></div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h4 className="text-[10px] font-extrabold text-slate-800">Provider fallback priority</h4><p className="mt-1 text-[9px] text-slate-500">Move providers up or down. CROX AI tries the first configured provider, then follows this order when fallback is enabled.</p></div>
              <div className="flex items-center gap-2"><button type="button" role="switch" aria-checked={providerFallback} onClick={() => setProviderFallback(value => !value)} className={`relative h-9 rounded-lg px-3 text-left text-[9px] font-bold ${providerFallback ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{providerFallback ? 'Fallback enabled' : 'Fallback disabled'}<span className={`ml-2 inline-block h-2.5 w-2.5 rounded-full ${providerFallback ? 'bg-emerald-500' : 'bg-slate-400'}`} /></button><button type="button" disabled={providerBusy === 'priority'} onClick={() => void saveProviderOrder()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-[9px] font-bold text-white hover:bg-violet-800 disabled:opacity-50"><Save size={11} /> Save order</button></div>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {providerPriority.map((name, index) => {
                const meta = aiProviderSettings?.providers.find(item => item.provider === name);
                return <div key={name} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white text-[9px] font-extrabold text-slate-500">{index + 1}</span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-[9px] text-slate-800">{meta?.label || name}</strong><small className={`block text-[8px] ${meta?.configured ? 'text-emerald-700' : 'text-slate-400'}`}>{meta?.configured ? 'Configured' : 'Not configured'}</small></span>
                  <button type="button" disabled={index === 0} onClick={() => moveProviderPriority(name, -1)} aria-label={`Move ${meta?.label || name} earlier`} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-violet-50 disabled:opacity-30"><ChevronUp size={13} /></button>
                  <button type="button" disabled={index === providerPriority.length - 1} onClick={() => moveProviderPriority(name, 1)} aria-label={`Move ${meta?.label || name} later`} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-violet-50 disabled:opacity-30"><ChevronDown size={13} /></button>
                </div>;
              })}
            </div>
          </div>
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-700"><Activity size={14} /></span><div><h4 className="text-[10px] font-extrabold text-slate-900">CROX AI provider usage & failover log</h4><p className="mt-0.5 text-[9px] text-slate-500">Last {providerUsage?.period_days || 30} days · provider attempts, not provider invoices</p></div></div><button type="button" onClick={() => getAIProviderUsage(30).then(setProviderUsage).catch(() => setStatusError('Provider usage could not be refreshed.'))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[9px] font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={10} className="mr-1 inline" />Refresh</button></div>
            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{[
              ['Requests', providerUsage?.totals.calls ?? 0],
              ['Successful', providerUsage?.totals.successful ?? 0],
              ['Fallback attempts', providerUsage?.totals.fallback_attempts ?? 0],
              ['Rate/quota events', (providerUsage?.totals.rate_limited ?? 0) + (providerUsage?.totals.quota_events ?? 0)]
            ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900">{value}</p></div>)}</div>
            {providerUsage?.providers.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[540px] text-left"><thead><tr className="border-b border-slate-100 text-[8px] font-bold uppercase tracking-wider text-slate-400"><th className="py-2">Provider</th><th className="py-2">Calls</th><th className="py-2">Success</th><th className="py-2">Rate limits</th><th className="py-2">Avg latency</th><th className="py-2">Last used</th></tr></thead><tbody className="divide-y divide-slate-100">{providerUsage.providers.map(item => <tr key={item.provider} className="text-[9px] text-slate-600"><td className="py-2 font-bold capitalize text-slate-800">{item.provider}</td><td className="py-2 tabular-nums">{item.calls}</td><td className="py-2 tabular-nums text-emerald-700">{item.successful}</td><td className="py-2 tabular-nums">{item.rate_limited + item.quota_events}</td><td className="py-2 tabular-nums">{item.average_latency_ms ? `${item.average_latency_ms} ms` : '—'}</td><td className="py-2">{item.last_used_at ? new Date(item.last_used_at).toLocaleString() : '—'}</td></tr>)}</tbody></table></div> : <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-[9px] text-slate-500">{providerUsage ? 'No AI provider attempts recorded yet. Run an Ask CROX AI request or test a connection to populate this panel.' : 'Usage records are unavailable until the backend usage endpoint responds.'}</p>}
            <p className="mt-3 text-[8px] leading-4 text-slate-400">CROX tracks request counts and latency only. Provider token billing and monetary costs are not available unless a provider exposes those usage records. Prompts and API keys are never stored in this log.</p>
          </section>
          <p className="mt-3 text-[9px] leading-4 text-slate-500">CROX AI uses the preferred configured provider first. It retries temporary errors with bounded backoff, rotates to another configured key only for authentication failures, and switches provider for quota/availability failures. Safety, permission and policy refusals are not bypassed. Provider plans and charges remain separate from CROX.</p>
        </section>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <IntegrationCard title="CROX AI · Multi-provider AI" description={`${integrations?.ai?.provider || 'AI provider'} · ${integrations?.ai?.model || 'Model not reported'}. ${integrations?.ai?.note || 'Connect a supported provider for live AI responses.'}`} configured={integrations?.ai?.configured} icon={Sparkles} env="Settings → Integrations or server AI keys" />
          <IntegrationCard title="Google PageSpeed Insights" description="Lighthouse and field/lab performance diagnostics when supported by the API response." configured={integrations?.pagespeed?.configured} icon={Gauge} env="PAGESPEED_API_KEY" />
          <IntegrationCard title="DataForSEO" description="Live keyword volume and CPC data for supported countries and languages." configured={integrations?.dataforseo?.configured} icon={Database} env="DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD" />
          <IntegrationCard title="External CROX AI Agent" description="Optional external agent endpoint for custom agent orchestration." configured={integrations?.agent?.configured} icon={Cloud} env="AGENT_API_URL + AGENT_API_KEY" />
          <IntegrationCard title="Google Analytics 4 + Search Console" description="Read-only property connection is managed in the Google data panel above. Dashboard metrics are loaded from the selected GA4 and Search Console properties." configured={googleDataStatus?.connected} icon={SearchConsoleIcon} env="GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · GOOGLE_DATA_REDIRECT_URI" detail="Only Google-reported sessions, users, page views, clicks, impressions and query rows are shown. No traffic is estimated." />
          <IntegrationCard title="Billing provider" description="Subscription checkout, invoices and payment webhooks are not implemented in this build." configured={integrations?.stripe_billing?.status === 'connected'} icon={CreditCard} env="Billing integration not implemented" />
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex items-start gap-3"><KeyRound size={16} className="mt-0.5 shrink-0 text-indigo-700" /><div><p className="text-[10px] font-extrabold text-indigo-950">Other server-side integrations</p><p className="mt-1 text-[10px] leading-5 text-indigo-900/80">The six CROX AI keys above can be added securely from this screen. PageSpeed, DataForSEO and the optional external agent still use server environment variables. Never place private keys in React components, browser storage or committed source files.</p></div></div></div>
      </div>}

      {tab === 'security' && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-700"><LockKeyhole size={16} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Change password</h2><p className="mt-1 text-[10px] text-slate-500">Update the password for your CROX account.</p></div></div>
          <form onSubmit={submitPassword} className="mt-5 space-y-3"><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-700">Current password</span><input type={showPasswords ? 'text' : 'password'} autoComplete="current-password" value={passwordForm.current} onChange={event => setPasswordForm(value => ({ ...value, current: event.target.value }))} required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-indigo-400" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-700">New password</span><input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={passwordForm.next} onChange={event => setPasswordForm(value => ({ ...value, next: event.target.value }))} required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-indigo-400" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-semibold text-slate-700">Confirm new password</span><input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={passwordForm.confirm} onChange={event => setPasswordForm(value => ({ ...value, confirm: event.target.value }))} required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-indigo-400" /></label><button type="button" onClick={() => setShowPasswords(value => !value)} className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-slate-500">{showPasswords ? <EyeOff size={12} /> : <Eye size={12} />} {showPasswords ? 'Hide passwords' : 'Show passwords'}</button>{passwordError && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-[10px] text-rose-700">{passwordError}</p>}{passwordSuccess && <p role="status" className="rounded-lg bg-emerald-50 p-2.5 text-[10px] text-emerald-700">{passwordSuccess}</p>}<button type="submit" disabled={passwordBusy} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[10px] font-bold text-white hover:bg-indigo-950 disabled:opacity-50">{passwordBusy ? 'Updating…' : 'Update password'}</button></form>
        </section>
        <section className="space-y-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><ShieldCheck size={17} className="text-emerald-600" /><h2 className="text-xs font-extrabold text-slate-900">Security checklist</h2></div><div className="mt-4 space-y-3 text-[10px]"><SecurityStatus label="Password hashes use bcrypt" passed /><SecurityStatus label="Core workspace API routes require authentication" passed /><SecurityStatus label="JWT logout revocation" passed={false} /><SecurityStatus label="Email verification and password reset" passed={false} /><SecurityStatus label="Two-factor authentication" passed={false} /></div><p className="mt-4 text-[9px] leading-5 text-slate-400">Some security controls are not implemented yet. Do not treat this checklist as a formal security certification.</p></div></section>
      </div>}

      {tab === 'usage' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><CreditCard size={16} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Current plan</h2><p className="mt-1 text-[10px] text-slate-500">Your account entitlement</p></div></div><p className="mt-4 text-2xl font-extrabold capitalize text-slate-900">{user?.plan || 'Free'}</p><p className="mt-1 text-[10px] leading-5 text-slate-500">Plan values are currently assigned in the CROX account system. Paid checkout, subscription management and invoices are not enabled.</p><span className="mt-4 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-800">Billing not connected</span></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-700"><BellRing size={16} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Usage and limits</h2><p className="mt-1 text-[10px] text-slate-500">Daily product allowances</p></div></div><div className="mt-4 space-y-3">{[['Site audits', user?.credits?.audits], ['CROX AI messages', user?.credits?.ai], ['Keyword searches', user?.credits?.keywords]].map(([label, counter]: any) => <div key={label}><div className="flex items-center justify-between text-[10px]"><span className="font-semibold text-slate-700">{label}</span><span className="tabular-nums text-slate-500">{counter ? `${counter.used}/${counter.daily_limit}` : 'Refresh account to load'}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${counter ? Math.min(100, counter.daily_limit ? counter.used / counter.daily_limit * 100 : 0) : 0}%` }} /></div></div>)}</div></div></div>}
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
