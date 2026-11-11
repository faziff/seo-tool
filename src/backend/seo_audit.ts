import { ExtractedPageData } from './crawler.js';

export interface AuditIssue {
  id: string;
  rule_id: string;
  title: string;
  category: 'SEO' | 'Technical' | 'Performance' | 'Accessibility' | 'Crawlability';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  pages_affected: number;
  affected_url: string;
  evidence: string;
  explanation: string;
  recommendation: string;
  suggested_fix?: string;
  verification?: string;
  resolved: boolean;
  created_at: string;
}

export interface AuditResult {
  issues: AuditIssue[];
  passed_checks: string[];
  passed_checks_count: number;
  warning_checks_count: number;
  critical_checks_count: number;
  total_checks_count: number;
}

export class SEOAuditEngine {
  public static audit(pages: ExtractedPageData[], scanId: string): AuditResult {
    const issues: AuditIssue[] = [];
    const passedSet = new Set<string>();

    if (pages.length === 0) {
      return {
        issues: [],
        passed_checks: [],
        passed_checks_count: 0,
        warning_checks_count: 0,
        critical_checks_count: 0,
        total_checks_count: 0
      };
    }

    const now = new Date().toISOString();

    // 1. Missing Title Tag (Critical)
    const missingTitle = pages.filter(p => !p.title || p.title.trim() === '');
    if (missingTitle.length > 0) {
      issues.push({
        id: `${scanId}-title-missing`,
        rule_id: 'SEO_TITLE_MISSING',
        title: 'Missing Page Title Tag',
        category: 'SEO',
        severity: 'Critical',
        pages_affected: missingTitle.length,
        affected_url: missingTitle[0].url,
        evidence: `Found ${missingTitle.length} pages without a <title> element. Example: ${missingTitle[0].url}`,
        explanation: 'The title tag is one of the most critical on-page ranking factors. Search engines rely on it for understanding page topics and rendering SERP snippets.',
        recommendation: 'Add a distinct, descriptive <title> tag between 30 and 60 characters to each page head section.',
        suggested_fix: '<title>Primary Topic | Brand Name</title>',
        verification: 'Inspect page source or run a CROX re-scan to confirm the <title> tag is rendered.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Title Tag Presence');
    }

    // 2. Title Tag Length (Medium)
    const badLengthTitle = pages.filter(p => p.title && (p.title.length < 30 || p.title.length > 65));
    if (badLengthTitle.length > 0) {
      issues.push({
        id: `${scanId}-title-length`,
        rule_id: 'SEO_TITLE_LENGTH',
        title: 'Title Tag Length Suboptimal',
        category: 'SEO',
        severity: 'Medium',
        pages_affected: badLengthTitle.length,
        affected_url: badLengthTitle[0].url,
        evidence: `Page "${badLengthTitle[0].title}" has length of ${badLengthTitle[0].title?.length} characters (recommended 30-65 chars).`,
        explanation: 'Titles shorter than 30 characters underutilize keyword opportunities. Titles longer than 65 characters risk getting truncated in Google search results.',
        recommendation: 'Refine titles to stay between 30 and 60 characters for optimal desktop and mobile visibility.',
        suggested_fix: '<title>Concise Topic Keyword - Secondary Keyword | Brand</title>',
        verification: 'Check SERP preview simulator or verify title character count.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Title Tag Length');
    }

    // 3. Duplicate Title Tags (High)
    const titleMap: Record<string, string[]> = {};
    pages.forEach(p => {
      if (p.title) {
        titleMap[p.title] = titleMap[p.title] || [];
        titleMap[p.title].push(p.url);
      }
    });
    const dupTitles = Object.entries(titleMap).filter(([_, urls]) => urls.length > 1);
    if (dupTitles.length > 0) {
      issues.push({
        id: `${scanId}-title-duplicate`,
        rule_id: 'SEO_TITLE_DUPLICATE',
        title: 'Duplicate Title Tags Found Across Pages',
        category: 'SEO',
        severity: 'High',
        pages_affected: dupTitles.reduce((acc, curr) => acc + curr[1].length, 0),
        affected_url: dupTitles[0][1][0],
        evidence: `Duplicate title "${dupTitles[0][0]}" shared by ${dupTitles[0][1].length} pages including ${dupTitles[0][1][0]} and ${dupTitles[0][1][1]}`,
        explanation: 'Identical title tags cause keyword cannibalization, making it harder for search engines to determine which page to rank for relevant search queries.',
        recommendation: 'Give every page a unique title reflecting its unique content, product, or topic.',
        suggested_fix: 'Ensure dynamic templating includes item name or unique page identifier in <title>.',
        verification: 'Verify that each URL produces distinct <title> text in the audit report.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Unique Title Tags');
    }

    // 4. Missing Meta Description (High)
    const missingDesc = pages.filter(p => !p.metaDescription || p.metaDescription.trim() === '');
    if (missingDesc.length > 0) {
      issues.push({
        id: `${scanId}-desc-missing`,
        rule_id: 'SEO_META_DESC_MISSING',
        title: 'Missing Meta Description',
        category: 'SEO',
        severity: 'High',
        pages_affected: missingDesc.length,
        affected_url: missingDesc[0].url,
        evidence: `${missingDesc.length} pages lack a <meta name="description"> tag. Example: ${missingDesc[0].url}`,
        explanation: 'Meta descriptions serve as organic search snippets. Missing descriptions allow search engines to select arbitrary text, lowering organic click-through rates (CTR).',
        recommendation: 'Add a compelling meta description of 120-160 characters summarizing the page value proposition.',
        suggested_fix: '<meta name="description" content="Engaging summary of page contents containing primary target keyword and call to action.">',
        verification: 'Check HTML source for <meta name="description"> tag.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Meta Description Presence');
    }

    // 5. Meta Description Length (Low)
    const badLengthDesc = pages.filter(p => p.metaDescription && (p.metaDescription.length < 70 || p.metaDescription.length > 165));
    if (badLengthDesc.length > 0) {
      issues.push({
        id: `${scanId}-desc-length`,
        rule_id: 'SEO_META_DESC_LENGTH',
        title: 'Meta Description Suboptimal Length',
        category: 'SEO',
        severity: 'Low',
        pages_affected: badLengthDesc.length,
        affected_url: badLengthDesc[0].url,
        evidence: `Description is ${badLengthDesc[0].metaDescription?.length} characters on ${badLengthDesc[0].url} (optimal is 120-160 chars).`,
        explanation: 'Short descriptions provide insufficient context. Overly long descriptions are truncated with an ellipsis in SERP snippets.',
        recommendation: 'Tune meta descriptions to between 120 and 160 characters.',
        suggested_fix: '<meta name="description" content="Concise, informative summary between 120 and 160 characters.">',
        verification: 'Check character length of description tag.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Meta Description Length');
    }

    // 6. Missing H1 Heading (High)
    const missingH1 = pages.filter(p => p.h1List.length === 0);
    if (missingH1.length > 0) {
      issues.push({
        id: `${scanId}-h1-missing`,
        rule_id: 'SEO_H1_MISSING',
        title: 'Missing H1 Heading',
        category: 'SEO',
        severity: 'High',
        pages_affected: missingH1.length,
        affected_url: missingH1[0].url,
        evidence: `No <h1> heading found in the DOM of ${missingH1[0].url}`,
        explanation: 'The <h1> element informs both search crawlers and screen readers of the primary subject of the page.',
        recommendation: 'Add exactly one clear, relevant <h1> heading to every indexable page.',
        suggested_fix: '<h1>Primary Subject of Page</h1>',
        verification: 'Verify that an <h1> tag is rendered at the top of main content.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('H1 Tag Presence');
    }

    // 7. Multiple H1 Headings (Medium)
    const multipleH1 = pages.filter(p => p.h1List.length > 1);
    if (multipleH1.length > 0) {
      issues.push({
        id: `${scanId}-h1-multiple`,
        rule_id: 'SEO_H1_MULTIPLE',
        title: 'Multiple H1 Headings Detected',
        category: 'SEO',
        severity: 'Medium',
        pages_affected: multipleH1.length,
        affected_url: multipleH1[0].url,
        evidence: `Found ${multipleH1[0].h1List.length} H1 elements on ${multipleH1[0].url}: "${multipleH1[0].h1List.slice(0, 2).join('", "')}"`,
        explanation: 'Multiple H1 tags dilute semantic focus and create confusion for assistive technologies and web crawlers.',
        recommendation: 'Convert secondary <h1> headings into <h2> or <h3> elements.',
        suggested_fix: 'Reserve <h1> for the page title; use <h2> for subsections.',
        verification: 'Confirm only one <h1> exists per page.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Single H1 Architecture');
    }

    // 8. Missing Mobile Viewport Tag (Critical)
    const missingViewport = pages.filter(p => !p.viewportMeta);
    if (missingViewport.length > 0) {
      issues.push({
        id: `${scanId}-viewport-missing`,
        rule_id: 'TECH_VIEWPORT_MISSING',
        title: 'Missing Mobile Viewport Meta Tag',
        category: 'Technical',
        severity: 'Critical',
        pages_affected: missingViewport.length,
        affected_url: missingViewport[0].url,
        evidence: `No <meta name="viewport"> tag detected on ${missingViewport[0].url}`,
        explanation: 'Without a viewport meta tag, mobile browsers render desktop-width pages, failing Google Mobile-Friendly requirements.',
        recommendation: 'Include standard viewport configuration tag in document <head>.',
        suggested_fix: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        verification: 'Verify viewport meta tag exists in HTML <head>.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Mobile Viewport Configuration');
    }

    // 9. Missing Canonical Tag (Medium)
    const missingCanonical = pages.filter(p => !p.canonicalUrl);
    if (missingCanonical.length > 0) {
      issues.push({
        id: `${scanId}-canonical-missing`,
        rule_id: 'TECH_CANONICAL_MISSING',
        title: 'Missing Canonical Tag',
        category: 'Crawlability',
        severity: 'Medium',
        pages_affected: missingCanonical.length,
        affected_url: missingCanonical[0].url,
        evidence: `No <link rel="canonical"> specified on ${missingCanonical[0].url}`,
        explanation: 'Canonical tags protect against duplicate content caused by tracking query strings, protocol variations, or syndicated content.',
        recommendation: 'Add self-referencing canonical links to all canonical page URLs.',
        suggested_fix: `<link rel="canonical" href="${missingCanonical[0].url}">`,
        verification: 'Check page head for <link rel="canonical"> tag.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Canonical Tag Coverage');
    }

    // 10. Images Missing Alt Attributes (Medium)
    let totalImages = 0;
    let missingAltImages = 0;
    const sampleMissingAltUrl: string[] = [];

    pages.forEach(p => {
      p.images.forEach(img => {
        totalImages++;
        if (!img.hasAlt) {
          missingAltImages++;
          if (sampleMissingAltUrl.length < 3) {
            sampleMissingAltUrl.push(`${img.src} (on ${p.url})`);
          }
        }
      });
    });

    if (missingAltImages > 0) {
      issues.push({
        id: `${scanId}-img-alt-missing`,
        rule_id: 'ACCESSIBILITY_IMAGE_ALT',
        title: 'Images Missing Alt Text Attributes',
        category: 'Accessibility',
        severity: 'Medium',
        pages_affected: missingAltImages,
        affected_url: pages[0]?.url || '',
        evidence: `Detected ${missingAltImages} of ${totalImages} images without descriptive alt text. Examples: ${sampleMissingAltUrl.join(', ')}`,
        explanation: 'Alt text is vital for accessibility (screen readers) and allows search engines to understand and index image content.',
        recommendation: 'Add clear, descriptive alt text to informative images, or alt="" for decorative graphics.',
        suggested_fix: '<img src="example.jpg" alt="Descriptive summary of image contents">',
        verification: 'Ensure every <img> element has an alt attribute.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Image Alt Text Attributes');
    }

    // 11. Insecure HTTP Protocol (High)
    const insecurePages = pages.filter(p => p.url.startsWith('http://'));
    if (insecurePages.length > 0) {
      issues.push({
        id: `${scanId}-insecure-http`,
        rule_id: 'TECH_HTTPS_MISSING',
        title: 'Insecure HTTP Protocol in Use',
        category: 'Technical',
        severity: 'High',
        pages_affected: insecurePages.length,
        affected_url: insecurePages[0].url,
        evidence: `URL served over unencrypted HTTP: ${insecurePages[0].url}`,
        explanation: 'HTTPS is an established Google ranking signal and prevents man-in-the-middle attacks on visitors.',
        recommendation: 'Enforce automatic 301 redirects from HTTP to HTTPS and install a valid SSL/TLS certificate.',
        suggested_fix: 'Configure 301 Permanent Redirect to https:// in web server (Nginx/Cloudflare/Apache).',
        verification: 'Verify that http:// requests automatically redirect to https:// with status 301.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('HTTPS Encryption');
    }

    // 12. Mixed Content (High)
    const mixedContentPages = pages.filter(p => p.hasMixedContent);
    if (mixedContentPages.length > 0) {
      issues.push({
        id: `${scanId}-mixed-content`,
        rule_id: 'TECH_MIXED_CONTENT',
        title: 'Mixed Content Detected on Secure Page',
        category: 'Technical',
        severity: 'High',
        pages_affected: mixedContentPages.length,
        affected_url: mixedContentPages[0].url,
        evidence: `Page on HTTPS loads HTTP image assets: ${mixedContentPages[0].url}`,
        explanation: 'Browsers block insecure HTTP resources loaded on HTTPS pages, triggering security warnings for visitors.',
        recommendation: 'Update all asset URLs to use HTTPS or protocol-relative schemes.',
        suggested_fix: 'Change src="http://..." to src="https://..."',
        verification: 'Confirm browser console shows no mixed content warnings.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Mixed Content Protection');
    }

    // 13. Slow Server Response Time / TTFB (Medium)
    const slowPages = pages.filter(p => p.responseTimeMs > 900);
    if (slowPages.length > 0) {
      issues.push({
        id: `${scanId}-slow-ttfb`,
        rule_id: 'PERF_SLOW_TTFB',
        title: 'Slow Server Response Time (TTFB > 900ms)',
        category: 'Performance',
        severity: 'Medium',
        pages_affected: slowPages.length,
        affected_url: slowPages[0].url,
        evidence: `Response time measured at ${slowPages[0].responseTimeMs}ms on ${slowPages[0].url} (recommended < 500ms).`,
        explanation: 'High Time-to-First-Byte directly degrades user experience and slows down crawl rate for search engine bots.',
        recommendation: 'Implement server-side caching, database query optimization, and CDN edge caching.',
        suggested_fix: 'Enable Cloudflare/Fastly edge caching and Cache-Control headers: Cache-Control: public, max-age=3600',
        verification: 'Test TTFB with curl or CROX re-scan.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Server Response Time (TTFB)');
    }

    // 14. Broken Internal Links / 4xx Status (Critical)
    const brokenPages = pages.filter(p => p.statusCode && p.statusCode >= 400);
    if (brokenPages.length > 0) {
      issues.push({
        id: `${scanId}-broken-links`,
        rule_id: 'CRAWL_BROKEN_PAGES',
        title: 'Broken Pages or 4xx Errors Discovered',
        category: 'Crawlability',
        severity: 'Critical',
        pages_affected: brokenPages.length,
        affected_url: brokenPages[0].url,
        evidence: `HTTP ${brokenPages[0].statusCode} response returned for ${brokenPages[0].url}`,
        explanation: 'Broken internal links waste crawl budget and create frustrating dead-ends for prospective customers.',
        recommendation: 'Update internal links pointing to dead pages, or implement 301 redirects to relevant replacement URLs.',
        suggested_fix: 'Fix the hyperlink href or configure 301 redirect in server.',
        verification: 'Verify URL returns HTTP 200 OK.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Link Integrity & 4xx Response');
    }

    // 15. Thin Content / Low Word Count (Medium)
    const thinPages = pages.filter(p => p.statusCode === 200 && p.wordCount < 200 && !p.url.includes('/login') && !p.url.includes('/signup'));
    if (thinPages.length > 0) {
      issues.push({
        id: `${scanId}-thin-content`,
        rule_id: 'SEO_THIN_CONTENT',
        title: 'Thin Content Detected (< 200 Words)',
        category: 'SEO',
        severity: 'Medium',
        pages_affected: thinPages.length,
        affected_url: thinPages[0].url,
        evidence: `Page ${thinPages[0].url} contains only ${thinPages[0].wordCount} words of text.`,
        explanation: 'Thin content pages struggle to rank organically because they lack depth, context, and user engagement signals.',
        recommendation: 'Expand page content with comprehensive explanations, FAQs, and topic coverage.',
        suggested_fix: 'Provide at least 300-500 words of relevant, original content answering user search intent.',
        verification: 'Re-audit page to verify word count exceeds 300 words.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Content Depth & Word Count');
    }

    // 16. Missing HTML Lang Attribute (Low)
    const missingLang = pages.filter(p => !p.lang);
    if (missingLang.length > 0) {
      issues.push({
        id: `${scanId}-lang-missing`,
        rule_id: 'ACCESSIBILITY_LANG_MISSING',
        title: 'Missing HTML Language Attribute',
        category: 'Accessibility',
        severity: 'Low',
        pages_affected: missingLang.length,
        affected_url: missingLang[0].url,
        evidence: `<html lang="..."> attribute is missing on ${missingLang[0].url}`,
        explanation: 'The lang attribute declares the human language of the page, assisting screen reader pronunciation and international search engines.',
        recommendation: 'Declare appropriate language code on the root <html> tag.',
        suggested_fix: '<html lang="en">',
        verification: 'Inspect root <html> tag in HTML document.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('HTML Language Declaration');
    }

    // 17. Missing OpenGraph Social Tags (Low)
    const missingOg = pages.filter(p => !p.ogTitle || !p.ogImage);
    if (missingOg.length > 0) {
      issues.push({
        id: `${scanId}-og-missing`,
        rule_id: 'SEO_OG_TAGS_MISSING',
        title: 'Missing OpenGraph Social Share Tags',
        category: 'SEO',
        severity: 'Low',
        pages_affected: missingOg.length,
        affected_url: missingOg[0].url,
        evidence: `Missing og:title or og:image tags on ${missingOg[0].url}`,
        explanation: 'OpenGraph metadata controls how links appear when shared on LinkedIn, Slack, Facebook, and Twitter/X.',
        recommendation: 'Add og:title, og:description, and og:image tags to the <head>.',
        suggested_fix: '<meta property="og:title" content="Page Title">\n<meta property="og:image" content="https://example.com/share.png">',
        verification: 'Test with social card validator or check HTML head.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('OpenGraph Social Share Metadata');
    }

    // 18. Structured Data / JSON-LD Validation (Medium)
    let invalidJsonLd = 0;
    pages.forEach(p => {
      p.jsonLdList.forEach(item => {
        if (item.__invalid_syntax) invalidJsonLd++;
      });
    });

    if (invalidJsonLd > 0) {
      issues.push({
        id: `${scanId}-jsonld-invalid`,
        rule_id: 'TECH_JSONLD_INVALID',
        title: 'Malformed JSON-LD Structured Data Syntax',
        category: 'Technical',
        severity: 'High',
        pages_affected: invalidJsonLd,
        affected_url: pages[0]?.url || '',
        evidence: `Found ${invalidJsonLd} script tags with invalid JSON syntax in schema markup.`,
        explanation: 'Syntax errors in JSON-LD cause Google to discard structured data entirely, losing rich snippet eligibility.',
        recommendation: 'Validate JSON-LD syntax using Google Rich Results Test tool and ensure trailing commas and quotes are valid.',
        suggested_fix: '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "Brand"\n}\n</script>',
        verification: 'Validate structured data syntax in Rich Results Test.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Structured Data Syntax');
    }

    // 19. Character Encoding / Charset (Medium)
    const missingCharset = pages.filter(p => !p.charset);
    if (missingCharset.length > 0) {
      issues.push({
        id: `${scanId}-charset-missing`,
        rule_id: 'TECH_CHARSET_MISSING',
        title: 'Missing Character Encoding Declaration',
        category: 'Technical',
        severity: 'Medium',
        pages_affected: missingCharset.length,
        affected_url: missingCharset[0].url,
        evidence: `No charset declaration found on ${missingCharset[0].url}`,
        explanation: 'Without a declared charset, browsers may misinterpret special characters, displaying garbled glyphs.',
        recommendation: 'Add UTF-8 character encoding declaration at the very top of <head>.',
        suggested_fix: '<meta charset="UTF-8">',
        verification: 'Check HTML source for <meta charset="UTF-8">.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Character Encoding (UTF-8)');
    }

    // 20. Robots NoIndex Directive (Notice)
    const noIndexPages = pages.filter(p => !p.isIndexable);
    if (noIndexPages.length > 0) {
      issues.push({
        id: `${scanId}-noindex-directive`,
        rule_id: 'CRAWL_NOINDEX_DIRECTIVE',
        title: 'Pages Marked With "noindex" Directive',
        category: 'Crawlability',
        severity: 'Low',
        pages_affected: noIndexPages.length,
        affected_url: noIndexPages[0].url,
        evidence: `Page ${noIndexPages[0].url} contains robots meta tag with "noindex" instruction: ${noIndexPages[0].robotsMeta}`,
        explanation: 'The noindex directive intentionally prevents search engines from indexing the page. Ensure this is intentional.',
        recommendation: 'If this page should receive organic traffic, remove the noindex directive from its meta tags or HTTP headers.',
        suggested_fix: '<meta name="robots" content="index, follow">',
        verification: 'Verify robots meta tag allows indexing.',
        resolved: false,
        created_at: now
      });
    } else {
      passedSet.add('Robots Indexability Directives');
    }

    const passedList = Array.from(passedSet);
    const criticalCount = issues.filter(i => i.severity === 'Critical').length;
    const warningCount = issues.filter(i => i.severity === 'High' || i.severity === 'Medium').length;

    return {
      issues,
      passed_checks: passedList,
      passed_checks_count: passedList.length,
      warning_checks_count: warningCount,
      critical_checks_count: criticalCount,
      total_checks_count: passedList.length + issues.length
    };
  }
}
