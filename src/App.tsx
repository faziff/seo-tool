import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
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
import { WorkspaceHome } from './components/WorkspaceHome';
import { ModulePreviewPage } from './components/ModulePreviewPage';
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
  listProjects,
  createProject as createProjectRequest,
} from './services/api';
import { ScanReport, ScanProgress, RecentScanItem, Issue, User, CreditSnapshot, Project } from './types';
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
  const [projects, setProjects] = useState<Project[]>([]);
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
        if (requestedPath === '/login' || requestedPath === '/signup' || requestedPath === '/register') {
          window.history.replaceState({}, '', '/app');
          setPagePath('/app');
