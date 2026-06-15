# Códigos de erro da API

Referência dos erros e respostas dos endpoints `POST /create-session`, `POST /chat`, `GET /session/status` e `POST /session/status`.

---

## Formato padrão

```json
{
  "ok": false,
  "code": "SESSION_EXPIRED",
  "error": "Sessão expirada. Crie uma nova sessão em POST /create-session."
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ok` | `boolean` | Sempre `false` em erros |
| `code` | `string` | Identificador estável para lógica no cliente |
| `error` | `string` | Mensagem legível para exibir ao usuário |
| `*` | `any` | Campos extras dependendo do erro (ex.: `retryAfterSeconds`) |

O status HTTP real vem no header da resposta (ex.: `401`, `502`).

---

## Índice rápido

| code | HTTP | Endpoint |
|------|------|----------|
| `SESSION_COOLDOWN_ACTIVE` | 429 | `/create-session` |
| `CONFIG_NOT_READY` | 500 | `/create-session`, `/chat`, `/session/status` |
| `SESSION_CREATE_FAILED` | 500 | `/create-session` |
| `PROMPT_REQUIRED` | 400 | `/chat` |
| `PROMPT_TOO_LONG` | 400 | `/chat` |
| `SESSION_TOKEN_REQUIRED` | 401 | `/chat`, `/session/status` |
| `SESSION_TOKEN_INVALID` | 401 | `/chat` |
| `SESSION_EXPIRED` | 401 | `/chat` |
| `SESSION_NOT_FOUND` | 401 | `/chat` |
| `INVALID_SESSION` | 401 | `/chat` |
| `GEMINI_TIMEOUT` | 504 | `/chat` |
| `GEMINI_UNAVAILABLE` | 502 | `/chat` |
| `GEMINI_RESPONSE_INVALID` | 502 | `/chat` |
| `RATE_LIMIT_EXCEEDED` | 429 | `/chat`, `/session/status` |
| `INTERNAL_ERROR` | 500 | `/chat` |

> **`/session/status`** não usa os códigos `SESSION_*` como erro HTTP quando o token está expirado ou inválido — retorna HTTP 200 com `valid: false` e um campo `reason`. Veja a seção dedicada abaixo.

---

## `POST /create-session`

### `SESSION_COOLDOWN_ACTIVE` — HTTP 429

Muitas sessões criadas pelo mesmo IP em pouco tempo. Intervalo mínimo configurável via `RATE_LIMIT_CREATE_SESSION_INTERVAL_SEC` (padrão: **15 segundos**).

**Resposta:**

```json
{
  "ok": false,
  "code": "SESSION_COOLDOWN_ACTIVE",
  "error": "Aguarde alguns segundos antes de criar outra sessão.",
  "retryAfterSeconds": 12
}
```

**O que fazer:** aguardar `retryAfterSeconds` e tentar novamente. Defina `RATE_LIMIT_CREATE_SESSION_INTERVAL_SEC=0` para desativar.

---

### `CONFIG_NOT_READY` — HTTP 500

`SESSION_SECRET` não está definido no `.env`.

**Mensagem:** `Servidor não configurado corretamente. Contate o administrador.`

**O que fazer:** definir `SESSION_SECRET` no `.env` e reiniciar o servidor.

---

### `SESSION_CREATE_FAILED` — HTTP 500

Falha ao montar o snapshot da sessão (config Gemini inválida ou ausente).

**Mensagem:** `Não foi possível criar a sessão. Tente novamente.`

**O que fazer:** verificar `src/config/gemini.js` (URL e body template). Ver logs do servidor.

---

## `GET /session/status` · `POST /session/status`

Verifica se o `sessionToken` ainda é válido **sem chamar o Gemini**.

**Autenticação:** igual ao `/chat` — `Authorization: Bearer <sessionToken>` ou `sessionToken` no body (POST).

### Resposta de sucesso — sessão válida (HTTP 200)

