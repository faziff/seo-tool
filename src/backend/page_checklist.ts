import { ChecklistItem, PageChecklist } from './db.js';
import { ExtractedPageData } from './crawler.js';

function item(key: string, label: string, status: ChecklistItem['status'], detail: string, fix: string): ChecklistItem {
  return { key, label, status, detail, fix };
}

export function buildPageChecklist(page: ExtractedPageData): PageChecklist {
  const https = page.url.toLowerCase().startsWith('https://');
  const title = (page.title || '').trim();
  const meta = (page.metaDescription || '').trim();
  const h1 = page.h1List || [];
  const canonical = (page.canonicalUrl || '').trim();
  const images = page.images || [];
  const missingAlt = images.filter(img => !img.hasAlt).length;
  const hasSchema = (page.jsonLdList || []).length > 0;
  const ogOk = !!(page.ogTitle && page.ogDescription);

  const items: ChecklistItem[] = [
    !title
      ? item('title', 'Title', 'Missing', 'No <title> tag was found.', 'Add a unique <title> of about 30–60 characters that names the page topic.')
      : title.length < 20 || title.length > 70
        ? item('title', 'Title', 'Problem', `Title is ${title.length} characters.`, 'Tighten or expand the title to roughly 30–60 characters without stuffing keywords.')
        : item('title', 'Title', 'Found', title.slice(0, 180), 'Keep the title unique and aligned with the primary heading.'),
    !meta
      ? item('meta', 'Meta description', 'Missing', 'No meta description was found.', 'Add a unique meta description of about 120–160 characters that explains why someone should click.')
      : meta.length < 70 || meta.length > 170
        ? item('meta', 'Meta description', 'Problem', `Meta description is ${meta.length} characters.`, 'Rewrite the description to roughly 120–160 characters with a clear value statement.')
        : item('meta', 'Meta description', 'Found', meta.slice(0, 220), 'Keep descriptions unique per URL.'),
    h1.length === 0
      ? item('h1', 'H1', 'Missing', 'No H1 heading was detected.', 'Add one visible H1 that matches the page intent.')
      : h1.length > 1
        ? item('h1', 'H1', 'Problem', `${h1.length} H1 headings found. First: ${h1[0]}`, 'Keep a single primary H1 and demote extra headings to H2/H3.')
        : item('h1', 'H1', 'Found', h1[0], 'Keep a single, descriptive H1.'),
    !canonical
      ? item('canonical', 'Canonical', 'Missing', 'No canonical link was found.', 'Add <link rel="canonical" href="https://example.com/preferred-url"> pointing to the preferred URL.')
      : item('canonical', 'Canonical', 'Found', canonical, 'Confirm the canonical matches the live preferred URL.'),
    images.length === 0
      ? item('alt', 'Alt text', 'Found', 'No content images were detected on this page.', 'When you add informative images, include concise alt text.')
      : missingAlt > 0
        ? item('alt', 'Alt text', 'Problem', `${missingAlt} of ${images.length} images are missing alt text.`, 'Add descriptive alt attributes to informative images; use alt="" only for decorative images.')
        : item('alt', 'Alt text', 'Found', `All ${images.length} detected images include alt text.`, 'Keep alt text accurate as images change.'),
    hasSchema
      ? item('schema', 'Schema', 'Found', `${page.jsonLdList.length} JSON-LD block(s) detected.`, 'Validate types against visible page content.')
      : item('schema', 'Schema', 'Missing', 'No JSON-LD structured data was found.', 'Add relevant JSON-LD (WebPage, Organization, FAQ, Product, etc.) that matches visible content.'),
    ogOk
      ? item('og', 'OG tags', 'Found', `og:title “${page.ogTitle}” and og:description are present.`, 'Keep Open Graph tags aligned with the title and description.')
      : !page.ogTitle && !page.ogDescription && !page.ogImage
        ? item('og', 'OG tags', 'Missing', 'No Open Graph tags were found.', 'Add og:title, og:description and og:image for cleaner social previews.')
        : item('og', 'OG tags', 'Problem', 'Open Graph tags are incomplete.', 'Provide og:title, og:description and og:image together.'),
    https
      ? item('https', 'HTTPS', 'Found', 'This URL is served over HTTPS.', 'Keep HTTP requests redirected to HTTPS.')
      : item('https', 'HTTPS', 'Problem', 'This URL is not using HTTPS.', 'Install a TLS certificate and redirect HTTP to HTTPS.')
  ];

  return { items };
}
