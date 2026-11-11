import React from 'react';
import { ArrowUpRight, CheckCircle2, Globe2, LoaderCircle, ShieldAlert } from 'lucide-react';

export interface CompetitorProfile {
  domain: string;
  normalized_url?: string;
  available: boolean;
  status_code?: number | null;
  response_time_ms?: number | null;
  title?: string | null;
  description?: string | null;
  h1?: string[];
  canonical?: string | null;
  indexed_hints?: string[];
  note?: string;
}

interface MarketProfileCardProps {
  profile: CompetitorProfile;
  label: string;
}

export const MarketProfileCard: React.FC<MarketProfileCardProps> = ({ profile, label }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm min-w-0">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0"><p className="text-[10px] uppercase font-bold tracking-[0.16em] text-slate-400 mb-1">{label}</p><h3 className="font-semibold text-slate-900 truncate">{profile.domain}</h3></div>
      <span className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-full ${profile.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{profile.available ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}{profile.available ? 'Read successfully' : 'Partial / unavailable'}</span>
    </div>
    <div className="grid grid-cols-2 gap-2 mb-4">
      <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[10px] text-slate-500 mb-1">HTTP status</span><strong className="text-lg text-slate-900">{profile.status_code ?? '—'}</strong></div>
      <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[10px] text-slate-500 mb-1">Response time</span><strong className="text-lg text-slate-900">{profile.response_time_ms == null ? '—' : `${profile.response_time_ms} ms`}</strong></div>
    </div>
    <div className="space-y-3">
      <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Homepage title</p><p className="text-xs leading-5 text-slate-700 break-words">{profile.title || 'Not detected from the homepage'}</p></div>
      <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Meta description</p><p className="text-xs leading-5 text-slate-600 break-words">{profile.description || 'Not detected from the homepage'}</p></div>
      <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Primary headings</p>{profile.h1?.length ? <div className="flex flex-wrap gap-1.5">{profile.h1.slice(0, 3).map((heading, index) => <span key={`${heading}-${index}`} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-700">{heading}</span>)}</div> : <p className="text-xs text-slate-500">No H1 extracted</p>}</div>
    </div>
    {profile.note && <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">{profile.note}</p>}
    {profile.normalized_url && <a href={profile.normalized_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">Open website <ArrowUpRight size={13} /></a>}
  </section>
);
