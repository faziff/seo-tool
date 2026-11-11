from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import datetime


# Auth Schemas
class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(..., min_length=6, max_length=128)
    confirm_password: str = Field(..., min_length=6, max_length=128)


class UserLoginRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime.datetime
    settings: Optional[Dict[str, Any]] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Scan & Audit Schemas
class StartScanRequest(BaseModel):
    url: str = Field(..., description="Target website URL or domain name")
    max_pages: Optional[int] = Field(default=50, ge=1, le=200, description="Max pages to crawl")


class IssueSummary(BaseModel):
    id: str
    rule_id: str
    title: str
    category: str
    severity: str
    pages_affected: int
    affected_url: str
    evidence: str
    explanation: str
    recommendation: str
    suggested_fix: Optional[str] = None
    verification: Optional[str] = None
    resolved: bool = False
    created_at: datetime.datetime


class PageSummary(BaseModel):
    id: int
    url: str
    status_code: Optional[int]
    response_time_ms: int
    content_type: str
    title: Optional[str]
    meta_description: Optional[str]
    canonical_url: Optional[str]
    h1_count: int
    word_count: int
    is_indexable: bool


class CategoryScore(BaseModel):
    score: int
    status: str
    passed_checks: int
    warning_checks: int
    critical_checks: int
    issues_count: int


class ScanProgressResponse(BaseModel):
    scan_id: str
    target_url: str
    domain: str
    status: str
    progress: int
    current_action: str
    pages_crawled: int
    total_urls_found: int
    redirects_found: int
    broken_links_found: int
    health_score: int
    duration_seconds: float
    error_message: Optional[str] = None


class ScanReportResponse(BaseModel):
    scan_id: str
    target_url: str
    domain: str
    status: str
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime]
    duration_seconds: float

    health_score: int
    technical_score: int
    performance_score: int
    accessibility_score: int
    seo_score: int

    pages_crawled: int
    total_urls_found: int
    redirects_found: int
    broken_links_found: int

    issues: List[IssueSummary]
    pages: List[PageSummary]
    passed_checks: List[str] = []

    passed_checks_count: int = 0
    warning_checks_count: int = 0
    critical_checks_count: int = 0
    total_checks_count: int = 0

    severity_counts: Dict[str, int]
    category_scores: Dict[str, CategoryScore]


class IssueUpdateRequest(BaseModel):
    resolved: bool


class AIChatRequest(BaseModel):
    scan_id: Optional[str] = None
    message: str
    issue_id: Optional[str] = None


class AIChatResponse(BaseModel):
    reply: str
    suggestions: List[str] = []
    code_snippet: Optional[str] = None


class ScanCompareRequest(BaseModel):
    base_scan_id: str
    compare_scan_id: str


class ScanCompareResponse(BaseModel):
    base_scan_id: str
    compare_scan_id: str
    domain: str
    health_score_diff: int
    pages_crawled_diff: int
    new_issues: List[IssueSummary]
    resolved_issues: List[IssueSummary]
    recurring_issues: List[IssueSummary]
