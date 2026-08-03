const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@libsql/client");
const { drizzle } = require("drizzle-orm/libsql");
const { sql } = require("drizzle-orm");

const DEFAULT_FOLDER = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DEFAULT_FOLDER)) {
  fs.mkdirSync(DEFAULT_FOLDER, { recursive: true });
}

const configured = String(process.env.APP_DB_PATH || "").trim();
const dbPath = configured
  ? path.resolve(configured)
  : path.resolve(DEFAULT_FOLDER, "app.sqlite");

let db = null;
let ready = false;
let initPromise = null;

async function migrate(database) {
  await database.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      plan TEXT NOT NULL DEFAULT 'free',
      stripe_customer_id TEXT,
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      totp_temp_secret TEXT,
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await database.run(sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      user_agent TEXT,
      ip TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await database.run(sql`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)
  `);

  await database.run(sql`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await database.run(sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Default',
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await database.run(sql`
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)
  `);

  await database.run(sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      stripe_subscription_id TEXT NOT NULL UNIQUE,
      stripe_price_id TEXT,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await database.run(sql`
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)
  `);

  await database.run(sql`
    CREATE TABLE IF NOT EXISTS stripe_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      processed_at INTEGER NOT NULL
    )
  `);

  await database.run(sql`
    CREATE TABLE IF NOT EXISTS usage_minutes (
      user_id TEXT NOT NULL,
      minute_ts INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'chat',
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, minute_ts, kind),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await database.run(sql`
    CREATE INDEX IF NOT EXISTS idx_usage_minutes_user_ts
    ON usage_minutes(user_id, minute_ts)
  `);
}

function initAppDb() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const client = createClient({ url: `file:${dbPath}` });
    db = drizzle(client);
    await migrate(db);
    ready = true;
    return db;
  })();

  return initPromise;
}

async function getDb() {
  if (!ready) await initAppDb();
  return db;
}

initAppDb().catch((err) => {
  console.error(`[app-db] failed to init: ${err.message}`);
});

module.exports = {
  getDb,
  initAppDb,
  dbPath,
  sql,
};
