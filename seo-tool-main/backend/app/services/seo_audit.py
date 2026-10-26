import json
import re
from typing import List, Dict, Any, Set
from collections import defaultdict
from backend.app.services.crawler import PageCrawlResult


class AuditRuleDefinition:
    def __init__(
        self,
        rule_id: str,
        title: str,
        category: str,
        severity: str,
        explanation: str,
        recommendation: str,
        verification: str,
        doc_url: str = "https://developers.google.com/search/docs"
    ):
        self.rule_id = rule_id
        self.title = title
        self.category = category  # SEO, Technical, Performance, Accessibility, Crawlability
        self.severity = severity  # Critical, High, Medium, Low
        self.explanation = explanation
        self.recommendation = recommendation
        self.verification = verification
        self.doc_url = doc_url


class DetectedIssue:
    def __init__(
        self,
        rule_id: str,
        title: str,
        category: str,
        severity: str,
        affected_url: str,
        evidence: str,
        explanation: str,
        recommendation: str,
        suggested_fix: str = "",
        verification: str = "",
        pages_affected: int = 1
    ):
        self.rule_id = rule_id
        self.title = title
        self.category = category
        self.severity = severity
        self.affected_url = affected_url
        self.evidence = evidence
        self.explanation = explanation
        self.recommendation = recommendation
        self.suggested_fix = suggested_fix
        self.verification = verification
        self.pages_affected = pages_affected


