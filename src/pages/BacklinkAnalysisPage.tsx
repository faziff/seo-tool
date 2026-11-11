import React, { useMemo, useState } from 'react';
import { ArrowUpRight, BadgeCheck, ExternalLink, Filter, Globe2, Link2, Loader2, LockKeyhole, Search, ShieldAlert, TrendingUp } from 'lucide-react';
import { analyzeBacklinks, type BacklinkAnalysisResponse } from '../services/api';

export const BacklinkAnalysisPage: React.FC<{ onOpenPricing: () => void }> = ({ onOpenPricing }) => {
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState<'free' | 'live'>('free');
  const [filter, setFilter] = useState<'all' | 'dofollow' | 'nofollow'>('all');
  const [providerFilter, setProviderFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<BacklinkAnalysisResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!target.trim()) { setError('Enter a website domain to analyze.'); return; }
    setBusy(true); setError(''); setData(null);
    try { setData(await analyzeBacklinks(target.trim(), mode)); }
    catch (err: any) { setError(err?.message || 'Backlink analysis failed.'); }
    finally { setBusy(false); }
  };

  const rows = useMemo(() => {
    const source = mode === 'live' ? (data?.backlinks || []) : (data?.links || []).map(link => ({
      source_domain: URLSafe(link.url), source_url: link.url, target_url: '', anchor: link.text,
      dofollow: !/nofollow/i.test(link.rel), rank: null as number | null, first_seen: null as string | null, last_seen: null as string | null
    }));
    return source.filter(row => {
      const matchesFilter = filter === 'all' || (filter === 'dofollow' ? row.dofollow === true : row.dofollow === false);
      const needle = search.trim().toLowerCase();
      const matchesSearch = !needle || `${row.source_domain} ${row.source_url} ${row.target_url} ${row.anchor}`.toLowerCase().includes(needle);
      return matchesFilter && matchesSearch;
    });
  }, [data, filter, mode, search]);

  const providers = [
    { name: 'Ahrefs Free', tier: 'free' as const, detail: 'Site Explorer and SEO tools for websites whose ownership you verify.', url: 'https://ahrefs.com/webmaster-tools', tag: 'Verified sites' },
    { name: 'Bing Webmaster Tools', tier: 'free' as const, detail: 'Free backlink report with referring domains, pages and anchor text for your site.', url: 'https://www.bing.com/webmasters', tag: 'Site owner access' },
    { name: 'Semrush Backlink Analytics', tier: 'paid' as const, detail: 'Commercial backlink research and competitor link analysis, with a free checker entry point.', url: 'https://www.semrush.com/analytics/backlinks/', tag: 'SEO suite' },
    { name: 'Ahrefs Site Explorer', tier: 'paid' as const, detail: 'Expanded backlink and competitor research beyond the verified-site free account.', url: 'https://ahrefs.com/site-explorer', tag: 'SEO suite' },
    { name: 'DataForSEO Backlinks API', tier: 'paid' as const, detail: 'Usage-based API access for embedding backlink metrics into CROX.', url: 'https://dataforseo.com/pricing/backlinks/backlinks', tag: 'Pay as you go' }
  ];
  const visibleProviders = providers.filter(provider => providerFilter === 'all' || provider.tier === providerFilter);
  const summary = data?.summary;
  const metrics = mode === 'live' ? [
    ['Backlinks', summary?.backlinks ?? 0], ['Referring domains', summary?.referring_domains ?? 0], ['Referring pages', summary?.referring_pages ?? 0], ['Backlink rank', summary?.rank == null ? '—' : summary.rank]
  ] : [
    ['Outgoing links', data?.outbound_external_links ?? 0], ['Dofollow', data?.dofollow_outbound ?? 0], ['Nofollow', data?.nofollow_outbound ?? 0], ['Unique sample', data?.links?.length ?? 0]
  ];

  return <div className="crox-product-page">
    <div className="crox-product-heading">
      <div><div className="crox-eyebrow"><Link2 size={13} /> OFF-PAGE SEO INTELLIGENCE</div><h1>Backlink Analysis</h1><p>Inspect external links on a page for free, or switch to a live backlink index for inbound links, referring domains and link attributes.</p></div>
      <div className="crox-product-badge"><ShieldAlert size={14} /> Link data coverage depends on source</div>
    </div>

    <div className="crox-product-card crox-backlink-search">
      <div className="crox-mode-toggle" role="tablist" aria-label="Backlink data source">
        <button type="button" className={mode === 'free' ? 'active' : ''} onClick={() => { setMode('free'); setData(null); setError(''); }}><Globe2 size={15} /> Free page check</button>
        <button type="button" className={mode === 'live' ? 'active' : ''} onClick={() => { setMode('live'); setData(null); setError(''); }}><TrendingUp size={15} /> Live backlink index <span>PRO</span></button>
      </div>
      <form className="crox-domain-form" onSubmit={event => { event.preventDefault(); void run(); }}>
        <div className="crox-domain-input"><Globe2 size={18} /><input value={target} onChange={event => setTarget(event.target.value)} placeholder="Enter a domain, e.g. example.com" aria-label="Website domain" /></div>
        <button type="submit" className="crox-btn-primary" disabled={busy}>{busy ? <><Loader2 className="crox-spin" size={16} /> Analyzing</> : <><Search size={16} /> Analyze backlinks</>}</button>
      </form>
      {mode === 'live' && <div className="crox-source-explainer"><LockKeyhole size={14} /> Live mode uses the DataForSEO Backlinks API. Add provider credentials on the server; provider usage may incur third-party charges.</div>}
      {mode === 'free' && <div className="crox-source-explainer"><BadgeCheck size={14} /> Free mode crawls the submitted homepage and reports outgoing external links. It does not estimate inbound backlinks.</div>}
    </div>

    {error && <div className="crox-inline-alert"><ShieldAlert size={16} /><span>{error}</span>{/upgrade|plan|trial/i.test(error) && <button type="button" onClick={onOpenPricing}>View plans <ArrowUpRight size={13} /></button>}</div>}
    {busy && <div className="crox-loading-panel"><span className="crox-loader" /><strong>Building backlink overview</strong><small>{mode === 'live' ? 'Requesting current metrics from the configured backlink provider.' : 'Fetching and parsing the submitted homepage.'}</small></div>}

    {data && <>
      <div className="crox-report-meta"><span><BadgeCheck size={13} /> Source: <strong>{data.provider}</strong></span><span>{data.checked_at ? `Checked ${new Date(data.checked_at).toLocaleString()}` : 'Fresh page snapshot'}</span></div>
      <div className="crox-product-metrics">{metrics.map(([label, value]) => <div key={String(label)} className="crox-product-metric"><span><Link2 size={17} /></span><small>{label}</small><strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong><em>{mode === 'live' ? 'Live index metric' : 'Homepage snapshot'}</em></div>)}</div>
      <section className="crox-product-card crox-table-card">
        <div className="crox-card-title"><div><strong>{mode === 'live' ? 'Inbound backlink sample' : 'External links found on homepage'}</strong><small>{data.note}</small></div><span className="crox-card-icon"><Link2 size={17} /></span></div>
        <div className="crox-table-toolbar">
          <div className="crox-table-search"><Search size={14} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter URLs, domains or anchor text" /></div>
          <div className="crox-filter-buttons"><Filter size={14} />{(['all', 'dofollow', 'nofollow'] as const).map(item => <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'All links' : item}</button>)}</div>
        </div>
        {rows.length ? <div className="crox-responsive-table"><table><thead><tr><th>{mode === 'live' ? 'Referring page' : 'External destination'}</th><th>Domain</th><th>Anchor text</th><th>Attribute</th>{mode === 'live' && <th>Rank</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.source_url}-${index}`}><td className="crox-link-cell"><a href={row.source_url} target="_blank" rel="noreferrer">{row.source_url || '—'} <ExternalLink size={11} /></a></td><td>{row.source_domain}</td><td>{row.anchor || '—'}</td><td><span className={`crox-link-pill ${row.dofollow ? 'follow' : 'nofollow'}`}>{row.dofollow ? 'Dofollow' : 'Nofollow'}</span></td>{mode === 'live' && <td>{row.rank ?? '—'}</td>}</tr>)}</tbody></table></div> : <div className="crox-empty-inline">No links match these filters.</div>}
      </section>
    </>}
    {!data && !busy && !error && <div className="crox-empty-state"><div className="crox-empty-icon"><Link2 size={26} /></div><h2>Understand your website's link profile</h2><p>Start with a free page check or use the live backlink index during your trial or on an active plan.</p><button type="button" className="crox-btn-primary" onClick={() => { setMode('free'); document.querySelector<HTMLInputElement>('.crox-domain-input input')?.focus(); }}>Start free analysis <ArrowUpRight size={15} /></button></div>}

    <section className="crox-product-card crox-provider-directory">
      <div className="crox-card-title"><div><strong>Backlink data providers</strong><small>Compare free and paid sources you can connect or use alongside CROX.</small></div><span className="crox-card-icon"><ExternalLink size={17} /></span></div>
      <div className="crox-provider-filters">{(['all', 'free', 'paid'] as const).map(item => <button key={item} type="button" className={providerFilter === item ? 'active' : ''} onClick={() => setProviderFilter(item)}>{item === 'all' ? 'All providers' : `${item[0].toUpperCase()}${item.slice(1)}`}</button>)}</div>
      <div className="crox-provider-grid">{visibleProviders.map(provider => <article className="crox-provider-card" key={provider.name}><div><strong>{provider.name}</strong><span className={`crox-provider-tier ${provider.tier}`}>{provider.tier}</span></div><p>{provider.detail}</p><small>{provider.tag}</small><a href={provider.url} target="_blank" rel="noreferrer">Open provider <ArrowUpRight size={13} /></a></article>)}</div>
      <p className="crox-provider-footnote">External services have their own verification, usage limits and pricing. CROX does not claim those services are connected to your account until credentials are configured.</p>
    </section>
  </div>;
};

function URLSafe(value: string): string {
  try { return new URL(value).hostname; } catch { return value; }
}
