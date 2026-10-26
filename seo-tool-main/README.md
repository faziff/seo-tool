# CROX — Website Audit & SEO Intelligence Platform

CROX is a website auditing and SEO intelligence workspace. It crawls public websites, checks technical/on-page SEO rules, calculates transparent health scores, and gives actionable remediation guidance. This delivery is **dashboard-only**: no login or account-registration gate is shown, so you can add your own authentication later. NOVA is CROX's face-free floating-orb AI identity for the Gemini-powered assistant, keyword ideation and niche strategy briefs.

## Architecture

The app started by `npm run dev` is an Express + TypeScript API with a React + TypeScript/Vite frontend. A separate legacy FastAPI backend is retained under `backend/app`; it is not used by the Node.js runtime command.

```text
crox/
  server.ts                    # Express + Vite full-stack runner
  src/
    App.tsx                    # Main dashboard shell, no login gate
    components/
      Sidebar.tsx              # Workspace navigation / recent scans
      Header.tsx               # Dashboard search, NOVA and settings actions
      NovaOrb.tsx              # Face-free floating AI orb
      ScannerHero.tsx          # Website scan entry point
      IssueDetailModal.tsx     # Audit evidence and suggested remediation
      AIAssistantDrawer.tsx    # NOVA copilot
    pages/
      FixCenterPage.tsx        # Persistent, editable remediation drafts
      SiteAuditPage.tsx        # Crawled-page explorer
      SEOAnalysisPage.tsx      # On-page SEO analysis
      PerformancePage.tsx       # Crawl timings and optional real PageSpeed data
      AccessibilityPage.tsx     # Accessibility checks
      TechnicalIssuesPage.tsx   # Technical issue diagnostics
      ReportsPage.tsx           # Saved reports / CSV export
      KeywordResearchPage.tsx   # Heuristic or Gemini keyword ideas
      MarketResearchPage.tsx    # Homepage metadata comparison
      SettingsPage.tsx          # API integration status and guardrails
    backend/
      routes.ts                 # Express API, crawler, Fix Center and PageSpeed routes
      db.ts                     # Local JSON persistence, including fixes
      crawler.ts                # Public-site crawler
      seo_audit.ts              # Technical/on-page audit rules
      scoring.ts                # Transparent health scoring
      ai_service.ts             # NOVA and fallback fix generation
      security.ts               # URL validation / SSRF restrictions
      test.ts                   # TypeScript backend tests
    services/api.ts             # Frontend API client
    types/index.ts              # Shared UI/domain types
  backend/app/                  # Separate legacy FastAPI implementation
  .data/crox_store.json         # Local scan, issue and fix draft persistence
```

## Key capabilities

### 1. Website crawling and technical audit
- Checks public target URLs with SSRF protections before crawling.
- Discovers pages through links and sitemap/robots signals.
- Audits page titles, meta descriptions, H1/heading structure, canonical tags, viewport, language and image alt text, structured data, response timing, redirects and broken links.
- Uses crawl findings to calculate a transparent 0–100 health score and issue severity counts.

### 2. Fix Center — reviewable remediation drafts
- Generates drafts from unresolved issues recorded in a completed scan.
- Uses Gemini when `GEMINI_API_KEY` is configured, with local rule-based guidance as a fallback.
- Stores drafts, evidence, editable snippets, provider mode and draft status in `.data/crox_store.json`.
- Supports search/filter, copy, edit, approve, reject and reopen/review workflows.
- Limits each generation batch to 15 issues and caps concurrent generation work.

**Important:** “Approved” means the draft has been reviewed. It does not write to the target website. Live changes require a separate, authenticated CMS/deployment integration and should be explicitly confirmed before publishing.

### 3. NOVA AI assistant
- Gemini-backed technical SEO help when configured.
- Context-aware keyword ideation and niche briefs.
- Transparent local fallback when the API key is missing or an AI request fails.
- Does not present estimated keyword ideas as live search volume, CPC, SERP rank or traffic data.

### 4. PageSpeed and performance
- Crawl timing cards use measurements from the crawl itself.
- Google Lighthouse / Core Web Vitals data is fetched from the real PageSpeed Insights API only when `PAGESPEED_API_KEY` is configured.
- If the API key is absent or the provider request fails, CROX reports that state instead of fabricating PageSpeed scores or vitals.

### 5. Reports and research
- CSV report export and historical scan comparison.
- SEO/on-page, technical, accessibility and scanned-page views.
- Public homepage metadata comparison for two sites, without claiming access to competitor analytics.

## Setup

### Requirements
- Node.js 22 or later.
- npm.

### Install and start

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local URL shown in the terminal (normally `http://localhost:3000`). On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp` if needed. Do not open `index.html` directly: that bypasses the API server.

### Optional environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini-backed NOVA chat, keyword ideas, briefs and Fix Center drafts; local fallback works without it |
| `PAGESPEED_API_KEY` | Real Google PageSpeed Insights / Lighthouse runs; optional |
| `PORT` | Server port; defaults to `3000` |

Keep secrets server-side and do not commit `.env` to source control.

## Build and tests

```bash
npm run build
npm run test:backend
```

A separate FastAPI implementation remains under `backend/app` and can be run separately after installing `backend/requirements.txt`; it is not required for the Node.js app above.

## Dashboard-only security boundary

Authentication UI and auth routes are deliberately not active in this build. All scans are stored in a shared, local single-workspace history. **Do not deploy this as a public multi-user service without adding authentication, per-user data isolation, rate limiting and access controls.**

## Honest data scope

No live search volume/CPC, competitor analytics, rankings or backlink data is claimed without a suitable external data provider. PageSpeed metrics come from Google's API when configured; they are not synthesized from crawl duration.
