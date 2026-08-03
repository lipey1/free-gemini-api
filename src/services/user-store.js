const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { getDb, sql } = require("../db/app-db");
const { getPlan } = require("../config/plans");

const BCRYPT_ROUNDS = 12;
const AUTH_COOKIE = "fga_auth";
const AUTH_TTL_DAYS = Number(process.env.AUTH_SESSION_DAYS || 14);

function now() {
  return Date.now();
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicUser(row) {
  if (!row) return null;
  const plan = getPlan(row.plan);
  return {
    id: row.id,
    email: row.email,
    name: row.name || "",
    role: row.role,
    plan: row.plan,
    planRpm: plan.rpm,
    totpEnabled: Boolean(row.totp_enabled),
    disabled: Boolean(row.disabled),
    stripeCustomerId: row.stripe_customer_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findUserByEmail(email) {
  const db = await getDb();
  const rows = await db.all(
    sql`SELECT * FROM users WHERE email = ${String(email).toLowerCase().trim()} LIMIT 1`,
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const db = await getDb();
  const rows = await db.all(sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`);
  return rows[0] || null;
}

async function createUser({ email, password, name = "", role = "user" }) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const ts = now();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const normalized = String(email).toLowerCase().trim();

  const adminEmail = String(process.env.ADMIN_EMAIL || "")
    .toLowerCase()
    .trim();
  const effectiveRole =
    adminEmail && normalized === adminEmail ? "admin" : role;

  await db.run(sql`
    INSERT INTO users (
      id, email, password_hash, name, role, plan,
      totp_enabled, disabled, created_at, updated_at
    ) VALUES (
      ${id}, ${normalized}, ${passwordHash}, ${name || ""}, ${effectiveRole},
      ${"free"}, ${0}, ${0}, ${ts}, ${ts}
    )
  `);

  return findUserById(id);
}

async function verifyPassword(user, password) {
  if (!user?.password_hash) return false;
  return bcrypt.compare(password, user.password_hash);
}

async function updatePassword(userId, password) {
  const db = await getDb();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const ts = now();
  await db.run(sql`
    UPDATE users SET password_hash = ${passwordHash}, updated_at = ${ts}
    WHERE id = ${userId}
  `);
}

async function updateUserFields(userId, fields) {
  const db = await getDb();
  const ts = now();

  if (fields.name !== undefined) {
    await db.run(sql`UPDATE users SET name = ${fields.name}, updated_at = ${ts} WHERE id = ${userId}`);
  }
  if (fields.role !== undefined) {
    await db.run(sql`UPDATE users SET role = ${fields.role}, updated_at = ${ts} WHERE id = ${userId}`);
  }
  if (fields.plan !== undefined) {
    await db.run(sql`UPDATE users SET plan = ${fields.plan}, updated_at = ${ts} WHERE id = ${userId}`);
  }
  if (fields.stripeCustomerId !== undefined) {
    await db.run(sql`UPDATE users SET stripe_customer_id = ${fields.stripeCustomerId}, updated_at = ${ts} WHERE id = ${userId}`);
  }
  if (fields.totpSecret !== undefined) {
    await db.run(sql`UPDATE users SET totp_secret = ${fields.totpSecret}, updated_at = ${ts} WHERE id = ${userId}`);
  }
  if (fields.totpEnabled !== undefined) {
    await db.run(sql`UPDATE users SET totp_enabled = ${fields.totpEnabled ? 1 : 0}, updated_at = ${ts} WHERE id = ${userId}`);
  }
  if (fields.totpTempSecret !== undefined) {
    await db.run(sql`UPDATE users SET totp_temp_secret = ${fields.totpTempSecret}, updated_at = ${ts} WHERE id = ${userId}`);
  }
  if (fields.disabled !== undefined) {
    await db.run(sql`UPDATE users SET disabled = ${fields.disabled ? 1 : 0}, updated_at = ${ts} WHERE id = ${userId}`);
  }

  return findUserById(userId);
}

async function createAuthSession(userId, { userAgent = "", ip = "" } = {}) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const createdAt = now();
  const expiresAt = createdAt + AUTH_TTL_DAYS * 24 * 60 * 60 * 1000;

  await db.run(sql`
    INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at, user_agent, ip)
    VALUES (${id}, ${userId}, ${tokenHash}, ${expiresAt}, ${createdAt}, ${userAgent}, ${ip})
  `);

  return { id, token, expiresAt };
}

async function findAuthSessionByToken(token) {
  if (!token) return null;
  const db = await getDb();
  const tokenHash = hashToken(token);
  const rows = await db.all(sql`
    SELECT s.id AS session_id, s.user_id, s.expires_at, s.created_at AS session_created_at,
           u.email, u.name, u.role, u.plan, u.totp_enabled, u.totp_secret,
           u.disabled, u.stripe_customer_id, u.created_at AS user_created_at,
           u.updated_at AS user_updated_at, u.password_hash, u.totp_temp_secret
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  if (Number(row.expires_at) < now()) return null;
  return row;
}

async function revokeAuthSession(token) {
  if (!token) return;
  const db = await getDb();
  const tokenHash = hashToken(token);
  await db.run(sql`DELETE FROM auth_sessions WHERE token_hash = ${tokenHash}`);
}

async function revokeAllUserSessions(userId) {
  const db = await getDb();
  await db.run(sql`DELETE FROM auth_sessions WHERE user_id = ${userId}`);
}

async function createPasswordReset(userId) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const createdAt = now();
  const expiresAt = createdAt + 60 * 60 * 1000;

  await db.run(sql`
    INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at)
    VALUES (${id}, ${userId}, ${tokenHash}, ${expiresAt}, ${null}, ${createdAt})
  `);

  return { token, expiresAt };
}

async function consumePasswordReset(token) {
  if (!token) return null;
  const db = await getDb();
  const tokenHash = hashToken(token);
  const rows = await db.all(sql`
    SELECT * FROM password_resets WHERE token_hash = ${tokenHash} LIMIT 1
  `);
  const row = rows[0];
  if (!row || row.used_at || Number(row.expires_at) < now()) return null;

  await db.run(sql`
    UPDATE password_resets SET used_at = ${now()} WHERE id = ${row.id}
  `);
  return row;
}

async function createApiKey(userId, name = "Default") {
  const { MAX_API_KEYS } = require("../config/limits");
  const db = await getDb();
  const activeRows = await db.all(sql`
    SELECT COUNT(*) AS c FROM api_keys
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `);
  const activeCount = Number(activeRows[0]?.c || 0);
  if (activeCount >= MAX_API_KEYS) {
    const err = new Error(
      `Limite de ${MAX_API_KEYS} API keys ativas por conta.`,
    );
    err.code = "API_KEY_LIMIT";
    err.status = 400;
    err.limit = MAX_API_KEYS;
    err.active = activeCount;
    throw err;
  }

  const id = crypto.randomUUID();
  const secret = crypto.randomBytes(24).toString("base64url");
  const rawKey = `fga_${secret}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = hashToken(rawKey);
  const createdAt = now();

  await db.run(sql`
    INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, created_at, last_used_at, revoked_at)
    VALUES (${id}, ${userId}, ${name}, ${keyPrefix}, ${keyHash}, ${createdAt}, ${null}, ${null})
  `);

  return { id, name, keyPrefix, key: rawKey, createdAt, activeCount: activeCount + 1 };
}

async function countActiveApiKeys(userId) {
  const db = await getDb();
  const rows = await db.all(sql`
    SELECT COUNT(*) AS c FROM api_keys
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `);
  return Number(rows[0]?.c || 0);
}

async function listApiKeys(userId) {
  const db = await getDb();
  const rows = await db.all(sql`
    SELECT id, name, key_prefix, created_at, last_used_at, revoked_at
    FROM api_keys WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.key_prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    revokedAt: r.revoked_at,
    active: !r.revoked_at,
  }));
}

