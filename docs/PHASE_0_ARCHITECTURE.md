# CROX Phase 0 — architecture and audit notes

## What was already present

The repository already had a React + Vite + TypeScript client, an Express/TypeScript server entry point (`server.ts`), a SQLite-compatible persistence wrapper (`src/backend/db.ts`, currently implemented with `sql.js`), email/password signup and login with bcrypt hashes and JWT bearer tokens, account-scoped scans and credits, a crawler and technical audit pipeline, a NOVA helper, and existing SEO/keyword/report pages. Phase 0 extends those implementations instead of replacing them.

## Phase 0 changes

- **Workspace projects:** a persistent `projects` table and account-scoped list/create/update/delete API routes. Each project stores its domain, target URL, market country, and timestamps.
- **Conversation storage foundation:** `ai_conversations` and `ai_messages` tables plus DB methods for Phase 1. The streaming chat endpoint is intentionally not implemented in Phase 0.
- **Provider-neutral AI gateway:** `src/backend/ai_provider.ts` centralizes Gemini and OpenAI-compatible Hermes, OpenRouter, and Groq text generation. It supports server-only credentials, provider/model selection, TTL response caching, duplicate-request coalescing, timeouts for compatible endpoints, and redacted error details. Missing credentials leave the existing deterministic/local guidance available.
- **Reusable external-request cache:** `src/backend/request_cache.ts` hashes request descriptors, supports configurable TTLs, coalesces concurrent duplicate requests, bounds in-memory entries, and does not cache failed requests. Existing DataForSEO keyword-volume and Google PageSpeed requests use it, as does Google autocomplete; future modules can share it.
- **Google OAuth option:** server routes implement authorization-code sign-in when Google credentials are supplied. Email/password sign-in remains available independently.
- **Request protections:** baseline API request throttling, tighter request-body limits, security response headers, and an additional failed-login throttle.
- **Workspace UI:** Semrush-inspired grouped navigation and a project-oriented home page with the global analyze field, project creation, existing scan history, and clear labels when analytics are not connected. Unbuilt suites are marked as roadmap shells rather than shown as live reports.

## Current folder map

```text
server.ts                       Express + Vite/production server
src/
  App.tsx                        authenticated shell and tab routing
  components/                    shared UI, sidebar, workspace home, auth
  pages/                         existing audit/SEO/keyword/report pages
  services/api.ts                typed client calls to /api
  types/index.ts                 shared frontend types
  backend/
    routes.ts                    crawler/audit REST API and health endpoint
    platform_routes.ts           auth, credits, project and platform routes
    db.ts                        persistence adapter and SQL schema
    auth.ts                      password hashing and JWT authorization
    ai_provider.ts               provider-agnostic server-only AI gateway
    ai_service.ts                NOVA strategy, local advice and fix drafts
    ...                          crawler, scoring, reporting and data services
```

## Suggested next structure as modules are implemented

Add these folders incrementally as the relevant phase is built; do not move existing files merely for aesthetics:

```text
src/backend/
  modules/
    site-audit/       crawl orchestration, audit rules, issue fixes
    keywords/         keyword ideas, SERP/volume adapters, clustering
    rank-tracking/    scheduled ranks, history, alerts
    backlinks/        backlink provider adapters and audit workflows
    ai-visibility/    prompt runs, citations, mention/sentiment analysis
    local-seo/        listing/review/rank-grid integrations
    content/          briefs, writer, content audit
  providers/
    dataforseo.ts
    pagespeed.ts
    google-search-console.ts
    google-analytics.ts
  jobs/               retryable crawl/rank/AI visibility queue
  lib/                validation, cache, logging, shared server utilities
```

When moving to `better-sqlite3` or PostgreSQL, first formalize the current `db.ts` operations behind a storage interface and run the same persistence tests against both adapters. The existing repository uses `sql.js`; Phase 0 keeps that working adapter to avoid a risky engine swap during the foundational UI/auth changes.

## Data and trust rules

- API credentials are read only by the server. Do not put provider keys in `VITE_*` variables or frontend source.
- `AI_PROVIDER` can select `gemini`, `hermes`, `openrouter`, or `groq`. If unset, CROX chooses the first configured provider in that order. If explicitly selected but missing a key, it stays in demo/local mode rather than silently using another provider.
- Cached AI and external API responses are keyed by normalized request descriptors and credential fingerprints, then stored under a hash; prompts and credentials are not printed to logs by the cache layer.
- Keyword ideas and market briefs remain estimates until supported by real search/analytics data providers. The UI must not label absent data as live data.
- Google OAuth is optional. For production use HTTPS and an exact callback URL registered in Google Cloud Console.
- Phase 1 is still needed for tool-calling NOVA chat, streamed SSE responses, and per-project conversation handling in the API.
