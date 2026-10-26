import React from 'react';
import {
  ArrowDownRight, ArrowRight, BarChart3, Check, ChevronRight, CircleGauge,
  Code2, Compass, FileSearch, Globe, Layers3, ListChecks, LockKeyhole,
  Search, ShieldCheck, Sparkles, Target, TrendingUp, Zap
} from 'lucide-react';
import { BrandMark } from './BrandMark';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

const features = [
  { icon: Globe, title: 'Technical site audits', text: 'Crawl public pages and surface broken links, metadata gaps, indexability signals and structural issues.' },
  { icon: Search, title: 'Keyword discovery', text: 'Turn a seed topic into keyword ideas, search intent labels and useful topic clusters.' },
  { icon: CircleGauge, title: 'Site health overview', text: 'Bring core SEO, technical, performance and accessibility signals into one readable report.' },
  { icon: Compass, title: 'Competitor snapshots', text: 'Compare public homepage signals and identify areas that deserve a deeper investigation.' },
  { icon: ListChecks, title: 'Actionable checklists', text: 'See what was found, what needs attention and a practical next step for each check.' },
  { icon: Sparkles, title: 'NOVA assistant', text: 'Get help interpreting findings and drafting improvements, with AI availability depending on setup.' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onSignUp }) => (
  <main className="crox-landing">
    <div className="crox-landing-glow crox-landing-glow-a" />
    <div className="crox-landing-glow crox-landing-glow-b" />
    <header className="crox-landing-nav">
      <button type="button" className="crox-brand-lockup" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="CROX home">
        <BrandMark size={39} /><span>CROX</span><span className="crox-brand-divider" /><span className="crox-brand-tagline">SEARCH INTELLIGENCE</span>
      </button>
      <nav className="crox-landing-links" aria-label="Main navigation">
        <a href="#platform">Platform</a><a href="#workflow">How it works</a><a href="#principles">Our approach</a>
      </nav>
      <div className="crox-landing-actions">
        <button type="button" className="crox-landing-signin" onClick={onSignIn}>Sign in</button>
        <button type="button" className="crox-landing-cta crox-landing-cta-small" onClick={onSignUp}>Start free <ArrowRight size={15} /></button>
      </div>
    </header>

    <section className="crox-landing-hero">
      <div className="crox-landing-copy">
        <div className="crox-landing-eyebrow"><span className="crox-live-dot" /> A focused workspace for search growth</div>
        <h1>See what is holding your site back. <span>Know what to do next.</span></h1>
        <p className="crox-landing-lede">CROX brings technical audits, keyword ideas and practical next steps into one clear workspace—so you can move from scattered SEO tasks to a focused plan.</p>
        <div className="crox-landing-hero-actions">
          <button type="button" className="crox-landing-cta" onClick={onSignUp}>Create your free workspace <ArrowRight size={17} /></button>
          <a href="#platform" className="crox-landing-secondary">Explore the platform <ArrowDownRight size={16} /></a>
        </div>
        <div className="crox-landing-proof"><span><Check size={14} /> Start without a credit card</span><span><ShieldCheck size={14} /> Your account, your workspace</span></div>
      </div>

      <div className="crox-landing-preview" aria-label="Illustrative CROX dashboard preview">
        <div className="crox-preview-window">
          <div className="crox-preview-top"><div className="crox-preview-dots"><i /><i /><i /></div><div className="crox-preview-address"><LockKeyhole size={11} /> app.crox.local / overview</div><span className="crox-preview-avatar">C</span></div>
          <div className="crox-preview-body">
            <aside className="crox-preview-side"><div className="crox-preview-brand"><BrandMark size={23} /><b>CROX</b></div><span className="active"><BarChart3 size={13} /> Overview</span><span><Globe size={13} /> Site audit</span><span><Search size={13} /> Keywords</span><span><ListChecks size={13} /> Checklist</span><span><Sparkles size={13} /> NOVA</span><div className="crox-preview-side-bottom"><span>DAILY CREDITS</span><b>18 <small>remaining</small></b><i /></div></aside>
            <div className="crox-preview-main">
              <div className="crox-preview-title-row"><div><small>WORKSPACE OVERVIEW</small><h3>Search health snapshot</h3><p>Sample interface preview · illustrative data</p></div><span className="crox-preview-range">Last scan <ChevronRight size={12} /></span></div>
              <div className="crox-preview-score-card"><div className="crox-preview-score-label"><span>Site health</span><span className="crox-preview-chip"><TrendingUp size={11} /> Demo</span></div><div className="crox-preview-score-row"><b>86</b><span>/100</span><div className="crox-preview-ring"><span>86</span></div></div><div className="crox-preview-track"><i /></div><small>Illustrative score, not a live website result</small></div>
              <div className="crox-preview-stats"><div><span><FileSearch size={12} /> Pages crawled</span><b>24</b><small>Example metric</small></div><div><span><Zap size={12} /> Needs attention</span><b>07</b><small>Example metric</small></div><div><span><Target size={12} /> Keyword ideas</span><b>128</b><small>Example metric</small></div></div>
              <div className="crox-preview-chart"><div><b>Audit activity</b><small>Illustrative visual</small></div><div className="crox-preview-bars">{[35,48,42,62,52,78,65,88,72,100,82,91].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></div>
            </div>
          </div>
        </div>
        <div className="crox-preview-float crox-preview-float-a"><span className="crox-preview-float-icon"><ListChecks size={16} /></span><div><b>Clear next steps</b><small>Findings → action plan</small></div><Check size={15} /></div>
        <div className="crox-preview-float crox-preview-float-b"><span className="crox-preview-float-icon mint"><Sparkles size={16} /></span><div><b>NOVA insights</b><small>Guidance when enabled</small></div></div>
      </div>
    </section>

    <section className="crox-landing-strip" aria-label="Platform focus areas"><span>BUILT AROUND THE WORK THAT MATTERS</span><div><i /><b>Technical clarity</b></div><div><i /><b>Search intent</b></div><div><i /><b>Useful next steps</b></div><div><i /><b>Honest data labels</b></div></section>

    <section className="crox-landing-section" id="platform">
      <div className="crox-landing-section-heading"><div className="crox-landing-section-kicker">THE CROX TOOLKIT</div><h2>Less guessing. <span>More direction.</span></h2><p>Tools that help you understand what a site is doing, spot opportunities and decide what to work on first.</p></div>
      <div className="crox-landing-features">{features.map(({ icon: Icon, title, text }, index) => <article className="crox-landing-feature" key={title}><div className="crox-landing-feature-head"><span className={`crox-landing-feature-icon feature-${index + 1}`}><Icon size={19} /></span><span className="crox-landing-feature-number">0{index + 1}</span></div><h3>{title}</h3><p>{text}</p><div className="crox-landing-feature-line" /></article>)}</div>
    </section>

    <section className="crox-landing-workflow" id="workflow"><div className="crox-landing-workflow-heading"><div className="crox-landing-section-kicker">A SIMPLE WORKFLOW</div><h2>From a URL to a <span>clearer plan.</span></h2><p>Keep the process understandable, with findings and limitations visible.</p></div><div className="crox-workflow-steps"><article><span>01</span><Layers3 size={21} /><h3>Bring your site</h3><p>Enter a public URL and let CROX inspect the pages it can reach within the scan limit.</p></article><div className="crox-workflow-connector" /><article><span>02</span><FileSearch size={21} /><h3>Review the signals</h3><p>Explore technical checks, page-level metadata, accessibility signals and keyword ideas.</p></article><div className="crox-workflow-connector" /><article><span>03</span><Target size={21} /><h3>Choose your next move</h3><p>Use the checklist and recommendations to prioritize fixes instead of chasing every metric.</p></article></div></section>

    <section className="crox-landing-principles" id="principles"><div className="crox-principles-symbol"><Code2 size={26} /></div><div><div className="crox-landing-section-kicker">BUILT FOR CLARITY</div><h2>Clear about what the data does—and doesn’t—say.</h2><p>Some results use local rules and estimates; live search volume, backlink indexes and AI-assisted features depend on configured providers. CROX labels those limits so an estimate is not mistaken for verified market data.</p></div><div className="crox-principle-checks"><span><Check size={15} /> No fake live metrics</span><span><Check size={15} /> Provider availability is visible</span><span><Check size={15} /> Findings linked to practical fixes</span></div></section>

    <section className="crox-landing-final-cta"><div className="crox-landing-final-mark"><BrandMark size={41} /></div><div><div className="crox-landing-section-kicker">YOUR NEXT STEP STARTS HERE</div><h2>Make your next SEO decision with context.</h2><p>Create a workspace and start with the information you already have.</p></div><button type="button" className="crox-landing-cta" onClick={onSignUp}>Get started with CROX <ArrowRight size={17} /></button></section>

    <footer className="crox-landing-footer"><div className="crox-brand-lockup"><BrandMark size={30} /><span>CROX</span></div><span>Independent search intelligence workspace</span><button type="button" onClick={onSignIn}>Sign in <ArrowRight size={13} /></button><small>© {new Date().getFullYear()} CROX. All rights reserved.</small></footer>
  </main>
);
