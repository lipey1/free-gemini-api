const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@libsql/client");
const { drizzle } = require("drizzle-orm/libsql");
const { sql } = require("drizzle-orm");

const memorySessions = new Map();

const SESSION_TTL_MINUTES = Number(process.env.SESSION_TTL_MINUTES || 45);
const SESSION_TTL_MS = SESSION_TTL_MINUTES * 60 * 1000;
const DEFAULT_DB_PATH_FOLDER = path.resolve(process.cwd(), "data");
if (!fs.existsSync(DEFAULT_DB_PATH_FOLDER)) {
  fs.mkdirSync(DEFAULT_DB_PATH_FOLDER, { recursive: true });
}
const DEFAULT_DB_PATH = path.resolve(DEFAULT_DB_PATH_FOLDER, "sessions.sqlite");

const configuredDbPath = String(process.env.SESSION_DB_PATH || "").trim();
const dbPath = configuredDbPath ? path.resolve(configuredDbPath) : DEFAULT_DB_PATH;

let db = null;
let sqliteEnabled = false;
let initPromise = null;

function initSqlite() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });

      const client = createClient({
        url: `file:${dbPath}`,
      });
      db = drizzle(client);

      await db.run(sql`
        CREATE TABLE IF NOT EXISTS sessions (
          sid TEXT PRIMARY KEY,
          snapshot_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `);

      sqliteEnabled = true;
    } catch (error) {
      sqliteEnabled = false;
      db = null;
      console.warn(
        `[session-store] Drizzle/SQLite desativado (${error.message}). ` +
          "Usando memória; sessões vão expirar ao reiniciar.",
      );
    }
  })();

  return initPromise;
}

initSqlite();

function now() {
  return Date.now();
}

async function createSession(snapshot) {
  await initSqlite();
  const sid = crypto.randomUUID();
  const createdAt = now();
  const expiresAt = createdAt + SESSION_TTL_MS;

  if (sqliteEnabled) {
    await db.run(sql`
      INSERT INTO sessions (sid, snapshot_json, created_at, expires_at)
      VALUES (${sid}, ${JSON.stringify(snapshot)}, ${createdAt}, ${expiresAt})
    `);
  } else {
    memorySessions.set(sid, {
      snapshot,
      createdAt,
      expiresAt,
    });
  }

  return sid;
}

async function getSession(sid) {
  const state = await getSessionState(sid);
  return state.status === "active" ? state.session : null;
}

async function getSessionState(sid) {
  await initSqlite();
  if (!sqliteEnabled) {
    const data = memorySessions.get(sid);
    if (!data) return { status: "missing" };
    if (data.expiresAt <= now()) {
      memorySessions.delete(sid);
      return {
        status: "expired",
        expiredAt: data.expiresAt,
      };
    }
    return {
      status: "active",
      session: data,
    };
  }

  const rows = await db.all(sql`
    SELECT sid, snapshot_json, created_at, expires_at
    FROM sessions
    WHERE sid = ${sid}
    LIMIT 1
  `);
  const data = Array.isArray(rows) ? rows[0] : null;
  if (!data) return { status: "missing" };

  const expiresAt = Number(data.expires_at);
  if (expiresAt <= now()) {
    await db.run(sql`DELETE FROM sessions WHERE sid = ${sid}`);
    return {
      status: "expired",
      expiredAt: expiresAt,
    };
  }

  let snapshot;
  try {
    snapshot = JSON.parse(String(data.snapshot_json));
  } catch {
    await db.run(sql`DELETE FROM sessions WHERE sid = ${sid}`);
    return { status: "missing" };
  }

  return {
    status: "active",
    session: {
      snapshot,
      createdAt: Number(data.created_at),
      expiresAt,
    },
  };
}

async function clearExpiredSessions() {
  await initSqlite();
  if (sqliteEnabled) {
    await db.run(sql`DELETE FROM sessions WHERE expires_at <= ${now()}`);
    return;
  }

  const ts = now();
  for (const [sid, data] of memorySessions.entries()) {
    if (data.expiresAt <= ts) {
      memorySessions.delete(sid);
    }
  }
}

async function updateSessionSnapshot(sid, snapshot) {
  await initSqlite();
  if (!sid || !snapshot) return false;

  if (sqliteEnabled) {
    const result = await db.run(sql`
      UPDATE sessions
      SET snapshot_json = ${JSON.stringify(snapshot)}
      WHERE sid = ${sid} AND expires_at > ${now()}
    `);
    return Number(result?.rowsAffected || 0) > 0;
  }

  const data = memorySessions.get(sid);
  if (!data || data.expiresAt <= now()) return false;
  data.snapshot = snapshot;
  return true;
}

module.exports = {
  SESSION_TTL_MS,
  createSession,
  getSession,
  getSessionState,
  clearExpiredSessions,
  updateSessionSnapshot,
};
