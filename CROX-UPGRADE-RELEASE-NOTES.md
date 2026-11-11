# CROX upgrade release notes

This release keeps the existing landing page untouched and focuses on the signed-in workspace, backend integrations, keyword research, and sidebar navigation. It also includes the earlier Module 1 content brief/content audit implementation from the previous delivery.

## Implemented in this release

### 1. Google Analytics 4 + Google Search Console

- Added a separate read-only Google OAuth flow. It does not change the Google sign-in flow.
- Added server routes for starting OAuth, handling the callback, checking status, listing available properties, saving per-project property mappings, disconnecting, and loading dashboard analytics.
- Google access/refresh tokens are encrypted with the existing AES-256-GCM key vault and are never returned to the browser.
- GA4 reporting shows Organic Search sessions, active users, page views, and a daily organic-session trend.
- Search Console reporting shows clicks, impressions, CTR, average position, a daily trend, and a sample of top queries.
- Dashboard source tabs now load the selected project's real Google reports rather than showing static placeholder values.
- Analytics are explicitly reported as Google-sampled measurements. Search Console reporting delay and top-row limits are disclosed.

### 2. Keyword research expansion

- Added the DataForSEO Labs Google Keyword Suggestions endpoint, wrapped in the existing request cache.
- Users can request 50, 100, or 250 ideas.
- Provider-reported search volume, CPC, difficulty, and monthly trend are shown as provider data only when returned.
- Without DataForSEO credentials or usable provider results, CROX falls back to Google Autocomplete plus generated keyword patterns. Search volume/CPC/difficulty are labelled as estimates, and missing trend data stays unavailable.
- The current release caps UI/API requests at 250 ideas to limit cost and result-processing load. DataForSEO bills provider usage; configure a valid account before enabling it for users.

### 3. Expandable tool navigation

- Reorganized the sidebar into tool groups: Workspace, SEO & Site Health, Keyword Intelligence, Competitor Research, Rank Tracking, Backlink Intelligence, Content Tools, AI Search/AEO/GEO, Local SEO, and Strategy.
- Groups expand on hover, keyboard focus, or click and display nested destinations.
- The public landing page was not redesigned.

### 4. Database access abstraction

- Added an internal storage-driver interface while preserving the existing `DatabaseStore` methods (`all`, `get`, and `run`) and the current SQL.js database-file format.
- **Important: this is an adapter foundation, not a completed migration to `better-sqlite3` or PostgreSQL.** The active adapter remains SQL.js. No database file conversion is required for this release, and no native database dependency was added because npm package-registry access was unavailable during validation.

### 5. Previously delivered Module 1 retained

- The content brief generator and page content audit from the previous Module 1 delivery remain included.
- Content briefs are stored as drafts and are scoped to the authenticated user; project ownership is checked when applicable.

## Not implemented in this release

These are not represented as working integrations yet:

- AI Visibility prompt runs, provider sampling, citation/mention detection, sentiment, history, and scheduler.
- Local rank-grid checks and their DataForSEO coordinate-based queries.
- Google Business Profile OAuth/API connection and listing sync.
- New SEO/GEO/AEO scoring logic beyond the existing CROX modules.
- Live backlink authority metrics unless an actual backlink provider is configured.

Some sidebar destinations for these future modules open the existing module-preview/roadmap screens. They are not live features yet. In particular, AEO/GEO readiness indicators must not be described as actual ChatGPT/Gemini rankings.

## Environment configuration

Add these server-side values in the Hostinger Node application environment:

```env
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
GOOGLE_DATA_REDIRECT_URI="https://YOUR_DOMAIN/api/integrations/google-data/callback"
```

Keep the existing Google sign-in redirect (`GOOGLE_REDIRECT_URI`) separate. Do not use `VITE_` prefixes for Google credentials. Keep a stable `JWT_SECRET` of at least 32 characters, or set `AI_KEYS_ENCRYPTION_SECRET` to a separate stable 32+ character secret, because the existing key vault uses it to encrypt Google tokens. Do not rotate that secret without migrating/re-encrypting stored credentials.

For live keyword metrics, also configure the existing server-side `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` values. Without them, generated keyword ideas are available but provider metrics are not.

## Google Cloud manual setup

1. In Google Cloud Console, create/select a project and configure an OAuth consent screen and a Web application OAuth client.
2. Enable **Google Analytics Admin API**, **Google Analytics Data API**, and **Google Search Console API** for that Cloud project.
3. Register the exact authorized redirect URI `https://YOUR_DOMAIN/api/integrations/google-data/callback` on the OAuth client. It must match `GOOGLE_DATA_REDIRECT_URI` exactly, including HTTPS and path.
4. Add the three Google environment variables above to the Hostinger server environment and redeploy/restart the Node app.
5. Sign in to CROX, create/select a project, open **Settings → Integrations**, connect the Google account, select the matching GA4 property and/or Search Console site, and save the project mapping.
6. Return to Dashboard and select the **Google Analytics** or **Google Search Console** tab. The connected Google account must have access to the selected property/site. Depending on OAuth audience and Google's current policy classification, production use may require consent-screen verification; check the status shown in Google Cloud Console.

## Install and verification commands

From the project root on the Hostinger build environment:

```bash
npm ci
npm run lint
npm run test:backend
npm run build
```

No new npm dependency was added for this release.

## Validation performed in this build environment

- TypeScript syntax transpilation: **passed for 62 `.ts`/`.tsx` files**.
- SQLite schema smoke test: **passed** for the required tables and representative inserts.
- Full TypeScript project typecheck: **not verified**; `node_modules` was unavailable.
- Backend test suite and Vite production build: **not verified**; dependency installation could not complete because the npm registry was unreachable from this environment.
- Google OAuth and Google report API calls: **not end-to-end tested** because no user's Google Cloud credentials/property access were available.

Do not treat the package as production-verified until the install, lint, backend test, and build commands pass in the target Hostinger environment, and a real Google account/property completes the connection flow.
