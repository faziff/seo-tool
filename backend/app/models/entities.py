import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
)
from sqlalchemy.orm import relationship
from backend.app.database.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    settings = Column(JSON, default=dict)

    websites = relationship("Website", back_populates="user", cascade="all, delete-orphan")
    scans = relationship("Scan", back_populates="user", cascade="all, delete-orphan")


class Website(Base):
    __tablename__ = "websites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    domain = Column(String(255), index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_scanned_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="websites")
    scans = relationship("Scan", back_populates="website", cascade="all, delete-orphan")


class Scan(Base):
    __tablename__ = "scans"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    website_id = Column(Integer, ForeignKey("websites.id"), nullable=False)
    target_url = Column(String(1024), nullable=False)
    status = Column(String(32), default="pending")  # pending, crawling, analyzing, completed, failed, cancelled
    progress = Column(Integer, default=0)
    current_action = Column(String(255), default="Initializing scanner...")

    pages_crawled = Column(Integer, default=0)
    total_urls_found = Column(Integer, default=0)
    redirects_found = Column(Integer, default=0)
    broken_links_found = Column(Integer, default=0)

    health_score = Column(Integer, default=0)
    seo_score = Column(Integer, default=0)
    performance_score = Column(Integer, default=0)
    accessibility_score = Column(Integer, default=0)
    technical_score = Column(Integer, default=0)

    # Detailed statistics
    passed_checks_count = Column(Integer, default=0)
    warning_checks_count = Column(Integer, default=0)
    critical_checks_count = Column(Integer, default=0)
    total_checks_count = Column(Integer, default=0)

    duration_seconds = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="scans")
    website = relationship("Website", back_populates="scans")
    pages = relationship("ScannedPage", back_populates="scan", cascade="all, delete-orphan")
    issues = relationship("Issue", back_populates="scan", cascade="all, delete-orphan")


class ScannedPage(Base):
    __tablename__ = "scanned_pages"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(String(64), ForeignKey("scans.id"), nullable=False, index=True)
    url = Column(String(1024), nullable=False, index=True)
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, default=0)
    content_type = Column(String(128), default="text/html")
    content_length = Column(Integer, default=0)

    title = Column(String(512), nullable=True)
    meta_description = Column(Text, nullable=True)
    canonical_url = Column(String(1024), nullable=True)
    h1_count = Column(Integer, default=0)
    first_h1 = Column(String(512), nullable=True)
    word_count = Column(Integer, default=0)
    has_viewport = Column(Boolean, default=True)
    has_meta_robots = Column(Boolean, default=False)
    is_indexable = Column(Boolean, default=True)
    html_lang = Column(String(16), nullable=True)

    # Social and technical signals
    og_title = Column(String(512), nullable=True)
    og_image = Column(String(1024), nullable=True)
    twitter_card = Column(String(64), nullable=True)

    links_internal_count = Column(Integer, default=0)
    links_external_count = Column(Integer, default=0)
    images_count = Column(Integer, default=0)
    images_missing_alt = Column(Integer, default=0)

    scan = relationship("Scan", back_populates="pages")


class Issue(Base):
    __tablename__ = "issues"

    id = Column(String(64), primary_key=True, index=True)
    scan_id = Column(String(64), ForeignKey("scans.id"), nullable=False, index=True)
    rule_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(64), nullable=False)  # SEO, Technical, Performance, Accessibility, Crawlability
    severity = Column(String(32), nullable=False)  # Critical, High, Medium, Low
    pages_affected = Column(Integer, default=1)
    affected_url = Column(String(1024), nullable=False)

    evidence = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)
    suggested_fix = Column(Text, nullable=True)

    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    scan = relationship("Scan", back_populates="issues")
