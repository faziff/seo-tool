import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Gauge, Info, KeyRound, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import { getIntegrationsStatus } from '../services/api';

interface IntegrationStatus {
  ai?: { provider: string; configured: boolean; mode: 'live' | 'demo'; model: string; note: string };
  gemini?: { configured: boolean; model?: string };
  pagespeed?: { configured: boolean };
}

export const SettingsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    let active = true;
    getIntegrationsStatus()
      .then((data) => { if (active) setIntegrations(data); })
      .catch(() => { if (active) setStatusError('Integration status is unavailable. Check that the CROX API server is running.'); });
    return () => { active = false; };
  }, []);

  const StatusPill = ({ configured, optional = false }: { configured?: boolean; optional?: boolean }) => {
    if (configured) return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</span>;
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200"><AlertCircle className="w-3.5 h-3.5" /> {optional ? 'Optional' : 'Key not configured'}</span>;
  };

  return (
    <div className="max-w-5xl space-y-7">
      <div className="relative overflow-hidden rounded-[28px] bg-[#100d24] p-6 sm:p-8 text-white shadow-xl shadow-violet-950/10">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute right-36 -bottom-28 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
          <div>
            <div className="flex items-center gap-2 text-violet-200 text-[11px] font-bold tracking-[0.18em] uppercase mb-3"><SlidersHorizontal className="w-4 h-4" /> Workspace control room</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Settings & Integrations</h1>
            <p className="text-sm text-slate-300 mt-2 max-w-xl leading-6">Review server-side AI integrations, optional data providers and crawler safety controls for your signed-in workspace.</p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/10 p-4 min-w-40 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-bold"><span className="w-2 h-2 rounded-full bg-emerald-400" /> CROX Engine</div>
            <p className="text-[11px] text-slate-300 mt-1">Local workspace mode</p>
          </div>
        </div>
      </div>

      {statusError && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{statusError}</div>}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center"><Sparkles className="w-5 h-5" /></div><div><h2 className="font-bold text-slate-900">NOVA · AI Provider</h2><p className="text-xs text-slate-500 mt-1">Gemini, Hermes, OpenRouter or Groq</p></div></div>
            <StatusPill configured={integrations?.ai?.configured} optional={!integrations?.ai?.configured} />
          </div>
          <p className="text-sm leading-6 text-slate-600 mt-4">When a provider is configured, NOVA can generate context-aware drafts and strategy. Without credentials, supported features switch to clear local guidance rather than pretending a live request succeeded.</p>
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600"><span className="font-semibold text-slate-800">Mode:</span> <code className="font-mono text-violet-700">{integrations?.ai?.mode || 'checking'}</code>{integrations?.ai?.provider ? <span className="ml-2 text-slate-400">Provider: {integrations.ai.provider} · Model: {integrations.ai.model}</span> : null}<p className="mt-2">Server variables: <code>AI_PROVIDER</code>, plus the selected provider key and model in <code>.env.example</code>.</p></div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center"><Gauge className="w-5 h-5" /></div><div><h2 className="font-bold text-slate-900">PageSpeed Insights</h2><p className="text-xs text-slate-500 mt-1">Lighthouse / Core Web Vitals</p></div></div>
            <StatusPill configured={integrations?.pagespeed?.configured} optional />
          </div>
          <p className="text-sm leading-6 text-slate-600 mt-4">PageSpeed results require the server to reach Google’s PageSpeed Insights API. The standard crawl still reports response timing and the metrics it can measure locally.</p>
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600"><span className="font-semibold text-slate-800">Server variable:</span> <code className="font-mono text-sky-700">PAGESPEED_API_KEY</code></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div><div><h2 className="font-bold text-slate-900">Crawler safety</h2><p className="text-xs text-slate-500 mt-1">Guardrails used before public website requests</p></div></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Private network targets</p><p className="text-sm text-slate-900 font-bold mt-2">Blocked</p><p className="text-xs text-slate-500 mt-1 leading-5">Loopback, private IP ranges and cloud metadata addresses.</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Crawl policy</p><p className="text-sm text-slate-900 font-bold mt-2">Robots & sitemap aware</p><p className="text-xs text-slate-500 mt-1 leading-5">Public pages are discovered through links and sitemaps.</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Remediation</p><p className="text-sm text-slate-900 font-bold mt-2">Review before use</p><p className="text-xs text-slate-500 mt-1 leading-5">Fix drafts are suggestions; CROX does not silently edit a live site.</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div><div><h2 className="font-bold text-slate-900">Configure optional keys</h2><p className="text-xs text-slate-500 mt-1">Keep secrets on the server only</p></div></div>
        <ol className="list-decimal pl-5 mt-4 space-y-2 text-sm leading-6 text-slate-600">
          <li>Open the project’s server-side <code className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5">.env</code> file.</li>
          <li>Add <code className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5">AI_PROVIDER</code> and the matching provider key (for example <code>GEMINI_API_KEY</code>, <code>HERMES_API_KEY</code>, <code>OPENROUTER_API_KEY</code> or <code>GROQ_API_KEY</code>), or add <code className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5">PAGESPEED_API_KEY</code>.</li>
          <li>Restart the CROX Node.js server. Never paste private keys into frontend code or commit them to GitHub.</li>
        </ol>
      </section>

      <div className="flex gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm text-violet-950"><Info className="w-5 h-5 shrink-0 text-violet-600 mt-0.5" /><p className="leading-6">CROX account routes require a signed-in user. Google sign-in is optional and only becomes available after its server OAuth settings are configured. Keep provider credentials in the server environment, never in frontend code.</p></div>
    </div>
  );
};
