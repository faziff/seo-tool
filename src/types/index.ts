export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type IssueCategory = 'SEO' | 'Technical' | 'Performance' | 'Accessibility' | 'Crawlability';

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
  settings?: Record<string, any>;
}

export interface Issue {
  id: string;
  rule_id: string;
  title: string;
  category: IssueCategory;
  type?: IssueCategory;
  severity: Severity;
  pages_affected: number;
  affected_url: string;
  evidence: string;
  explanation: string;
  recommendation: string;
  suggested_fix?: string;
  verification?: string;
  resolved: boolean;
  created_at: string;
}

export interface ScannedPage {
  id: number;
  url: string;
  status_code: number | null;
  response_time_ms: number;
  content_type: string;
  title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  h1_count: number;
  word_count: number;
  is_indexable: boolean;
}

export interface CategoryScore {
  score: number;
  status: string;
  passed_checks: number;
  warning_checks: number;
  critical_checks: number;
  issues_count: number;
}

export interface ScanReport {
  scan_id: string;
  target_url: string;
  domain: string;
  status: 'pending' | 'crawling' | 'analyzing' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
  duration_seconds: number;
  health_score: number;
  technical_score: number;
  performance_score: number;
  accessibility_score: number;
  seo_score: number;
  pages_crawled: number;
  total_urls_found: number;
  redirects_found: number;
  broken_links_found: number;
  issues: Issue[];
  pages: ScannedPage[];
  passed_checks: string[];
  passed_checks_count: number;
  warning_checks_count: number;
  critical_checks_count: number;
  total_checks_count: number;
  severity_counts: {
    Critical: number;
    High: number;
    Medium: number;
    Low: number;
  };
  category_scores: {
    [key: string]: CategoryScore;
  };
}

export interface ScanProgress {
  scan_id: string;
  target_url: string;
  domain: string;
  status: string;
  progress: number;
  current_action: string;
  pages_crawled: number;
  total_urls_found: number;
  redirects_found: number;
  broken_links_found: number;
  health_score: number;
  duration_seconds: number;
  error_message?: string;
}

export interface RecentScanItem {
  id: string;
  domain: string;
  target_url: string;
  status: string;
  health_score: number;
  pages_crawled: number;
  created_at: string;
  completed_at?: string;
}


export type FixStatus = 'draft' | 'approved' | 'rejected';

export interface FixDraft {
  id: string;
  scan_id: string;
  issue_id: string;
  issue_title: string;
  category: IssueCategory;
  severity: Severity;
  affected_url: string;
  evidence: string;
  recommendation: string;
  fix_explanation: string;
  code_snippet: string;
  status: FixStatus;
  generated_by: 'gemini' | 'fallback';
  created_at: string;
  updated_at: string;
}
