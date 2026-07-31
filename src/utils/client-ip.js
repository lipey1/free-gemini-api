const logger = require("./logger");

/**
 * Identify the caller for rate limiting.
 *
 * The Elysia node adapter does not expose the socket address, so headers set
 * by the reverse proxy are the only source. The previous implementation
 * returned the literal string "unknown" when no header was present, which put
 * every unidentified caller into a single shared bucket: with the console open
 * in 200 browsers they would collectively exhaust one 30/min allowance and
 * throttle each other.
 *
 * Returns null when the caller cannot be identified. Callers treat null as
 * "do not rate limit" rather than "share one bucket", because throttling
 * everyone together is a worse failure than not throttling an unidentified
 * request. Behind a proxy that sets X-Forwarded-For this never happens.
 */

const HEADERS = [
  "x-forwarded-for", // standard proxy chain; first entry is the origin client
  "x-real-ip", // nginx proxy_set_header X-Real-IP
  "cf-connecting-ip", // Cloudflare
  "true-client-ip", // Akamai, Cloudflare Enterprise
  "fly-client-ip", // Fly.io
];

let warned = false;

function firstAddress(value) {
  const candidate = value.split(",")[0].trim();
  if (!candidate) return null;

  // Strip an IPv6 zone or a :port suffix on a bare IPv4 (1.2.3.4:5678).
  const bare = candidate.replace(/^\[|\]$/g, "").split("%")[0];
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(bare)) return bare.split(":")[0];
  return bare;
}

function getClientIp(request) {
  for (const name of HEADERS) {
    const raw = request.headers.get(name);
    if (!raw) continue;
    const addr = firstAddress(raw);
    if (addr) return addr;
  }

  if (!warned) {
    warned = true;
    logger.warn(
      "Nenhum header de IP do cliente encontrado (x-forwarded-for, x-real-ip, ...). " +
        "Rate limiting desativado para estas requisições. Configure o proxy reverso: " +
        'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    );
  }
  return null;
}

module.exports = { getClientIp };
