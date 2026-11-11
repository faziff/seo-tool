import pytest
from backend.app.core.security import validate_target_url, SecurityError
from backend.app.services.crawler import PageCrawlResult
from backend.app.services.seo_audit import SEOAuditEngine
from backend.app.services.scoring import ScoringEngine


def test_ssrf_validation_blocks_localhost():
    with pytest.raises(SecurityError):
        validate_target_url("http://localhost:8080")

    with pytest.raises(SecurityError):
        validate_target_url("http://127.0.0.1/admin")

    with pytest.raises(SecurityError):
        validate_target_url("http://169.254.169.254/latest/meta-data")


def test_valid_public_domain():
    validated = validate_target_url("example.com")
    assert validated.startswith("https://")
    assert "example.com" in validated


def test_seo_audit_missing_title_and_h1():
    page = PageCrawlResult("https://example.com/test")
    page.status_code = 200
    page.html = "<html><body><p>Hello world without headings or title</p></body></html>"
    page.title = None
    page.h1_tags = []
    page.has_viewport = False
    page.word_count = 7

    engine = SEOAuditEngine({"https://example.com/test": page})
    result = engine.run_all_checks()
    issues = result["issues"]

    rule_ids = [i.rule_id for i in issues]
    assert "TITLE_MISSING" in rule_ids
    assert "H1_MISSING" in rule_ids
    assert "VIEWPORT_MISSING" in rule_ids
    assert "THIN_CONTENT" in rule_ids


def test_scoring_engine_deductions():
    page = PageCrawlResult("https://example.com")
    page.status_code = 200
    page.title = "A Great Title For Testing Purposes"
    page.meta_description = "A comprehensive and engaging meta description that accurately reflects the page purpose."
    page.h1_tags = ["Main Heading"]
    page.has_viewport = True
    page.html_lang = "en"
    page.word_count = 350

    engine = SEOAuditEngine({"https://example.com": page})
    result = engine.run_all_checks()

    scores = ScoringEngine.calculate_scores(result["issues"], 1, result["passed_checks"])
    assert 0 <= scores["health_score"] <= 100
    assert 0 <= scores["technical_score"] <= 100
    assert 0 <= scores["seo_score"] <= 100
    assert scores["health_score"] >= 70
    assert scores["passed_checks_count"] > 0
