# CROX — Website Audit & SEO Intelligence Platform

CROX is a website auditing and SEO intelligence workspace. It crawls public websites, checks technical/on-page SEO rules, calculates transparent health scores, and provides remediation guidance. The dashboard-first build opens directly into the CROX workspace without a login screen; authentication can be re-enabled later. NOVA is the face-free floating-orb AI identity for the Gemini-powered assistant, contextual keyword ideation, and niche strategy briefs.

---

## Architecture Overview

CROX uses a separate Python-first backend paired with a high-performance React + TypeScript frontend:

```
crox/
  backend/
    app/
      main.py                  # FastAPI application with CORS and router
      api/
        routes.py              # REST API endpoints (scans, issues, AI, reports)
      core/
        config.py              # Environment configuration & SSRF blocklists
        security.py            # SSRF validation & DNS rebinding protection
      database/
        session.py             # SQLAlchemy engine & SQLite connection session
      models/
        entities.py            # SQLAlchemy models (Websites, Scans, Pages, Issues)
      schemas/
        domain.py              # Pydantic validation schemas
      services/
        crawler.py             # Async HTTPX crawler with robots.txt & sitemaps
        seo_audit.py           # Comprehensive modular SEO & technical audit engine
        scoring.py             # Documented transparent scoring algorithm
        ai_service.py          # CROX AI copilot & Gemini API provider
        performance.py         # Google PageSpeed Insights & TTFB metrics
        reporting.py           # Historical scan comparison & CSV exporter
    tests/
      test_audit.py            # Pytest test suite for SSRF, audit rules, scoring
      test_api.py              # Pytest test suite for FastAPI REST endpoints
    requirements.txt           # Python backend dependencies
    .env.example               # Backend environment variables
  src/
    components/
      Sidebar.tsx              # Left navigation rail & recent scans
      BrandMark.tsx            # CROX gradient ring + sparkle logo
      NovaOrb.tsx              # NOVA floating AI orb identity
      AuthPage.tsx             # Black responsive sign-in / registration experience
      MarketProfileCard.tsx    # Competitor homepage signal summary
      Header.tsx               # Top bar with search, notification, and profile
      ScannerHero.tsx          # Center scanner card & quick action cards
      HealthScoreCard.tsx      # SVG circular score meter & 4 category cards
      CrawlStatsCard.tsx       # KPI metrics & smooth SVG spline area chart
      TopIssuesTable.tsx       # Filterable severity tabs & issue overview
      RecentActivity.tsx       # Live scan activity timeline
      IssueDetailModal.tsx     # How-to-fix modal with code snippets & AI fix
      AIAssistantDrawer.tsx    # CROX AI assistant conversational copilot
      CompareScansModal.tsx    # Baseline vs current scan diffing modal
    pages/
      SiteAuditPage.tsx        # Scanned pages explorer with status code filters
      SEOAnalysisPage.tsx      # On-page titles, descriptions, headings breakdown
      PerformancePage.tsx      # Core Web Vitals & PageSpeed Insights runner
      AccessibilityPage.tsx    # WCAG 2.1 AA automated audit & manual checklist
      TechnicalIssuesPage.tsx  # Searchable issue diagnostics and resolution
      ReportsPage.tsx          # Stored reports and RFC-4180 CSV export
      SettingsPage.tsx         # Platform configurations and API keys overview
      KeywordResearchPage.tsx  # Keyword ideas, intent filters, topic clusters and CSV export
      MarketResearchPage.tsx   # Homepage competitor comparison and niche strategy brief
    services/
      api.ts                   # Frontend API client
    types/
      index.ts                 # TypeScript type definitions
  server.ts                    # Full-stack runner proxying /api to FastAPI
  package.json                 # Frontend dependencies and scripts
  README.md                    # Setup and documentation
```

---

## Key Features

1. **Website Crawler & Discovery:**
   - Asynchronous crawler respecting `robots.txt` and discovering `sitemap.xml`.
   - SSRF protection: resolves hostnames and blocks `localhost`, `127.0.0.0/8`, private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata (`169.254.169.254`).
   - Configurable limits (default 50 pages, 15s timeout, 5 concurrent workers).

2. **SEO & Technical Audit Engine:**
   - Page Titles (missing, short `<30`, long `>65`, duplicate).
   - Meta Descriptions (missing, short `<70`, long `>160`, duplicate).
   - Heading Hierarchy (missing H1, multiple H1s, improper semantics).
   - Canonical Link Tags (missing, mismatch).
   - Viewport & Mobile-Friendliness (missing viewport tag).
   - Accessibility (missing image `alt` attributes, HTML `lang` attributes, contrast checks).
   - Structured Data (JSON-LD syntax and presence).
   - Server Performance (Time to First Byte > 1,200ms).
   - Broken links & HTTP error codes.

