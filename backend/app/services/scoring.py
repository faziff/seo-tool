from typing import List, Dict, Any
from backend.app.services.seo_audit import DetectedIssue


class ScoringEngine:
    """
    Transparent, documented scoring methodology.
    Base score: 100
    Severity Deductions:
      - Critical: -15 points
      - High: -7 points
      - Medium: -3 points
      - Low: -1 point
    Category weights for Overall Health Score:
      - Technical SEO: 30%
      - On-page SEO: 35%
      - Performance: 20%
      - Accessibility: 15%
    """

    SEVERITY_WEIGHTS = {
        "Critical": 15,
        "High": 7,
        "Medium": 3,
        "Low": 1
    }

    @classmethod
    def calculate_category_score(cls, issues: List[DetectedIssue], category: str) -> Dict[str, Any]:
        cat_issues = [i for i in issues if i.category.lower() == category.lower()]
        deductions = sum(cls.SEVERITY_WEIGHTS.get(i.severity, 2) for i in cat_issues)
        score = max(10, min(100, 100 - deductions))

        critical_count = len([i for i in cat_issues if i.severity == "Critical"])
        warning_count = len([i for i in cat_issues if i.severity in ("High", "Medium", "Low")])

        # Benchmark estimate of passed checks in this category
        estimated_passed = max(0, 10 - len(cat_issues))

        if score >= 80:
            status = "Good"
        elif score >= 60:
            status = "Moderate"
        else:
            status = "Action Required"

        return {
            "score": score,
            "status": status,
            "passed_checks": estimated_passed,
            "warning_checks": warning_count,
            "critical_checks": critical_count,
            "issues_count": len(cat_issues)
        }

    @classmethod
    def calculate_scores(cls, issues: List[DetectedIssue], pages_count: int, passed_checks: List[str] = None) -> Dict[str, Any]:
        if pages_count == 0:
            return {
                "health_score": 0,
                "technical_score": 0,
                "seo_score": 0,
                "performance_score": 0,
                "accessibility_score": 0,
                "category_scores": {},
                "passed_checks_count": 0,
                "warning_checks_count": 0,
                "critical_checks_count": 0,
                "total_checks_count": 0
            }

        tech = cls.calculate_category_score(issues, "Technical")
        seo = cls.calculate_category_score(issues, "SEO")
        perf = cls.calculate_category_score(issues, "Performance")
        acc = cls.calculate_category_score(issues, "Accessibility")

        health = int(
            tech["score"] * 0.30 +
            seo["score"] * 0.35 +
            perf["score"] * 0.20 +
            acc["score"] * 0.15
        )

        critical_total = len([i for i in issues if i.severity == "Critical"])
        warning_total = len([i for i in issues if i.severity in ("High", "Medium")])
        passed_count = len(passed_checks) if passed_checks is not None else (tech["passed_checks"] + seo["passed_checks"] + perf["passed_checks"] + acc["passed_checks"])

        return {
            "health_score": max(5, min(100, health)),
            "technical_score": tech["score"],
            "seo_score": seo["score"],
            "performance_score": perf["score"],
            "accessibility_score": acc["score"],
            "category_scores": {
                "Technical SEO": tech,
                "Performance": perf,
                "Accessibility": acc,
                "SEO Opportunities": seo,
            },
            "passed_checks_count": passed_count,
            "warning_checks_count": warning_total,
            "critical_checks_count": critical_total,
            "total_checks_count": passed_count + len(issues)
        }
