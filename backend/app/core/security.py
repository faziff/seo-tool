import ipaddress
import socket
from urllib.parse import urlparse
from backend.app.core.config import settings


class SecurityError(Exception):
    pass


def validate_target_url(raw_url: str) -> str:
    """
    Validates a URL against SSRF attacks, DNS rebinding, internal network scanning,
    and invalid schemes. Normalizes the URL for safe crawling.
    """
    if not raw_url:
        raise SecurityError("URL cannot be empty")

    url = raw_url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        url = "https://" + url

    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise SecurityError(f"Unsupported URL scheme: {parsed.scheme}. Only HTTP and HTTPS are permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise SecurityError("Invalid domain name or hostname.")

    # Block obvious local keywords
    lowered_host = hostname.lower()
    if lowered_host in ("localhost", "127.0.0.1", "0.0.0.0", "metadata.google.internal"):
        raise SecurityError("Scanning localhost, internal, or cloud metadata endpoints is prohibited.")

    if lowered_host.endswith(".local") or lowered_host.endswith(".internal"):
        raise SecurityError("Scanning internal domains is prohibited.")

    # DNS Resolution and CIDR checking
    try:
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror:
        raise SecurityError(f"Unable to resolve hostname '{hostname}'. Please check the domain name.")

    blocked_networks = [ipaddress.ip_network(net) for net in settings.BLOCKED_IP_NETWORKS]

    for item in addr_info:
        ip_str = item[4][0]
        ip_obj = ipaddress.ip_address(ip_str)

        # Check if IP falls into any blocked network
        for network in blocked_networks:
            if ip_obj in network:
                raise SecurityError(
                    f"Resolved IP {ip_str} for domain '{hostname}' belongs to restricted network ({network}). Access denied."
                )

        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_multicast:
            raise SecurityError(f"Scanning private/local IP address {ip_str} is strictly prohibited.")

    return url
