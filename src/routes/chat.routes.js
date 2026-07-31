const fs = require("node:fs/promises");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const { askGemini, lastTimings } = require("../services/gemini-client");
const { captureGeminiSession } = require("../services/session-capture");
const {
  ApiErrorCode,
  apiError,
  classifyChatFailure,
} = require("../errors/api-errors");
const {
  SESSION_TTL_MS,
  clearExpiredSessions,
  createSession,
  getSessionState,
  updateSessionSnapshot,
} = require("../services/session-store");
const {
  checkCreateSessionRateLimit,
  checkChatRateLimit,
  checkStatusRateLimit,
} = require("../services/rate-limit");
const logger = require("../utils/logger");
const { getClientIp } = require("../utils/client-ip");
const defaultPromptPath = path.resolve(__dirname, "../config/default_prompt.txt");
const PROMPT_MAX_LENGTH = 20_000;

function extractToken(request, body) {
  const auth = request.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  if (typeof body?.sessionToken === "string") {
    return body.sessionToken.trim();
  }
  return "";
}

function isInsertPromptEnabled() {
  return String(process.env.INSERT_PROMPT || "false").toLowerCase() === "true";
}

async function buildOutgoingPrompt(userPrompt) {
  if (!isInsertPromptEnabled()) return userPrompt;

  let promptTemplate = "";
  try {
    promptTemplate = await fs.readFile(defaultPromptPath, "utf8");
  } catch {
    promptTemplate = "";
  }

  if (!promptTemplate.trim()) return userPrompt;
  return promptTemplate.split("${message}").join(userPrompt);
}

async function inspectSessionToken(token) {
  if (!process.env.SESSION_SECRET) {
    return { error: { status: 500, code: ApiErrorCode.CONFIG_NOT_READY } };
  }

  if (!token) {
    return { error: { status: 401, code: ApiErrorCode.SESSION_TOKEN_REQUIRED } };
  }

  let sid;
  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);
    sid = decoded?.sid;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      const decoded = jwt.decode(token);
      const expiredAtMs =
        error.expiredAt?.getTime?.() ??
        (typeof decoded?.exp === "number" ? decoded.exp * 1000 : null);

      return {
        valid: false,
        reason: "token_expired",
        ...(expiredAtMs && {
          expiredAt: new Date(expiredAtMs).toISOString(),
        }),
      };
    }

    return { valid: false, reason: "token_invalid" };
  }

  if (!sid) {
    return { valid: false, reason: "token_invalid" };
  }

  const state = await getSessionState(sid);
  if (state.status === "expired") {
    return {
      valid: false,
      reason: "session_expired",
      expiredAt: new Date(state.expiredAt).toISOString(),
    };
  }

  if (state.status !== "active") {
    return { valid: false, reason: "session_not_found" };
  }

  const expiresAtMs = state.session.expiresAt;
  return {
    valid: true,
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresInSeconds: Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)),
  };
}

async function handleSessionStatus({ request, body, set }) {
  const ip = getClientIp(request);
  const rateLimit = checkStatusRateLimit(ip);
  if (!rateLimit.allowed) {
    return apiError(set, 429, ApiErrorCode.RATE_LIMIT_EXCEEDED, {
      endpoint: "/session/status",
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      limit: rateLimit.limit,
      windowSeconds: rateLimit.windowSeconds,
    });
  }

  const result = await inspectSessionToken(extractToken(request, body));

  if (result.error) {
    return apiError(set, result.error.status, result.error.code);
  }

  return {
    ok: true,
    valid: result.valid,
    ...(result.reason && { reason: result.reason }),
    ...(result.expiredAt && { expiredAt: result.expiredAt }),
    ...(result.valid && {
      expiresAt: result.expiresAt,
      expiresInSeconds: result.expiresInSeconds,
    }),
  };
}

