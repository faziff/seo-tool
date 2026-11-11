import asyncio
import re
import time
from typing import List, Set, Dict, Any, Optional
from urllib.parse import urljoin, urlparse, urldefrag
import urllib.robotparser

try:
    import httpx
except ImportError:
    httpx = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

from backend.app.core.config import settings
from backend.app.core.security import validate_target_url, SecurityError


class PageCrawlResult:
    def __init__(self, url: str):
        self.url = url
        self.status_code: Optional[int] = None
        self.response_time_ms: int = 0
        self.content_type: str = "text/html"
        self.content_length: int = 0
        self.headers: Dict[str, str] = {}
        self.html: str = ""
        self.title: Optional[str] = None
        self.meta_description: Optional[str] = None
        self.canonical_url: Optional[str] = None
        self.h1_tags: List[str] = []
        self.h2_tags: List[str] = []
        self.word_count: int = 0
        self.has_viewport: bool = False
        self.meta_robots: Optional[str] = None
        self.is_indexable: bool = True
        self.html_lang: Optional[str] = None
        self.og_title: Optional[str] = None
        self.og_image: Optional[str] = None
        self.twitter_card: Optional[str] = None
        self.internal_links: Set[str] = set()
        self.external_links: Set[str] = set()
        self.images: List[Dict[str, str]] = []
        self.structured_data: List[str] = []
        self.is_redirect: bool = False
        self.redirect_destination: Optional[str] = None
        self.error: Optional[str] = None


