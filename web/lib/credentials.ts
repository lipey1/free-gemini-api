/**
 * Shared credential limits and validation — keep in sync with
 * src/utils/credentials.js
 */

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const EMAIL_LOCAL_MAX = 64;
export const PASSWORD_MIN = 8;
/** bcrypt silently truncates past 72 bytes — reject longer instead. */
export const PASSWORD_MAX = 72;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmail(email: string) {
  return String(email ?? "").toLowerCase().trim();
}

export function normalizeName(name: string) {
  return String(name ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateName(
  name: string,
  { required = false }: { required?: boolean } = {},
): { ok: true; value: string } | { ok: false; error: string; value: string } {
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

export function validateEmail(
  email: string,
  { required = true }: { required?: boolean } = {},
): { ok: true; value: string } | { ok: false; error: string; value: string } {
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

export function validatePassword(
  password: string,
  {
    required = true,
    strength = false,
  }: { required?: boolean; strength?: boolean } = {},
): { ok: true; value: string } | { ok: false; error: string; value: string } {
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

export function validateCredentials(
  email: string,
  password: string,
  { passwordStrength = false }: { passwordStrength?: boolean } = {},
) {
  const errors: Record<string, string> = {};
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

export function validateRegistration(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const errors: Record<string, string> = {};
  const nameResult = validateName(input.name || "");
  const creds = validateCredentials(input.email, input.password, {
    passwordStrength: true,
  });
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

export function firstError(errors: Record<string, string>) {
  return Object.values(errors)[0] || "Invalid input.";
}
