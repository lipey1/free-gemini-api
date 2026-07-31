const buckets = new Map();

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

const CREATE_SESSION_INTERVAL_SEC = parsePositiveInt(
  process.env.RATE_LIMIT_CREATE_SESSION_INTERVAL_SEC,
  15,
);
const CHAT_PER_MINUTE = parsePositiveInt(process.env.RATE_LIMIT_CHAT_PER_MINUTE, 30);
const STATUS_PER_MINUTE = parsePositiveInt(
  process.env.RATE_LIMIT_STATUS_PER_MINUTE,
  60,
);
const WINDOW_MS = 60_000;

/* Buckets are keyed per IP, so the map grows with the audience. Evict expired
   entries periodically or a long-running process leaks one entry per visitor. */
const EVICT_EVERY_MS = 5 * 60_000;
let lastEviction = Date.now();

function evictExpired(now, windowMs) {
  if (now - lastEviction < EVICT_EVERY_MS) return;
  lastEviction = now;
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart >= Math.max(windowMs, WINDOW_MS)) buckets.delete(key);
  }
}

function checkRateLimit(key, maxRequests, windowMs) {
  if (!maxRequests) {
    return { allowed: true, remaining: null, retryAfterSeconds: 0 };
  }

  // Unidentified caller (no proxy header). Never share a bucket: that would
  // throttle every such visitor against one another.
  if (key === null || key === undefined) {
    return { allowed: true, remaining: null, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  evictExpired(now, windowMs);
  let entry = buckets.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 0, windowStart: now };
  }

  if (entry.count >= maxRequests) {
    const retryAfterMs = Math.max(0, windowMs - (now - entry.windowStart));
    buckets.set(key, entry);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      limit: maxRequests,
      windowSeconds: Math.ceil(windowMs / 1000),
    };
  }

  entry.count += 1;
  buckets.set(key, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    retryAfterSeconds: 0,
    limit: maxRequests,
    windowSeconds: Math.ceil(windowMs / 1000),
  };
}

function checkCreateSessionRateLimit(ip) {
  const windowMs = CREATE_SESSION_INTERVAL_SEC * 1000;
  return checkRateLimit((ip == null ? null : `create-session:${ip}`), 1, windowMs);
}

function checkChatRateLimit(ip) {
  return checkRateLimit((ip == null ? null : `chat:${ip}`), CHAT_PER_MINUTE, WINDOW_MS);
}

function checkStatusRateLimit(ip) {
  return checkRateLimit((ip == null ? null : `status:${ip}`), STATUS_PER_MINUTE, WINDOW_MS);
}

module.exports = {
  checkCreateSessionRateLimit,
  checkChatRateLimit,
  checkStatusRateLimit,
};
