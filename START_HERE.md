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

5. Open the local URL printed in the terminal (normally `http://localhost:3000`).
6. CROX opens directly into the dashboard in this build. Login/signup screens are bypassed as requested; scans can run anonymously. Login can be re-added later.

**Important:** Do not open `index.html` directly, and do not use `npm run preview` as the app server. Those only serve the frontend and do not run the account API. Use `npm run dev` locally, or deploy this as a **Node.js full-stack app** with the start command `npm start` (not a static-only site).

## Optional AI setup

Set `GEMINI_API_KEY` in `.env` to enable Gemini-backed NOVA chat, keyword suggestions and niche briefs. Without it, the app uses contextual fallback keyword expansion and a starter strategy template. Never place API keys in frontend code or commit `.env` to source control.

Before a production deployment, set `JWT_SECRET` in your host's environment settings to a unique random secret of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. The example placeholder is not a valid production secret; if production starts without a valid secret, the API intentionally refuses to start. Deploy the frontend and backend together as a Node.js app so `/api/auth/register`, `/api/auth/login`, and `/api/health` are reachable on the same origin.

## What the research tools do

- **Keyword Research:** expands a seed topic into keyword ideas, labels likely search intent, groups ideas into themes and exports the list to CSV.
- **Market Research:** inspects public homepage title/meta description/H1/canonical signals for two sites and generates a niche-oriented strategy brief.
- **NOVA:** AI copilot for SEO guidance, contextual ideation and a practical validation plan.

Keyword demand, CPC, ranking positions, backlink counts and competitor traffic are **not** presented as live data. Those require a connected search/keyword-data provider. The market comparison is a homepage metadata inspection, not a full-site crawl or live SERP analysis.

## Build / test commands

```powershell
npm run build
npm run test:backend
```

Python backend syntax checks passed. The backend test suite had 7 passing tests and 1 DNS-dependent test that could not pass because this environment cannot resolve public domains. A complete frontend build could not be run because npm dependency installation timed out in this environment; run `npm install` then `npm run build` on your machine.
