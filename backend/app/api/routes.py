import uuid
import time
import datetime
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response, status
from sqlalchemy.orm import Session

from backend.app.database.session import get_db, Base, engine
from backend.app.models.entities import User, Website, Scan, ScannedPage, Issue
from backend.app.schemas.domain import (
    UserRegisterRequest, UserLoginRequest, UserResponse, TokenResponse,
    ChangePasswordRequest, StartScanRequest, ScanProgressResponse,
    ScanReportResponse, IssueSummary, PageSummary, CategoryScore,
    IssueUpdateRequest, AIChatRequest, AIChatResponse,
    ScanCompareRequest, ScanCompareResponse
)
from backend.app.core.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, get_current_user_optional
)
from backend.app.core.security import validate_target_url, SecurityError
from backend.app.services.crawler import WebsiteCrawler
from backend.app.services.seo_audit import SEOAuditEngine
from backend.app.services.scoring import ScoringEngine
from backend.app.services.ai_service import AIService
from backend.app.services.performance import PerformanceService
from backend.app.services.reporting import ReportingService

# Ensure tables exist
Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/api")


# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@router.post("/auth/register", response_model=TokenResponse)
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match."
        )

    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    clean_email = payload.email.lower().strip()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    new_user = User(
        email=clean_email,
        name=payload.name.strip(),
        hashed_password=hash_password(payload.password),
        is_active=True,
        created_at=datetime.datetime.utcnow(),
        settings={
            "max_pages": 50,
            "timeout_seconds": 15,
            "theme": "light"
        }
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id), "email": new_user.email})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=new_user.id,
            name=new_user.name,
            email=new_user.email,
            created_at=new_user.created_at,
            settings=new_user.settings
        )
    )


@router.post("/auth/login", response_model=TokenResponse)
def login_user(payload: UserLoginRequest, db: Session = Depends(get_db)):
    clean_email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled."
        )

    token = create_access_token({"sub": str(user.id), "email": user.email})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at,
            settings=user.settings
        )
    )


@router.get("/auth/me", response_model=UserResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at,
        settings=user.settings
    )


@router.post("/auth/change-password")
def change_password(payload: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password entered is incorrect."
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long."
        )

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"status": "success", "message": "Password changed successfully."}


@router.post("/auth/logout")
def logout_user():
    return {"status": "success", "message": "Successfully logged out."}


# ==========================================
# CRAWL WORKER & AUDIT EXECUTION
# ==========================================

async def execute_crawl_background(scan_id: str, start_url: str, max_pages: int):
    """
    Background worker that runs the crawler and audit engine, updating database state.
    """
    from backend.app.database.session import SessionLocal
    db = SessionLocal()
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        db.close()
        return

    start_time = time.time()
    try:
        scan.status = "crawling"
        scan.current_action = "Discovering site architecture, robots.txt & sitemaps..."
        scan.progress = 10
        db.commit()

        async def update_progress(action: str, percent: int):
            try:
                scan.current_action = action
                scan.progress = percent
                db.commit()
            except Exception:
                pass

        crawler = WebsiteCrawler(
            start_url=start_url,
            max_pages=max_pages,
            progress_callback=update_progress
        )

        results = await crawler.start()

        scan.status = "analyzing"
        scan.current_action = "Executing SEO, Accessibility & Technical audit rules..."
        scan.progress = 85
        db.commit()

        # Run SEO audit engine
        engine_audit = SEOAuditEngine(results)
        audit_result = engine_audit.run_all_checks()
        detected_issues = audit_result["issues"]
        passed_checks = audit_result["passed_checks"]

        # Calculate scores
        scores = ScoringEngine.calculate_scores(detected_issues, len(results), passed_checks)

        # Store Scanned Pages
        redirect_count = 0
        broken_count = 0
        all_discovered_links = set()

        for url, page_res in results.items():
            if page_res.is_redirect:
                redirect_count += 1
            if page_res.status_code and page_res.status_code >= 400:
                broken_count += 1

            for link in page_res.internal_links.union(page_res.external_links):
                all_discovered_links.add(link)

            db_page = ScannedPage(
                scan_id=scan.id,
                url=url,
                status_code=page_res.status_code,
                response_time_ms=page_res.response_time_ms,
                content_type=page_res.content_type,
                content_length=page_res.content_length,
                title=page_res.title,
                meta_description=page_res.meta_description,
                canonical_url=page_res.canonical_url,
                h1_count=len(page_res.h1_tags),
                first_h1=page_res.h1_tags[0] if page_res.h1_tags else None,
                word_count=page_res.word_count,
                has_viewport=page_res.has_viewport,
                has_meta_robots=bool(page_res.meta_robots),
                is_indexable=page_res.is_indexable,
                html_lang=page_res.html_lang,
                links_internal_count=len(page_res.internal_links),
                links_external_count=len(page_res.external_links),
                images_count=len(page_res.images),
                images_missing_alt=len([i for i in page_res.images if not i.get("alt")])
            )
            db.add(db_page)

        # Store Issues
        for iss in detected_issues:
            db_issue = Issue(
                id=str(uuid.uuid4())[:12],
                scan_id=scan.id,
                rule_id=iss.rule_id,
                title=iss.title,
                category=iss.category,
                severity=iss.severity,
                pages_affected=iss.pages_affected,
                affected_url=iss.affected_url,
                evidence=iss.evidence,
                explanation=iss.explanation,
                recommendation=iss.recommendation,
                suggested_fix=iss.suggested_fix,
                resolved=False
            )
            db.add(db_issue)

        scan.pages_crawled = len(results)
        scan.total_urls_found = len(all_discovered_links) + len(results)
        scan.redirects_found = redirect_count
        scan.broken_links_found = broken_count

        scan.health_score = scores["health_score"]
        scan.technical_score = scores["technical_score"]
        scan.seo_score = scores["seo_score"]
        scan.performance_score = scores["performance_score"]
        scan.accessibility_score = scores["accessibility_score"]

        scan.passed_checks_count = scores["passed_checks_count"]
        scan.warning_checks_count = scores["warning_checks_count"]
        scan.critical_checks_count = scores["critical_checks_count"]
        scan.total_checks_count = scores["total_checks_count"]

        scan.status = "completed"
        scan.progress = 100
        scan.current_action = "Audit successfully completed"
        scan.duration_seconds = round(time.time() - start_time, 2)
        scan.completed_at = datetime.datetime.utcnow()

        if scan.website:
            scan.website.last_scanned_at = datetime.datetime.utcnow()

        db.commit()

    except Exception as e:
        db.rollback()
        scan.status = "failed"
        scan.error_message = str(e)
        scan.current_action = f"Scan failed: {str(e)}"
        scan.duration_seconds = round(time.time() - start_time, 2)
        db.commit()
    finally:
        db.close()


