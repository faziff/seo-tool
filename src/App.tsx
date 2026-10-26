import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ScannerHero } from './components/ScannerHero';
import { EmptyDashboard } from './components/EmptyDashboard';
import { HealthScoreCard } from './components/HealthScoreCard';
import { CrawlStatsCard } from './components/CrawlStatsCard';
import { TopIssuesTable } from './components/TopIssuesTable';
import { RecentActivity } from './components/RecentActivity';
import { IssueDetailModal } from './components/IssueDetailModal';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { CompareScansModal } from './components/CompareScansModal';
import { FixCenterPage } from './pages/FixCenterPage';
import { NovaOrb } from './components/NovaOrb';
import { BrandMark } from './components/BrandMark';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { AuditChecklistPage } from './pages/AuditChecklistPage';

import { SiteAuditPage } from './pages/SiteAuditPage';
import { SEOAnalysisPage } from './pages/SEOAnalysisPage';
import { PerformancePage } from './pages/PerformancePage';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { TechnicalIssuesPage } from './pages/TechnicalIssuesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { KeywordResearchPage } from './pages/KeywordResearchPage';
import { MarketResearchPage } from './pages/MarketResearchPage';

import {
  startScan,
  getScanStatus,
  getScanReport,
  listRecentScans,
  fetchCurrentUser,
  fetchCreditSnapshot,
  logoutUser,
} from './services/api';
import { ScanReport, ScanProgress, RecentScanItem, Issue, User, CreditSnapshot } from './types';
import { Globe, ArrowRight, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [pagePath, setPagePath] = useState<string>(() => window.location.pathname || '/');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [credits, setCredits] = useState<CreditSnapshot | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('crox_theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [report, setReport] = useState<ScanReport | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  // Modals & Drawers
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Reference for polling cleanup
  const pollIntervalRef = useRef<any>(null);

  const navigate = (path: string, replace = false) => {
    if (window.location.pathname !== path) {
      if (replace) window.history.replaceState({}, '', path);
      else window.history.pushState({}, '', path);
    }
    setPagePath(path);
  };

  const refreshCredits = async () => {
    try { setCredits(await fetchCreditSnapshot()); }
    catch { setCredits(null); }
  };

  // Restore the signed-in workspace on reload. Private dashboard routes stay behind auth.
  useEffect(() => {
    let active = true;
    const onPopState = () => setPagePath(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    document.documentElement.dataset.theme = theme;
    fetchCurrentUser().then(async (user) => {
      if (!active) return;
      setCurrentUser(user);
      setAuthReady(true);
      const requestedPath = window.location.pathname || '/';
      if (user) {
        if (requestedPath === '/' || requestedPath === '/login' || requestedPath === '/signup' || requestedPath === '/register') {
          window.history.replaceState({}, '', '/app');
          setPagePath('/app');
        }
        void loadUserScans();
        void refreshCredits();
      } else {
        setCredits(null);
        if (requestedPath === '/app' || requestedPath.startsWith('/app/')) {
          window.history.replaceState({}, '', '/login');
          setPagePath('/login');
        }
      }
    }).catch(() => {
      if (active) setAuthReady(true);
    });
    return () => {
      active = false;
      window.removeEventListener('popstate', onPopState);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('crox_theme', theme); } catch { /* storage can be unavailable in private browsing */ }
  }, [theme]);

  useEffect(() => {
    const onCreditRefresh = () => { if (currentUser) void refreshCredits(); };
    window.addEventListener('crox:credits-refresh', onCreditRefresh);
    return () => window.removeEventListener('crox:credits-refresh', onCreditRefresh);
  }, [currentUser]);

  useEffect(() => {
    if (authReady && !currentUser && (pagePath === '/app' || pagePath.startsWith('/app/'))) navigate('/login', true);
    if (authReady && currentUser && (pagePath === '/' || pagePath === '/login' || pagePath === '/signup' || pagePath === '/register')) navigate('/app', true);
  }, [authReady, currentUser, pagePath]);

  useEffect(() => {
    const handleWorkspaceSearch = (event: Event) => {
      const query = String((event as CustomEvent<{ query?: string }>).detail?.query || '').trim().toLowerCase();
      if (!query) return;
      const matchingScan = recentScans.find((scan) => `${scan.domain} ${scan.target_url}`.toLowerCase().includes(query));
      if (matchingScan) {
        void handleSelectScan(matchingScan.id);
        return;
      }
      const tools: Array<{ terms: string[]; tab: string }> = [
        { terms: ['fix', 'fix center', 'remediation', 'autofix'], tab: 'fix-center' },
        { terms: ['keyword', 'keywords'], tab: 'keyword-research' },
        { terms: ['market', 'competitor'], tab: 'market-research' },
        { terms: ['performance', 'speed', 'core web vitals'], tab: 'performance' },
        { terms: ['accessibility', 'wcag'], tab: 'accessibility' },
        { terms: ['technical', 'broken link'], tab: 'technical' },
        { terms: ['report', 'export'], tab: 'reports' },
        { terms: ['setting', 'integration', 'api key'], tab: 'settings' },
        { terms: ['seo', 'metadata', 'title tag'], tab: 'seo-analysis' },
        { terms: ['site audit', 'crawl', 'pages'], tab: 'site-audit' },
        { terms: ['checklist', 'page checks', 'on-page checks'], tab: 'audit-checklist' }
      ];
      const match = tools.find((tool) => tool.terms.some((term) => term.includes(query) || query.includes(term)));
      if (match) setCurrentTab(match.tab);
      else setScanError(`No scan or tool matched “${query}”. Try a domain name or a tool such as Fix Center, Keywords, Reports, or Settings.`);
    };
    window.addEventListener('crox:search', handleWorkspaceSearch);
    return () => window.removeEventListener('crox:search', handleWorkspaceSearch);
  }, [recentScans]);

  const loadUserScans = async () => {
    try {
      const scans = await listRecentScans();
      setRecentScans(scans);
      if (scans.length > 0 && !report) {
        // Load the most recent scan report for this workspace
        const latest = await getScanReport(scans[0].id);
        setReport(latest);
      }
    } catch {
      // Ignore if no scans
    }
  };

  const focusScannerInput = () => {
    setCurrentTab('overview');
    setTimeout(() => {
      const inputEl = document.querySelector('input[placeholder="Enter your website URL or domain"]') as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleStartScan = async (url: string) => {
    setScanError(null);

    setIsScanning(true);
    setScanProgress({
      scan_id: '',
      target_url: url,
      domain: url.replace(/^https?:\/\//, '').split('/')[0],
      status: 'pending',
      progress: 5,
      current_action: 'Validating domain and SSRF restrictions...',
      pages_crawled: 0,
      total_urls_found: 0,
      redirects_found: 0,
      broken_links_found: 0,
      health_score: 0,
      duration_seconds: 0
    });

    try {
      const initial = await startScan(url, 50);
      window.dispatchEvent(new Event('crox:credits-refresh'));
      setScanProgress(initial);

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      // Poll until crawl and audit complete
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await getScanStatus(initial.scan_id);
          setScanProgress(status);

          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setIsScanning(false);

            if (status.status === 'completed') {
              const fullReport = await getScanReport(initial.scan_id);
              setReport(fullReport);
              setCurrentTab('overview');
              window.dispatchEvent(new Event('crox:credits-refresh'));

              // Refresh user scans
              listRecentScans().then((scans) => {
                if (scans.length > 0) setRecentScans(scans);
              });
            } else if (status.status === 'failed') {
              setScanError(status.current_action || 'Scan failed to complete. Please verify the domain is publicly reachable.');
            }
          }
        } catch (pollErr: any) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setIsScanning(false);
          setScanError('Connection interrupted while monitoring scan progress.');
        }
      }, 1500);
    } catch (err: any) {
      setIsScanning(false);
      setScanProgress(null);
      setScanError(err.message || 'Failed to start website scan.');
    }
  };

  const handleSelectScan = async (scanId: string) => {
    try {
      const loadedReport = await getScanReport(scanId);
      setReport(loadedReport);
      setCurrentTab('overview');
    } catch (err) {
      console.error(err);
    }
  };

  const handleIssueStatusChanged = (issueId: string, resolved: boolean) => {
    if (!report) return;
    setReport((prev) =>
      prev
        ? {
            ...prev,
            issues: prev.issues.map((i) => (i.id === issueId ? { ...i, resolved } : i))
          }
        : null
    );
    if (selectedIssue && selectedIssue.id === issueId) {
      setSelectedIssue((prev) => (prev ? { ...prev, resolved } : null));
    }
  };


  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setAuthReady(true);
    setCredits(user.credits || null);
    setCurrentTab('overview');
    setReport(null);
    setRecentScans([]);
    navigate('/app', true);
    void loadUserScans();
    void refreshCredits();
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setCredits(null);
    setReport(null);
    setRecentScans([]);
    setCurrentTab('overview');
    navigate('/login', true);
  };

  // Render subpage empty state when no scan exists
  const renderEmptySubpage = (title: string, desc: string) => (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto space-y-4 shadow-xs my-8">
      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
        <Globe className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      <button
        onClick={focusScannerInput}
        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors"
      >
        <span>Run Website Audit</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  if (!authReady) {
    return <div className="crox-loading-screen"><BrandMark size={46} /><span>Preparing your CROX workspace…</span></div>;
  }

  if (!currentUser) {
    const initialMode = pagePath === '/signup' || pagePath === '/register' ? 'register' : 'login';
    if (pagePath === '/login' || pagePath === '/signup' || pagePath === '/register') {
      return <AuthPage key={pagePath} initialMode={initialMode} onSuccess={handleAuthSuccess} onModeChange={mode => navigate(mode === 'register' ? '/signup' : '/login', true)} />;
    }
    return <LandingPage onSignIn={() => navigate('/login')} onSignUp={() => navigate('/signup')} />;
  }

  return (
    <div className={`crox-theme-root crox-theme-${theme} min-h-screen bg-[#F8FAFC] flex flex-col antialiased font-sans`} data-theme={theme}>

      <div className="flex-1 flex w-full">
        {/* Left Sidebar Navigation Rail */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          recentScans={recentScans}
          onSelectScan={handleSelectScan}
          activeScanId={report?.scan_id}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          hasActiveReport={!!report}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar Header */}
          <Header
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenAI={() => setIsAIOpen(true)}
            onOpenSettings={() => setCurrentTab('settings')}
            onToggleTheme={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}
            onLogout={handleLogout}
            theme={theme}
            userName={currentUser.name}
            credits={credits}
          />

          {/* Viewport Content */}
          <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
            {/* Scan Error Banner */}
            {scanError && (
              <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start justify-between gap-3 text-rose-900 text-xs animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-800">Scan Notice</p>
                    <p className="text-rose-700 mt-0.5">{scanError}</p>
                  </div>
                </div>
                <button
                  onClick={() => setScanError(null)}
                  className="text-rose-400 hover:text-rose-700 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {currentTab === 'overview' && (
              <>
                {/* Center Hero Scanner and Quick Actions */}
                <ScannerHero
                  onStartScan={handleStartScan}
                  isScanning={isScanning}
                  scanProgress={scanProgress}
                  onOpenReports={() => setCurrentTab('reports')}
                  onOpenCompare={() => setIsCompareOpen(true)}
                  onOpenAI={() => setIsAIOpen(true)}
                  onQuickAudit={focusScannerInput}
                />

                {/* If no report is loaded, show clean onboarding empty dashboard */}
                {!report ? (
                  <EmptyDashboard onFocusScanner={focusScannerInput} />
                ) : (
                  <>
                    {/* Second Row: Health Score & 4 Category Cards (Left) | Crawl Statistics (Right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-8">
                        <HealthScoreCard
                          report={report}
                          onViewCategory={(cat) => {
                            if (cat === 'technical') setCurrentTab('technical');
                            else if (cat === 'performance') setCurrentTab('performance');
                            else if (cat === 'accessibility') setCurrentTab('accessibility');
                            else if (cat === 'seo') setCurrentTab('seo-analysis');
                          }}
                        />
                      </div>
                      <div className="lg:col-span-4">
                        <CrawlStatsCard
                          report={report}
                          recentScans={recentScans}
                          onViewDetails={() => setCurrentTab('site-audit')}
                        />
                      </div>
                    </div>

                    {/* Third Row: Top Issues (Left) | Recent Activity (Right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-8">
                        <TopIssuesTable
                          issues={report.issues}
                          onSelectIssue={(iss) => setSelectedIssue(iss)}
                          onViewAllIssues={() => setCurrentTab('technical')}
                        />
                      </div>
                      <div className="lg:col-span-4">
                        <RecentActivity
                          report={report}
                          recentScans={recentScans}
                          onViewAllActivity={() => setCurrentTab('reports')}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {currentTab === 'site-audit' && (
              report ? (
                <SiteAuditPage report={report} />
              ) : (
                renderEmptySubpage(
                  'No Crawled Pages Available',
                  'Run an audit on your website domain to inspect HTTP status codes, canonical URLs, and indexability.'
                )
              )
            )}

            {currentTab === 'audit-checklist' && (
              report ? <AuditChecklistPage report={report} /> : renderEmptySubpage(
                'Run a scan to build your checklist',
                'CROX creates page-level checks for titles, descriptions, headings, canonical URLs, alt text, structured data, social tags and HTTPS.'
              )
            )}

            {currentTab === 'seo-analysis' && (
              report ? (
                <SEOAnalysisPage report={report} />
              ) : (
                renderEmptySubpage(
                  'No SEO Analysis Available',
                  'Scan a website to audit title tags, meta descriptions, H1 headings, content length, and OpenGraph tags.'
                )
              )
            )}

            {currentTab === 'keyword-research' && <KeywordResearchPage />}

            {currentTab === 'market-research' && <MarketResearchPage />}

            {currentTab === 'fix-center' && (
              <FixCenterPage report={report} onFocusScanner={focusScannerInput} />
            )}

            {currentTab === 'performance' && (
              report ? (
                <PerformancePage report={report} />
              ) : (
                renderEmptySubpage(
                  'No Performance Metrics Available',
                  'Analyze page TTFB (Time to First Byte) and Google Core Web Vitals by entering a website URL.'
                )
              )
            )}

            {currentTab === 'accessibility' && (
              report ? (
                <AccessibilityPage report={report} />
              ) : (
                renderEmptySubpage(
                  'No Accessibility Findings Available',
                  'Check missing image alt texts, viewport configuration, and document language declaration across your site.'
                )
              )
            )}

            {currentTab === 'technical' && (
              report ? (
                <TechnicalIssuesPage
                  report={report}
                  onSelectIssue={(iss) => setSelectedIssue(iss)}
                  onQuickResolve={handleIssueStatusChanged}
                />
              ) : (
                renderEmptySubpage(
                  'No Technical Issues Logged',
                  'Audit your site to detect broken links, redirect chains, structured data problems, and mixed content.'
                )
              )
            )}

            {currentTab === 'content' && (
              report ? (
                <SEOAnalysisPage report={report} />
              ) : (
                renderEmptySubpage(
                  'No Content Opportunities Identified',
                  'Perform a website crawl to detect thin content pages, missing descriptions, and heading hierarchy issues.'
                )
              )
            )}

            {currentTab === 'ai-assistant' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs text-center space-y-4 max-w-xl mx-auto my-8">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                  <NovaOrb size={35} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">NOVA AI Assistant</h2>
                <p className="text-xs text-slate-600">
                  {report
                    ? `Open the interactive copilot drawer to analyze findings for ${report.domain}, generate custom metadata, and get step-by-step remediation advice.`
                    : 'NOVA analyzes your audit context and helps generate code fixes, metadata, content briefs, and step-by-step SEO recommendations.'}
                </p>
                <button
                  onClick={() => setIsAIOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors"
                >
                  Open NOVA Copilot
                </button>
              </div>
            )}

            {currentTab === 'reports' && (
              <ReportsPage
                currentReport={report}
                recentScans={recentScans}
                onSelectScan={handleSelectScan}
                onOpenCompare={() => setIsCompareOpen(true)}
                onFocusScanner={focusScannerInput}
              />
            )}

            {currentTab === 'settings' && <SettingsPage />}
          </main>
        </div>
      </div>

      {/* Slide-out / Modal Dialogs */}
      <IssueDetailModal
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onStatusChanged={handleIssueStatusChanged}
      />

      <AIAssistantDrawer
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        report={report}
      />

      <CompareScansModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        recentScans={recentScans}
        currentReport={report}
      />

    </div>
  );
}
