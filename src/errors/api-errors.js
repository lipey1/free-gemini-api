const ApiErrorCode = {
  SESSION_COOLDOWN_ACTIVE: "SESSION_COOLDOWN_ACTIVE",
  CONFIG_NOT_READY: "CONFIG_NOT_READY",
  SESSION_CREATE_FAILED: "SESSION_CREATE_FAILED",
  PROMPT_REQUIRED: "PROMPT_REQUIRED",
  PROMPT_TOO_LONG: "PROMPT_TOO_LONG",
  SESSION_TOKEN_REQUIRED: "SESSION_TOKEN_REQUIRED",
  SESSION_TOKEN_INVALID: "SESSION_TOKEN_INVALID",
  INVALID_SESSION: "INVALID_SESSION",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  GEMINI_TIMEOUT: "GEMINI_TIMEOUT",
  GEMINI_UNAVAILABLE: "GEMINI_UNAVAILABLE",
  GEMINI_RESPONSE_INVALID: "GEMINI_RESPONSE_INVALID",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

const ApiErrorMessage = {
  [ApiErrorCode.SESSION_COOLDOWN_ACTIVE]:
    "Aguarde alguns segundos antes de criar outra sessão.",
  [ApiErrorCode.CONFIG_NOT_READY]:
    "Servidor não configurado corretamente. Contate o administrador.",
  [ApiErrorCode.SESSION_CREATE_FAILED]:
    "Não foi possível criar a sessão. Tente novamente.",
  [ApiErrorCode.PROMPT_REQUIRED]:
    "O campo prompt é obrigatório.",
  [ApiErrorCode.PROMPT_TOO_LONG]:
    "O campo prompt excede o limite de 20000 caracteres.",
  [ApiErrorCode.SESSION_TOKEN_REQUIRED]:
    "Token de sessão obrigatório. Envie sessionToken no body ou Authorization: Bearer.",
  [ApiErrorCode.SESSION_TOKEN_INVALID]:
    "Token de sessão inválido. Crie uma nova sessão em POST /create-session.",
  [ApiErrorCode.INVALID_SESSION]:
    "Sessão inválida ou expirada. Crie uma nova sessão em POST /create-session.",
  [ApiErrorCode.SESSION_EXPIRED]:
    "Sessão expirada. Crie uma nova sessão em POST /create-session.",
  [ApiErrorCode.SESSION_NOT_FOUND]:
    "Sessão não encontrada. Crie uma nova sessão em POST /create-session.",
  [ApiErrorCode.GEMINI_TIMEOUT]:
    "Tempo esgotado ao aguardar resposta do Gemini. Tente novamente.",
  [ApiErrorCode.GEMINI_UNAVAILABLE]:
    "Gemini indisponível no momento. Tente novamente em instantes.",
  [ApiErrorCode.GEMINI_RESPONSE_INVALID]:
    "Não foi possível interpretar a resposta do Gemini. Tente novamente.",
  [ApiErrorCode.RATE_LIMIT_EXCEEDED]:
    "Muitas requisições. Aguarde antes de tentar novamente.",
  [ApiErrorCode.INTERNAL_ERROR]:
    "Erro interno no servidor. Tente novamente.",
};

function apiError(set, status, code, extra = {}) {
  const message = ApiErrorMessage[code] || ApiErrorMessage[ApiErrorCode.INTERNAL_ERROR];
  set.status = status;
  return {
    ok: false,
    code,
    error: message,
    ...extra,
  };
}

function classifyChatFailure(message) {
  const msg = String(message || "");

  if (/Timeout ao chamar Gemini/i.test(msg)) {
    return { status: 504, code: ApiErrorCode.GEMINI_TIMEOUT };
  }
  if (/BardErrorInfo=1100/i.test(msg)) {
    return { status: 401, code: ApiErrorCode.INVALID_SESSION };
  }
  if (/BardErrorInfo=/i.test(msg)) {
    return { status: 502, code: ApiErrorCode.GEMINI_UNAVAILABLE };
  }
  if (/Gemini HTTP \d+/i.test(msg)) {
    return { status: 502, code: ApiErrorCode.GEMINI_UNAVAILABLE };
  }
  if (/Nao foi possivel extrair o texto/i.test(msg)) {
    return { status: 502, code: ApiErrorCode.GEMINI_RESPONSE_INVALID };
  }

  return { status: 500, code: ApiErrorCode.INTERNAL_ERROR };
}

module.exports = {
  ApiErrorCode,
  ApiErrorMessage,
  apiError,
  classifyChatFailure,
};