# ==========================================
# SCAN MANAGEMENT ENDPOINTS
# ==========================================

@router.post("/scans", response_model=ScanProgressResponse)
def start_scan(
    payload: StartScanRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    try:
        validated_url = validate_target_url(payload.url)
    except SecurityError as e:
        raise HTTPException(status_code=400, detail=str(e))

    domain = urlparse(validated_url).hostname.lower()

    # Find or create website
    user_id = current_user.id if current_user else None
    website = db.query(Website).filter(Website.domain == domain).first()
    if not website:
        website = Website(domain=domain, user_id=user_id)
        db.add(website)
        db.commit()
        db.refresh(website)

    scan_id = str(uuid.uuid4())[:12]
    scan = Scan(
        id=scan_id,
        user_id=user_id,
        website_id=website.id,
        target_url=validated_url,
        status="pending",
        progress=0,
        current_action="Queued for crawl..."
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    background_tasks.add_task(
        execute_crawl_background,
        scan_id=scan.id,
        start_url=validated_url,
        max_pages=payload.max_pages or 50
    )

    return ScanProgressResponse(
        scan_id=scan.id,
        target_url=scan.target_url,
        domain=domain,
        status=scan.status,
        progress=scan.progress,
        current_action=scan.current_action,
        pages_crawled=0,
        total_urls_found=0,
        redirects_found=0,
        broken_links_found=0,
        health_score=0,
        duration_seconds=0.0
    )


@router.get("/scans/{scan_id}", response_model=ScanProgressResponse)
def get_scan_status(
    scan_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    query = db.query(Scan).filter(Scan.id == scan_id)
    if current_user:
        # Enforce user isolation: if user is logged in and scan has user_id, ensure it belongs to them
        scan = query.first()
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")
        if scan.user_id and scan.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not have permission to access this scan.")
    else:
        scan = query.first()
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")

    return ScanProgressResponse(
        scan_id=scan.id,
        target_url=scan.target_url,
        domain=scan.website.domain if scan.website else "",
        status=scan.status,
        progress=scan.progress,
        current_action=scan.current_action,
        pages_crawled=scan.pages_crawled,
        total_urls_found=scan.total_urls_found,
        redirects_found=scan.redirects_found,
        broken_links_found=scan.broken_links_found,
        health_score=scan.health_score,
        duration_seconds=scan.duration_seconds,
        error_message=scan.error_message
    )


@router.get("/scans/{scan_id}/report", response_model=ScanReportResponse)
def get_scan_report(
    scan_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    # Enforce user isolation
    if current_user and scan.user_id and scan.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied. This scan belongs to another user.")

    severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    issue_summaries = []
    for iss in scan.issues:
        sev = iss.severity if iss.severity in severity_counts else "Medium"
        severity_counts[sev] += 1
        issue_summaries.append(IssueSummary(
            id=iss.id,
            rule_id=iss.rule_id,
            title=iss.title,
            category=iss.category,
            severity=iss.severity,
            pages_affected=iss.pages_affected,
            affected_url=iss.affected_url,
            evidence=iss.evidence,
            explanation=iss.explanation,
            recommendation=iss.recommendation,
            suggested_fix=iss.suggested_fix,
            resolved=iss.resolved,
            created_at=iss.created_at
        ))

    page_summaries = [
        PageSummary(
            id=p.id,
            url=p.url,
            status_code=p.status_code,
            response_time_ms=p.response_time_ms,
            content_type=p.content_type,
            title=p.title,
            meta_description=p.meta_description,
            canonical_url=p.canonical_url,
            h1_count=p.h1_count,
            word_count=p.word_count,
            is_indexable=p.is_indexable
        )
        for p in scan.pages
    ]

    # Calculate real dynamic category scores
    engine_temp = SEOAuditEngine({})
    cat_tech = ScoringEngine.calculate_category_score(scan.issues, "Technical")
    cat_perf = ScoringEngine.calculate_category_score(scan.issues, "Performance")
    cat_acc = ScoringEngine.calculate_category_score(scan.issues, "Accessibility")
    cat_seo = ScoringEngine.calculate_category_score(scan.issues, "SEO")

    category_scores = {
        "Technical SEO": CategoryScore(
            score=scan.technical_score,
            status=cat_tech["status"],
            passed_checks=cat_tech["passed_checks"],
            warning_checks=cat_tech["warning_checks"],
            critical_checks=cat_tech["critical_checks"],
            issues_count=cat_tech["issues_count"]
        ),
        "Performance": CategoryScore(
            score=scan.performance_score,
            status=cat_perf["status"],
            passed_checks=cat_perf["passed_checks"],
            warning_checks=cat_perf["warning_checks"],
            critical_checks=cat_perf["critical_checks"],
            issues_count=cat_perf["issues_count"]
        ),
        "Accessibility": CategoryScore(
            score=scan.accessibility_score,
            status=cat_acc["status"],
            passed_checks=cat_acc["passed_checks"],
            warning_checks=cat_acc["warning_checks"],
            critical_checks=cat_acc["critical_checks"],
            issues_count=cat_acc["issues_count"]
        ),
        "SEO Opportunities": CategoryScore(
            score=scan.seo_score,
            status=cat_seo["status"],
            passed_checks=cat_seo["passed_checks"],
            warning_checks=cat_seo["warning_checks"],
            critical_checks=cat_seo["critical_checks"],
            issues_count=cat_seo["issues_count"]
        )
    }

    # Generate passed checks summary list
    passed_list = []
    if severity_counts["Critical"] == 0:
        passed_list.append("Zero critical HTTP errors or mobile viewport blockers detected")
    if not any(i.rule_id == "TITLE_MISSING" for i in scan.issues):
        passed_list.append("All crawled pages have title tags declared")
    if not any(i.rule_id == "H1_MISSING" for i in scan.issues):
        passed_list.append("Primary H1 headings are present across crawled templates")
    if not any(i.rule_id == "INSECURE_HTTP" for i in scan.issues):
        passed_list.append("All scanned pages enforce encrypted HTTPS protocol")
    if not any(i.rule_id == "STRUCTURED_DATA_INVALID" for i in scan.issues):
        passed_list.append("Structured data schemas are free of syntax errors")

    return ScanReportResponse(
        scan_id=scan.id,
        target_url=scan.target_url,
        domain=scan.website.domain if scan.website else "",
        status=scan.status,
        created_at=scan.created_at,
        completed_at=scan.completed_at,
        duration_seconds=scan.duration_seconds,
        health_score=scan.health_score,
        technical_score=scan.technical_score,
        performance_score=scan.performance_score,
        accessibility_score=scan.accessibility_score,
        seo_score=scan.seo_score,
        pages_crawled=scan.pages_crawled,
        total_urls_found=scan.total_urls_found,
        redirects_found=scan.redirects_found,
        broken_links_found=scan.broken_links_found,
        issues=issue_summaries,
        pages=page_summaries,
        passed_checks=passed_list,
        passed_checks_count=scan.passed_checks_count or len(passed_list),
        warning_checks_count=scan.warning_checks_count or (severity_counts["High"] + severity_counts["Medium"]),
        critical_checks_count=scan.critical_checks_count or severity_counts["Critical"],
        total_checks_count=scan.total_checks_count or (len(passed_list) + len(issue_summaries)),
        severity_counts=severity_counts,
        category_scores=category_scores
    )


@router.get("/scans")
def list_scans(
    limit: int = 20,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    query = db.query(Scan)
    if current_user:
        # Enforce user isolation: filter by current_user.id
        query = query.filter((Scan.user_id == current_user.id) | (Scan.user_id == None))
    scans = query.order_by(Scan.created_at.desc()).limit(limit).all()
    return [
        {
            "id": s.id,
            "domain": s.website.domain if s.website else "",
            "target_url": s.target_url,
            "status": s.status,
            "health_score": s.health_score,
            "pages_crawled": s.pages_crawled,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None
        }
        for s in scans
    ]


@router.delete("/scans/{scan_id}")
def delete_scan(
    scan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if scan.user_id and scan.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied to delete this scan")

    db.delete(scan)
    db.commit()
    return {"status": "success", "message": f"Scan {scan_id} deleted successfully"}


@router.patch("/issues/{issue_id}")
def update_issue_status(
    issue_id: str,
    payload: IssueUpdateRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    if current_user and issue.scan and issue.scan.user_id and issue.scan.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    issue.resolved = payload.resolved
    issue.resolved_at = datetime.datetime.utcnow() if payload.resolved else None
    db.commit()
    return {"status": "success", "issue_id": issue.id, "resolved": issue.resolved}


@router.post("/ai/fix")
async def generate_ai_fix(payload: Dict[str, Any]):
    issue_title = payload.get("title", "")
    issue_category = payload.get("category", "")
    affected_url = payload.get("affected_url", "")
    evidence = payload.get("evidence", "")
    explanation = payload.get("explanation", "")

    return await AIService.generate_issue_fix(
        issue_title=issue_title,
        issue_category=issue_category,
        affected_url=affected_url,
        evidence=evidence,
        explanation=explanation
    )


@router.post("/ai/chat", response_model=AIChatResponse)
async def ai_chat(
    payload: AIChatRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    scan_context = None
    if payload.scan_id:
        scan = db.query(Scan).filter(Scan.id == payload.scan_id).first()
        if scan:
            critical_count = len([i for i in scan.issues if i.severity == "Critical"])
            top_issues = [f"{i.title} ({i.severity})" for i in scan.issues[:3]]
            scan_context = {
                "domain": scan.website.domain if scan.website else "",
                "health_score": scan.health_score,
                "pages_crawled": scan.pages_crawled,
                "critical_issues_count": critical_count,
                "top_issues_summary": ", ".join(top_issues)
            }

    result = await AIService.chat(payload.message, scan_context=scan_context)
    return AIChatResponse(
        reply=result.get("reply", ""),
        suggestions=result.get("suggestions", [])
    )


@router.post("/scans/compare")
def compare_scans(
    payload: ScanCompareRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    base_scan = db.query(Scan).filter(Scan.id == payload.base_scan_id).first()
    compare_scan = db.query(Scan).filter(Scan.id == payload.compare_scan_id).first()

    if not base_scan or not compare_scan:
        raise HTTPException(status_code=404, detail="One or both scans not found for comparison")

    if current_user:
        if (base_scan.user_id and base_scan.user_id != current_user.id) or \
           (compare_scan.user_id and compare_scan.user_id != current_user.id):
            raise HTTPException(status_code=403, detail="You do not have permission to compare these scans.")

    comparison = ReportingService.compare_scans(base_scan, compare_scan)
    return comparison


@router.get("/scans/{scan_id}/export/csv")
def export_scan_csv(
    scan_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    if current_user and scan.user_id and scan.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    csv_data = ReportingService.generate_csv_report(scan, scan.issues)
    domain_slug = scan.website.domain if scan.website else "website"
    filename = f"crox_audit_{domain_slug}_{scan.id}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/pagespeed")
async def get_pagespeed(url: str, strategy: str = "mobile"):
    return await PerformanceService.fetch_pagespeed_metrics(url, strategy)


@router.get("/integrations/status")
def get_integrations_status():
    return {
        "gemini": {
            "name": "Google Gemini AI",
            "is_configured": AIService.is_configured(),
            "model": "gemini-3.8-flash",
            "status": "Connected" if AIService.is_configured() else "Not configured"
        },
        "pagespeed": {
            "name": "Google PageSpeed Insights",
            "is_configured": PerformanceService.is_configured(),
            "status": "Connected" if PerformanceService.is_configured() else "Not configured"
        },
        "search_console": {
            "name": "Google Search Console",
            "is_configured": False,
            "status": "Authorization required"
        }
    }


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CROX Backend API",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "ai_configured": AIService.is_configured(),
        "pagespeed_configured": PerformanceService.is_configured()
    }