```json
{
  "ok": true,
  "valid": true,
  "expiresAt": "2026-06-15T14:30:00.000Z",
  "expiresInSeconds": 1842
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `valid` | `boolean` | `true` se JWT e sessão no servidor estão ativos |
| `expiresAt` | `string` | ISO 8601 — expiração da sessão no servidor |
| `expiresInSeconds` | `number` | Segundos restantes até expirar |

### Resposta de sucesso — sessão inválida ou expirada (HTTP 200)

Não é erro HTTP — a requisição foi processada e o status da sessão foi retornado.

```json
{
  "ok": true,
  "valid": false,
  "reason": "token_expired",
  "expiredAt": "2026-06-15T13:00:00.000Z"
}
```

| `reason` | Significado | Equivalente em `/chat` |
|----------|-------------|------------------------|
| `token_expired` | JWT expirou | `SESSION_TOKEN_INVALID` ou `SESSION_EXPIRED` |
| `token_invalid` | JWT malformado ou assinatura inválida | `SESSION_TOKEN_INVALID` |
| `session_expired` | Sessão expirou no servidor (TTL) | `SESSION_EXPIRED` |
| `session_not_found` | SID não existe no banco | `SESSION_NOT_FOUND` |

`expiredAt` aparece quando `reason` é `token_expired` ou `session_expired`.

**O que fazer:** se `valid` for `false`, chamar `POST /create-session` e obter um novo token.

### Erros HTTP em `/session/status`

#### `CONFIG_NOT_READY` — HTTP 500

Mesmo caso de `/create-session`.

#### `SESSION_TOKEN_REQUIRED` — HTTP 401

Nenhum token enviado.

**Mensagem:** `Token de sessão obrigatório. Envie sessionToken no body ou Authorization: Bearer.`

**O que fazer:** enviar o token via header ou body (no `GET`, apenas header).

#### `RATE_LIMIT_EXCEEDED` — HTTP 429

Muitas requisições `/session/status` do mesmo IP na janela de 1 minuto (padrão: **60/min** — `RATE_LIMIT_STATUS_PER_MINUTE`). Mesmo formato de resposta do `/chat`, com `"endpoint": "/session/status"`.

---

## `POST /chat`

### `PROMPT_REQUIRED` — HTTP 400

Campo `prompt` ausente ou vazio.

**Mensagem:** `O campo prompt é obrigatório.`

**O que fazer:** enviar `{ "prompt": "sua mensagem" }`.

---

### `PROMPT_TOO_LONG` — HTTP 400

Campo `prompt` com mais de 20.000 caracteres (após `trim`).

**Resposta:**

```json
{
  "ok": false,
  "code": "PROMPT_TOO_LONG",
  "error": "O campo prompt excede o limite de 20000 caracteres.",
  "maxLength": 20000,
  "length": 20500
}
```

**O que fazer:** encurtar a mensagem para no máximo 20.000 caracteres.

---

### `RATE_LIMIT_EXCEEDED` — HTTP 429

Muitas requisições `/chat` do mesmo IP na janela de 1 minuto (padrão: **30/min** — `RATE_LIMIT_CHAT_PER_MINUTE`).

**Resposta:**

```json
{
  "ok": false,
  "code": "RATE_LIMIT_EXCEEDED",
  "error": "Muitas requisições. Aguarde antes de tentar novamente.",
  "endpoint": "/chat",
  "retryAfterSeconds": 42,
  "limit": 30,
  "windowSeconds": 60
}
```

**O que fazer:** aguardar `retryAfterSeconds`. Defina `RATE_LIMIT_CHAT_PER_MINUTE=0` para desativar.

---

### `CONFIG_NOT_READY` — HTTP 500

Mesmo caso de `/create-session`.

---

### `SESSION_TOKEN_REQUIRED` — HTTP 401

Nenhum token enviado.

**Mensagem:** `Token de sessão obrigatório. Envie sessionToken no body ou Authorization: Bearer.`

**O que fazer:** criar sessão e enviar o token via header ou body:

```
Authorization: Bearer <sessionToken>
```

ou

```json
{ "prompt": "...", "sessionToken": "..." }
```

---

### `SESSION_TOKEN_INVALID` — HTTP 401

JWT malformado, assinatura inválida ou `SESSION_SECRET` alterado após emissão.

**Mensagem:** `Token de sessão inválido. Crie uma nova sessão em POST /create-session.`

**O que fazer:** `POST /create-session` e usar o novo token.

---

### `SESSION_EXPIRED` — HTTP 401

Sessão passou do TTL (padrão: 45 minutos).

**Resposta:**

```json
{
  "ok": false,
  "code": "SESSION_EXPIRED",
  "error": "Sessão expirada. Crie uma nova sessão em POST /create-session.",
  "expiredAt": "2026-06-15T11:30:00.000Z"
}
```

**O que fazer:** criar nova sessão.

---

### `SESSION_NOT_FOUND` — HTTP 401

SID do JWT não existe no banco (servidor reiniciado com store em memória, ou sessão removida).

**Mensagem:** `Sessão não encontrada. Crie uma nova sessão em POST /create-session.`

**O que fazer:** criar nova sessão.

---

### `INVALID_SESSION` — HTTP 401

O Gemini rejeitou o contexto da sessão (`BardErrorInfo=1100`) — cookie ou body template expirados.

**Mensagem:** `Sessão inválida ou expirada. Crie uma nova sessão em POST /create-session.`

**O que fazer:**

1. Atualizar `src/config/gemini.js` com credenciais novas do DevTools.
2. Reiniciar o servidor.
3. Criar nova sessão.

---

## Erros do Gemini (`POST /chat`)

### `GEMINI_TIMEOUT` — HTTP 504

Sem resposta do Gemini em 120 segundos.

**Mensagem:** `Tempo esgotado ao aguardar resposta do Gemini. Tente novamente.`

**O que fazer:** retry com backoff.

---

### `GEMINI_UNAVAILABLE` — HTTP 502

Gemini retornou HTTP de erro ou `BardErrorInfo` diferente de 1100.

**Mensagem:** `Gemini indisponível no momento. Tente novamente em instantes.`

**O que fazer:** aguardar e tentar de novo. Se persistir, atualizar config ou criar nova sessão.

---

### `GEMINI_RESPONSE_INVALID` — HTTP 502

Resposta recebida, mas sem texto extraível do stream.

**Mensagem:** `Não foi possível interpretar a resposta do Gemini. Tente novamente.`

**O que fazer:** retry. Se recorrente, atualizar body template em `gemini.js`.

---

### `INTERNAL_ERROR` — HTTP 500

Erro não classificado durante a chamada ao Gemini.

**Mensagem:** `Erro interno no servidor. Tente novamente.`

**O que fazer:** verificar logs do servidor.

---

## Respostas de sucesso

### `POST /create-session`

```json
{
  "ok": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresInSeconds": 2700
}
```

### `POST /chat`

```json
{
  "ok": true,
  "reply": "Texto gerado pelo Gemini."
}
```

### `GET /session/status` · `POST /session/status`

Ver seção [acima](#get-sessionstatus--post-sessionstatus) para os formatos `valid: true` e `valid: false`.

---

## Fluxo de recuperação no cliente

```
POST /chat
    │
    ├─ ok: true ──────────────────────────► usar reply
    │
    └─ ok: false
           │
           ├─ SESSION_* / INVALID_SESSION ─► POST /create-session → repetir /chat
           ├─ SESSION_COOLDOWN_ACTIVE ─────► sleep(retryAfterSeconds) → repetir
           ├─ RATE_LIMIT_EXCEEDED ─────────► sleep(retryAfterSeconds) → repetir
           ├─ GEMINI_TIMEOUT / UNAVAILABLE ► retry com backoff
           └─ CONFIG_NOT_READY ────────────► alertar administrador

