import React from 'react';
import { Activity, ArrowRight, BarChart3, BrainCircuit, Globe2, Link2, MapPin, Megaphone, MessageSquareText, Search, ShieldCheck, Sparkles } from 'lucide-react';

interface ModulePreviewPageProps {
  moduleId: string;
  onOpenTab: (tab: string) => void;
}

const roadmap: Record<string, { title: string; eyebrow: string; description: string; phase: string; icon: React.ElementType; capabilities: string[]; nextSteps: Array<{ label: string; tab: string }> }> = {
  'ai-visibility': {
    title: 'AI Visibility', eyebrow: 'AI SEARCH', description: 'A dedicated workspace for measuring whether answer engines mention your brand, which sources they cite, and how your visibility compares with competitors.', phase: 'Phase 7', icon: BrainCircuit,
    capabilities: ['Tracked prompts across supported AI systems', 'Brand mentions, citation sources and sentiment', 'Competitor comparisons and improvement suggestions'],
    nextSteps: [{ label: 'Ask NOVA for an AI-search plan', tab: 'ai-assistant' }, { label: 'Research target topics', tab: 'keyword-research' }]
  },
  'local-seo': {
    title: 'Local SEO', eyebrow: 'LOCAL GROWTH', description: 'Local listing, reviews and map-rank workflows are planned here. Live map positions and listings will only appear after the corresponding data source is connected.', phase: 'Phase 8', icon: MapPin,
    capabilities: ['Business listing consistency checks', 'Review monitoring and reply suggestions', 'Local rank-grid planning for target areas'],
    nextSteps: [{ label: 'Explore market research', tab: 'market-research' }, { label: 'Open SEO audit', tab: 'site-audit' }]
  },
  advertising: {
    title: 'Advertising Intelligence', eyebrow: 'PAID SEARCH', description: 'The future advertising workspace will organize competitor ad research, keyword cost estimates and AI-assisted creative drafts.', phase: 'Phase 8', icon: Megaphone,
    capabilities: ['Competitor ad and landing-page research', 'CPC and paid-keyword insights when available', 'Ad copy drafts with reviewable suggestions'],
    nextSteps: [{ label: 'Explore market research', tab: 'market-research' }, { label: 'Research keywords', tab: 'keyword-research' }]
  },
  'ai-pr': {
    title: 'AI PR & Brand', eyebrow: 'BRAND INTELLIGENCE', description: 'A planned hub for monitoring brand mentions and finding media opportunities, with NOVA helping draft relevant outreach.', phase: 'Phase 8', icon: MessageSquareText,
    capabilities: ['Brand mention tracking', 'Media and outreach prospect organization', 'AI-assisted pitch drafts with human review'],
    nextSteps: [{ label: 'Open NOVA', tab: 'ai-assistant' }, { label: 'Review market positioning', tab: 'market-research' }]
  },
  social: {
    title: 'Social Intelligence', eyebrow: 'SOCIAL GROWTH', description: 'The social workspace will help plan content, organize a publishing calendar and summarize connected profile performance.', phase: 'Phase 8', icon: Activity,
    capabilities: ['Social publishing calendar', 'AI-assisted post variants', 'Best-time-to-post recommendations when enough data exists'],
    nextSteps: [{ label: 'Open Content opportunities', tab: 'content' }, { label: 'Generate a content brief', tab: 'market-research' }]
  },
  'position-tracking': {
    title: 'Position Tracking', eyebrow: 'RANK MONITORING', description: 'Set up a foundation for country, city and device-specific rank tracking. This shell does not claim to report live rankings yet.', phase: 'Phase 4', icon: BarChart3,
    capabilities: ['Daily rank history and visibility trend', 'Country, city and device segments', 'Alerts for meaningful ranking changes'],
    nextSteps: [{ label: 'Research keywords', tab: 'keyword-research' }, { label: 'Create a project', tab: 'overview' }]
  },
  'keyword-gap': {
    title: 'Keyword Gap', eyebrow: 'COMPETITOR RESEARCH', description: 'Compare your target domain with competitors to organize keyword opportunities after a live SERP data provider is connected.', phase: 'Phase 4', icon: Search,
    capabilities: ['Compare up to five competitor domains', 'Find shared and missing topics', 'Export opportunity lists when data is available'],
    nextSteps: [{ label: 'Open Keyword Magic Tool', tab: 'keyword-research' }, { label: 'Open Market Research', tab: 'market-research' }]
  },
  backlinks: {
    title: 'Backlink Analytics', eyebrow: 'LINK INTELLIGENCE', description: 'The current CROX project does not yet include a full inbound backlink index. This page reserves the workspace for provider-backed link analytics.', phase: 'Phase 5', icon: Link2,
    capabilities: ['Referring-domain and anchor reports', 'New and lost link history', 'Audit-ready disavow and outreach workflows'],
    nextSteps: [{ label: 'Open reports', tab: 'reports' }, { label: 'Explore market research', tab: 'market-research' }]
  }
};

export const ModulePreviewPage: React.FC<ModulePreviewPageProps> = ({ moduleId, onOpenTab }) => {
  const module = roadmap[moduleId] || roadmap['ai-visibility'];
  const Icon = module.icon;
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-700"><Icon size={14} /></span>{module.eyebrow}</div>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
        <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 sm:p-9">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-violet-200/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-slate-600"><ShieldCheck size={11} /> Foundation ready · {module.phase}</span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{module.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{module.description}</p>
            <p className="mt-4 inline-flex items-center gap-2 text-[10px] font-semibold text-indigo-700"><Sparkles size={13} /> Module shell only — not reporting live module data yet.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3 sm:p-7">
          {module.capabilities.map((item, index) => <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="mb-3 grid h-7 w-7 place-items-center rounded-lg bg-white text-indigo-600 shadow-xs"><span className="text-[10px] font-bold">0{index + 1}</span></div><p className="text-xs font-semibold leading-5 text-slate-800">{item}</p></div>)}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-sm font-bold text-slate-900">What you can do now</h2><p className="mt-1 text-xs leading-5 text-slate-500">Use existing CROX tools while this module is developed. CROX labels estimated data and does not manufacture live metrics.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{module.nextSteps.map(step => <button key={step.tab} type="button" onClick={() => onOpenTab(step.tab)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">{step.label}<ArrowRight size={13} /></button>)}</div></div>
    </div>
  );
};
