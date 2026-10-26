# CROX — Search Intelligence Workspace

CROX is an original SEO workspace built with React, Vite, TypeScript and an Express API. It combines authenticated site audits, keyword ideation, page-level checklist findings, technical diagnostics, performance/accessibility views, competitor homepage snapshots, exportable reports and the NOVA assistant.

## Main areas

- **Public landing page** at `/` and separate `/signup` and `/login` routes.
- **Workspace overview** with site health, crawl activity, top issues and stored scans.
- **Site Audit and Audit Checklist** for discovered pages and title/meta/H1/canonical/alt/schema/Open Graph/HTTPS checks.
- **Keyword Research** with search-intent labels, topic clusters, filtering and CSV export. Search volume and CPC are only shown as live when a data provider is configured.
- **Fix Center, SEO Analysis, Performance, Accessibility, Technical Issues, Market Research, Reports and Settings**.
- **Account-scoped storage and daily credits** for audits, AI requests and keyword research. Default daily allowances are 3 audits, 15 AI requests and 5 keyword searches, with optional bonus credits for administrators.
- **Light/dark dashboard theme**, with the choice saved in the browser.

## Architecture

`server.ts` starts Express and mounts the TypeScript API from `src/backend/routes.ts`. In development the server also attaches Vite middleware; with `NODE_ENV=production`, it serves the `dist` build. The legacy FastAPI implementation in `backend/app` is separate and is not started by `npm start` or `npm run dev`.

The Node backend uses `src/backend/db.ts` and `sql.js` for the account, scan, usage, and checklist data store. By default it writes its database outside this source folder under `../crox-data/crox.sqlite`; `DB_PATH` can override the location. Do not include live database files in source ZIPs or commits.

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
| `GEMINI_API_KEY` | Optional Gemini-backed NOVA chat, keyword ideation, market briefs and AI-generated fix drafts. Local fallbacks remain available for supported features. |
| `PAGESPEED_API_KEY` | Optional Google PageSpeed Insights data. Without it, live PageSpeed data is unavailable rather than fabricated. |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Optional provider credentials for live keyword data. |
| `AGENT_API_URL`, `AGENT_API_KEY` | Optional external agent provider settings. |
| `ADMIN_EMAIL` | Optional email allowed to use protected admin user/credit endpoints. |
| `DB_PATH` | Optional database file location. |
| `NODE_ENV`, `DISABLE_HMR` | Runtime mode and development HMR setting. |

Keep actual API keys and `.env` private. Never hard-code secrets into frontend source or commit them to source control.

## Build and checks

```bash
npm run build
npm run lint
npm run test:backend
```

`npm run lint` runs TypeScript's no-emit check. `npm run test:backend` runs the Node backend test harness. Install dependencies first. The separately maintained Python tests under `backend/tests` apply only to the FastAPI implementation.

## Honest data scope

Crawler findings are generated from the publicly reachable pages inspected during a scan. Keyword suggestions and difficulty labels may be heuristic; verified search volume/CPC, rankings, a full inbound backlink index, and competitor traffic analytics require their respective live data providers. A saved fix is a reviewable draft; approval does not automatically deploy code to the audited site.