function registerChatRoutes(app) {
  return app
    // "/" now serves the landing page (see src/static.js). The health payload
    // that used to live there moved here when the site and the API were merged
    // into one process.
    .get("/health", () => ({
      ok: true,
      message: "Free Gemini API online",
      endpoints: ["POST /create-session", "POST /chat", "GET /session/status", "POST /session/status"],
      docs: "/docs",
      openapi: "/openapi.json",
      errorCodesDoc: "doc/ERROR_CODES.md",
    }))
    .post("/create-session", async ({ request, set }) => {
      const ip = getClientIp(request);
      const rateLimit = checkCreateSessionRateLimit(ip);

      if (!rateLimit.allowed) {
        return apiError(
          set,
          429,
          ApiErrorCode.SESSION_COOLDOWN_ACTIVE,
          { retryAfterSeconds: rateLimit.retryAfterSeconds },
        );
      }

      if (!process.env.SESSION_SECRET) {
        return apiError(set, 500, ApiErrorCode.CONFIG_NOT_READY);
      }

      try {
        await clearExpiredSessions();
        const snapshot = await captureGeminiSession();
        const sid = await createSession(snapshot);
        const token = jwt.sign({ sid }, process.env.SESSION_SECRET, {
          expiresIn: Math.floor(SESSION_TTL_MS / 1000),
        });

        logger.success(`Sessão criada para IP ${ip}`);
        return {
          ok: true,
          sessionToken: token,
          expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000),
        };
      } catch (error) {
        logger.error(`Falha ao criar sessão: ${error.message}`);
        return apiError(set, 500, ApiErrorCode.SESSION_CREATE_FAILED);
      }
    })
    .get("/session/status", handleSessionStatus)
    .post("/session/status", handleSessionStatus)
    .post("/chat", async ({ request, body, set }) => {
      const ip = getClientIp(request);
      const rateLimit = checkChatRateLimit(ip);
      if (!rateLimit.allowed) {
        return apiError(set, 429, ApiErrorCode.RATE_LIMIT_EXCEEDED, {
          endpoint: "/chat",
          retryAfterSeconds: rateLimit.retryAfterSeconds,
          limit: rateLimit.limit,
          windowSeconds: rateLimit.windowSeconds,
        });
      }

      const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) {
        return apiError(set, 400, ApiErrorCode.PROMPT_REQUIRED);
      }
      if (prompt.length > PROMPT_MAX_LENGTH) {
        return apiError(set, 400, ApiErrorCode.PROMPT_TOO_LONG, {
          maxLength: PROMPT_MAX_LENGTH,
          length: prompt.length,
        });
      }

      if (!process.env.SESSION_SECRET) {
        return apiError(set, 500, ApiErrorCode.CONFIG_NOT_READY);
      }

      const token = extractToken(request, body);
      if (!token) {
        return apiError(set, 401, ApiErrorCode.SESSION_TOKEN_REQUIRED);
      }

      // Wall-clock per step. Only returned when TIMINGS=true, so the default
      // response shape never changes. The landing page quotes these numbers,
      // so they have to come from a real run rather than an estimate.
      const marks = [];
      const clock = () => Number(process.hrtime.bigint() / 1000n) / 1000;
      let last = clock();
      const mark = (name) => {
        const now = clock();
        marks.push({ name, ms: Number((now - last).toFixed(3)) });
        last = now;
      };

      let sid;
      try {
        const decoded = jwt.verify(token, process.env.SESSION_SECRET);
        sid = decoded?.sid;
      } catch {
        return apiError(set, 401, ApiErrorCode.SESSION_TOKEN_INVALID);
      }
      mark("auth.verify_jwt");

      const state = sid ? await getSessionState(sid) : { status: "missing" };
      if (state.status === "expired") {
        return apiError(set, 401, ApiErrorCode.SESSION_EXPIRED, {
          expiredAt: new Date(state.expiredAt).toISOString(),
        });
      }

      const session = state.status === "active" ? state.session : null;
      if (!session) {
        return apiError(set, 401, ApiErrorCode.SESSION_NOT_FOUND);
      }

      const previewLen = 30;
      logger.info(`Nova request /chat (${prompt.length} chars)`);
      logger.info(
        `Prompt do usuário (primeiros ${previewLen} chars): ` +
          `${prompt.slice(0, previewLen)}`,
      );

      mark("session.load");

      try {
        const outgoingPrompt = await buildOutgoingPrompt(prompt);
        mark("payload.inject_prompt");

        const reply = await askGemini(outgoingPrompt, session.snapshot);
        // askGemini bundles the round trip and the parse; split them apart.
        marks.push({ name: "gemini.StreamGenerate", ms: lastTimings.networkMs });
        marks.push({ name: "stream.parse", ms: lastTimings.parseMs });
        last = clock();

        if (sid) {
          await updateSessionSnapshot(sid, session.snapshot);
        }
        mark("session.save_cookies");

        logger.success("Resposta recebida do Gemini");

        if (process.env.TIMINGS === "true") {
          const totalMs = Number(marks.reduce((a, m) => a + m.ms, 0).toFixed(3));
          return { ok: true, reply, timings: { totalMs, spans: marks } };
        }
        return { ok: true, reply };
      } catch (error) {
        const msg = String(error?.message || "");
        logger.error(`Falha no Gemini: ${msg}`);
        const classified = classifyChatFailure(msg);
        return apiError(set, classified.status, classified.code);
      }
    });
}

module.exports = {
  registerChatRoutes,
};
