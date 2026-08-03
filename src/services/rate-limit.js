const { getPlan } = require("../config/plans");
const { scheduleUsageRecord } = require("./usage");
const { API_KEY_CREATE_PER_MINUTE } = require("../config/limits");

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
const FREE_CHAT_RPM = parsePositiveInt(
  process.env.RATE_LIMIT_CHAT_PER_MINUTE,
  getPlan("free").rpm,
);
const STATUS_PER_MINUTE = parsePositiveInt(
  process.env.RATE_LIMIT_STATUS_PER_MINUTE,
  60,
);
const WINDOW_MS = 60_000;

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
      windowStart: entry.windowStart,
      used: entry.count,
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
    windowStart: entry.windowStart,
    used: entry.count,
  };
}

function peekRateLimit(key, maxRequests, windowMs) {
  if (!maxRequests || key == null) {
    return {
      remaining: maxRequests || null,
      used: 0,
      limit: maxRequests || null,
      windowSeconds: Math.ceil(windowMs / 1000),
      windowStart: null,
      resetAt: null,
    };
  }
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    return {
      remaining: maxRequests,
      used: 0,
      limit: maxRequests,
      windowSeconds: Math.ceil(windowMs / 1000),
      windowStart: null,
      resetAt: null,
    };
  }
  const used = entry.count;
  const remaining = Math.max(0, maxRequests - used);
  return {
    remaining,
    used,
    limit: maxRequests,
    windowSeconds: Math.ceil(windowMs / 1000),
    windowStart: entry.windowStart,
    resetAt: entry.windowStart + windowMs,
  };
}

function resolveChatLimit(user) {
  if (user?.plan) {
    const plan = getPlan(user.plan);
    return { keyPart: `user:${user.id}`, limit: plan.rpm, planId: plan.id };
  }
  return { keyPart: null, limit: FREE_CHAT_RPM, planId: "free" };
}

function checkCreateSessionRateLimit(ip, user = null) {
  const windowMs = CREATE_SESSION_INTERVAL_SEC * 1000;
  const identity = user?.id ? `user:${user.id}` : ip == null ? null : `ip:${ip}`;
  return checkRateLimit(
    identity == null ? null : `create-session:${identity}`,
    1,
    windowMs,
  );
}

function checkChatRateLimit(ip, user = null) {
  const { keyPart, limit, planId } = resolveChatLimit(user);
  const identity = keyPart || (ip == null ? null : `ip:${ip}`);
  const result = checkRateLimit(
    identity == null ? null : `chat:${identity}`,
    limit,
    WINDOW_MS,
  );
  if (result.allowed && user?.id) {
    scheduleUsageRecord(user.id, "chat");
  }
  return { ...result, planId };
}

function peekChatRateLimit(user = null) {
  const { keyPart, limit, planId } = resolveChatLimit(user);
  if (!keyPart) {
    return { ...peekRateLimit(null, limit, WINDOW_MS), planId };
  }
  return { ...peekRateLimit(`chat:${keyPart}`, limit, WINDOW_MS), planId };
}

function checkStatusRateLimit(ip, user = null) {
  const identity = user?.id ? `user:${user.id}` : ip == null ? null : `ip:${ip}`;
  return checkRateLimit(
    identity == null ? null : `status:${identity}`,
    STATUS_PER_MINUTE,
    WINDOW_MS,
  );
}

function checkApiKeyCreateRateLimit(userId) {
  return checkRateLimit(
    `api-key-create:user:${userId}`,
    API_KEY_CREATE_PER_MINUTE,
    WINDOW_MS,
  );
}

module.exports = {
  checkCreateSessionRateLimit,
  checkChatRateLimit,
  checkStatusRateLimit,
  checkApiKeyCreateRateLimit,
  peekChatRateLimit,
  FREE_CHAT_RPM,
};