3. **Transparent Health Scoring:**
   - 0–100 Overall Health Score calculated from weighted category scores: Technical (30%), SEO (35%), Performance (20%), Accessibility (15%).
   - Deductions based on issue severity: Critical (-15), High (-7), Medium (-3), Low (-1).

4. **CROX AI Assistant:**
   - Powered by Google Gemini (`gemini-2.5-flash`) via server-side `@google/genai` or direct API proxy.
   - Generates production-ready HTML and configuration snippets for detected issues.
   - Context-aware chat copilot answering technical SEO questions.
   - NOVA can generate niche-aware keyword ideas and directional market briefs when `GEMINI_API_KEY` is configured; a transparent local expansion/brief is used otherwise.

5. **Reports & Comparison:**
   - RFC-4180 compliant CSV export containing issues, evidence, and recommendations.
   - Scan comparison comparing baseline vs current scans, showing resolved and new issues.
6. **AI Fix Studio:**
   - Generate remediation drafts from audit issue evidence, severity, category, and affected URL.
   - Review drafts, copy them, and mark them approved or rejected; drafts are session-local and do not auto-publish website changes.
7. **Keyword & Market Research:**
   - Generate seed phrase variations, classify search intent, and group phrases into topic clusters.
   - Filter keyword ideas by intent and export the working list as CSV.
   - Compare publicly accessible homepage title/meta/H1/canonical signals with SSRF checks and no automatic redirect following.
   - Generate a niche strategy brief with audience hypotheses and a 30-day validation plan.

---

## Setup & Running Instructions

### 1. Install Dependencies
```bash
# Install frontend & full-stack dependencies
npm install

# Install Python backend dependencies
pip3 install -r backend/requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key variables:
- `GEMINI_API_KEY`: Enables Gemini-powered NOVA chat, keyword ideation and market strategy briefs (automatically injected in AI Studio). For local Node.js runs, `server.ts` loads this from `.env`.
- `JWT_SECRET`: Set a unique random value of at least 32 characters before production deployment; the server intentionally refuses to start in production without a valid configured secret.
- `PAGESPEED_API_KEY`: Optional for Google PageSpeed Insights live tests.
- `DATABASE_URL`: Defaults to `sqlite:///./crox.db`.

### 3. Run the Full-Stack Application
```bash
npm run dev
```
This launches the Express + TypeScript API and Vite frontend together on port 3000. The current frontend sends authentication requests to `/api/auth/register` and `/api/auth/login`; the account API must be running for sign-up/sign-in to work. Do not open `index.html` directly or use `vite preview` alone. For production, build with `npm run build`, set `JWT_SECRET` in the host environment, and run the app as a Node.js service with `npm start`. Static-only hosting cannot run the account API. The separate Python FastAPI implementation under `backend/app` can be run independently when you specifically want to use that backend.

### 4. Running the Standalone Python Backend (Optional) & Tests
```bash
# Install Python backend dependencies
pip3 install -r backend/requirements.txt

# Run the separate FastAPI implementation
python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

# Test the TypeScript backend used by `npm run dev`
npm run test:backend

# Optional: test the separate Python implementation
PYTHONPATH=. pytest
```

---

## Feature Availability Matrix

| Feature | Works Out-of-the-Box (No API Key) | Requires API Key |
|---|---|---|
| Website Crawler & SSRF Guard | ✅ Yes | None |
| Robots.txt & Sitemap Discovery | ✅ Yes | None |
| All 15+ SEO & Technical Rules | ✅ Yes | None |
| Health & Category Scoring (0-100) | ✅ Yes | None |
| Scanned Pages & Response Times | ✅ Yes | None |
| Issue Resolution & Tracking | ✅ Yes | None |
| CSV Report Generation & Download | ✅ Yes | None |
| Multi-Scan Comparison | ✅ Yes | None |
| CROX AI Automated Fix Generator | ⚠️ Fallback Guide provided | `GEMINI_API_KEY` |
| NOVA AI Copilot Chat | ⚠️ Contextual helper provided | `GEMINI_API_KEY` |
| Keyword idea expansion & intent classification | ✅ Heuristic/contextual fallback | `GEMINI_API_KEY` for AI ideation |
| Live search volume / CPC | ❌ Not fabricated | An integrated Google Ads/Semrush or other licensed keyword-data provider |
| Competitor homepage metadata comparison | ✅ Public homepage inspection | None |
| Market strategy brief | ✅ Starter template fallback | `GEMINI_API_KEY` for personalized AI brief |
| Google PageSpeed Lab Vitals | ⚠️ Guidance provided | `PAGESPEED_API_KEY` |
