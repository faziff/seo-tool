import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "CROX SEO Intelligence"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./crox.db")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    PAGESPEED_API_KEY: str = os.getenv("PAGESPEED_API_KEY", "")
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "*")
    MAX_PAGES_PER_SCAN: int = int(os.getenv("MAX_PAGES_PER_SCAN", "50"))
    REQUEST_TIMEOUT_SECONDS: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "15"))
    CRAWL_CONCURRENCY: int = int(os.getenv("CRAWL_CONCURRENCY", "5"))
    USER_AGENT: str = os.getenv(
        "USER_AGENT",
        "Mozilla/5.0 (compatible; CROX-SEO-Bot/1.0; +https://crox.ai/bot)"
    )

    # SSRF Protection: Block private and link-local CIDRs
    BLOCKED_IP_NETWORKS: List[str] = [
        "127.0.0.0/8",      # Loopback
        "10.0.0.0/8",       # Private RFC1918
        "172.16.0.0/12",    # Private RFC1918
        "192.168.0.0/16",   # Private RFC1918
        "169.254.0.0/16",   # Link-local / Cloud metadata (169.254.169.254)
        "0.0.0.0/8",        # Current network
        "::1/128",          # IPv6 loopback
        "fc00::/7",         # IPv6 Unique Local
        "fe80::/10",        # IPv6 Link-local
    ]


settings = Settings()
