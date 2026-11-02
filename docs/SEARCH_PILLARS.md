# CROX Search Intelligence: SEO, AEO and GEO

The dashboard exposes three separate workspaces. One site crawl supplies the shared page evidence; the workspaces apply different sets of checks to that evidence.

## SEO

SEO remains the technical and on-page audit foundation: crawlability, indexability, titles, descriptions, headings, canonical tags, links, images, structured data, performance and accessibility. SEO issues are stored in the scan and flow into reports and Fix Center.

## AEO readiness

AEO measures crawl-derived answer readiness for HTML pages. The current weighted checks are: crawlability/indexability (22%), question-and-answer patterns (22%), heading hierarchy (16%), extractable/scannable content (16%), relevant structured data (14%), and short answers/definitions (10%).

The crawler stores H2/H3 headings, question headings, short paragraph counts, definition patterns, FAQ/Q&A schema types, JSON-LD types, lists and tables. These are structural signals, not a guarantee of selection in an answer engine.

## GEO readiness

GEO measures crawl-derived foundations for generative discovery. The weighted checks are: discoverability/indexability (22%), entity/brand signals (18%), evidence-rich content (20%), authorship/freshness (14%), topical structure (14%), and metadata/schema consistency (12%).

The crawler stores schema types, organization/person/product/local-business hints, publisher/site name, authorship, publication/update dates, content depth, lists, tables and external reference domains.

## Score meaning and data limits

AEO and GEO scores are transparent, deterministic readiness assessments on HTML pages from a fresh crawl that includes search-signal snapshot version 1. Non-HTML and failed pages are excluded. Older saved scans are marked as needing a fresh crawl rather than assigning zero scores to signals that were never collected. A missing signal is not proof that an AI platform does not understand a page. These scores do not represent ChatGPT, Gemini, Perplexity or Google AI Overviews mentions, citations, rank, traffic or share of voice. Those require repeated platform-specific tests or a connected provider with a documented methodology.

Structured data is scored as a context signal only. Do not add markup that does not accurately describe visible page content, and do not promise ranking or citation gains from schema alone.

## Crawler safeguards

Redirect destinations are validated before each redirect request, cross-domain redirects are not followed, and robots/sitemap/HTML response bodies are byte-limited. The URL validator performs DNS/IP screening; network-level IP pinning against DNS rebinding remains a separate hardening item for high-risk deployments.
