import { lookup } from "node:dns/promises";
import net from "node:net";
import { z } from "zod";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".lan"];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const ranges: Array<[number, number]> = [
    [ipv4ToInt("0.0.0.0"), ipv4ToInt("0.255.255.255")],
    [ipv4ToInt("10.0.0.0"), ipv4ToInt("10.255.255.255")],
    [ipv4ToInt("100.64.0.0"), ipv4ToInt("100.127.255.255")],
    [ipv4ToInt("127.0.0.0"), ipv4ToInt("127.255.255.255")],
    [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")],
    [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")],
    [ipv4ToInt("192.0.0.0"), ipv4ToInt("192.0.0.255")],
    [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")],
    [ipv4ToInt("198.18.0.0"), ipv4ToInt("198.19.255.255")],
    [ipv4ToInt("224.0.0.0"), ipv4ToInt("255.255.255.255")],
  ];
  return ranges.some(([start, end]) => n >= start && n <= end);
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    /^::ffff:(172\.(1[6-9]|2\d|3[0-1])\.)/.test(normalized)
  );
}

export function isBlockedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

export const publicHttpUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2048, "URL is too long")
  .url("Enter a valid URL")
  .refine((value) => {
    try {
      const u = new URL(value);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Only http and https URLs are allowed")
  .refine((value) => {
    let u: URL;
    try {
      u = new URL(value);
    } catch {
      return false;
    }
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (BLOCKED_HOSTNAMES.has(host)) return false;
    if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return false;
    if (net.isIP(host) && isBlockedIp(host)) return false;
    if (host === "metadata" || host.includes("169.254.169.254")) return false;
    return true;
  }, "Local, private, and metadata endpoints are blocked");

export type SafeUrlResult =
  | { ok: true; url: string; hostname: string; resolvedIps: string[] }
  | { ok: false; error: string };

/**
 * Validate URL shape, resolve DNS, and reject private/metadata targets.
 * Re-checks resolved IPs to mitigate DNS rebinding for SSRF.
 */
export async function validatePublicUrl(input: string): Promise<SafeUrlResult> {
  const trimmed = typeof input === "string" ? input.trim() : "";
  const withScheme = trimmed && !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
  const parsed = publicHttpUrlSchema.safeParse(withScheme);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid URL" };
  }

  const url = new URL(parsed.data);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      return { ok: false, error: "Private or loopback IP addresses are blocked" };
    }
    return { ok: true, url: url.toString(), hostname, resolvedIps: [hostname] };
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    const ips = records.map((r) => r.address);
    if (ips.length === 0) {
      return { ok: false, error: "Could not resolve hostname" };
    }
    const blocked = ips.find((ip) => isBlockedIp(ip));
    if (blocked) {
      return {
        ok: false,
        error: `Hostname resolves to a blocked address (${blocked})`,
      };
    }
    return { ok: true, url: url.toString(), hostname, resolvedIps: ips };
  } catch {
    return { ok: false, error: "DNS resolution failed for this hostname" };
  }
}

/** Re-validate after redirects — call with final URL before fetching content. */
export async function assertSafeRedirectTarget(url: string): Promise<SafeUrlResult> {
  return validatePublicUrl(url);
}
