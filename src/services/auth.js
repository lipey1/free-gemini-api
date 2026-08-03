const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const {
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
  findUserByApiKey,
} = require("./user-store");
const { parseCookieHeader, serializeCookie } = require("../utils/cookies");
const { sendMail, publicBaseUrl } = require("./mail");
const {
  validateCredentials,
  validateRegistration,
  validateEmail,
  validatePassword,
} = require("../utils/credentials");

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.SESSION_SECRET || "";
}

function cookieOptions(expiresAt) {
  const secure =
    String(process.env.COOKIE_SECURE || "").toLowerCase() === "true" ||
    String(process.env.PUBLIC_BASE_URL || "").startsWith("https");

  return {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    expires: new Date(expiresAt),
    maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  };
}

function setAuthCookie(set, token, expiresAt) {
  const value = serializeCookie(AUTH_COOKIE, token, cookieOptions(expiresAt));
  const existing = set.headers?.["set-cookie"];
  if (!set.headers) set.headers = {};
  if (Array.isArray(existing)) {
    set.headers["set-cookie"] = [...existing, value];
  } else if (existing) {
    set.headers["set-cookie"] = [existing, value];
  } else {
    set.headers["set-cookie"] = value;
  }
}

function clearAuthCookie(set) {
  const value = serializeCookie(AUTH_COOKIE, "", {
    httpOnly: true,
    secure:
      String(process.env.COOKIE_SECURE || "").toLowerCase() === "true" ||
      String(process.env.PUBLIC_BASE_URL || "").startsWith("https"),
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  if (!set.headers) set.headers = {};
  set.headers["set-cookie"] = value;
}

function extractBearer(request) {
  const auth = request.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  return "";
}

function extractApiKey(request, body) {
  const header =
    request.headers.get("x-api-key") ||
    request.headers.get("x-fga-key") ||
    "";
  if (header) return header.trim();
  if (typeof body?.apiKey === "string") return body.apiKey.trim();

  const bearer = extractBearer(request);
  if (bearer.startsWith("fga_")) return bearer;
  return "";
}

function extractSessionCookie(request) {
  const cookies = parseCookieHeader(request.headers.get("cookie") || "");
  return cookies[AUTH_COOKIE] || "";
}

async function resolveCaller(request, body = {}) {
  const apiKey = extractApiKey(request, body);
  if (apiKey) {
    const user = await findUserByApiKey(apiKey);
    if (user) {
      return {
        user: publicUser(user),
        raw: user,
        via: "api_key",
        authToken: null,
      };
    }
  }

  const token = extractSessionCookie(request);
  if (token) {
    const session = await findAuthSessionByToken(token);
    if (session && !session.disabled) {
      return {
        user: publicUser({
          id: session.user_id,
          email: session.email,
          name: session.name,
          role: session.role,
          plan: session.plan,
          totp_enabled: session.totp_enabled,
          disabled: session.disabled,
          stripe_customer_id: session.stripe_customer_id,
          created_at: session.user_created_at,
          updated_at: session.user_updated_at,
        }),
        raw: session,
        via: "cookie",
        authToken: token,
      };
    }
  }

  return { user: null, raw: null, via: null, authToken: null };
}

async function register({ email, password, name, request, set }) {
  if (!getAuthSecret()) {
    return { ok: false, status: 500, code: "CONFIG_NOT_READY" };
  }

  const check = validateRegistration({ email, password, name });
  if (!check.ok) {
    return { ok: false, status: 400, code: "VALIDATION_ERROR", errors: check.errors };
  }

  const existing = await findUserByEmail(check.email);
  if (existing) {
    return {
      ok: false,
      status: 409,
      code: "EMAIL_TAKEN",
      error: "Já existe uma conta com este e-mail.",
    };
  }

  const user = await createUser({
    email: check.email,
    password: check.password,
    name: check.name,
  });

  const session = await createAuthSession(user.id, {
    userAgent: request.headers.get("user-agent") || "",
    ip: "",
  });
  setAuthCookie(set, session.token, session.expiresAt);

  return { ok: true, user: publicUser(user) };
}

async function login({ email, password, totpCode, request, set }) {
  const check = validateCredentials(email, password);
  if (!check.ok) {
    return { ok: false, status: 400, code: "VALIDATION_ERROR", errors: check.errors };
  }

  const user = await findUserByEmail(check.email);
  if (!user || !(await verifyPassword(user, check.password))) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_CREDENTIALS",
      error: "E-mail ou senha incorretos.",
    };
  }

  if (user.disabled) {
    return {
      ok: false,
      status: 403,
      code: "ACCOUNT_DISABLED",
      error: "Esta conta foi desativada.",
    };
  }

  if (user.totp_enabled) {
    if (!totpCode) {
      return {
        ok: false,
        status: 401,
        code: "TOTP_REQUIRED",
        error: "Informe o código de autenticação de dois fatores.",
        totpRequired: true,
      };
    }
    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: "base32",
      token: String(totpCode).replace(/\s/g, ""),
      window: 1,
    });
    if (!valid) {
      return {
        ok: false,
        status: 401,
        code: "TOTP_INVALID",
        error: "Código 2FA inválido.",
        totpRequired: true,
      };
    }
  }

  const session = await createAuthSession(user.id, {
    userAgent: request.headers.get("user-agent") || "",
    ip: "",
  });
  setAuthCookie(set, session.token, session.expiresAt);

  return { ok: true, user: publicUser(user) };
}

