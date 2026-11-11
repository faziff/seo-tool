# CROX — Search Intelligence Workspace

CROX is an original SEO workspace built with React, Vite, TypeScript and an Express API. It combines authenticated site audits, keyword ideation, page-level checklist findings, technical diagnostics, performance/accessibility views, competitor homepage snapshots, exportable reports and the CROX AI assistant.

## Main areas

- **Public landing page** at `/` and separate `/signup` and `/login` routes.
- **Dashboard** opens with live audit KPIs, a health-score history chart, issue-severity distribution, site health, priority issues and recent scan activity. Metrics are sourced from saved scans; traffic, keyword ranking and backlink totals are not fabricated when their providers are unavailable.
- **Projects** contains project creation, website/keyword analysis, SEO/AEO/GEO workspaces and the existing scan workflow.
- **Site Audit and Audit Checklist** for discovered pages and title/meta/H1/canonical/alt/schema/Open Graph/HTTPS checks.
- **Keyword Research** with search-intent labels, topic clusters, filtering and CSV export. Search volume and CPC are only shown as live when a data provider is configured.
- **AEO workspace** checks question coverage, direct answer patterns, heading structure, structured data and extractable content. **GEO workspace** checks entity clarity, evidence structure, authorship/freshness, topical depth and metadata/schema context. SEO Analysis, Fix Center, Performance, Accessibility, Technical Issues, Market Research, Reports and Settings remain available.
- **Account-scoped storage and daily credits** for audits, AI requests and keyword research. Default daily allowances are 3 audits, 15 AI requests and 5 keyword searches, with optional bonus credits for administrators.
- **Light/dark dashboard theme**, with the choice saved in the browser.

## Architecture

`server.ts` starts Express and mounts the TypeScript API from `src/backend/routes.ts`. In development the server also attaches Vite middleware; with `NODE_ENV=production`, it serves the `dist` build. The legacy FastAPI implementation in `backend/app` is separate and is not started by `npm start` or `npm run dev`.

The Node backend uses `src/backend/db.ts` and `sql.js` for account, project, scan, usage, checklist and AI-conversation storage. By default it writes its database outside this source folder under `../crox-data/crox.sqlite`; `DB_PATH` can override the location. Do not include live database files in source ZIPs or commits. The adapter is intentionally unchanged in this phase; see [`docs/PHASE_0_ARCHITECTURE.md`](docs/PHASE_0_ARCHITECTURE.md) for the audit, proposed modular structure and staged database migration notes.

## Run locally

Requirements: Node.js 22+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local URL printed in the terminal, normally `http://localhost:3000`. On Windows PowerShell use `Copy-Item .env.example .env`. Do not open `index.html` directly: the frontend depends on the Express API.

For a production-style launch, build and then run the server with `NODE_ENV=production` and a suitable `JWT_SECRET`:

```bash
npm run build
npm start
```

`npm start` listens on `process.env.PORT` when provided and defaults to `3000`.

## Environment variables

See `.env.example` for the complete variable list. The most important settings are:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | **Required in production.** Use a unique random secret of at least 32 characters. If omitted during local development, CROX generates a temporary random secret and sessions expire when the server restarts. |
| `PORT` | HTTP port; defaults to `3000`. |
| `AI_PROVIDER` | Optional server-level preference: `gemini`, `openai`, `anthropic`, `openrouter`, `groq`, `mistral` or legacy `hermes`. Per-user order is managed in Settings. |
| `AI_CACHE_TTL_SECONDS` | Server-side response-cache TTL for identical AI requests; defaults to 180 seconds. Set to `0` to disable AI response caching. |
| `API_CACHE_TTL_SECONDS` | TTL for repeatable external API requests such as DataForSEO keyword volumes and PageSpeed; defaults to 300 seconds. Set to `0` to disable response caching (concurrent duplicate requests are still coalesced). |
| `AI_KEYS_ENCRYPTION_SECRET` | **Required to save account-level provider keys**, unless a stable 32+ character `JWT_SECRET` is used as the encryption key source. Keep it unchanged or saved provider keys cannot be decrypted. |
| `GEMINI_API_KEY`, `GEMINI_API_KEYS`, `GEMINI_MODEL` | Optional server-level Gemini key pool/model. |
| `OPENAI_API_KEY`, `OPENAI_API_KEYS`, `OPENAI_MODEL` | Optional server-level OpenAI key pool/model (OpenAI Responses API). |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_API_KEYS`, `ANTHROPIC_MODEL` | Optional server-level Anthropic Claude key pool/model. |
| `MISTRAL_API_KEY`, `MISTRAL_API_KEYS`, `MISTRAL_MODEL` | Optional server-level Mistral key pool/model. |
| `HERMES_API_KEY`, `HERMES_BASE_URL`, `HERMES_MODEL` | Optional Hermes or another OpenAI-compatible endpoint, including a self-hosted endpoint. |
| `OPENROUTER_API_KEY`, `OPENROUTER_API_KEYS`, `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL` | Optional OpenRouter key pool and model selection. |
| `GROQ_API_KEY`, `GROQ_API_KEYS`, `GROQ_BASE_URL`, `GROQ_MODEL` | Optional Groq key pool and model selection. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Optional Google OAuth sign-in. Set the redirect URI to `https://your-domain.com/api/auth/google/callback` (or your registered local callback) exactly as configured in Google Cloud Console. |
| `PAGESPEED_API_KEY` | Optional Google PageSpeed Insights data. Without it, live PageSpeed data is unavailable rather than fabricated. |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Optional provider credentials for live keyword data. |
| `AGENT_API_URL`, `AGENT_API_KEY` | Optional external agent provider settings. |
| `ADMIN_EMAIL` | Optional email allowed to use protected admin user/credit endpoints. |
| `DB_PATH` | Optional database file location. |
| `NODE_ENV`, `DISABLE_HMR` | Runtime mode and development HMR setting. |