class WebsiteCrawler:
    def __init__(
        self,
        start_url: str,
        max_pages: int = 50,
        timeout: int = 15,
        concurrency: int = 5,
        progress_callback=None
    ):
        self.start_url = start_url
        self.max_pages = min(max_pages, 200)
        self.timeout = timeout
        self.concurrency = concurrency
        self.progress_callback = progress_callback

        parsed = urlparse(start_url)
        self.base_domain = parsed.hostname.lower() if parsed.hostname else ""
        self.base_scheme = parsed.scheme or "https"
        self.base_netloc = parsed.netloc

        self.visited_urls: Set[str] = set()
        self.queued_urls: List[str] = []
        self.results: Dict[str, PageCrawlResult] = {}
        self.sitemap_urls: Set[str] = set()
        self.robot_parser: Optional[urllib.robotparser.RobotFileParser] = None
        self.cancelled = False

    def is_same_domain(self, url: str) -> bool:
        try:
            parsed = urlparse(url)
            host = parsed.hostname.lower() if parsed.hostname else ""
            return host == self.base_domain or host.endswith("." + self.base_domain)
        except Exception:
            return False

    def normalize_url(self, raw_url: str) -> Optional[str]:
        try:
            cleaned, _ = urldefrag(raw_url.strip())
            parsed = urlparse(cleaned)
            if parsed.scheme not in ("http", "https"):
                return None
            path = parsed.path or "/"
            normalized = f"{parsed.scheme}://{parsed.netloc.lower()}{path}"
            if parsed.query:
                normalized += f"?{parsed.query}"
            return normalized
        except Exception:
            return None

    async def fetch_robots_txt(self, client: Any):
        robots_url = f"{self.base_scheme}://{self.base_netloc}/robots.txt"
        try:
            val_url = validate_target_url(robots_url)
            resp = await client.get(val_url, timeout=self.timeout)
            if resp.status_code == 200:
                self.robot_parser = urllib.robotparser.RobotFileParser()
                self.robot_parser.parse(resp.text.splitlines())

                for line in resp.text.splitlines():
                    if line.lower().startswith("sitemap:"):
                        sm_url = line.split(":", 1)[1].strip()
                        if sm_url:
                            self.sitemap_urls.add(sm_url)
        except Exception:
            pass

    async def fetch_sitemap(self, client: Any):
        default_sitemaps = [
            f"{self.base_scheme}://{self.base_netloc}/sitemap.xml",
            f"{self.base_scheme}://{self.base_netloc}/sitemap_index.xml",
        ]
        all_sitemaps = list(self.sitemap_urls.union(default_sitemaps))

        for sm_url in all_sitemaps:
            try:
                val_url = validate_target_url(sm_url)
                resp = await client.get(val_url, timeout=self.timeout)
                if resp.status_code == 200 and ("xml" in resp.headers.get("content-type", "") or sm_url.endswith(".xml")):
                    urls = re.findall(r"<loc>(https?://[^<]+)</loc>", resp.text, re.IGNORECASE)
                    for u in urls:
                        norm = self.normalize_url(u)
                        if norm and self.is_same_domain(norm):
                            self.sitemap_urls.add(norm)
            except Exception:
                continue

    def parse_html_content(self, page: PageCrawlResult):
        if not page.html:
            return

        if BeautifulSoup:
            soup = BeautifulSoup(page.html, "html.parser")

            # Title
            title_tag = soup.find("title")
            page.title = title_tag.get_text().strip() if title_tag else None

            # Meta description
            desc_tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
            page.meta_description = desc_tag.get("content", "").strip() if desc_tag else None

            # Canonical
            canon_tag = soup.find("link", attrs={"rel": re.compile(r"^canonical$", re.I)})
            page.canonical_url = canon_tag.get("href", "").strip() if canon_tag else None

            # Viewport
            vp_tag = soup.find("meta", attrs={"name": re.compile(r"^viewport$", re.I)})
            page.has_viewport = bool(vp_tag and vp_tag.get("content"))

            # Robots
            rb_tag = soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)})
            if rb_tag:
                page.meta_robots = rb_tag.get("content", "").lower()
                if "noindex" in page.meta_robots:
                    page.is_indexable = False

            # HTML Lang
            html_tag = soup.find("html")
            page.html_lang = html_tag.get("lang") if html_tag else None

            # OpenGraph & Twitter
            og_t = soup.find("meta", property="og:title")
            page.og_title = og_t.get("content", "").strip() if og_t else None

            og_img = soup.find("meta", property="og:image")
            page.og_image = og_img.get("content", "").strip() if og_img else None

            tw_card = soup.find("meta", attrs={"name": re.compile(r"^twitter:card$", re.I)})
            page.twitter_card = tw_card.get("content", "").strip() if tw_card else None

            # Headings
            page.h1_tags = [h.get_text().strip() for h in soup.find_all("h1") if h.get_text().strip()]
            page.h2_tags = [h.get_text().strip() for h in soup.find_all("h2") if h.get_text().strip()]

            # Images
            for img in soup.find_all("img"):
                src = img.get("src", "")
                alt = img.get("alt", None)
                page.images.append({
                    "src": urljoin(page.url, src) if src else "",
                    "alt": alt.strip() if alt is not None else ""
                })

            # Links
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not href or href.startswith("javascript:") or href.startswith("mailto:") or href.startswith("tel:"):
                    continue
                abs_link = urljoin(page.url, href)
                norm_link = self.normalize_url(abs_link)
                if norm_link:
                    if self.is_same_domain(norm_link):
                        page.internal_links.add(norm_link)
                    else:
                        page.external_links.add(norm_link)

            # Structured Data (JSON-LD)
            for script in soup.find_all("script", type="application/ld+json"):
                if script.string:
                    page.structured_data.append(script.string.strip())

            # Word count
            for s in soup(["script", "style", "noscript", "svg"]):
                s.extract()
            body_text = soup.get_text(separator=" ", strip=True)
            words = re.findall(r"\b\w+\b", body_text)
            page.word_count = len(words)
        else:
            t_match = re.search(r"<title[^>]*>(.*?)</title>", page.html, re.I | re.S)
            page.title = t_match.group(1).strip() if t_match else None

            d_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']', page.html, re.I)
            page.meta_description = d_match.group(1).strip() if d_match else None

            h1_matches = re.findall(r"<h1[^>]*>(.*?)</h1>", page.html, re.I | re.S)
            page.h1_tags = [re.sub(r"<[^>]+>", "", h).strip() for h in h1_matches]

            words = re.findall(r"\b\w+\b", re.sub(r"<[^>]+>", " ", page.html))
            page.word_count = len(words)

    async def crawl_page(self, client: Any, url: str) -> PageCrawlResult:
        result = PageCrawlResult(url)
        start_time = time.time()

        try:
            # Re-validate target URL to protect against DNS rebinding & SSRF
            validated_url = validate_target_url(url)
            headers = {"User-Agent": settings.USER_AGENT}

            resp = await client.get(
                validated_url,
                headers=headers,
                timeout=self.timeout,
                follow_redirects=True
            )

            # SSRF validation on the final redirect URL
            final_url = str(resp.url)
            validate_target_url(final_url)

            result.status_code = resp.status_code
            result.response_time_ms = int((time.time() - start_time) * 1000)
            result.headers = dict(resp.headers)
            result.content_type = resp.headers.get("content-type", "")
            result.content_length = len(resp.content)

            if final_url != validated_url:
                result.is_redirect = True
                result.redirect_destination = final_url

            if "text/html" in result.content_type.lower():
                # Enforce 5MB limit
                if len(resp.content) > 5 * 1024 * 1024:
                    result.html = resp.content[: 5 * 1024 * 1024].decode("utf-8", errors="ignore")
                else:
                    result.html = resp.text
                self.parse_html_content(result)

        except SecurityError as se:
            result.error = f"Security block: {str(se)}"
            result.status_code = 403
        except Exception as e:
            result.error = str(e)
            result.status_code = 500

        return result

    async def start(self) -> Dict[str, PageCrawlResult]:
        normalized_start = self.normalize_url(self.start_url)
        if not normalized_start:
            raise ValueError("Invalid starting URL")

        self.queued_urls.append(normalized_start)
        semaphore = asyncio.Semaphore(self.concurrency)

        client_kwargs = {
            "timeout": self.timeout,
            "limits": httpx.Limits(max_keepalive_connections=5, max_connections=10) if httpx else None
        }

        async with httpx.AsyncClient(**{k: v for k, v in client_kwargs.items() if v is not None}) as client:
            if self.progress_callback:
                await self.progress_callback("Checking robots.txt & discovering sitemap...", 5)
            await self.fetch_robots_txt(client)
            await self.fetch_sitemap(client)

            for sm_url in list(self.sitemap_urls)[: self.max_pages]:
                if sm_url not in self.queued_urls:
                    self.queued_urls.append(sm_url)

            while self.queued_urls and len(self.visited_urls) < self.max_pages and not self.cancelled:
                batch = []
                while self.queued_urls and len(batch) < self.concurrency and len(self.visited_urls) + len(batch) < self.max_pages:
                    candidate = self.queued_urls.pop(0)
                    if candidate not in self.visited_urls:
                        self.visited_urls.add(candidate)
                        batch.append(candidate)

                if not batch:
                    break

                async def crawl_with_sem(target):
                    async with semaphore:
                        return await self.crawl_page(client, target)

                tasks = [crawl_with_sem(u) for u in batch]
                batch_results = await asyncio.gather(*tasks, return_exceptions=True)

                for res in batch_results:
                    if isinstance(res, PageCrawlResult):
                        self.results[res.url] = res
                        for link in res.internal_links:
                            if link not in self.visited_urls and link not in self.queued_urls:
                                self.queued_urls.append(link)

                progress = min(90, int((len(self.visited_urls) / max(1, self.max_pages)) * 80) + 10)
                if self.progress_callback:
                    await self.progress_callback(
                        f"Crawled {len(self.visited_urls)} / {self.max_pages} pages...",
                        progress
                    )

        return self.results