GET|POST /session/status
    │
    ├─ ok: true, valid: true ─────────────► token ainda válido; usar expiresInSeconds
    │
    ├─ ok: true, valid: false ─────────────► POST /create-session → novo token
    │
    └─ ok: false
           ├─ SESSION_TOKEN_REQUIRED ───────► enviar token
           ├─ RATE_LIMIT_EXCEEDED ──────────► sleep(retryAfterSeconds) → repetir
           └─ CONFIG_NOT_READY ────────────► alertar administrador
```

---

## Mapeamento interno

Os códigos são definidos em `src/errors/api-errors.js`. A classificação de falhas do Gemini ocorre em `classifyChatFailure()` com base na mensagem de erro interna:

| Padrão na mensagem interna | `code` resultante |
|----------------------------|-------------------|
| `Timeout ao chamar Gemini` | `GEMINI_TIMEOUT` |
| `BardErrorInfo=1100` | `INVALID_SESSION` |
| `BardErrorInfo=` (outros) | `GEMINI_UNAVAILABLE` |
| `Gemini HTTP \d+` | `GEMINI_UNAVAILABLE` |
| `Nao foi possivel extrair o texto` | `GEMINI_RESPONSE_INVALID` |
| Qualquer outro | `INTERNAL_ERROR` |
