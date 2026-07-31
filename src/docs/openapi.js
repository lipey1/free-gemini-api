const PROMPT_MAX_LENGTH = 20_000;

const errorSchema = {
  type: "object",
  required: ["ok", "code", "error"],
  properties: {
    ok: { type: "boolean", example: false },
    code: { type: "string" },
    error: { type: "string" },
    retryAfterSeconds: { type: "integer" },
    expiredAt: { type: "string", format: "date-time" },
    maxLength: { type: "integer" },
    length: { type: "integer" },
    endpoint: { type: "string" },
    limit: { type: "integer" },
    windowSeconds: { type: "integer" },
  },
};

function buildOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Free Gemini API",
      version: "1.0.0",
      description:
        "Free Gemini API — proxy REST para o Gemini web (`StreamGenerate`). " +
        "Crie uma sessão, envie prompts em `/chat` e consulte erros em `doc/ERROR_CODES.md`.",
      contact: {
        name: "Felipe Estrela",
        url: "https://github.com/lipey1",
      },
    },
    tags: [
      { name: "health", description: "Status do servidor" },
      { name: "session", description: "Criação e validação de sessão" },
      { name: "chat", description: "Envio de prompts ao Gemini" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "sessionToken retornado por POST /create-session",
        },
      },
      schemas: {
        ApiError: errorSchema,
        CreateSessionResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            sessionToken: { type: "string" },
            expiresInSeconds: { type: "integer", example: 2700 },
          },
        },
        ChatRequest: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              maxLength: PROMPT_MAX_LENGTH,
              description: "Mensagem do usuário (máx. 20.000 caracteres após trim)",
            },
            sessionToken: {
              type: "string",
              description: "Alternativa ao header Authorization",
            },
          },
        },
        ChatResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            reply: { type: "string" },
          },
        },
        SessionStatusResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            valid: { type: "boolean" },
            reason: {
              type: "string",
              enum: [
                "token_expired",
                "token_invalid",
                "session_expired",
                "session_not_found",
              ],
            },
            expiredAt: { type: "string", format: "date-time" },
            expiresAt: { type: "string", format: "date-time" },
            expiresInSeconds: { type: "integer" },
          },
        },
        SessionStatusRequest: {
          type: "object",
          properties: {
            sessionToken: {
              type: "string",
              description: "Alternativa ao header Authorization (POST)",
            },
          },
        },
      },
    },
    paths: {
      "/health": {
        get: {
          tags: ["health"],
          summary: "Health check",
          description:
            "Antes da fusão do site com a API este payload ficava em GET /. A raiz agora serve a landing page.",
          responses: {
            200: {
              description: "API online",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      message: { type: "string" },
                      endpoints: { type: "array", items: { type: "string" } },
                      errorCodesDoc: { type: "string" },
                      docs: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/create-session": {
        post: {
          tags: ["session"],
          summary: "Criar sessão",
          description:
            "Executa um `StreamGenerate` seed, captura cookies e retorna um JWT de sessão. " +
            "Rate limit: 1 req a cada `RATE_LIMIT_CREATE_SESSION_INTERVAL_SEC` por IP (padrão 15s).",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          responses: {
            200: {
              description: "Sessão criada",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CreateSessionResponse" },
                },
              },
            },
            429: {
              description: "SESSION_COOLDOWN_ACTIVE",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
            500: {
              description: "CONFIG_NOT_READY ou SESSION_CREATE_FAILED",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
          },
        },
      },
      "/chat": {
        post: {
          tags: ["chat"],
          summary: "Enviar prompt",
          description:
            "Envia texto ao Gemini usando cookies da sessão. " +
            "Rate limit: `RATE_LIMIT_CHAT_PER_MINUTE` por IP (padrão 30/min).",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChatRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Resposta do Gemini",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ChatResponse" },
                },
              },
            },
            400: {
              description: "PROMPT_REQUIRED ou PROMPT_TOO_LONG",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
            401: {
              description: "Erros de sessão/token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
            429: {
              description: "RATE_LIMIT_EXCEEDED",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
            502: {
              description: "GEMINI_UNAVAILABLE ou GEMINI_RESPONSE_INVALID",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
            504: {
              description: "GEMINI_TIMEOUT",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
          },
        },
      },
      "/session/status": {
        get: {
          tags: ["session"],
          summary: "Verificar sessão (GET)",
          description:
            "Valida JWT e estado no servidor sem chamar o Gemini. " +
            "Token apenas via header `Authorization`. " +
            "Rate limit: `RATE_LIMIT_STATUS_PER_MINUTE` por IP (padrão 60/min).",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Status da sessão (`valid: true` ou `false`)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SessionStatusResponse" },
                },
              },
            },
            401: {
              description: "SESSION_TOKEN_REQUIRED",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
            429: {
              description: "RATE_LIMIT_EXCEEDED",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
          },
        },
        post: {
          tags: ["session"],
          summary: "Verificar sessão (POST)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionStatusRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Status da sessão",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SessionStatusResponse" },
                },
              },
            },
            401: {
              description: "SESSION_TOKEN_REQUIRED",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
            429: {
              description: "RATE_LIMIT_EXCEEDED",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiError" },
                },
              },
            },
          },
        },
      },
    },
  };
}

module.exports = {
  buildOpenApiSpec,
};
