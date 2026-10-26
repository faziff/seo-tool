import React, { FormEvent, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Check, ChevronDown,
  ChevronRight, CircleGauge, Code2, Compass, FileSearch, Globe, Layers3,
  ListChecks, LockKeyhole, Menu, Search, ShieldCheck, Sparkles, Target,
  TrendingUp, Users, X, Zap
} from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
  onAnalyze: (target: string) => void;
}

const features = [
  { icon: CircleGauge, title: 'SEO Performance', text: 'Understand technical health, page signals and the issues that deserve attention first.', id: 'seo-performance', color: 'blue' },
  { icon: Sparkles, title: 'AI Search Visibility', text: 'Use AI-assisted workflows to explore how brands and topics appear in modern search.', id: 'ai-visibility', color: 'violet' },
  { icon: Search, title: 'Keyword Research', text: 'Explore relevant keyword ideas, search intent and opportunities for your next page.', id: 'keyword-research', color: 'mint' },
  { icon: Users, title: 'Competitor Analysis', text: 'Review public website signals and compare areas that may need a closer look.', id: 'competitor-analysis', color: 'orange' },
  { icon: FileSearch, title: 'Content Intelligence', text: 'Improve page structure and content clarity with focused, actionable recommendations.', id: 'content-intelligence', color: 'rose' },
  { icon: BarChart3, title: 'Reporting and Insights', text: 'Bring scan findings and project context together in a readable workspace.', id: 'reporting-insights', color: 'cyan' },
];

const workflow = [
  { icon: Globe, number: '01', title: 'Enter your website', text: 'Add a public website address and create your CROX workspace.' },
  { icon: FileSearch, number: '02', title: 'Explore available insights', text: 'Review the audit results, page signals and tools available to your account.' },
  { icon: Target, number: '03', title: 'Choose what to improve', text: 'Prioritize practical fixes and track your work from one place.' },
];

const navMenus = [
  { label: 'Product', links: [{ label: 'SEO Performance', href: '#features' }, { label: 'AI Insights', href: '#ai-insights' }, { label: 'Dashboard preview', href: '#product-preview' }] },
  { label: 'Solutions', links: [{ label: 'Website owners', href: '#how-it-works' }, { label: 'SEO workflows', href: '#features' }, { label: 'Competitor research', href: '#features' }] },
  { label: 'Resources', links: [{ label: 'How CROX works', href: '#how-it-works' }, { label: 'Our approach to data', href: '#data-approach' }, { label: 'Feature overview', href: '#features' }] },
];

