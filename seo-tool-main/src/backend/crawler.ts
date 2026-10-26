import * as cheerio from 'cheerio';
import { validateTargetUrl } from './security.js';

export interface ExtractedPageData {
  url: string;
  statusCode: number;
  responseTimeMs: number;
  contentType: string;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  charset: string | null;
  lang: string | null;
  viewportMeta: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  h1List: string[];
  h2Count: number;
  h3Count: number;
  wordCount: number;
  isIndexable: boolean;
  images: Array<{ src: string; alt: string; hasAlt: boolean }>;
  internalLinks: string[];
  externalLinks: string[];
  jsonLdList: any[];
  hasMixedContent: boolean;
  rawHtmlLength: number;
}

export interface CrawlProgressEvent {
  status: 'validating' | 'crawling' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  currentAction: string;
  pagesCrawled: number;
  totalUrlsFound: number;
  redirectsFound: number;
  brokenLinksFound: number;
  errorMessage?: string;
}

export class WebsiteCrawler {
  private targetUrl: string;
  private rootOrigin: string;
  private rootHostname: string;
  private maxPages: number;
  private timeoutMs: number;

  private visitedUrls = new Set<string>();
  private urlQueue: string[] = [];
  private crawledPages: ExtractedPageData[] = [];
  private redirectsCount = 0;
  private brokenLinksCount = 0;

  private disallowedPaths: string[] = [];
  private isCancelled = false;

  constructor(targetUrl: string, maxPages: number = 30, timeoutMs: number = 12000) {
    this.targetUrl = targetUrl;
    const parsed = new URL(targetUrl);
    this.rootOrigin = parsed.origin;
    this.rootHostname = parsed.hostname.toLowerCase();
    this.maxPages = Math.min(Math.max(1, maxPages), 100);
    this.timeoutMs = timeoutMs;
  }

  public cancel() {
    this.isCancelled = true;
  }