async function logout({ request, set }) {
  const token = extractSessionCookie(request);
  await revokeAuthSession(token);
  clearAuthCookie(set);
  return { ok: true };
}

async function requestPasswordReset(email) {
  const emailResult = validateEmail(email);
  if (!emailResult.ok) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      errors: { email: emailResult.error },
    };
  }
  // Always succeed for valid-looking emails to avoid account enumeration.
  const user = await findUserByEmail(emailResult.value);
  if (user && !user.disabled) {
    const { token } = await createPasswordReset(user.id);
    const link = `${publicBaseUrl()}/reset-password/?token=${encodeURIComponent(token)}`;
    await sendMail({
      to: user.email,
      subject: "Free Gemini API — redefinição de senha",
      text:
        `Recebemos um pedido para redefinir a senha da sua conta.\n\n` +
        `Abra o link (válido por 1 hora):\n${link}\n\n` +
        `Se você não pediu isso, ignore este e-mail.`,
    });
  }
  return {
    ok: true,
    message: "Se o e-mail existir, enviaremos instruções de recuperação.",
  };
}

async function resetPassword({ token, password }) {
  const passwordResult = validatePassword(password, { strength: true });
  if (!passwordResult.ok) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      errors: { password: passwordResult.error },
    };
  }

  const reset = await consumePasswordReset(token);
  if (!reset) {
    return {
      ok: false,
      status: 400,
      code: "RESET_TOKEN_INVALID",
      error: "Link de recuperação inválido ou expirado.",
    };
  }

  await updatePassword(reset.user_id, passwordResult.value);
  await revokeAllUserSessions(reset.user_id);
  return { ok: true, message: "Senha atualizada. Faça login novamente." };
}

async function beginTotpSetup(userId) {
  const user = await findUserById(userId);
  if (!user) return { ok: false, status: 404, code: "NOT_FOUND" };

  const secret = speakeasy.generateSecret({
    length: 20,
    name: `Free Gemini API (${user.email})`,
  });

  await updateUserFields(userId, { totpTempSecret: secret.base32 });

  const otpauth = speakeasy.otpauthURL({
    secret: secret.base32,
    label: user.email,
    issuer: "Free Gemini API",
    encoding: "base32",
  });
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  return {
    ok: true,
    secret: secret.base32,
    otpauth,
    qrDataUrl,
  };
}

async function confirmTotpSetup(userId, code) {
  const user = await findUserById(userId);
  if (!user?.totp_temp_secret) {
    return {
      ok: false,
      status: 400,
      code: "TOTP_NOT_STARTED",
      error: "Inicie a configuração do 2FA primeiro.",
    };
  }

  const valid = speakeasy.totp.verify({
    secret: user.totp_temp_secret,
    encoding: "base32",
    token: String(code || "").replace(/\s/g, ""),
    window: 1,
  });

  if (!valid) {
    return {
      ok: false,
      status: 400,
      code: "TOTP_INVALID",
      error: "Código 2FA inválido.",
    };
  }

  await updateUserFields(userId, {
    totpSecret: user.totp_temp_secret,
    totpEnabled: true,
    totpTempSecret: null,
  });

  return { ok: true, totpEnabled: true };
}

async function disableTotp(userId, { password, totpCode }) {
  const user = await findUserById(userId);
  if (!user) return { ok: false, status: 404, code: "NOT_FOUND" };

  const passwordResult = validatePassword(password, { strength: false });
  if (!passwordResult.ok) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      errors: { password: passwordResult.error },
    };
  }

  if (!(await verifyPassword(user, passwordResult.value))) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_CREDENTIALS",
      error: "Senha incorreta.",
    };
  }

  if (user.totp_enabled) {
    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: "base32",
      token: String(totpCode || "").replace(/\s/g, ""),
      window: 1,
    });
    if (!valid) {
      return {
        ok: false,
        status: 401,
        code: "TOTP_INVALID",
        error: "Código 2FA inválido.",
      };
    }
  }

  await updateUserFields(userId, {
    totpEnabled: false,
    totpSecret: null,
    totpTempSecret: null,
  });

  return { ok: true, totpEnabled: false };
}

module.exports = {
  AUTH_COOKIE,
  AUTH_TTL_DAYS,
  getAuthSecret,
  setAuthCookie,
  clearAuthCookie,
  resolveCaller,
  register,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
  extractApiKey,
  publicUser,
};
