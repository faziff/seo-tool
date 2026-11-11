from typing import Dict, Any, Optional
from backend.app.core.config import settings

try:
    import httpx
except ImportError:
    httpx = None


class PerformanceService:
    @staticmethod
    def is_configured() -> bool:
        return bool(settings.PAGESPEED_API_KEY and settings.PAGESPEED_API_KEY.strip())

    @classmethod
    async def fetch_pagespeed_metrics(cls, url: str, strategy: str = "mobile") -> Dict[str, Any]:
        """
        Retrieves real Lighthouse and Core Web Vitals metrics via Google PageSpeed Insights API.
        If unconfigured, returns clearly labeled status and guidance.
        """
        if not cls.is_configured():
            return {
                "status": "not_configured",
                "message": "Google PageSpeed Insights API key is not configured. Add PAGESPEED_API_KEY to your environment to retrieve real Lighthouse LCP, INP, CLS, and lab performance scores.",
                "data": None
            }

        endpoint = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
        params = {
            "url": url,
            "key": settings.PAGESPEED_API_KEY,
            "strategy": strategy,
            "category": ["performance", "accessibility", "seo", "best-practices"]
        }

        try:
            async with httpx.AsyncClient(timeout=45) as client:
                res = await client.get(endpoint, params=params)
                if res.status_code == 200:
                    raw = res.json()
                    lighthouse = raw.get("lighthouseResult", {})
                    categories = lighthouse.get("categories", {})
                    audits = lighthouse.get("audits", {})

                    return {
                        "status": "success",
                        "data": {
                            "performance_score": int((categories.get("performance", {}).get("score", 0) or 0) * 100),
                            "accessibility_score": int((categories.get("accessibility", {}).get("score", 0) or 0) * 100),
                            "seo_score": int((categories.get("seo", {}).get("score", 0) or 0) * 100),
                            "lcp": audits.get("largest-contentful-paint", {}).get("displayValue", "N/A"),
                            "cls": audits.get("cumulative-layout-shift", {}).get("displayValue", "N/A"),
                            "fcp": audits.get("first-contentful-paint", {}).get("displayValue", "N/A"),
                            "speed_index": audits.get("speed-index", {}).get("displayValue", "N/A"),
                            "total_blocking_time": audits.get("total-blocking-time", {}).get("displayValue", "N/A"),
                        }
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"PageSpeed API returned HTTP {res.status_code}: {res.text[:150]}"
                    }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to retrieve PageSpeed metrics: {str(e)}"
            }
