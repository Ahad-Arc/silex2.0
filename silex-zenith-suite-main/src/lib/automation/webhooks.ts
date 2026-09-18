/**
 * SILEX Automation Workflow Engine — Webhook Security & Cryptography Helpers
 * 
 * Server-only cryptographic signing, SSRF target URL validation, HTTP response classification,
 * exponential backoff calculation, and bounded response body formatting.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "CRITICAL SECURITY ERROR: Webhook security helpers must NEVER be loaded in client browser environments."
  );
}

/**
 * Result contract for URL validation
 */
export interface WebhookUrlValidationResult {
  valid: boolean;
  reason?: string;
  url?: URL;
}

/**
 * Result contract for HMAC signature generation
 */
export interface HmacSignatureResult {
  signature: string;
  headerValue: string;
  timestamp: number;
}

/**
 * Result contract for response classification
 */
export interface WebhookResponseClassification {
  isSuccess: boolean;
  retryable: boolean;
  status: "delivered" | "pending" | "failed";
  error?: string;
}

/**
 * Private / Local IP range patterns for SSRF prevention
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // RFC 1918 Private Class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // RFC 1918 Private Class B
  /^192\.168\./, // RFC 1918 Private Class C
  /^169\.254\./, // Link-local / Cloud IMDS (169.254.169.254)
  /^0\./, // Unspecified
  /^22[4-9]\./, // Multicast
  /^23[0-9]\./, // Multicast
];

/**
 * Validates target webhook URL against SSRF threats and protocol constraints.
 */
export function validateWebhookTargetUrl(urlStr: string): WebhookUrlValidationResult {
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, reason: "Target URL must be a non-empty string." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch (err) {
    return { valid: false, reason: "Target URL is malformed or invalid absolute URI." };
  }

  // Protocol Whitelist: HTTPS ONLY
  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      reason: `SECURITY REJECTION: Insecure protocol "${parsed.protocol}" prohibited. Webhook targets MUST use HTTPS.`,
    };
  }

  // Port Check: Enforce default HTTPS port (443 or unassigned default)
  if (parsed.port && parsed.port !== "443") {
    return {
      valid: false,
      reason: `SECURITY REJECTION: Custom port "${parsed.port}" is prohibited. Only default HTTPS port 443 is allowed.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Hostname Blacklist
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    return {
      valid: false,
      reason: `SECURITY REJECTION: Local/internal domain "${hostname}" is prohibited.`,
    };
  }

  // IPv6 Loopback / Local check
  if (
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("fe80:") ||
    hostname.startsWith("fc00:") ||
    hostname.startsWith("fd00:")
  ) {
    return {
      valid: false,
      reason: `SECURITY REJECTION: IPv6 local/private address "${hostname}" is prohibited.`,
    };
  }

  // Check IPv4 patterns if host is a literal IP address
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return {
        valid: false,
        reason: `SECURITY REJECTION: Private/reserved IP address "${hostname}" is prohibited.`,
      };
    }
  }

  return { valid: true, url: parsed };
}

/**
 * Generates an HMAC-SHA256 signature using Web Crypto API (`crypto.subtle`).
 * Canonical signing string: `${timestamp}.${rawJSONPayload}`
 */
export async function generateHmacSignature(
  secret: string,
  timestamp: number,
  rawPayload: string
): Promise<HmacSignatureResult> {
  const encoder = new TextEncoder();
  const canonicalString = `${timestamp}.${rawPayload}`;

  const keyBuffer = encoder.encode(secret);
  const dataBuffer = encoder.encode(canonicalString);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hexSignature = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    signature: hexSignature,
    headerValue: `t=${timestamp},v1=${hexSignature}`,
    timestamp,
  };
}

/**
 * Calculates exponential backoff date with jitter.
 * 
 * consumedRetries = number of retries already consumed (0 for initial failure -> retry #1).
 * Schedule:
 * - Retry #1 (consumed=0): 10s
 * - Retry #2 (consumed=1): 60s (1m)
 * - Retry #3 (consumed=2): 300s (5m)
 * - Retry #4 (consumed=3): 1800s (30m)
 */
export function calculateExponentialBackoff(
  consumedRetries: number,
  customDelaySec?: number
): Date {
  let delaySec: number;

  if (customDelaySec && customDelaySec > 0) {
    delaySec = Math.min(customDelaySec, 3600); // Cap custom delay at 1 hour
  } else {
    switch (consumedRetries) {
      case 0:
        delaySec = 10;
        break;
      case 1:
        delaySec = 60;
        break;
      case 2:
        delaySec = 300;
        break;
      case 3:
      default:
        delaySec = 1800;
        break;
    }
  }

  // Bounded ±10% pseudo-random jitter
  const jitterFactor = 0.9 + Math.random() * 0.2;
  const finalDelayMs = Math.min(delaySec * 1000 * jitterFactor, 3600 * 1000);

  return new Date(Date.now() + finalDelayMs);
}

/**
 * Classifies HTTP response status code or network exception into execution status.
 */
export function classifyWebhookResponse(
  statusCode?: number | null,
  errorMessage?: string | null
): WebhookResponseClassification {
  if (statusCode && statusCode >= 200 && statusCode < 300) {
    return { isSuccess: true, retryable: false, status: "delivered" };
  }

  // Manual Redirect Handling: 3xx is a non-retryable security failure
  if (statusCode && statusCode >= 300 && statusCode < 400) {
    return {
      isSuccess: false,
      retryable: false,
      status: "failed",
      error: `SECURITY_FAILURE: HTTP redirect (${statusCode}) received. Redirects are prohibited.`,
    };
  }

  // 429 Rate Limited: Retryable
  if (statusCode === 429) {
    return {
      isSuccess: false,
      retryable: true,
      status: "pending",
      error: "HTTP 429 Rate Limited.",
    };
  }

  // 408 Request Timeout: Retryable
  if (statusCode === 408) {
    return {
      isSuccess: false,
      retryable: true,
      status: "pending",
      error: "HTTP 408 Request Timeout.",
    };
  }

  // Client Errors (400, 401, 403, 404, 410, etc.): Permanent Failure
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return {
      isSuccess: false,
      retryable: false,
      status: "failed",
      error: `HTTP ${statusCode} Client Error. Non-retryable.`,
    };
  }

  // Server Errors (500, 502, 503, 504): Retryable
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return {
      isSuccess: false,
      retryable: true,
      status: "pending",
      error: `HTTP ${statusCode} Server Error.`,
    };
  }

  // Network Exception / ETIMEDOUT / Connection Refused: Retryable
  return {
    isSuccess: false,
    retryable: true,
    status: "pending",
    error: errorMessage || "Network execution failure.",
  };
}

/**
 * Safely truncates response body snippets to maximum length (default 2048 bytes).
 */
export function boundedResponseBodyReader(
  bodyText?: string | null,
  maxBytes: number = 2048
): string | null {
  if (!bodyText || typeof bodyText !== "string") return null;

  if (bodyText.length > maxBytes) {
    return bodyText.substring(0, maxBytes) + "\n[TRUNCATED]";
  }

  return bodyText;
}

/**
 * Returns string UTF-8 byte size
 */
export function getUtf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}