function normalizeWebsiteTarget(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Enter a website domain to continue.');
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try { parsed = new URL(candidate); } catch { throw new Error('Enter a valid domain, such as example.com.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname.includes('.') || /\s/.test(parsed.hostname)) {
    throw new Error('Enter a public website domain, such as example.com.');
  }
  return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, ''));
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onSignUp, onAnalyze }) => {
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [domainError, setDomainError] = useState('');

  const handleDomainSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const target = normalizeWebsiteTarget(domain);
      setDomainError('');
      onAnalyze(target);
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Check the website address and try again.');
    }
  };

  const closeMobileNav = () => setMobileNavOpen(false);
  const jumpTo = (href: string) => {
    closeMobileNav();
    if (href.startsWith('#')) requestAnimationFrame(() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <main className="crox-home">
      {announcementVisible && <div className="crox-home-announcement">
        <div className="crox-home-announcement-inner"><Sparkles size={14} aria-hidden="true" /><span>CROX brings SEO audits, keyword research and AI-assisted insights into one workspace.</span><a href="#features" onClick={() => jumpTo('#features')}>Explore product <ArrowRight size={13} /></a><button type="button" aria-label="Dismiss announcement" onClick={() => setAnnouncementVisible(false)}><X size={14} /></button></div>
      </div>}

      <header className="crox-home-header">
        <div className="crox-home-nav-wrap">
          <a href="#top" className="crox-home-brand" aria-label="CROX home" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><img src="/crox-mark.svg" width="39" height="39" alt="" aria-hidden="true" /><span>CROX</span></a>
          <nav className="crox-home-nav" aria-label="Main navigation">
            {navMenus.map((menu) => <details className="crox-home-nav-dropdown" key={menu.label}>
              <summary>{menu.label}<ChevronDown size={13} /></summary>
              <div className="crox-home-dropdown-panel">{menu.links.map((link) => <a key={link.label} href={link.href} onClick={() => jumpTo(link.href)}>{link.label}<ArrowUpRight size={13} /></a>)}</div>
            </details>)}
            <a href="#how-it-works" onClick={() => jumpTo('#how-it-works')}>How it works</a>
          </nav>
          <div className="crox-home-nav-actions"><button type="button" className="crox-home-login" onClick={onSignIn}>Log in</button><button type="button" className="crox-home-primary crox-home-nav-cta" onClick={onSignUp}>Create account <ArrowRight size={15} /></button></div>
          <button type="button" className="crox-home-mobile-toggle" aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
        {mobileNavOpen && <nav className="crox-home-mobile-nav" aria-label="Mobile navigation">
          {navMenus.map((menu) => <div key={menu.label} className="crox-home-mobile-nav-group"><span>{menu.label}</span>{menu.links.map((link) => <a key={link.label} href={link.href} onClick={() => jumpTo(link.href)}>{link.label}<ChevronRight size={14} /></a>)}</div>)}
          <a href="#how-it-works" onClick={() => jumpTo('#how-it-works')}>How it works <ChevronRight size={14} /></a>
          <div className="crox-home-mobile-auth"><button type="button" className="crox-home-login" onClick={() => { closeMobileNav(); onSignIn(); }}>Log in</button><button type="button" className="crox-home-primary" onClick={() => { closeMobileNav(); onSignUp(); }}>Create account <ArrowRight size={15} /></button></div>
        </nav>}
      </header>

      <section className="crox-home-hero" id="top">
        <div className="crox-home-hero-grid">
          <div className="crox-home-hero-copy">
            <div className="crox-home-eyebrow"><span className="crox-home-eyebrow-icon"><Sparkles size={13} /></span> SEO &amp; AI SEARCH ANALYTICS</div>
            <h1>More visibility.<br />More clicks.<br /><span>More growth.</span></h1>
            <p className="crox-home-hero-lede">CROX helps you understand search performance, uncover SEO opportunities, review website health and organize your next steps in one clear workspace.</p>
            <form className="crox-home-domain-form" onSubmit={handleDomainSubmit} noValidate>
              <Globe size={18} aria-hidden="true" />
              <label className="crox-home-visually-hidden" htmlFor="crox-domain-input">Website domain</label>
              <input id="crox-domain-input" type="text" inputMode="url" autoComplete="url" value={domain} onChange={(event) => { setDomain(event.target.value); if (domainError) setDomainError(''); }} placeholder="Enter your website (e.g. yourdomain.com)" aria-invalid={!!domainError} aria-describedby={domainError ? 'crox-domain-error' : 'crox-domain-help'} />
              <button type="submit" className="crox-home-primary">Get insights <ArrowRight size={16} /></button>
            </form>
            {domainError ? <p className="crox-home-form-message crox-home-form-error" id="crox-domain-error" role="alert">{domainError}</p> : <p className="crox-home-form-message" id="crox-domain-help">You’ll create or sign in to a CROX account before running an audit.</p>}
            <div className="crox-home-hero-proof"><span><Check size={14} /> Website audit workflow</span><span><Check size={14} /> Clear next steps</span><span><Check size={14} /> Provider-aware insights</span></div>
          </div>

          <div className="crox-home-hero-visual" aria-label="CROX analytics interface preview with clearly labeled illustrative data">
            <div className="crox-home-orbit crox-home-orbit-one" /><div className="crox-home-orbit crox-home-orbit-two" />
            <div className="crox-dashboard-window">
              <div className="crox-dashboard-topbar"><div className="crox-dashboard-brand"><img src="/crox-mark.svg" width="23" height="23" alt="" aria-hidden="true" /><b>CROX</b></div><span className="crox-dashboard-demo"><span /> Illustrative data</span><span className="crox-dashboard-profile">C</span></div>
              <div className="crox-dashboard-layout">
                <aside className="crox-dashboard-sidebar"><div className="crox-dashboard-sidebar-label">WORKSPACE</div><span className="active"><BarChart3 size={14} /> Overview</span><span><FileSearch size={14} /> SEO audit</span><span><Search size={14} /> Keywords</span><span><Users size={14} /> Competitors</span><span><Sparkles size={14} /> AI visibility</span><div className="crox-dashboard-sidebar-footer"><span>ACCOUNT STATUS</span><b><i /> Workspace ready</b></div></aside>
                <div className="crox-dashboard-content">
                  <div className="crox-dashboard-heading"><div><span>OVERVIEW</span><h2>Your search workspace</h2></div><span className="crox-dashboard-date"><Activity size={12} /> Sample view</span></div>
                  <div className="crox-dashboard-metrics">
                    <div><span>Site health</span><b>86<small>/100</small></b><em><Check size={11} /> Example score</em></div>
                    <div><span>Pages checked</span><b>24</b><em>Illustrative count</em></div>
                    <div><span>Keyword ideas</span><b>128</b><em>Demo value</em></div>
                    <div><span>AI mentions</span><b>—</b><em>Provider dependent</em></div>
                  </div>
                  <div className="crox-dashboard-panels">
                    <div className="crox-dashboard-chart-card"><div className="crox-dashboard-card-heading"><div><b>Audit overview</b><small>Example visualization</small></div><span>Demo</span></div><div className="crox-dashboard-chart"><div className="crox-dashboard-ylabels"><span>100</span><span>75</span><span>50</span><span>25</span></div><svg viewBox="0 0 420 132" preserveAspectRatio="none" role="img" aria-label="Illustrative rising line chart, not real website performance"><defs><linearGradient id="crox-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1686ff" stopOpacity=".22" /><stop offset="100%" stopColor="#1686ff" stopOpacity="0" /></linearGradient></defs><path d="M0 103 C20 94 27 105 43 85 S71 95 89 78 S118 92 137 65 S162 80 180 58 S207 74 226 52 S250 68 269 40 S295 58 315 31 S343 49 363 23 S392 35 420 12 V132 H0 Z" fill="url(#crox-chart-fill)"/><path d="M0 103 C20 94 27 105 43 85 S71 95 89 78 S118 92 137 65 S162 80 180 58 S207 74 226 52 S250 68 269 40 S295 58 315 31 S343 49 363 23 S392 35 420 12" fill="none" stroke="#1686ff" strokeWidth="2.6" strokeLinecap="round"/></svg></div><div className="crox-dashboard-xlabels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div></div>
                    <div className="crox-dashboard-visibility-card"><span>Search visibility</span><div className="crox-dashboard-ring"><div><b>—</b><small>not connected</small></div></div><p>Connect a supported data source to track live visibility.</p></div>
                  </div>
                  <div className="crox-dashboard-keywords"><div className="crox-dashboard-card-heading"><b>Example task list</b><span>PREVIEW</span></div><div className="crox-dashboard-keyword-row"><span className="crox-dashboard-check"><Check size={11} /></span><span>Review title and meta description</span><em>On-page</em></div><div className="crox-dashboard-keyword-row"><span className="crox-dashboard-check"><Check size={11} /></span><span>Check internal links</span><em>Technical</em></div><div className="crox-dashboard-keyword-row"><span className="crox-dashboard-check pending" /><span>Review keyword opportunities</span><em>Research</em></div></div>
                </div>
              </div>
              <div className="crox-dashboard-bottom-note"><ShieldCheck size={13} /> Values shown here are illustrative, not live performance data.</div>
            </div>
            <div className="crox-home-floating-card crox-home-floating-task"><span className="crox-home-floating-icon"><ListChecks size={16} /></span><div><b>Clear next steps</b><small>Findings organized for action</small></div><ChevronRight size={15} /></div>
            <div className="crox-home-floating-card crox-home-floating-ai"><span className="crox-home-floating-icon violet"><Sparkles size={16} /></span><div><b>NOVA assistance</b><small>When an AI provider is configured</small></div></div>
          </div>
        </div>
      </section>

      <section className="crox-home-trust-strip" aria-label="CROX product principles"><span className="crox-home-strip-label">A CLEARER WAY TO WORK ON SEARCH</span><div><Search size={18} /><b>Search insights</b></div><div><ShieldCheck size={18} /><b>Transparent data</b></div><div><Target size={18} /><b>Practical priorities</b></div><div><Layers3 size={18} /><b>One workspace</b></div></section>

      <section className="crox-home-section crox-home-features" id="features">
        <div className="crox-home-section-intro"><div className="crox-home-section-kicker"><span /> THE CROX TOOLKIT</div><h2>Everything you need to work <span>smarter in search.</span></h2><p>From technical website checks to keyword discovery and AI-assisted workflows, CROX brings useful search work into one focused place.</p><a className="crox-home-text-link" href="#how-it-works" onClick={() => jumpTo('#how-it-works')}>See how it works <ArrowRight size={15} /></a></div>
        <div className="crox-home-feature-grid">{features.map(({ icon: Icon, title, text, id, color }, index) => <a className="crox-home-feature-card" href={index === 1 ? '#ai-insights' : '#product-preview'} onClick={() => jumpTo(index === 1 ? '#ai-insights' : '#product-preview')} key={title} id={id}><div className={`crox-home-feature-icon ${color}`}><Icon size={19} /></div><span className="crox-home-feature-arrow"><ArrowUpRight size={16} /></span><h3>{title}</h3><p>{text}</p><span className="crox-home-card-bottom">Explore capability <ArrowRight size={13} /></span></a>)}</div>
      </section>

      <section className="crox-home-ai-section" id="ai-insights">
        <div className="crox-home-ai-copy"><div className="crox-home-section-kicker"><span /> AI-ASSISTED WORKFLOWS</div><h2>Smarter data.<br /><span>Better decisions.</span></h2><p>Use CROX to organize site findings, understand potential improvements and turn technical signals into a more focused plan. AI responses depend on your configured provider.</p><button type="button" className="crox-home-dark-button" onClick={onSignUp}>Explore CROX <ArrowRight size={15} /></button></div>
        <div className="crox-home-ai-demo" aria-label="Illustrative AI recommendation and analytics preview">
          <div className="crox-home-ai-recommendation"><div className="crox-home-ai-card-top"><span className="crox-home-ai-avatar"><Sparkles size={15} /></span><b>Example recommendation</b><span className="crox-home-demo-pill">Illustrative</span></div><h3>Make the page topic clearer</h3><p>Review whether the page title, main heading and opening copy communicate the same search intent.</p><div className="crox-home-ai-action"><span><Check size={13} /> Suggested review</span><ArrowRight size={14} /></div></div>
          <div className="crox-home-insight-chart"><div><span>SEO task overview</span><b>Example view</b></div><div className="crox-home-insight-bars">{[36,52,44,69,58,79,64,88,72,95,76,86].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><small>Illustrative chart · no real site data</small></div>
        </div>
        <div className="crox-home-ai-benefits"><div><span className="crox-home-benefit-icon"><Compass size={18} /></span><div><b>Actionable direction</b><p>Turn findings into a shortlist of useful tasks.</p></div></div><div><span className="crox-home-benefit-icon"><Activity size={18} /></span><div><b>Visible limitations</b><p>See where live providers or account access are needed.</p></div></div><div><span className="crox-home-benefit-icon"><Zap size={18} /></span><div><b>Less busywork</b><p>Keep checks, notes and next steps together.</p></div></div></div>
      </section>

      <section className="crox-home-workflow" id="how-it-works"><div className="crox-home-centered-heading"><div className="crox-home-section-kicker"><span /> HOW CROX WORKS</div><h2>A clear path from a website to <span>your next step.</span></h2><p>Start with the information you have, then use the available tools to decide what to work on next.</p></div><div className="crox-home-workflow-grid">{workflow.map(({ icon: Icon, number, title, text }, index) => <React.Fragment key={number}><article className="crox-home-workflow-card"><span className="crox-home-step-number">{number}</span><div className={`crox-home-workflow-icon step-${index + 1}`}><Icon size={20} /></div><h3>{title}</h3><p>{text}</p></article>{index < workflow.length - 1 && <div className="crox-home-step-connector" aria-hidden="true"><ArrowRight size={17} /></div>}</React.Fragment>)}</div></section>

      <section className="crox-home-product-section" id="product-preview"><div className="crox-home-product-copy"><div className="crox-home-section-kicker"><span /> MADE FOR REAL WORKFLOWS</div><h2>Know what to fix.<br /><span>Know where to begin.</span></h2><p>Keep the essentials visible: site health checks, issue status, context for each finding and a place to continue your work.</p><div className="crox-home-product-benefit"><span><Check size={14} /></span><div><b>Review issues in context</b><p>See technical findings without wading through clutter.</p></div></div><div className="crox-home-product-benefit"><span><Check size={14} /></span><div><b>Prioritize practical improvements</b><p>Focus on fixes you can verify and apply to your site.</p></div></div><div className="crox-home-product-benefit"><span><Check size={14} /></span><div><b>Keep your project in one place</b><p>Return to your scans, notes and available tools.</p></div></div><button type="button" className="crox-home-outline-button" onClick={onSignUp}>Open your workspace <ArrowRight size={15} /></button></div>
        <div className="crox-home-product-preview"><div className="crox-home-product-preview-header"><div><span className="crox-home-product-status-dot" /><b>Site audit</b><small>Sample interface</small></div><button type="button" aria-label="Sign up to use the site audit workspace" onClick={onSignUp}><ArrowUpRight size={16} /></button></div><div className="crox-home-product-score"><div><span>Site health</span><b>—<small> awaiting scan</small></b><p>Run a scan to view your site's results.</p></div><div className="crox-home-empty-score"><FileSearch size={23} /></div></div><div className="crox-home-checklist-title"><b>Example checks</b><span>Preview only</span></div><div className="crox-home-check-item"><span className="status-green"><Check size={12} /></span><span><b>Page title</b><small>Check title presence and clarity</small></span><em>On-page</em></div><div className="crox-home-check-item"><span className="status-amber"><Activity size={12} /></span><span><b>Mobile performance</b><small>Requires a live performance check</small></span><em>Speed</em></div><div className="crox-home-check-item"><span className="status-blue"><Code2 size={12} /></span><span><b>Structured data</b><small>Validate relevant schema markup</small></span><em>Technical</em></div><div className="crox-home-preview-footer"><LockKeyhole size={12} /> Live results appear in your workspace after a scan.</div></div>
      </section>

      <section className="crox-home-data-approach" id="data-approach"><div className="crox-home-data-symbol"><ShieldCheck size={24} /></div><div><div className="crox-home-section-kicker"><span /> BUILT AROUND CLARITY</div><h2>Useful insight starts with honest context.</h2><p>CROX distinguishes illustrative interface examples from live results. Some search metrics require an external provider, and AI-assisted features depend on configuration. We do not promise rankings or traffic outcomes.</p></div><div className="crox-home-data-checks"><span><Check size={14} /> Demo values clearly labeled</span><span><Check size={14} /> Provider dependencies explained</span><span><Check size={14} /> No guaranteed ranking claims</span></div></section>

      <section className="crox-home-final-cta"><div className="crox-home-final-logo"><img src="/crox-mark.svg" width="43" height="43" alt="" aria-hidden="true" /></div><div className="crox-home-final-copy"><div className="crox-home-section-kicker">START WITH YOUR WEBSITE</div><h2>Make your next search decision with context.</h2><p>Create a CROX account to organize website scans, review insights and decide what to improve.</p></div><button type="button" className="crox-home-final-button" onClick={onSignUp}>Create your account <ArrowRight size={16} /></button></section>

      <footer className="crox-home-footer" id="footer"><div className="crox-home-footer-main"><div className="crox-home-footer-brand"><a href="#top" className="crox-home-brand" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><img src="/crox-mark.svg" width="35" height="35" alt="" aria-hidden="true" /><span>CROX</span></a><p>Search intelligence for clearer decisions.</p><span className="crox-home-footer-note">Built to make website and search work easier to understand.</span></div><div className="crox-home-footer-column"><b>Product</b><a href="#features" onClick={() => jumpTo('#features')}>Features</a><a href="#ai-insights" onClick={() => jumpTo('#ai-insights')}>AI-assisted workflows</a><a href="#product-preview" onClick={() => jumpTo('#product-preview')}>Product preview</a></div><div className="crox-home-footer-column"><b>Explore</b><a href="#how-it-works" onClick={() => jumpTo('#how-it-works')}>How it works</a><a href="#data-approach" onClick={() => jumpTo('#data-approach')}>Data approach</a><button type="button" onClick={onSignIn}>Log in</button></div><div className="crox-home-footer-cta"><b>Ready to get started?</b><p>Open your CROX workspace and explore the available tools.</p><button type="button" onClick={onSignUp}>Create account <ArrowRight size={14} /></button></div></div><div className="crox-home-footer-bottom"><span>© {new Date().getFullYear()} CROX. All rights reserved.</span><span>Search insights with transparent context.</span></div></footer>
    </main>
  );
};