Keep actual API keys and `.env` private. Never hard-code secrets into frontend source or commit them to source control.

### CROX AI multi-provider setup

After signing in, open **Settings → Integrations → CROX AI multi-provider setup**. CROX supports server-managed key pools for Google Gemini, OpenAI, Anthropic Claude, OpenRouter, Groq and Mistral, plus an optional encrypted account-level key per provider. Server secrets are read only by the Node backend and are never returned to the browser. Account-level keys use AES-256-GCM and are also never returned after saving. Use **Test connection** to validate an authorized credential and move providers up/down in the fallback priority list. Provider API usage is billed by the provider and is separate from CROX credits.

For each provider, the legacy singular `*_API_KEY` variable is supported. Multiple server keys can be supplied as a comma- or newline-separated `*_API_KEYS` value, a JSON string array, or numbered variables such as `OPENAI_API_KEY_1`, `OPENAI_API_KEY_2` (up to 10). Set them in your hosting provider's secret manager, not in frontend `VITE_` variables or committed files. Keep a stable `AI_KEYS_ENCRYPTION_SECRET` of at least 32 characters before saving account-level keys; alternatively, CROX derives the encryption key from your stable `JWT_SECRET`. Never rotate either encryption secret without a deliberate credential re-encryption/migration plan, or existing saved account keys will no longer decrypt.

**Failover rules are deliberately conservative:** an HTTP 401 can move to another explicitly configured key for that provider because the failing credential is invalid/revoked. Quota/billing exhaustion, rate limits and temporary availability failures do not rotate through keys of the same provider (they may share one organisation quota); CROX performs at most one short retry when allowed, honours a short `Retry-After`, applies an in-process cooldown, then moves to the next independently configured provider when fallback is enabled. A 403 permission/region/policy refusal and fatal request errors stop the chain; CROX does not route around provider restrictions or safety decisions. Usage records track provider/model, status class, latency, character counts and attempt number for 90 days; raw keys, prompts and response bodies are not stored. Token-cost totals are not claimed because the supported adapters do not consistently return comparable billing data.

The OpenAI provider uses the Responses API. Gemini, Anthropic and compatible endpoints use their provider APIs. Default model IDs are examples based on provider documentation and can be changed to models enabled for your own account.

## Build and checks

```bash
npm run build
npm run lint
npm run test:backend
```

`npm run lint` runs TypeScript's no-emit check. `npm run test:backend` runs the Node backend test harness, including credential-pool parsing, simulated cross-provider failover and usage logging. Install dependencies first. Google sign-in stays disabled until all three Google OAuth variables are set; email/password authentication works without them. The separately maintained Python tests under `backend/tests` apply only to the FastAPI implementation.

## SEO, AEO and GEO data scope

AEO and GEO scores are crawl-derived readiness assessments, not measurements of actual ChatGPT, Gemini, Perplexity or Google AI Overviews mentions, citations, answer inclusion or ranking. Older scans need to be re-crawled before the new AEO/GEO signal snapshot can be assessed. Structured data is treated as context only and must match visible page content.

Crawler findings are generated from the publicly reachable pages inspected during a scan. Keyword suggestions and difficulty labels may be heuristic; verified search volume/CPC, rankings, a full inbound backlink index, and competitor traffic analytics require their respective live data providers. A saved fix is a reviewable draft; approval does not automatically deploy code to the audited site.
