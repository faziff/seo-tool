# CROX Reference Dashboard UI Update

The signed-in workspace has been rebuilt around the supplied CROX SEO Executive Dashboard screenshot. The current design uses a full-width header, quick tool search, left SEO navigation, project/domain heading and filters, metric cards, health gauge, source tabs, audit-history chart, Site Performance and Audit Summary panels. Responsive layouts are included for tablet and mobile.

The visual treatment follows the reference: soft blue-grey background, light navigation rail, white rounded panels, blue primary actions and restrained purple chart accents.

## Functionality and source data

- Site Health, pages crawled, issue counts, performance score and audit summaries use saved CROX crawl/report data.
- Chart history is based on completed scans; a chart point opens its saved audit. Date range filtering applies to the local audit history.
- Project creation, route navigation, settings, Google site search, share/copy, JSON audit export and CROX AI entry points use existing app functionality.
- Google Analytics and Google Search Console tabs show a connection-required state until configured. Traffic, authority, rankings, AI visibility and mentions are never fabricated.
- Device, market and search-engine segmentation is disabled until a supporting analytics integration is connected.

## Backend

The active full-stack backend remains the existing TypeScript/Express server (`server.ts`). The Python FastAPI project in `backend/` is preserved as a separate legacy backend and is not started by the app's standard `npm run dev` or `npm start` commands. No backend migration was attempted in this UI update.

## Validation

- TypeScript/TSX syntax transpilation should be run on all project source files.
- Install dependencies with `npm install`, then run `npm run build` and `npm run test:backend` before deployment.
- A full dependency-backed build could not be completed in the editing environment because dependency installation timed out.
