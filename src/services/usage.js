const { sql } = require("drizzle-orm");
const { getDb } = require("../db/app-db");

function minuteBucket(ts = Date.now()) {
  return Math.floor(ts / 60_000) * 60_000;
}

function hourBucket(ts = Date.now()) {
  return Math.floor(ts / 3_600_000) * 3_600_000;
}

/**
 * Fire-and-forget friendly increment for authenticated chat usage.
 */
async function recordUsageMinute(userId, kind = "chat", at = Date.now()) {
  if (!userId) return;
  const db = await getDb();
  const minuteTs = minuteBucket(at);
  const k = String(kind || "chat").slice(0, 32);

  await db.run(sql`
    INSERT INTO usage_minutes (user_id, minute_ts, kind, count)
    VALUES (${userId}, ${minuteTs}, ${k}, 1)
    ON CONFLICT(user_id, minute_ts, kind)
    DO UPDATE SET count = count + 1
  `);
}

function scheduleUsageRecord(userId, kind = "chat") {
  if (!userId) return;
  setImmediate(() => {
    recordUsageMinute(userId, kind).catch(() => {});
  });
}

async function getUsageSeries(userId, { hours = 24, kind = "chat" } = {}) {
  const db = await getDb();
  const now = Date.now();
  const hoursClamped = Math.min(168, Math.max(1, Number(hours) || 24));
  const since = now - hoursClamped * 3_600_000;
  const k = String(kind || "chat");

  const rows = await db.all(sql`
    SELECT minute_ts, count
    FROM usage_minutes
    WHERE user_id = ${userId}
      AND kind = ${k}
      AND minute_ts >= ${since}
    ORDER BY minute_ts ASC
  `);

  const byHour = new Map();
  for (let i = hoursClamped - 1; i >= 0; i--) {
    const h = hourBucket(now - i * 3_600_000);
    byHour.set(h, 0);
  }
  for (const row of rows) {
    const h = hourBucket(row.minute_ts);
    if (byHour.has(h)) byHour.set(h, byHour.get(h) + Number(row.count || 0));
  }

  const hourly = [...byHour.entries()].map(([ts, count]) => ({ ts, count }));

  const lastHourSince = now - 60 * 60_000;
  const byMinute = new Map();
  for (let i = 59; i >= 0; i--) {
    const m = minuteBucket(now - i * 60_000);
    byMinute.set(m, 0);
  }
  for (const row of rows) {
    if (row.minute_ts < lastHourSince) continue;
    const m = minuteBucket(row.minute_ts);
    if (byMinute.has(m)) byMinute.set(m, Number(row.count || 0));
  }
  const lastHour = [...byMinute.entries()].map(([ts, count]) => ({ ts, count }));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySince = todayStart.getTime();
  let todayTotal = 0;
  let last24hTotal = 0;
  for (const row of rows) {
    const c = Number(row.count || 0);
    last24hTotal += c;
    if (row.minute_ts >= todaySince) todayTotal += c;
  }

  return {
    hourly,
    lastHour,
    todayTotal,
    last24hTotal,
    hours: hoursClamped,
  };
}

module.exports = {
  minuteBucket,
  hourBucket,
  recordUsageMinute,
  scheduleUsageRecord,
  getUsageSeries,
};
