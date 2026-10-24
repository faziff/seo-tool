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
import { BrandMark } from './components/BrandMark';
import { NovaOrb } from './components/NovaOrb';

import { SiteAuditPage } from './pages/SiteAuditPage';
import { SEOAnalysisPage } from './pages/SEOAnalysisPage';
import { PerformancePage } from './pages/PerformancePage';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { TechnicalIssuesPage } from './pages/TechnicalIssuesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { KeywordResearchPage } from './pages/KeywordResearchPage';
import { MarketResearchPage } from './pages/MarketResearchPage';
import { FixesPage } from './pages/FixesPage';

import {
  startScan,
  getScanStatus,
  getScanReport,
  listRecentScans,
  logoutUser
} from './services/api';
import { ScanReport, ScanProgress, RecentScanItem, Issue, User } from './types';
import { Globe, ArrowRight, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [currentUser] = useState<User>({ id: 0, name: 'CROX Workspace', email: 'Local workspace', created_at: new Date().toISOString(), settings: {} });

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

  // Login is intentionally disabled for this build. The API supports anonymous scans.
  useEffect(() => {
    listRecentScans().then((scans) => {
      setRecentScans(scans);
      if (scans.length > 0) getScanReport(scans[0].id).then(setReport).catch(() => {});
    }).catch(() => {});
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);


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

  const handleLogout = async () => {
    await logoutUser();
    setIsAIOpen(false);
    setIsCompareOpen(false);
    setSelectedIssue(null);
    setReport(null);
    setRecentScans([]);
    setCurrentTab('overview');
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col antialiased font-sans">
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
            user={currentUser}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenAI={() => setIsAIOpen(true)}
            onOpenAuth={() => setCurrentTab('settings')}
            onLogout={handleLogout}
            onOpenSettings={() => setCurrentTab('settings')}
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

            {currentTab === 'fixes' && <FixesPage report={report} onRunAudit={focusScannerInput} />}

            {currentTab === 'keyword-research' && <KeywordResearchPage />

            {currentTab === 'market-research' && <MarketResearchPage />}

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

            {currentTab === 'settings' && (
              <SettingsPage
                user={currentUser}
                onLogout={handleLogout}
                onOpenAuth={() => setCurrentTab('overview')}
              />
            )}
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