class SEOAuditEngine:
    def __init__(self, pages: Dict[str, PageCrawlResult]):
        self.pages = pages
        self.issues: List[DetectedIssue] = []
        self.passed_checks: List[str] = []
        self.total_checks_evaluated: int = 0

    def run_all_checks(self) -> Dict[str, Any]:
        self.issues = []
        self.passed_checks = []

        total_rules_tested = 0

        # Aggregation maps
        title_occurrences = defaultdict(list)
        desc_occurrences = defaultdict(list)
        h1_occurrences = defaultdict(list)

        has_http_errors = False
        has_missing_titles = False
        has_short_titles = False
        has_long_titles = False
        has_missing_desc = False
        has_short_desc = False
        has_long_desc = False
        has_missing_h1 = False
        has_multiple_h1 = False
        has_missing_canonical = False
        has_missing_viewport = False
        has_missing_lang = False
        has_missing_alt = False
        has_thin_content = False
        has_missing_schema = False
        has_invalid_schema = False
        has_slow_ttfb = False
        has_insecure_http = False
        has_missing_og = False
        has_empty_anchors = False

        for url, page in self.pages.items():
            # 1. HTTP Status & Broken Links Check
            total_rules_tested += 1
            if page.status_code and page.status_code >= 400:
                has_http_errors = True
                severity = "Critical" if page.status_code == 404 else "High"
                self.issues.append(DetectedIssue(
                    rule_id="HTTP_ERROR",
                    title=f"Page returned HTTP client/server error {page.status_code}",
                    category="Technical",
                    severity=severity,
                    affected_url=url,
                    evidence=f"HTTP response code: {page.status_code}",
                    explanation=f"The server responded with an error code ({page.status_code}). Crawlers cannot index broken pages, wasting crawl budget and creating dead ends.",
                    recommendation="Fix the source link or configure a permanent 301 redirect to an active destination.",
                    suggested_fix=f"# Nginx Redirect\nlocation = {url} {{\n  return 301 /new-destination;\n}}",
                    verification=f"curl -I {url}"
                ))
                continue

            # 2. Page Title Checks
            total_rules_tested += 1
            if not page.title or not page.title.strip():
                has_missing_titles = True
                self.issues.append(DetectedIssue(
                    rule_id="TITLE_MISSING",
                    title="Missing page title tag",
                    category="SEO",
                    severity="High",
                    affected_url=url,
                    evidence="No <title> tag was found inside the <head> element.",
                    explanation="The <title> tag is one of the most important on-page SEO ranking factors and is rendered directly in Google search result headlines.",
                    recommendation="Add a distinct, keyword-targeted <title> tag between 50 and 60 characters.",
                    suggested_fix="<title>Primary Topic & Keyword — Brand Name</title>",
                    verification="Inspect page source and verify <title> is populated inside <head>."
                ))
            else:
                title_occurrences[page.title.strip()].append(url)
                title_len = len(page.title.strip())
                if title_len < 30:
                    has_short_titles = True
                    self.issues.append(DetectedIssue(
                        rule_id="TITLE_TOO_SHORT",
                        title="Page title tag is too short",
                        category="SEO",
                        severity="Low",
                        affected_url=url,
                        evidence=f"Title length: {title_len} characters ('{page.title}')",
                        explanation="Titles shorter than 30 characters underutilize valuable SERP real estate and provide insufficient context to search engines.",
                        recommendation="Expand the title tag to 50–60 characters to include relevant secondary keywords.",
                        suggested_fix=f"<title>{page.title} — Comprehensive Guide & Solutions</title>",
                        verification="Verify title tag character length is between 50 and 60 characters."
                    ))
                elif title_len > 65:
                    has_long_titles = True
                    self.issues.append(DetectedIssue(
                        rule_id="TITLE_TOO_LONG",
                        title="Page title tag exceeds 65 characters",
                        category="SEO",
                        severity="Medium",
                        affected_url=url,
                        evidence=f"Title length: {title_len} characters ('{page.title[:65]}...')",
                        explanation="Titles longer than 60–65 characters are truncated with an ellipsis (...) in search results, reducing click-through rate.",
                        recommendation="Trim the title tag to under 60 characters to keep the complete message visible in search snippets.",
                        suggested_fix=f"<title>{page.title[:55]}...</title>",
                        verification="Preview snippet on Google Search preview simulators."
                    ))

            # 3. Meta Description Checks
            total_rules_tested += 1
            if not page.meta_description or not page.meta_description.strip():
                has_missing_desc = True
                self.issues.append(DetectedIssue(
                    rule_id="META_DESC_MISSING",
                    title="Missing meta description tag",
                    category="SEO",
                    severity="High",
                    affected_url=url,
                    evidence="No <meta name='description'> element detected in HTML head.",
                    explanation="Meta descriptions provide snippet previews in search engine result pages. Missing descriptions force Google to generate automated fallbacks that often look poorly formatted.",
                    recommendation="Add a compelling meta description between 120 and 155 characters that summarizes the page and includes a clear call to action.",
                    suggested_fix='<meta name="description" content="Discover our complete range of enterprise analytics, auditing, and real-time monitoring solutions designed to scale.">',
                    verification="Inspect <head> for <meta name='description' content='...'>"
                ))
            else:
                desc_occurrences[page.meta_description.strip()].append(url)
                desc_len = len(page.meta_description.strip())
                if desc_len < 70:
                    has_short_desc = True
                    self.issues.append(DetectedIssue(
                        rule_id="META_DESC_TOO_SHORT",
                        title="Meta description is too short",
                        category="SEO",
                        severity="Low",
                        affected_url=url,
                        evidence=f"Description length: {desc_len} characters.",
                        explanation="Descriptions under 70 characters lack sufficient detail to entice users and may be replaced by search engines with random text.",
                        recommendation="Expand the meta description to 120–155 characters with key benefits and a call-to-action.",
                        suggested_fix=f'<meta name="description" content="{page.meta_description} Learn more about our top-tier features and customer benefits today.">',
                        verification="Verify meta description length is 120-155 characters."
                    ))
                elif desc_len > 160:
                    has_long_desc = True
                    self.issues.append(DetectedIssue(
                        rule_id="META_DESC_TOO_LONG",
                        title="Meta description exceeds 160 characters",
                        category="SEO",
                        severity="Medium",
                        affected_url=url,
                        evidence=f"Description length: {desc_len} characters.",
                        explanation="Meta descriptions over 160 characters are clipped in Google desktop and mobile SERPs.",
                        recommendation="Condense your meta description to 150–155 characters.",
                        suggested_fix=f'<meta name="description" content="{page.meta_description[:150]}...">',
                        verification="Check SERP snippet preview to ensure no trailing truncation."
                    ))

            # 4. Heading Structure Checks
            total_rules_tested += 1
            if not page.h1_tags:
                has_missing_h1 = True
                self.issues.append(DetectedIssue(
                    rule_id="H1_MISSING",
                    title="Missing primary H1 heading",
                    category="SEO",
                    severity="High",
                    affected_url=url,
                    evidence="No <h1> element detected in the document body.",
                    explanation="The H1 tag establishes the primary subject of the page for search engine crawlers and screen readers.",
                    recommendation="Add a single, prominent <h1> tag that describes the core topic of the page.",
                    suggested_fix="<h1>The Core Subject or Service Title</h1>",
                    verification="Inspect body DOM to confirm presence of <h1>."
                ))
            elif len(page.h1_tags) > 1:
                has_multiple_h1 = True
                self.issues.append(DetectedIssue(
                    rule_id="H1_MULTIPLE",
                    title="Multiple H1 headings detected",
                    category="Technical",
                    severity="Low",
                    affected_url=url,
                    evidence=f"Found {len(page.h1_tags)} H1 headings: '{page.h1_tags[0]}' and '{page.h1_tags[1]}'",
                    explanation="While HTML5 allows multiple H1s, best practice is a single dominant H1 per page for clear semantic hierarchy.",
                    recommendation="Keep one primary <h1> for the page title and demote secondary headers to <h2>.",
                    suggested_fix="<!-- Keep primary H1 -->\n<h1>Primary Title</h1>\n<!-- Demote secondary -->\n<h2>Secondary Section</h2>",
                    verification="Verify page contains exactly one <h1> element."
                ))

            # 5. Canonical Link Checks
            total_rules_tested += 1
            if not page.canonical_url:
                has_missing_canonical = True
                self.issues.append(DetectedIssue(
                    rule_id="CANONICAL_MISSING",
                    title="Missing canonical link tag",
                    category="SEO",
                    severity="Medium",
                    affected_url=url,
                    evidence="No <link rel='canonical'> element found in <head>.",
                    explanation="Canonical tags prevent duplicate content indexing by explicitly declaring the preferred URL for search engines.",
                    recommendation="Add a self-referential canonical tag to the document head.",
                    suggested_fix=f'<link rel="canonical" href="{url}" />',
                    verification="Verify <link rel='canonical' href='...'> exists in <head>."
                ))

            # 6. Responsive Viewport Check
            total_rules_tested += 1
            if not page.has_viewport:
                has_missing_viewport = True
                self.issues.append(DetectedIssue(
                    rule_id="VIEWPORT_MISSING",
                    title="Missing mobile viewport meta tag",
                    category="Accessibility",
                    severity="Critical",
                    affected_url=url,
                    evidence="No <meta name='viewport'> tag detected.",
                    explanation="Without a viewport meta tag, mobile browsers render pages at desktop width, failing Google mobile-friendly criteria.",
                    recommendation="Include the standard responsive viewport meta tag in the head section.",
                    suggested_fix='<meta name="viewport" content="width=device-width, initial-scale=1.0">',
                    verification="Verify viewport tag in source."
                ))

            # 7. HTML Language Declaration
            total_rules_tested += 1
            if not page.html_lang:
                has_missing_lang = True
                self.issues.append(DetectedIssue(
                    rule_id="HTML_LANG_MISSING",
                    title="Missing HTML document language declaration",
                    category="Accessibility",
                    severity="Medium",
                    affected_url=url,
                    evidence="<html> element lacks a 'lang' attribute.",
                    explanation="Screen readers and translation tools require the lang attribute to accurately parse and speak page text.",
                    recommendation="Declare the primary language on the <html> element.",
                    suggested_fix='<html lang="en">',
                    verification="Inspect <html lang='...'> attribute in page source."
                ))

            # 8. Images Missing Alt Attributes
            total_rules_tested += 1
            images_without_alt = [img for img in page.images if not img.get("alt")]
            if images_without_alt:
                has_missing_alt = True
                count = len(images_without_alt)
                sample = images_without_alt[0].get("src", "image")
                self.issues.append(DetectedIssue(
                    rule_id="IMAGE_ALT_MISSING",
                    title=f"Images missing alternative text ({count} images)",
                    category="Accessibility",
                    severity="Medium",
                    affected_url=url,
                    evidence=f"{count} image(s) lack alt attributes. Example: {sample[:80]}",
                    explanation="Alternative text allows screen readers to convey image meaning to visually impaired users and enables Google image search ranking.",
                    recommendation="Add descriptive alt text to all informative images. Use alt='' only for purely decorative graphics.",
                    suggested_fix='<img src="graphic.jpg" alt="Clear descriptive summary of the image content" />',
                    verification="Audit img elements with accessibility inspector."
                ))

            # 9. Thin Content Check
            total_rules_tested += 1
            if page.word_count < 200 and (not page.status_code or page.status_code < 400):
                has_thin_content = True
                self.issues.append(DetectedIssue(
                    rule_id="THIN_CONTENT",
                    title="Low word count / Thin content indicator",
                    category="SEO",
                    severity="Low",
                    affected_url=url,
                    evidence=f"Page body contains only {page.word_count} words (minimum recommended: 250).",
                    explanation="Pages with very little unique textual content struggle to rank for competitive search queries.",
                    recommendation="Expand the copy with helpful, informative answers to customer queries and clear explanations.",
                    suggested_fix="Add informative paragraphs, feature explanations, or FAQs to page body.",
                    verification="Count body words excluding headers and navigation."
                ))

            # 10. Structured Data Validation
            total_rules_tested += 1
            if not page.structured_data:
                has_missing_schema = True
                self.issues.append(DetectedIssue(
                    rule_id="STRUCTURED_DATA_MISSING",
                    title="No JSON-LD structured data detected",
                    category="SEO",
                    severity="Low",
                    affected_url=url,
                    evidence="No <script type='application/ld+json'> tags found in page.",
                    explanation="Structured data (Schema.org) unlocks rich search snippets such as breadcrumbs, product pricing, star reviews, and organization logos.",
                    recommendation="Add JSON-LD schema markup corresponding to your business or page type.",
                    suggested_fix='<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "CROX",\n  "url": "https://example.com"\n}\n</script>',
                    verification="Validate with Google Rich Results Test tool."
                ))
            else:
                for sd_text in page.structured_data:
                    try:
                        json.loads(sd_text)
                    except Exception as json_err:
                        has_invalid_schema = True
                        self.issues.append(DetectedIssue(
                            rule_id="STRUCTURED_DATA_INVALID",
                            title="Invalid JSON-LD structured data syntax",
                            category="Technical",
                            severity="High",
                            affected_url=url,
                            evidence=f"JSON syntax error: {str(json_err)[:100]}",
                            explanation="Invalid JSON syntax causes search bots to completely discard your structured data.",
                            recommendation="Fix the JSON formatting error in your structured data script.",
                            suggested_fix="Validate JSON with a linter to ensure quotes and brackets are properly escaped.",
                            verification="Test with Google Rich Results Test."
                        ))

            # 11. Performance / Slow TTFB
            total_rules_tested += 1
            if page.response_time_ms > 800:
                has_slow_ttfb = True
                severity = "High" if page.response_time_ms > 2000 else "Medium"
                self.issues.append(DetectedIssue(
                    rule_id="SLOW_RESPONSE_TIME",
                    title=f"Slow server response time ({page.response_time_ms}ms TTFB)",
                    category="Performance",
                    severity=severity,
                    affected_url=url,
                    evidence=f"Time to First Byte: {page.response_time_ms}ms (Recommended: < 600ms)",
                    explanation="High TTFB delays HTML parsing, impairs Largest Contentful Paint (LCP), and frustrates site visitors.",
                    recommendation="Enable edge caching, optimize database queries, and leverage a CDN like Cloudflare.",
                    suggested_fix="# Add HTTP Caching Header\nCache-Control: public, max-age=3600, s-maxage=86400",
                    verification="Measure TTFB with curl: curl -o /dev/null -w 'TTFB: %{time_starttransfer}s\n' <url>"
                ))

            # 12. Insecure HTTP Protocol
            total_rules_tested += 1
            if url.startswith("http://"):
                has_insecure_http = True
                self.issues.append(DetectedIssue(
                    rule_id="INSECURE_HTTP",
                    title="Page served over unencrypted HTTP protocol",
                    category="Technical",
                    severity="High",
                    affected_url=url,
                    evidence="URL uses http:// instead of secure https://",
                    explanation="HTTPS is a mandatory ranking signal and prevents data interception and browser security warnings.",
                    recommendation="Install a valid SSL/TLS certificate and configure a permanent 301 redirect from HTTP to HTTPS.",
                    suggested_fix="# Nginx HTTPS Enforcement\nserver {\n  listen 80;\n  return 301 https://$host$request_uri;\n}",
                    verification="Verify HTTP automatically redirects to HTTPS with 301 status."
                ))

        # Check Duplicate Titles across multiple crawled pages
        for title, urls in title_occurrences.items():
            if len(urls) > 1:
                self.issues.append(DetectedIssue(
                    rule_id="DUPLICATE_TITLES",
                    title=f"Duplicate title tag across {len(urls)} pages",
                    category="SEO",
                    severity="High",
                    affected_url=urls[0],
                    evidence=f"Identical title '{title}' found on {len(urls)} URLs: {', '.join(urls[:3])}",
                    explanation="Duplicate titles create internal keyword cannibalization and prevent search engines from ranking the most relevant page.",
                    recommendation="Assign unique, specific title tags to each individual URL.",
                    suggested_fix="<title>{Page Subject} | {Category} — {Brand}</title>",
                    verification="Review crawl report to verify every URL has a distinct title.",
                    pages_affected=len(urls)
                ))

        # Check Duplicate Descriptions across multiple pages
        for desc, urls in desc_occurrences.items():
            if len(urls) > 1:
                self.issues.append(DetectedIssue(
                    rule_id="DUPLICATE_META_DESC",
                    title=f"Duplicate meta description across {len(urls)} pages",
                    category="SEO",
                    severity="Medium",
                    affected_url=urls[0],
                    evidence=f"Identical meta description used on {len(urls)} URLs.",
                    explanation="Duplicate descriptions result in identical search snippets, degrading user engagement across different pages.",
                    recommendation="Write distinct descriptions highlighting each page's specific content.",
                    suggested_fix="Write unique meta description summaries per page.",
                    verification="Verify meta descriptions are unique per URL.",
                    pages_affected=len(urls)
                ))

        # Record passed checks
        if not has_http_errors:
            self.passed_checks.append("All crawled pages returned clean 200 OK responses")
        if not has_missing_titles and not has_short_titles and not has_long_titles:
            self.passed_checks.append("Page titles have optimal lengths and present on all pages")
        if not has_missing_desc and not has_short_desc and not has_long_desc:
            self.passed_checks.append("Meta descriptions are well-formed and within recommended limits")
        if not has_missing_h1 and not has_multiple_h1:
            self.passed_checks.append("Semantic H1 heading structure is valid and properly isolated")
        if not has_missing_canonical:
            self.passed_checks.append("Canonical tags are properly declared on crawled templates")
        if not has_missing_viewport:
            self.passed_checks.append("Mobile viewport meta tag is correctly configured")
        if not has_missing_lang:
            self.passed_checks.append("HTML language declarations are present for accessibility")
        if not has_missing_alt:
            self.passed_checks.append("All inspected images have non-empty alt text attributes")
        if not has_thin_content:
            self.passed_checks.append("All crawled pages meet minimum word count requirements")
        if not has_invalid_schema:
            self.passed_checks.append("Structured data syntax is free of JSON parsing errors")
        if not has_insecure_http:
            self.passed_checks.append("All pages are served over secure HTTPS protocol")
        if not has_slow_ttfb:
            self.passed_checks.append("Server response times (TTFB) are within acceptable thresholds")

        return {
            "issues": self.issues,
            "passed_checks": self.passed_checks,
            "total_checks_evaluated": max(12, total_rules_tested)
        }
