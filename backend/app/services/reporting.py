import csv
import io
from typing import List, Dict, Any, Optional
from backend.app.models.entities import Scan, Issue


class ReportingService:
    @staticmethod
    def generate_csv_report(scan: Scan, issues: List[Issue]) -> str:
        """
        Generates RFC-4180 compliant CSV export containing audit issues and evidence.
        """
        output = io.StringIO()
        writer = csv.writer(output)

        # Header metadata
        writer.writerow(["# CROX Website Audit Report"])
        writer.writerow(["# Domain", scan.website.domain if scan.website else "Unknown"])
        writer.writerow(["# Scan Date", scan.created_at.isoformat() if scan.created_at else ""])
        writer.writerow(["# Health Score", f"{scan.health_score}/100"])
        writer.writerow(["# Pages Crawled", scan.pages_crawled])
        writer.writerow([])

        # Table columns
        writer.writerow([
            "Issue ID",
            "Rule ID",
            "Title",
            "Category",
            "Severity",
            "Status",
            "Affected URL",
            "Evidence",
            "Explanation",
            "Recommendation"
        ])

        for issue in issues:
            writer.writerow([
                issue.id,
                issue.rule_id,
                issue.title,
                issue.category,
                issue.severity,
                "Resolved" if issue.resolved else "Open",
                issue.affected_url,
                issue.evidence,
                issue.explanation,
                issue.recommendation
            ])

        return output.getvalue()

    @staticmethod
    def compare_scans(base_scan: Scan, compare_scan: Scan) -> Dict[str, Any]:
        """
        Compares earlier vs recent scan to identify resolved, new, and recurring issues.
        """
        base_issues_map = {f"{i.rule_id}:{i.affected_url}": i for i in base_scan.issues}
        compare_issues_map = {f"{i.rule_id}:{i.affected_url}": i for i in compare_scan.issues}

        new_keys = set(compare_issues_map.keys()) - set(base_issues_map.keys())
        resolved_keys = set(base_issues_map.keys()) - set(compare_issues_map.keys())
        recurring_keys = set(base_issues_map.keys()).intersection(set(compare_issues_map.keys()))

        return {
            "base_scan_id": base_scan.id,
            "compare_scan_id": compare_scan.id,
            "domain": base_scan.website.domain if base_scan.website else "",
            "health_score_diff": compare_scan.health_score - base_scan.health_score,
            "pages_crawled_diff": compare_scan.pages_crawled - base_scan.pages_crawled,
            "new_issues": [compare_issues_map[k] for k in new_keys],
            "resolved_issues": [base_issues_map[k] for k in resolved_keys],
            "recurring_issues": [compare_issues_map[k] for k in recurring_keys],
        }
