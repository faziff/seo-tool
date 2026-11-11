# CROX Reference Dashboard Update

## What changed

- Rebuilt the signed-in workspace shell around the supplied CROX executive dashboard reference: full-width top navigation, tool search, create-tool action, left SEO navigation rail and a responsive main workspace.
- Recreated the dashboard information hierarchy: domain heading and filters, five SEO metric cards, a Site Health gauge, analytics source tabs, an audit-history chart, Site Performance and Audit Summary panels.
- Kept the visual language close to the reference: soft blue-grey canvas, light sidebar, white cards, rounded controls, blue actions and restrained purple chart accents.
- Added mobile navigation and responsive dashboard layouts.
- Wired dashboard values to saved CROX scan/report data. Audit-history chart points open the corresponding saved scan; audit JSON export, project creation, settings, Google site search, share/copy and CROX AI actions are connected to existing routes or flows.
- Google Analytics and Google Search Console tabs show a connection-required state until real credentials/data are configured. External traffic, authority, AI visibility and brand mention cards remain unavailable rather than displaying fabricated metrics. Device, market and search-engine segmentation stays disabled until a suitable analytics source is connected.
- The product assistant and provider labels use CROX AI branding.

## Existing backend and data scope

- The running full-stack application uses the existing TypeScript/Express server (`server.ts`) and its `/api` routes.
- The ZIP also contains a Python FastAPI backend under `backend/`. Existing project documentation describes that Python service as a legacy/separate implementation; it is not started by `npm run dev` or `npm start`. This update does not switch the app to Python or start a second backend, because doing so without migrating and testing API contracts could break authentication, scan jobs, saved reports or AI provider settings. The Python source is retained in the package.
- The dashboard uses the saved crawl/report data currently exposed by the Node API. It does not invent Google traffic, backlink authority, keyword rank or AI-platform mention figures.

## Validation

- Updated TypeScript/TSX files were syntax-transpiled. A full dependency-backed Vite build and backend tests still need to be run in an environment where `npm install` can complete.
- After extracting the project, run `npm install`, then `npm run build` and `npm run test:backend`.
