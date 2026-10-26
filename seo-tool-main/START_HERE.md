# CROX — Start Here

## Run on Windows

1. Extract this ZIP into a folder.
2. Install Node.js 22 or later.
3. Open PowerShell in the extracted project folder.
4. Install packages and start CROX:

   ```powershell
   npm install
   Copy-Item .env.example .env
   notepad .env
   npm run dev
   ```

5. Open the local URL printed in the terminal (normally `http://localhost:3000`). You will land directly in the dashboard; this build intentionally has no sign-in or registration screen.

**Important:** Do not open `index.html` directly or use `npm run preview` as the app server. Use `npm run dev` locally, or build with `npm run build` and run the app as a full-stack Node.js service with `npm start`. Static-only hosting cannot run the crawl and Fix Center API.

## Optional AI and PageSpeed setup

Set `GEMINI_API_KEY` in `.env` to enable Gemini-backed NOVA chat, keyword suggestions, niche briefs and AI-assisted fix drafts. Without it, CROX uses local rule-based remediation drafts and transparent heuristic research. Set `PAGESPEED_API_KEY` to enable real Google PageSpeed Insights / Lighthouse results. Without that key, the app reports PageSpeed as not configured rather than inventing Core Web Vitals.

Keep keys in the server environment only. Never put them in frontend code or commit `.env` to source control.

## What Fix Center does

1. Run a website audit and open **Fix Center**.
2. Generate remediation drafts from saved, unresolved issue evidence.
3. Review and edit each draft, copy its snippet, then mark it approved or rejected.
4. Drafts and their statuses are saved in the local CROX JSON store at `.data/crox_store.json`.

**Approval is a review status, not a live-site deployment.** CROX does not automatically edit the website. WordPress, Shopify or hosting deployment connections must be added separately before publishing can be automated.

## Security note about dashboard-only mode

The login/account screens and authentication API routes have been removed so you can install your preferred authentication later. The current workspace API is unauthenticated and shares the scan history for this installation. Do not expose it as a public multi-user service until you add access control, per-user data isolation, and suitable rate limits.

## Current runtime and project scope

`npm run dev` starts the Express + TypeScript API from `server.ts` and the React/Vite UI. A separate legacy FastAPI implementation remains under `backend/app`; it is not the backend used by the Node.js run command.

The SEO crawler checks public pages and common technical/on-page rules. Keyword demand, CPC, rankings, backlink counts and competitor traffic are not claimed as live data without a connected licensed data provider. Market research inspects public homepage metadata, not full competitor traffic or SERP datasets.

## Build and test

```powershell
npm run build
npm run test:backend
```

Run these after `npm install`. `npm run test:backend` runs the TypeScript backend tests; `backend/requirements.txt` and the Python `pytest` suite apply only to the separate FastAPI implementation.
