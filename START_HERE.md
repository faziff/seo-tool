# CROX — Start Here

## Run on Windows

1. Extract the ZIP to a folder.
2. Install Node.js 22 or later.
3. Open PowerShell in the project folder.
4. Install dependencies and create your local environment file:

   ```powershell
   npm install
   Copy-Item .env.example .env
   notepad .env
   npm run dev
   ```

5. Open the URL printed in the terminal, normally `http://localhost:3000`. The public landing page opens first; use **Start free** to create an account or **Sign in** to access an existing workspace.

Do not open `index.html` directly. The crawler, account system, credit tracking and reports depend on the Express API. `npm start` runs the same full-stack server; for a production deployment, build first and set `NODE_ENV=production`, `JWT_SECRET` and `PORT` in the environment.

## Setup notes

- `JWT_SECRET` must be a unique random secret of at least 32 characters in production. The development-only fallback is not appropriate for public deployment.
- AI providers are selected server-side with `AI_PROVIDER=gemini`, `hermes`, `openrouter`, or `groq`. Add the matching provider key and optional model/base URL fields shown in `.env.example`. If credentials are missing, supported NOVA features use local/heuristic fallback guidance. `AI_CACHE_TTL_SECONDS` and the shared `API_CACHE_TTL_SECONDS` default to 300 seconds for their respective caches.
- Google sign-in is optional. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the exact registered `GOOGLE_REDIRECT_URI` to enable its button; email/password login works without Google setup.
- `PAGESPEED_API_KEY` enables real PageSpeed Insights data.
- `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` enable provider-backed keyword metrics when configured.
- `ADMIN_EMAIL` identifies the account that may use the protected admin user/credit routes.
- `DB_PATH` optionally overrides the local SQLite-compatible data-store path. Keep database files separate from source packages and backups.

Never paste secret values into frontend files or share your real `.env` file.

## Workspace workflow

1. Run a website audit from the Overview screen.
2. Review the overall score and move through Site Audit, Audit Checklist, SEO Analysis, Technical Issues and Performance.
3. Use Keyword Research to build a list of keyword ideas, filter by intent and export the selected set to CSV.
4. Use Fix Center and NOVA to draft potential improvements. Review any generated text or code before using it on a live website.
5. Check the header credits bar for remaining daily audit, AI and keyword allowances. Default allowances reset at midnight Pakistan time.

## Data scope

CROX labels estimated or heuristic keyword results; it does not invent live search volume, CPC, rankings, backlink counts or competitor traffic when those providers are not connected. A saved or approved remediation draft does not automatically change the audited site.

## Phase 0 architecture notes

The dashboard now has project-scoped storage and a Semrush-inspired grouped navigation. Some products are intentionally marked as roadmap shells until their data integrations exist; they do not display made-up live metrics. AI conversation tables are ready for Phase 1, but streaming/tool-calling chat is not part of Phase 0. Read [`docs/PHASE_0_ARCHITECTURE.md`](docs/PHASE_0_ARCHITECTURE.md) for the existing-code audit and suggested next module structure.
