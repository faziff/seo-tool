import os
from typing import Dict, Any, Optional, List
from backend.app.core.config import settings

try:
    import httpx
except ImportError:
    httpx = None


class AIService:
    @staticmethod
    def is_configured() -> bool:
        return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())

    @classmethod
    async def generate_issue_fix(
        cls,
        issue_title: str,
        issue_category: str,
        affected_url: str,
        evidence: str,
        explanation: str
    ) -> Dict[str, Any]:
        """
        Generates an actionable fix snippet and instructions using Gemini API (gemini-3.8-flash)
        when configured, or returns detailed deterministic technical remediation instructions.
        """
        if not cls.is_configured():
            return {
                "status": "unconfigured",
                "message": "CROX AI provider is not configured. Set GEMINI_API_KEY in the environment or Settings panel to enable real-time AI code generation.",
                "remediation_guide": f"Standard remediation for {issue_title}: Review {affected_url}, resolve evidence ({evidence}), and deploy updated HTML/server configurations."
            }

        prompt = f"""You are CROX AI, an elite technical SEO and web engineering specialist.
Analyze the following website issue and provide a concrete, production-ready fix:

Issue: {issue_title}
Category: {issue_category}
Affected URL: {affected_url}
Evidence: {evidence}
Explanation: {explanation}

Respond with:
1. Exact Code Snippet (HTML, Nginx/Apache, or JavaScript)
2. Step-by-step Implementation Steps
3. Verification Command or Test
"""
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    return {
                        "status": "success",
                        "fix_content": text
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"AI provider returned status {res.status_code}: {res.text[:200]}"
                    }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to contact AI provider: {str(e)}"
            }

    @classmethod
    async def chat(
        cls,
        user_message: str,
        scan_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not cls.is_configured():
            return {
                "reply": "CROX AI Assistant requires an active Gemini API Key. To activate, ensure GEMINI_API_KEY is configured in your environment or Secrets panel. Once configured, CROX AI can analyze your audit results, suggest tailored schema, and write high-converting meta tags.",
                "suggestions": [
                    "How do I fix missing meta descriptions?",
                    "What is Time to First Byte (TTFB)?",
                    "How to setup canonical tags properly?",
                    "Best practices for H1 headings"
                ]
            }

        context_str = ""
        if scan_context:
            context_str = f"""
Current Scan Context:
Domain: {scan_context.get('domain')}
Health Score: {scan_context.get('health_score')}/100
Pages Crawled: {scan_context.get('pages_crawled')}
Critical Issues: {scan_context.get('critical_issues_count', 0)}
Top Issues Detected: {scan_context.get('top_issues_summary', 'None')}
"""

        system_instruction = f"""You are CROX AI, the dedicated SEO & technical website health copilot.
Answer user questions with deep technical authority, concise prose, and clean formatting.
Distinguish observed facts from assumptions.
{context_str}
"""
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={settings.GEMINI_API_KEY}"
            payload = {
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "contents": [{"parts": [{"text": user_message}]}]
            }
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    return {
                        "reply": text,
                        "suggestions": [
                            "Explain the most critical issue",
                            "Generate a meta description template",
                            "How to optimize LCP for my site"
                        ]
                    }
                else:
                    return {
                        "reply": f"AI provider returned an error ({res.status_code}). Please check your API quota or key permissions.",
                        "suggestions": []
                    }
        except Exception as e:
            return {
                "reply": f"Unable to reach AI assistant: {str(e)}",
                "suggestions": []
            }
