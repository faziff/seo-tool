import { AuditIssue } from './seo_audit.js';

export interface CategoryScoreResult {
  score: number;
  status: 'Good' | 'Fair' | 'Poor';
  passed_checks: number;
  warning_checks: number;
  critical_checks: number;
  issues_count: number;
}

export interface ScoreReport {
  health_score: number;
  technical_score: number;
  performance_score: number;
  accessibility_score: number;
  seo_score: number;
  severity_counts: {
    Critical: number;
    High: number;
    Medium: number;
    Low: number;
  };
  category_scores: Record<string, CategoryScoreResult>;
}

export class ScoringEngine {
  public static calculate(
    issues: AuditIssue[],
    totalPages: number,
    passedChecks: string[]
  ): ScoreReport {
    const safePages = Math.max(1, totalPages);

    const severityCounts = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    };

    const categoryIssues: Record<string, AuditIssue[]> = {
      SEO: [],
      Technical: [],
      Performance: [],
      Accessibility: [],
      Crawlability: []
    };

    issues.forEach(issue => {
      if (severityCounts[issue.severity] !== undefined) {
        severityCounts[issue.severity]++;
      }
      if (categoryIssues[issue.category]) {
        categoryIssues[issue.category].push(issue);
      } else {
        categoryIssues[issue.category] = [issue];
      }
    });

    const calculateDeduction = (issueList: AuditIssue[]): number => {
      let penalty = 0;
      for (const issue of issueList) {
        const pageRatio = Math.min(1, issue.pages_affected / safePages);
        let weight = 4;
        if (issue.severity === 'Critical') weight = 15;
        else if (issue.severity === 'High') weight = 8;
        else if (issue.severity === 'Medium') weight = 4;
        else if (issue.severity === 'Low') weight = 1.5;

        penalty += weight * (0.6 + 0.4 * pageRatio);
      }
      return penalty;
    };

    const computeCategory = (catName: string): CategoryScoreResult => {
      const catIssues = categoryIssues[catName] || [];
      const penalty = calculateDeduction(catIssues);
      const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
      const criticalCount = catIssues.filter(i => i.severity === 'Critical').length;
      const warningCount = catIssues.filter(i => i.severity === 'High' || i.severity === 'Medium').length;

      return {
        score,
        status: score >= 85 ? 'Good' : score >= 60 ? 'Fair' : 'Poor',
        passed_checks: passedChecks.length,
        warning_checks: warningCount,
        critical_checks: criticalCount,
        issues_count: catIssues.length
      };
    };

    const technicalScore = computeCategory('Technical').score;
    const seoScore = computeCategory('SEO').score;
    const perfScore = computeCategory('Performance').score;
    const a11yScore = computeCategory('Accessibility').score;
    const crawlScore = computeCategory('Crawlability').score;

    // Overall Technical Health Score (weighted average of categories)
    const overallScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          seoScore * 0.35 +
          technicalScore * 0.25 +
          crawlScore * 0.15 +
          perfScore * 0.15 +
          a11yScore * 0.10
        )
      )
    );

    const categoryScores: Record<string, CategoryScoreResult> = {
      'Technical SEO': computeCategory('Technical'),
      'On-Page SEO': computeCategory('SEO'),
      'Performance': computeCategory('Performance'),
      'Accessibility': computeCategory('Accessibility'),
      'Crawlability': computeCategory('Crawlability')
    };

    return {
      health_score: overallScore,
      technical_score: technicalScore,
      performance_score: perfScore,
      accessibility_score: a11yScore,
      seo_score: seoScore,
      severity_counts: severityCounts,
      category_scores: categoryScores
    };
  }
}