async function revokeApiKey(userId, keyId) {
  const db = await getDb();
  await db.run(sql`
    UPDATE api_keys SET revoked_at = ${now()}
    WHERE id = ${keyId} AND user_id = ${userId} AND revoked_at IS NULL
  `);
}

async function findUserByApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith("fga_")) return null;
  const db = await getDb();
  const keyHash = hashToken(rawKey);
  const rows = await db.all(sql`
    SELECT u.*, k.id AS api_key_id
    FROM api_keys k
    JOIN users u ON u.id = k.user_id
    WHERE k.key_hash = ${keyHash} AND k.revoked_at IS NULL
    LIMIT 1
  `);
  const row = rows[0];
  if (!row || row.disabled) return null;

  await db.run(sql`
    UPDATE api_keys SET last_used_at = ${now()} WHERE id = ${row.api_key_id}
  `);

  return row;
}

async function listUsers({ q = "", limit = 50, offset = 0 } = {}) {
  const db = await getDb();
  const lim = Math.min(100, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const query = String(q || "").trim().toLowerCase();

  let rows;
  if (query) {
    const like = `%${query}%`;
    rows = await db.all(sql`
      SELECT * FROM users
      WHERE lower(email) LIKE ${like} OR lower(name) LIKE ${like}
      ORDER BY created_at DESC
      LIMIT ${lim} OFFSET ${off}
    `);
  } else {
    rows = await db.all(sql`
      SELECT * FROM users
      ORDER BY created_at DESC
      LIMIT ${lim} OFFSET ${off}
    `);
  }

  return rows.map(publicUser);
}

async function countUsers() {
  const db = await getDb();
  const rows = await db.all(sql`SELECT COUNT(*) AS c FROM users`);
  return Number(rows[0]?.c || 0);
}

async function upsertSubscription({
  userId,
  stripeSubscriptionId,
  stripePriceId,
  plan,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}) {
  const db = await getDb();
  const ts = now();
  const existing = await db.all(sql`
    SELECT id FROM subscriptions WHERE stripe_subscription_id = ${stripeSubscriptionId} LIMIT 1
  `);

  if (existing[0]) {
    await db.run(sql`
      UPDATE subscriptions SET
        stripe_price_id = ${stripePriceId || null},
        plan = ${plan},
        status = ${status},
        current_period_end = ${currentPeriodEnd || null},
        cancel_at_period_end = ${cancelAtPeriodEnd ? 1 : 0},
        updated_at = ${ts}
      WHERE stripe_subscription_id = ${stripeSubscriptionId}
    `);
  } else {
    await db.run(sql`
      INSERT INTO subscriptions (
        id, user_id, stripe_subscription_id, stripe_price_id, plan, status,
        current_period_end, cancel_at_period_end, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${userId}, ${stripeSubscriptionId},
        ${stripePriceId || null}, ${plan}, ${status},
        ${currentPeriodEnd || null}, ${cancelAtPeriodEnd ? 1 : 0}, ${ts}, ${ts}
      )
    `);
  }

  const active =
    status === "active" || status === "trialing" || status === "past_due";
  await updateUserFields(userId, { plan: active ? plan : "free" });
}

async function getSubscriptionForUser(userId) {
  const db = await getDb();
  const rows = await db.all(sql`
    SELECT * FROM subscriptions
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    plan: row.plan,
    status: row.status,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

async function markStripeEventProcessed(eventId, type) {
  const db = await getDb();
  try {
    await db.run(sql`
      INSERT INTO stripe_events (id, type, processed_at)
      VALUES (${eventId}, ${type}, ${now()})
    `);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  AUTH_COOKIE,
  AUTH_TTL_DAYS,
  publicUser,
  findUserByEmail,
  findUserById,
  createUser,
  verifyPassword,
  updatePassword,
  updateUserFields,
  createAuthSession,
  findAuthSessionByToken,
  revokeAuthSession,
  revokeAllUserSessions,
  createPasswordReset,
  consumePasswordReset,
  createApiKey,
  countActiveApiKeys,
  listApiKeys,
  revokeApiKey,
  findUserByApiKey,
  listUsers,
  countUsers,
  upsertSubscription,
  getSubscriptionForUser,
  markStripeEventProcessed,
  hashToken,
};
