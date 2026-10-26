import dns from 'node:dns/promises';
import { URL } from 'node:url';

// IPv4 private & reserved ranges
const IPV4_PROHIBITED_RANGES = [
  { start: '0.0.0.0', end: '0.255.255.255' },         // Current network
  { start: '10.0.0.0', end: '10.255.255.255' },       // RFC 1918 Private
  { start: '100.64.0.0', end: '100.127.255.255' },    // Shared Address (Carrier NAT)
  { start: '127.0.0.0', end: '127.255.255.255' },     // Loopback
  { start: '169.254.0.0', end: '169.254.255.255' },   // Link-Local & Cloud Metadata (AWS/GCP 169.254.169.254)
  { start: '172.16.0.0', end: '172.31.255.255' },     // RFC 1918 Private
  { start: '192.0.0.0', end: '192.0.0.255' },         // IETF Protocol Assignments
  { start: '192.0.2.0', end: '192.0.2.255' },         // TEST-NET-1
  { start: '192.168.0.0', end: '192.168.255.255' },   // RFC 1918 Private
  { start: '198.18.0.0', end: '198.19.255.255' },     // Benchmark tests
  { start: '198.51.100.0', end: '198.51.100.255' },   // TEST-NET-2
  { start: '203.0.113.0', end: '203.0.113.255' },     // TEST-NET-3
  { start: '224.0.0.0', end: '239.255.255.255' },     // Multicast
  { start: '240.0.0.0', end: '255.255.255.255' },     // Reserved / Broadcast
];

function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function isPrivateOrReservedIPv4(ip: string): boolean {
  const ipNum = ipToLong(ip);
  for (const range of IPV4_PROHIBITED_RANGES) {
    const startNum = ipToLong(range.start);
    const endNum = ipToLong(range.end);
    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }
  return false;
}

export function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  // Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  // Unspecified
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
  // Unique local addresses (fc00::/7)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // Link-local addresses (fe80::/10)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  // IPv4-mapped IPv6 (::ffff:192.0.2.128)
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.replace('::ffff:', '');
    if (v4Part.includes('.')) {
      return isPrivateOrReservedIPv4(v4Part);
    }
  }
  return false;
}

export interface ValidationResult {
  valid: boolean;
  normalizedUrl: string;
  hostname: string;
  protocol: string;
  resolvedIp?: string;
  error?: string;
}

export async function validateTargetUrl(rawUrl: string): Promise<ValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, normalizedUrl: '', hostname: '', protocol: '', error: 'URL must be a non-empty string.' };
  }

  let cleaned = rawUrl.trim();
  // If no scheme provided, default to https://
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return { valid: false, normalizedUrl: '', hostname: '', protocol: '', error: 'Invalid URL format.' };
  }

  // Scheme check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, normalizedUrl: '', hostname: '', protocol: parsed.protocol, error: 'Only HTTP and HTTPS protocols are permitted.' };
  }

  // Embedded credentials check
  if (parsed.username || parsed.password) {
    return { valid: false, normalizedUrl: '', hostname: parsed.hostname, protocol: parsed.protocol, error: 'URLs with embedded user credentials are not allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Basic hostname structure check
  if (!hostname || hostname.includes(' ') || hostname.length > 253) {
    return { valid: false, normalizedUrl: '', hostname, protocol: parsed.protocol, error: 'Malformed hostname.' };
  }

  // Block localhost and specific internal names
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { valid: false, normalizedUrl: '', hostname, protocol: parsed.protocol, error: 'Localhost and private domain extensions are prohibited.' };
  }

  // Check if hostname is directly an IP literal
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    if (isPrivateOrReservedIPv4(hostname)) {
      return { valid: false, normalizedUrl: '', hostname, protocol: parsed.protocol, error: `Access to private or loopback IP (${hostname}) is blocked.` };
    }
    return {
      valid: true,
      normalizedUrl: parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname),
      hostname,
      protocol: parsed.protocol,
      resolvedIp: hostname
    };
  }

  // Check IPv6 literal
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const rawIpv6 = hostname.slice(1, -1);
    if (isPrivateOrReservedIPv6(rawIpv6)) {
      return { valid: false, normalizedUrl: '', hostname, protocol: parsed.protocol, error: `Access to private IPv6 address (${rawIpv6}) is blocked.` };
    }
    return {
      valid: true,
      normalizedUrl: parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname),
      hostname,
      protocol: parsed.protocol,
      resolvedIp: rawIpv6
    };
  }

  // DNS resolution to protect against DNS rebinding & private IP mapping
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { valid: false, normalizedUrl: '', hostname, protocol: parsed.protocol, error: `Could not resolve domain ${hostname}. Please verify domain exists.` };
    }

    for (const record of records) {
      if (record.family === 4 && isPrivateOrReservedIPv4(record.address)) {
        return { valid: false, normalizedUrl: '', hostname, protocol: parsed.protocol, error: `Domain ${hostname} resolves to prohibited private IP address ${record.address}.` };
      }
      if (record.family === 6 && isPrivateOrReservedIPv6(record.address)) {
        return { valid: false, normalizedUrl: '', hostname, protocol: parsed.protocol, error: `Domain ${hostname} resolves to prohibited IPv6 address ${record.address}.` };
      }
    }

    const normalizedUrl = `${parsed.protocol}//${hostname}${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}`;

    return {
      valid: true,
      normalizedUrl,
      hostname,
      protocol: parsed.protocol,
      resolvedIp: records[0].address
    };
  } catch (err: any) {
    return {
      valid: false,
      normalizedUrl: '',
      hostname,
      protocol: parsed.protocol,
      error: `DNS resolution failed for ${hostname}: ${err.message || 'Host not found'}`
    };
  }
}