  private normalizeUrl(rawUrl: string, baseUrl: string): string | null {
    try {
      const parsed = new URL(rawUrl, baseUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

      // Only crawl same root hostname or same domain
      const parsedHost = parsed.hostname.toLowerCase();
      if (parsedHost !== this.rootHostname && !parsedHost.endsWith(`.${this.rootHostname}`)) {
        return null;
      }

      // Ignore common non-HTML file extensions
      const extMatch = parsed.pathname.match(/\.([a-z0-9]+)$/i);
      if (extMatch) {
        const ext = extMatch[1].toLowerCase();
        if (['pdf', 'zip', 'tar', 'gz', 'mp4', 'mp3', 'avi', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'css', 'js', 'json', 'xml'].includes(ext)) {
          return null;
        }
      }

      // Strip fragment & tracking parameters
      parsed.hash = '';
      const paramsToDrop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', '_ga'];
      paramsToDrop.forEach(p => parsed.searchParams.delete(p));

      // Clean pathname
      let cleanPath = parsed.pathname.replace(/\/+/g, '/');
      if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1);
      }
      parsed.pathname = cleanPath;

      // Crawl trap protection: repeated segments
      const segments = cleanPath.split('/').filter(Boolean);
      if (segments.length > 8) return null; // excessive depth
      const segmentCounts: Record<string, number> = {};
      for (const seg of segments) {
        segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
        if (segmentCounts[seg] > 2) return null; // path loop
      }

      return parsed.toString();
    } catch {
      return null;
    }
  }

  private isRobotsAllowed(urlPath: string): boolean {
    for (const disallowed of this.disallowedPaths) {
      if (disallowed === '/' || urlPath.startsWith(disallowed)) {
        return false;
      }
    }
    return true;
  }

  private async fetchRobotsTxt(): Promise<string[]> {
    const sitemaps: string[] = [];
    try {
      const robotsUrl = `${this.rootOrigin}/robots.txt`;
      const ssrf = await validateTargetUrl(robotsUrl);
      if (!ssrf.valid) return sitemaps;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CROX-SEO-Crawler/2.0 (+https://crox.ai/bot)' }
      });
      clearTimeout(timeout);

      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        let isAppliesToUs = true;

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('#')) continue;

          if (/^User-agent:\s*/i.test(line)) {
            const agent = line.replace(/^User-agent:\s*/i, '').trim().toLowerCase();
            isAppliesToUs = agent === '*' || agent === 'crox' || agent === 'crox-seo-crawler';
          } else if (isAppliesToUs && /^Disallow:\s*/i.test(line)) {
            const pathRule = line.replace(/^Disallow:\s*/i, '').trim();
            if (pathRule) this.disallowedPaths.push(pathRule);
          } else if (/^Sitemap:\s*/i.test(line)) {
            const sitemapUrl = line.replace(/^Sitemap:\s*/i, '').trim();
            if (sitemapUrl) sitemaps.push(sitemapUrl);
          }
        }
      }
    } catch {
      // Robots.txt is optional, ignore network errors
    }
    return sitemaps;
  }

  private async fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
    const discovered: string[] = [];
    try {
      const ssrf = await validateTargetUrl(sitemapUrl);
      if (!ssrf.valid) return discovered;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(sitemapUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CROX-SEO-Crawler/2.0' }
      });
      clearTimeout(timeout);

      if (res.ok) {
        const xml = await res.text();
        const urlMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
        for (const match of urlMatches) {
          const rawLoc = match[1]?.trim();
          if (rawLoc) {
            const norm = this.normalizeUrl(rawLoc, this.rootOrigin);
            if (norm && !this.visitedUrls.has(norm)) {
              discovered.push(norm);
            }
          }
          if (discovered.length >= 25) break;
        }
      }
    } catch {}
    return discovered;
  }

  public async crawl(onProgress?: (event: CrawlProgressEvent) => void): Promise<{
    pages: ExtractedPageData[];
    totalUrlsFound: number;
    redirectsFound: number;
    brokenLinksFound: number;
  }> {
    // Phase 1: Validate root target with SSRF
    onProgress?.({
      status: 'validating',
      progress: 5,
      currentAction: `Validating target URL and SSRF network boundaries for ${this.rootHostname}...`,
      pagesCrawled: 0,
      totalUrlsFound: 1,
      redirectsFound: 0,
      brokenLinksFound: 0
    });

    const rootValidation = await validateTargetUrl(this.targetUrl);
    if (!rootValidation.valid) {
      throw new Error(`SSRF or URL validation failed: ${rootValidation.error}`);
    }

    const startUrl = rootValidation.normalizedUrl;
    this.urlQueue.push(startUrl);

    // Phase 2: Robots.txt & Sitemaps discovery
    onProgress?.({
      status: 'crawling',
      progress: 10,
      currentAction: 'Checking robots.txt directives and XML sitemaps...',
      pagesCrawled: 0,
      totalUrlsFound: this.urlQueue.length,
      redirectsFound: 0,
      brokenLinksFound: 0
    });

    const sitemapLinks = await this.fetchRobotsTxt();
    if (sitemapLinks.length === 0) {
      sitemapLinks.push(`${this.rootOrigin}/sitemap.xml`);
    }

    for (const sm of sitemapLinks.slice(0, 2)) {
      const sitemapUrls = await this.fetchSitemapUrls(sm);
      for (const smUrl of sitemapUrls) {
        if (!this.urlQueue.includes(smUrl)) {
          this.urlQueue.push(smUrl);
        }
      }
    }

    // Phase 3: Crawl Loop
    let crawledCount = 0;

    while (this.urlQueue.length > 0 && crawledCount < this.maxPages && !this.isCancelled) {
      const currentUrl = this.urlQueue.shift()!;
      if (this.visitedUrls.has(currentUrl)) continue;

      this.visitedUrls.add(currentUrl);

      // Check robots exclusion
      const parsedPath = new URL(currentUrl).pathname;
      if (!this.isRobotsAllowed(parsedPath)) {
        continue;
      }

      const calculatedProgress = Math.min(85, Math.round(15 + (crawledCount / this.maxPages) * 70));

      onProgress?.({
        status: 'crawling',
        progress: calculatedProgress,
        currentAction: `Crawling [${crawledCount + 1}/${this.maxPages}]: ${currentUrl}`,
        pagesCrawled: crawledCount,
        totalUrlsFound: this.visitedUrls.size + this.urlQueue.length,
        redirectsFound: this.redirectsCount,
        brokenLinksFound: this.brokenLinksCount
      });

      // SSRF check on this URL before fetch
      const hopValidation = await validateTargetUrl(currentUrl);
      if (!hopValidation.valid) {
        continue;
      }

      const startTime = performance.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; CROX-SEO-Audit/2.0; +https://crox.ai/bot)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        clearTimeout(timeout);

        const responseTimeMs = Math.round(performance.now() - startTime);
        const statusCode = response.status;
        const contentType = response.headers.get('content-type') || 'text/html';

        if (response.redirected) {
          this.redirectsCount++;
          // Validate final destination
          const finalSsrf = await validateTargetUrl(response.url);
          if (!finalSsrf.valid) {
            continue;
          }
        }

        if (statusCode >= 400) {
          this.brokenLinksCount++;
        }

        // Only parse HTML responses
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          this.crawledPages.push({
            url: currentUrl,
            statusCode,
            responseTimeMs,
            contentType,
            title: null,
            metaDescription: null,
            canonicalUrl: null,
            robotsMeta: null,
            charset: null,
            lang: null,
            viewportMeta: null,
            ogTitle: null,
            ogDescription: null,
            ogImage: null,
            twitterCard: null,
            h1List: [],
            h2Count: 0,
            h3Count: 0,
            wordCount: 0,
            isIndexable: statusCode < 400,
            images: [],
            internalLinks: [],
            externalLinks: [],
            jsonLdList: [],
            hasMixedContent: false,
            rawHtmlLength: 0
          });
          crawledCount++;
          continue;
        }

        const html = await response.text();
        const parsedData = this.parsePageHtml(currentUrl, statusCode, responseTimeMs, contentType, html);
        this.crawledPages.push(parsedData);
        crawledCount++;

        // Add discovered internal links to queue
        for (const link of parsedData.internalLinks) {
          if (!this.visitedUrls.has(link) && !this.urlQueue.includes(link)) {
            this.urlQueue.push(link);
          }
        }

        // Polite crawl delay
        await new Promise(r => setTimeout(r, 120));
      } catch (err: any) {
        const responseTimeMs = Math.round(performance.now() - startTime);
        this.brokenLinksCount++;
        this.crawledPages.push({
          url: currentUrl,
          statusCode: 504,
          responseTimeMs,
          contentType: 'error/timeout',
          title: null,
          metaDescription: null,
          canonicalUrl: null,
          robotsMeta: null,
          charset: null,
          lang: null,
          viewportMeta: null,
          ogTitle: null,
          ogDescription: null,
          ogImage: null,
          twitterCard: null,
          h1List: [],
          h2Count: 0,
          h3Count: 0,
          wordCount: 0,
          isIndexable: false,
          images: [],
          internalLinks: [],
          externalLinks: [],
          jsonLdList: [],
          hasMixedContent: false,
          rawHtmlLength: 0
        });
        crawledCount++;
      }
    }

    onProgress?.({
      status: 'analyzing',
      progress: 90,
      currentAction: `Completed crawl of ${this.crawledPages.length} pages. Executing technical SEO audit rules...`,
      pagesCrawled: this.crawledPages.length,
      totalUrlsFound: this.visitedUrls.size + this.urlQueue.length,
      redirectsFound: this.redirectsCount,
      brokenLinksFound: this.brokenLinksCount
    });

    return {
      pages: this.crawledPages,
      totalUrlsFound: this.visitedUrls.size + this.urlQueue.length,
      redirectsFound: this.redirectsCount,
      brokenLinksFound: this.brokenLinksCount
    };
  }

  private parsePageHtml(
    url: string,
    statusCode: number,
    responseTimeMs: number,
    contentType: string,
    html: string
  ): ExtractedPageData {
    const $ = cheerio.load(html);

    // Title
    const rawTitle = $('title').first().text();
    const title = rawTitle ? rawTitle.trim() : null;

    // Meta Description
    const metaDesc = $('meta[name="description" i], meta[property="og:description" i]').first().attr('content');
    const metaDescription = metaDesc ? metaDesc.trim() : null;

    // Canonical
    const canonical = $('link[rel="canonical" i]').attr('href');
    const canonicalUrl = canonical ? canonical.trim() : null;

    // Robots meta
    const robots = $('meta[name="robots" i]').attr('content');
    const robotsMeta = robots ? robots.trim().toLowerCase() : null;

    // Charset
    const charset = $('meta[charset]').attr('charset') || $('meta[http-equiv="Content-Type" i]').attr('content') || null;

    // HTML Lang
    const lang = $('html').attr('lang') || null;

    // Viewport
    const viewport = $('meta[name="viewport" i]').attr('content') || null;

    // OpenGraph & Twitter
    const ogTitle = $('meta[property="og:title" i]').attr('content') || null;
    const ogDescription = $('meta[property="og:description" i]').attr('content') || null;
    const ogImage = $('meta[property="og:image" i]').attr('content') || null;
    const twitterCard = $('meta[name="twitter:card" i]').attr('content') || null;

    // Headings
    const h1List: string[] = [];
    $('h1').each((_, el) => {
      const text = $(el).text().trim();
      if (text) h1List.push(text);
    });

    const h2Count = $('h2').length;
    const h3Count = $('h3').length;

    // Body text & Word count
    $('script, style, noscript, svg, nav, footer, header').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const words = bodyText.split(' ').filter(w => w.length > 1);
    const wordCount = words.length;

    // Indexability
    let isIndexable = statusCode >= 200 && statusCode < 300;
    if (robotsMeta && (robotsMeta.includes('noindex') || robotsMeta.includes('none'))) {
      isIndexable = false;
    }

    // Images
    const images: Array<{ src: string; alt: string; hasAlt: boolean }> = [];
    let hasMixedContent = false;
    const isHttps = url.startsWith('https://');

    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      const alt = $(el).attr('alt');
      const hasAlt = typeof alt === 'string' && alt.trim().length > 0;
      if (src) {
        images.push({ src, alt: alt || '', hasAlt });
        if (isHttps && src.startsWith('http://')) {
          hasMixedContent = true;
        }
      }
    });

    // Links
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];

    $('a[href]').each((_, el) => {
      const rawHref = $(el).attr('href');
      if (!rawHref) return;

      const norm = this.normalizeUrl(rawHref, url);
      if (norm) {
        if (!internalLinks.includes(norm)) {
          internalLinks.push(norm);
        }
      } else {
        try {
          const parsedExt = new URL(rawHref, url);
          if (parsedExt.protocol === 'http:' || parsedExt.protocol === 'https:') {
            if (parsedExt.hostname !== this.rootHostname && !externalLinks.includes(parsedExt.origin)) {
              externalLinks.push(parsedExt.origin);
            }
          }
        } catch {}
      }
    });

    // Structured data (JSON-LD)
    const jsonLdList: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const content = $(el).html();
      if (content) {
        try {
          const parsed = JSON.parse(content.trim());
          jsonLdList.push(parsed);
        } catch {
          jsonLdList.push({ __invalid_syntax: true, raw: content.slice(0, 150) });
        }
      }
    });

    return {
      url,
      statusCode,
      responseTimeMs,
      contentType,
      title,
      metaDescription,
      canonicalUrl,
      robotsMeta,
      charset,
      lang,
      viewportMeta: viewport,
      ogTitle,
      ogDescription,
      ogImage,
      twitterCard,
      h1List,
      h2Count,
      h3Count,
      wordCount,
      isIndexable,
      images,
      internalLinks,
      externalLinks,
      jsonLdList,
      hasMixedContent,
      rawHtmlLength: html.length
    };
  }
}
