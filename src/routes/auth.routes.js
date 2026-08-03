const {
  register,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
  resolveCaller,
  getAuthSecret,
} = require("../services/auth");
const {
  createApiKey,
  listApiKeys,
  countActiveApiKeys,
  revokeApiKey,
  getSubscriptionForUser,
  publicUser,
  findUserById,
} = require("../services/user-store");
const { peekChatRateLimit, checkApiKeyCreateRateLimit } = require("../services/rate-limit");
const { getUsageSeries } = require("../services/usage");
const { MAX_API_KEYS, validateApiKeyName } = require("../config/limits");
const { ApiErrorCode, apiError } = require("../errors/api-errors");

function jsonError(set, status, code, error, extra = {}) {
  set.status = status;
  return { ok: false, code, error, ...extra };
}

async function requireUser(request, set, body) {
  if (!getAuthSecret()) {
    return { error: apiError(set, 500, ApiErrorCode.CONFIG_NOT_READY) };
  }
  const caller = await resolveCaller(request, body);
  if (!caller.user) {
    return {
      error: jsonError(set, 401, "AUTH_REQUIRED", "Faça login para continuar."),
    };
  }
  if (caller.user.disabled) {
    return {
      error: jsonError(set, 403, "ACCOUNT_DISABLED", "Esta conta foi desativada."),
    };
  }
  return { caller };
}

function registerAuthRoutes(app) {
  return app.group("/auth", (auth) =>
    auth
      .post("/register", async ({ request, body, set }) => {
        const result = await register({
          email: body?.email,
          password: body?.password,
          name: body?.name,
          request,
          set,
        });
        if (!result.ok) {
          set.status = result.status || 400;
          return result;
        }
        return result;
      })
      .post("/login", async ({ request, body, set }) => {
        const result = await login({
          email: body?.email,
          password: body?.password,
          totpCode: body?.totpCode,
          request,
          set,
        });
        if (!result.ok) {
          set.status = result.status || 400;
          return result;
        }
        return result;
      })
      .post("/logout", async ({ request, set }) => logout({ request, set }))
      .get("/me", async ({ request, set }) => {
        const gate = await requireUser(request, set, {});
        if (gate.error) return gate.error;
        const sub = await getSubscriptionForUser(gate.caller.user.id);
        return { ok: true, user: gate.caller.user, subscription: sub };
      })
      .post("/forgot-password", async ({ body }) =>
        requestPasswordReset(body?.email),
      )
      .post("/reset-password", async ({ body, set }) => {
        const result = await resetPassword({
          token: body?.token,
          password: body?.password,
        });
        if (!result.ok) {
          set.status = result.status || 400;
          return result;
        }
        return result;
      })
      .post("/2fa/setup", async ({ request, set }) => {
        const gate = await requireUser(request, set, {});
        if (gate.error) return gate.error;
        return beginTotpSetup(gate.caller.user.id);
      })
      .post("/2fa/confirm", async ({ request, body, set }) => {
        const gate = await requireUser(request, set, {});
        if (gate.error) return gate.error;
        const result = await confirmTotpSetup(gate.caller.user.id, body?.code);
        if (!result.ok) {
          set.status = result.status || 400;
          return result;
        }
        const user = publicUser(await findUserById(gate.caller.user.id));
        return { ...result, user };
      })
      .post("/2fa/disable", async ({ request, body, set }) => {
        const gate = await requireUser(request, set, {});
        if (gate.error) return gate.error;
        const result = await disableTotp(gate.caller.user.id, {
          password: body?.password,
          totpCode: body?.totpCode,
        });
        if (!result.ok) {
          set.status = result.status || 400;
          return result;
        }
        const user = publicUser(await findUserById(gate.caller.user.id));
        return { ...result, user };
      }),
  )
    .group("/account", (account) =>
      account
        .get("/usage", async ({ request, set }) => {
          const gate = await requireUser(request, set, {});
          if (gate.error) return gate.error;
          const user = gate.caller.user;
          const series = await getUsageSeries(user.id, { hours: 24, kind: "chat" });
          const rate = peekChatRateLimit(user);
          const activeKeys = await countActiveApiKeys(user.id);
          return {
            ok: true,
            rate: {
              used: rate.used ?? 0,
              remaining: rate.remaining ?? rate.limit,
              limit: rate.limit,
              windowSeconds: rate.windowSeconds,
              resetAt: rate.resetAt,
              planId: rate.planId || user.plan,
            },
            keys: {
              active: activeKeys,
              max: MAX_API_KEYS,
            },
            usage: series,
          };
        })
        .get("/api-keys", async ({ request, set }) => {
          const gate = await requireUser(request, set, {});
          if (gate.error) return gate.error;
          const keys = await listApiKeys(gate.caller.user.id);
          const active = keys.filter((k) => k.active).length;
          return { ok: true, keys, active, max: MAX_API_KEYS };
        })
        .post("/api-keys", async ({ request, body, set }) => {
          const gate = await requireUser(request, set, {});
          if (gate.error) return gate.error;

          const rl = checkApiKeyCreateRateLimit(gate.caller.user.id);
          if (!rl.allowed) {
            return apiError(set, 429, ApiErrorCode.RATE_LIMIT_EXCEEDED, {
              endpoint: "/account/api-keys",
              retryAfterSeconds: rl.retryAfterSeconds,
              limit: rl.limit,
              windowSeconds: rl.windowSeconds,
            });
          }

          const nameCheck = validateApiKeyName(body?.name);
          if (!nameCheck.ok) {
            set.status = 400;
            return {
              ok: false,
              code: "VALIDATION_ERROR",
              errors: { name: nameCheck.error },
              error: nameCheck.error,
            };
          }
          try {
            const key = await createApiKey(gate.caller.user.id, nameCheck.value);
            return {
              ok: true,
              key,
              max: MAX_API_KEYS,
              warning: "Copie a chave agora. Ela não será exibida novamente.",
            };
          } catch (err) {
            if (err?.code === "API_KEY_LIMIT") {
              set.status = 400;
              return {
                ok: false,
                code: "API_KEY_LIMIT",
                error: err.message,
                limit: err.limit,
                active: err.active,
              };
            }
            throw err;
          }
        })
        .post("/api-keys/:id/revoke", async ({ request, params, set }) => {
          const gate = await requireUser(request, set, {});
          if (gate.error) return gate.error;
          await revokeApiKey(gate.caller.user.id, params.id);
          return { ok: true };
        }),
    );
}

module.exports = {
  registerAuthRoutes,
  requireUser,
};
