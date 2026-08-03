/**
 * Shared credential limits and validation for auth endpoints.
 * Keep in sync with web/lib/credentials.ts
 */

const NAME_MAX = 80;
const EMAIL_MAX = 254;
const EMAIL_LOCAL_MAX = 64;
const PASSWORD_MIN = 8;
/** bcrypt silently truncates past 72 bytes — reject longer instead. */
const PASSWORD_MAX = 72;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
// Practical RFC-ish email: no spaces, one @, dot in domain, reasonable charset.
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function normalizeEmail(email) {
  return String(email ?? "").toLowerCase().trim();
}

function normalizeName(name) {
  return String(name ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function validateName(name, { required = false } = {}) {
  const normalized = normalizeName(name);
  if (!normalized) {
    if (required) return { ok: false, error: "Informe um nome.", value: "" };
    return { ok: true, value: "" };
  }
  if (normalized.length > NAME_MAX) {
    return {
      ok: false,
      error: `Nome pode ter no máximo ${NAME_MAX} caracteres.`,
      value: normalized,
    };
  }
  if (CONTROL_CHARS.test(normalized)) {
    return {
      ok: false,
      error: "Nome contém caracteres inválidos.",
      value: normalized,
    };
  }
  return { ok: true, value: normalized };
}

function validateEmail(email, { required = true } = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    if (!required) return { ok: true, value: "" };
    return { ok: false, error: "Informe um e-mail válido.", value: "" };
  }
  if (normalized.length > EMAIL_MAX) {
    return {
      ok: false,
      error: `E-mail pode ter no máximo ${EMAIL_MAX} caracteres.`,
      value: normalized,
    };
  }
  const at = normalized.indexOf("@");
  if (at < 1 || at > EMAIL_LOCAL_MAX) {
    return { ok: false, error: "Informe um e-mail válido.", value: normalized };
  }
  if (normalized.includes("..") || CONTROL_CHARS.test(normalized)) {
    return { ok: false, error: "Informe um e-mail válido.", value: normalized };
  }
  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, error: "Informe um e-mail válido.", value: normalized };
  }
  return { ok: true, value: normalized };
}

/**
 * @param {string} password
 * @param {{ required?: boolean, strength?: boolean }} [opts]
 * strength=true (register/reset): requires a letter and a digit.
 */
function validatePassword(password, { required = true, strength = false } = {}) {
  const value = String(password ?? "");
  if (!value) {
    if (!required) return { ok: true, value: "" };
    return {
      ok: false,
      error: `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`,
      value: "",
    };
  }
  if (value.length < PASSWORD_MIN) {
    return {
      ok: false,
      error: `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`,
      value,
    };
  }
  if (value.length > PASSWORD_MAX) {
    return {
      ok: false,
      error: `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`,
      value,
    };
  }
  if (CONTROL_CHARS.test(value)) {
    return {
      ok: false,
      error: "Senha contém caracteres inválidos.",
      value,
    };
  }
  if (strength) {
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
      return {
        ok: false,
        error: "A senha precisa ter pelo menos uma letra e um número.",
        value,
      };
    }
  }
  return { ok: true, value };
}

function validateCredentials(email, password, { passwordStrength = false } = {}) {
  const errors = {};
  const emailResult = validateEmail(email);
  const passwordResult = validatePassword(password, {
    strength: passwordStrength,
  });
  if (!emailResult.ok) errors.email = emailResult.error;
  if (!passwordResult.ok) errors.password = passwordResult.error;
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    email: emailResult.value,
    password: passwordResult.value,
  };
}

function validateRegistration({ email, password, name }) {
  const errors = {};
  const nameResult = validateName(name);
  const creds = validateCredentials(email, password, { passwordStrength: true });
  if (!nameResult.ok) errors.name = nameResult.error;
  Object.assign(errors, creds.errors);
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    email: creds.email,
    password: creds.password,
    name: nameResult.value,
  };
}

module.exports = {
  NAME_MAX,
  EMAIL_MAX,
  EMAIL_LOCAL_MAX,
  PASSWORD_MIN,
  PASSWORD_MAX,
  normalizeEmail,
  normalizeName,
  validateName,
  validateEmail,
  validatePassword,
  validateCredentials,
  validateRegistration,
};
