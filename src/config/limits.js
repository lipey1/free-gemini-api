/** Account / API hard limits (keep in sync with web/lib/limits.ts). */

const MAX_API_KEYS = 250;
const API_KEY_NAME_MAX = 60;
const API_KEY_NAME_MIN = 1;
const API_KEY_CREATE_PER_MINUTE = 20;

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function validateApiKeyName(name) {
  const value = String(name ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) {
    return { ok: true, value: "Default" };
  }
  if (value.length < API_KEY_NAME_MIN) {
    return { ok: false, error: "Informe um nome para a API key." };
  }
  if (value.length > API_KEY_NAME_MAX) {
    return {
      ok: false,
      error: `Nome da API key pode ter no máximo ${API_KEY_NAME_MAX} caracteres.`,
    };
  }
  if (CONTROL_CHARS.test(value)) {
    return { ok: false, error: "Nome da API key contém caracteres inválidos." };
  }
  return { ok: true, value };
}

module.exports = {
  MAX_API_KEYS,
  API_KEY_NAME_MAX,
  API_KEY_NAME_MIN,
  API_KEY_CREATE_PER_MINUTE,
  validateApiKeyName,
};
