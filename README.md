# Free Gemini API

API REST em Node.js (**Free Gemini API**) que encaminha prompts de texto para o **Gemini web** (`StreamGenerate`) via `fetch` — sem Puppeteer, sem upload de arquivos e sem SDK oficial do Google.

Cada cliente cria uma **sessão** (JWT + snapshot da config Gemini) e envia mensagens pelo endpoint `/chat`.

---

## Como funciona

```
Cliente                    API (Elysia)                 Gemini (web)
  |                              |                            |
  |-- POST /create-session ----->| monta snapshot estático    |
  |<-- sessionToken (JWT) -------| salva em SQLite/memória    |
  |                              |                            |
  |-- POST /chat + prompt ------>| substitui prompt no body   |
  |                              |-- POST StreamGenerate ---->|
  |<-- { ok, reply } ------------|<-- stream de resposta -----|
```

1. **`POST /create-session`** — um único `POST StreamGenerate` com prompt seed; cookies vêm do `Set-Cookie` dessa resposta e ficam na sessão.
2. **`POST /chat`** — usa os cookies **da sessão** (não relê `gemini.js`), injeta o prompt e chama o Gemini. Cookies novos da resposta são gravados de volta na sessão.
3. A resposta em stream é parseada e o texto final é retornado em `{ ok: true, reply: "..." }`.

Sessões expiram após **45 minutos** (TTL — ver abaixo). Rate limits por IP (configuráveis via `.env`):

| Endpoint | Limite padrão | Variável |
|----------|---------------|----------|
| `POST /create-session` | 1 a cada **15 s** | `RATE_LIMIT_CREATE_SESSION_INTERVAL_SEC` |
| `POST /chat` | **30**/min | `RATE_LIMIT_CHAT_PER_MINUTE` |
| `GET/POST /session/status` | **60**/min | `RATE_LIMIT_STATUS_PER_MINUTE` |

Use `0` na variável para desativar o limite daquele endpoint.

---

## Arquitetura e implementação

Este projeto é um **proxy HTTP fino**: recebe JSON, monta a requisição que o site do Gemini faria no navegador, chama `StreamGenerate` com `fetch` nativo e devolve o texto parseado. Não há frontend, fila, nem SDK oficial do Google no fluxo principal.

### Camadas

```
HTTP (Elysia)          Negócio                    Integração Gemini
─────────────          ───────                    ───────────────────
chat.routes.js    →    session-store.js      →    gemini-client.js
                       session-capture.js         (fetch + parse stream)
                       rate-limit.js
                       api-errors.js
```

| Arquivo | Responsabilidade |
|---------|------------------|
| `app.js` | Sobe o servidor, trata porta em uso e sinais de encerramento |
| `src/server.js` | Instancia o Elysia com adapter Node e registra as rotas |
| `src/routes/chat.routes.js` | Endpoints, validação de input, JWT, rate limit, orquestração |
| `src/services/session-capture.js` | Monta o *snapshot* estático (URL, headers, body template) a partir de `gemini.js` |
| `src/services/gemini-client.js` | `fetch` ao Gemini, merge de cookies, substituição do prompt no `f.req`, parse do stream |
| `src/services/session-store.js` | Persiste sessões em SQLite (Drizzle + libSQL) ou memória |
| `src/services/rate-limit.js` | Contadores por IP em memória (janela fixa) |
| `src/config/gemini.js` | Template da requisição web capturado do DevTools (sem cookie fixo) |

### Fluxo interno detalhado

**`POST /create-session`**

1. Rate limit por IP (`RATE_LIMIT_CREATE_SESSION_INTERVAL_SEC`).
2. `session-capture.js` lê o prompt seed de `default_prompt.txt` e monta um snapshot com URL, headers e body template de `gemini.js`.
3. `gemini-client.warmupSession()` faz um `POST StreamGenerate` **sem cookie** (`allowEmptyCookie: true`).
4. Os cookies retornados em `Set-Cookie` são extraídos e gravados no snapshot.
5. O snapshot é salvo no SQLite com um `sid` (UUID) e TTL.
6. Um JWT (`{ sid }`) é assinado com `SESSION_SECRET` e devolvido ao cliente.

**`POST /chat`**

1. Rate limit por IP (`RATE_LIMIT_CHAT_PER_MINUTE`).
2. Valida `prompt` (obrigatório, máx. 20.000 chars).
3. Verifica o JWT e carrega a sessão do banco.
4. Se `INSERT_PROMPT=true`, envolve o texto com `default_prompt.txt` (`${message}`).
5. Substitui o prompt no body `f.req` (parse JSON aninhado ou fallback por marcador codificado).
6. Chama o Gemini com os cookies **da sessão** (não relê `gemini.js` a cada request).
7. Parseia o stream no formato Google (`)]}'` + chunks `wrb.fr`), extrai o texto e normaliza `\n` literais.
8. Atualiza cookies da sessão se o Gemini devolver novos `Set-Cookie`.

**`GET/POST /session/status`**

1. Rate limit por IP.
2. Valida JWT + estado no banco **sem** chamar o Gemini.
3. Retorna `valid: true/false` com `reason` quando inválido (HTTP 200 — não é erro de protocolo).

### Protocolo Gemini (web)

O site `gemini.google.com` não expõe uma API REST pública simples. Este proxy replica o que o navegador envia:

- **URL:** `.../StreamGenerate?...&_reqid={REQID}&rt=c` — `REQID` é gerado por timestamp.
- **Body:** `application/x-www-form-urlencoded` com `f.req` (JSON duplamente encodado).
- **Headers:** `x-goog-ext-*`, `referer`, etc. — contexto da sessão web.
- **Resposta:** stream chunked; cada evento `wrb.fr` carrega o texto parcial; erros vêm como `BardErrorInfo`.

Cookies são obtidos dinamicamente no `create-session` e renovados a cada `/chat` — não ficam hardcoded no repositório.

### Evolução do projeto

O código passou por simplificações deliberadas:

| Removido | Motivo |
|----------|--------|
| Puppeteer / browser headless | Lento, pesado, difícil de manter em produção |
| Upload de arquivos | Escopo reduzido; só texto |
| Cookie fixo em `gemini.js` | Cookies agora vêm do `Set-Cookie` do primeiro `StreamGenerate` |
| Refresh automático de cookie | Substituído por atualização manual do template quando o Google muda o protocolo |

---

## Stack e por que Elysia

### Stack

| Tecnologia | Uso |
|------------|-----|
| **[Elysia](https://elysiajs.com)** + `@elysiajs/node` | Framework HTTP (rotas, request/response) |
| **Node.js 18+** | Runtime (`fetch` nativo, sem polyfill) |
| **jsonwebtoken** | JWT de sessão |
| **Drizzle ORM** + **libSQL** | SQLite para persistir snapshots |
| **dotenv** | Variáveis de ambiente |

`express` e `cors` já apareceram no `package.json` sem serem usados; foram removidos. O servidor roda 100% em Elysia, com CORS via `@elysiajs/cors`.

### Por que Elysia em vez de Express, Fastify, etc.?

**Motivos da escolha neste projeto:**

1. **Overhead mínimo** — Elysia foi desenhado para ser um dos frameworks HTTP mais leves do ecossistema JS. O roteamento é direto, sem cadeia longa de middlewares como no Express clássico.
2. **API moderna e enxuta** — Para uma API com 4 rotas, Elysia exige pouco boilerplate (`new Elysia().get(...).post(...)`).
3. **Adapter Node** — Com `@elysiajs/node`, roda em Node.js puro sem migrar para Bun, mantendo compatibilidade com o ecossistema npm.
4. **Mesma filosofia do proxy** — O projeto inteiro é minimalista (sem ORM pesado, sem browser, sem filas). Elysia alinha com isso.

**Comparação honesta com alternativas:**

| Framework | Perfil | Neste projeto |
|-----------|--------|---------------|
| **Express** | Padrão de mercado, ecossistema enorme, middlewares em cadeia | Funcionaria, mas é mais verboso e tende a ser mais lento em benchmarks de throughput puro |
| **Fastify** | Rápido, schema validation, plugin system | Boa alternativa; escolha equivalente em performance para este caso |
| **Elysia** | Focado em performance e DX; otimizado para rotas simples | Escolhido pela combinação de leveza + sintaxe direta |

**Benchmarks (contexto):** em testes de *hello world* (milhares de req/s em rota vazia), Elysia e Fastify costumam ficar **várias vezes acima** do Express em throughput e latência p99. O Express prioriza compatibilidade e ecossistema há 15+ anos, não velocidade bruta de roteamento.

### O que isso muda na prática aqui?

**Quase nada no tempo de resposta do `/chat`.**

O gargalo desta API é o **Gemini** (chamada HTTP externa + parse de stream, até 120 s de timeout) — não o framework. A diferença Elysia vs Express em uma rota `/chat` seria da ordem de **milissegundos**; a resposta do Gemini leva **segundos**.

O ganho real do Elysia neste projeto:

- Menos código e menos camadas entre o request e o handler
- Servidor leve para deploy (menos memória em idle)
- Base sólida se no futuro surgirem muitas rotas de health check, webhooks ou status polling (`/session/status`)

Para um proxy I/O-bound como este, **qualquer framework Node moderno (Fastify, Elysia, Hono) seria adequado**. Elysia foi escolhido por ser o mais enxuto entre as opções avaliadas, não porque o Express impediria o projeto de funcionar.

---

## Início rápido

### Requisitos

- Node.js 18+
- Credenciais de template em `src/config/gemini.js` (URL, body, headers `x-goog-ext-*` — sem cookie)

### Instalação

```bash
npm install
```

### Variáveis de ambiente (`.env`)

```env
SESSION_SECRET=uma-chave-secreta-longa-e-aleatoria
PORT=3333

# Opcional
INSERT_PROMPT=true
SESSION_TTL_MINUTES=45
SESSION_DB_PATH=

# Rate limits (0 = desativado)
RATE_LIMIT_CREATE_SESSION_INTERVAL_SEC=15
RATE_LIMIT_CHAT_PER_MINUTE=30
RATE_LIMIT_STATUS_PER_MINUTE=60
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SESSION_SECRET` | Sim | Chave para assinar JWTs de sessão |
| `PORT` | Não | Porta do servidor (padrão: `3333`) |
| `INSERT_PROMPT` | Não | Se `true`, envolve o prompt do usuário com o template em `src/config/default_prompt.txt` |
| `SESSION_TTL_MINUTES` | Não | Tempo de vida do `sessionToken` em minutos (padrão: `45`) |
| `SESSION_DB_PATH` | Não | Caminho do SQLite; vazio usa `data/sessions.sqlite` |
| `RATE_LIMIT_CREATE_SESSION_INTERVAL_SEC` | Não | Intervalo mínimo entre `create-session` por IP (padrão: `15`; `0` = off) |
| `RATE_LIMIT_CHAT_PER_MINUTE` | Não | Máx. de `/chat` por IP por minuto (padrão: `30`; `0` = off) |
| `RATE_LIMIT_STATUS_PER_MINUTE` | Não | Máx. de `/session/status` por IP por minuto (padrão: `60`; `0` = off) |

### O que é o TTL (`SESSION_TTL_MINUTES`)?

É quanto tempo o `sessionToken` continua válido depois de criado. Passado esse prazo:

- o JWT expira
- a sessão é removida do banco
- `/chat` retorna `SESSION_EXPIRED`

O cliente precisa chamar `POST /create-session` de novo. Não tem relação com o cookie do Gemini — só controla por quanto tempo a API aceita aquele token antes de pedir uma sessão nova.

### Executar

```bash
npm run dev    # API com --watch, sem o site
npm start      # produção (serve o site se web/out existir)
```

A API sobe em `http://localhost:3333`.

### Rodar site e API no mesmo processo

O site (`web/`) é um Next.js com `output: "export"`, ou seja, vira HTML/CSS/JS
estático. O Elysia serve esses arquivos como fallback depois das rotas da API, então
tudo cabe em **um processo e um container**.

```bash
npm run build   # instala e builda o site em web/out
npm start       # sobe API + site em http://localhost:3333
```

| Caminho | Serve |
|---------|-------|
| `/` | Landing page |
| `/playground` | Chat de teste no navegador |
| `/health` | Health check JSON |
| `/create-session`, `/chat`, `/session/status` | API, inalterados |
| `/docs`, `/openapi.json` | Swagger e spec |

Se `web/out` não existir, a API funciona normalmente e a raiz devolve um JSON
avisando para rodar `npm run build:web`. Para desenvolver o site com hot reload,
use `npm run dev:web` (Next em `:3000`) junto com `npm run dev` (API em `:3333`).

Servido assim, o navegador chama a API na **mesma origem** e o CORS deixa de ser
necessário. Para hospedar o site separado da API, builde com
`NEXT_PUBLIC_API_BASE=https://sua-api npm run build:web`.

---

## Endpoints

### `GET /health`

Health check.

> **Mudou.** Este payload ficava em `GET /`. Desde que o site passou a ser servido
> pelo mesmo processo, a raiz devolve a landing page e o health check mora em
> `/health`. Os demais endpoints continuam nos mesmos caminhos.

```json
{
  "ok": true,
  "message": "Free Gemini API online",
  "endpoints": [
    "POST /create-session",
    "POST /chat",
    "GET /session/status",
    "POST /session/status",
    "GET /docs",
    "GET /openapi.json"
  ],
  "docs": "/docs",
  "openapi": "/openapi.json",
  "errorCodesDoc": "doc/ERROR_CODES.md"
}
```

### `POST /create-session`

Cria uma sessão e retorna o token.

**Body:** vazio ou `{}`

**Resposta (200):**

```json
{
  "ok": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresInSeconds": 2700
}
```

### `POST /chat`

Envia um prompt e recebe a resposta do Gemini.

**Headers (uma das opções):**

```
Authorization: Bearer <sessionToken>
```

**Body:**

```json
{
  "prompt": "Explique o que é computação quântica.",
  "sessionToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

O token pode ir no header **ou** no body.

**Resposta (200):**

```json
{
  "ok": true,
  "reply": "Computação quântica é..."
}
```

### `GET /session/status` · `POST /session/status`

Verifica se o `sessionToken` ainda é válido, sem chamar o Gemini.

**Headers (uma das opções):**

```
Authorization: Bearer <sessionToken>
```

**Body (opcional no POST):**

```json
{
  "sessionToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

No `GET`, use apenas o header `Authorization`. No `POST`, o token pode ir no header **ou** no body.

**Resposta — sessão válida (200):**

```json
{
  "ok": true,
  "valid": true,
  "expiresAt": "2026-06-15T14:30:00.000Z",
  "expiresInSeconds": 1842
}
```

**Resposta — sessão expirada ou inválida (200):**

```json
{
  "ok": true,
  "valid": false,
  "reason": "token_expired",
  "expiredAt": "2026-06-15T13:00:00.000Z"
}
```

Valores de `reason`:

| `reason` | Significado |
|---|---|
| `token_expired` | JWT expirou |
| `token_invalid` | JWT malformado ou assinatura inválida |
| `session_expired` | Sessão expirou no servidor |
| `session_not_found` | Sessão não existe mais no banco |

Sem token → HTTP 401 `SESSION_TOKEN_REQUIRED`.

### `GET /docs`

Documentação interativa da API (Swagger UI) no navegador.

**Body:** nenhum

**Resposta (200):** página HTML com Swagger UI.

Abra no navegador:

```
http://localhost:3333/docs
```

Na interface:

1. Clique em **Authorize** e informe o `sessionToken` como Bearer JWT.
2. Execute `POST /create-session` e `POST /chat` direto pela UI.

> Swagger UI + OpenAPI estático (`src/docs/openapi.js`). Não usamos `@elysiajs/swagger` por bugs com o adapter Node ao recarregar a página.

### `GET /openapi.json`

Especificação [OpenAPI 3.0](https://swagger.io/specification/) em JSON — usada pelo `/docs` e por ferramentas externas (Postman, Insomnia, codegen).

**Body:** nenhum

**Resposta (200):** `Content-Type: application/json`

```json
{
  "openapi": "3.0.3",
  "info": {
    "title": "Free Gemini API",
    "version": "1.0.0"
  },
  "paths": { "...": "..." }
}
```

**Exemplo:**

```bash
curl -s http://localhost:3333/openapi.json | jq .info
```

### Exemplo com cURL

```bash
# 1. Criar sessão
TOKEN=$(curl -s -X POST http://localhost:3333/create-session | jq -r .sessionToken)

# 2. Enviar prompt
curl -s -X POST http://localhost:3333/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt": "Olá, como você está?"}'

# 3. Verificar se o token ainda é válido
curl -s http://localhost:3333/session/status \
  -H "Authorization: Bearer $TOKEN"

# 4. Abrir documentação no navegador (ou baixar o OpenAPI)
start http://localhost:3333/docs          # Windows
curl -s http://localhost:3333/openapi.json -o openapi.json
```

### Exemplo em JavaScript

```javascript
const base = "http://localhost:3333";

const { sessionToken } = await fetch(`${base}/create-session`, {
  method: "POST",
}).then((r) => r.json());

const { reply } = await fetch(`${base}/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  },
  body: JSON.stringify({ prompt: "Olá!" }),
}).then((r) => r.json());

console.log(reply);
```

---

## Configuração do Gemini

Toda autenticação e contexto da requisição web ficam em **`src/config/gemini.js`**:

| Campo | Função |
|-------|--------|
| `GEMINI_URL_TEMPLATE` | URL do `StreamGenerate` com placeholder `{REQID}` |
| `GEMINI_BODY_TEMPLATE` | Body `application/x-www-form-urlencoded` com o `f.req` capturado |
| `GEMINI_HEADERS` | Headers HTTP (`x-goog-ext-*`, `referer`, etc.) — **sem cookie** |

> **Cookies 100% dinâmicos.** No `create-session`, a API faz um único `POST StreamGenerate`; os cookies vêm do `Set-Cookie` dessa resposta e ficam salvos na sessão para os `/chat` seguintes.

### Atualizar credenciais

Quando as requisições falharem com `INVALID_SESSION` ou `SESSION_CREATE_FAILED`:

1. Abra [gemini.google.com](https://gemini.google.com) e confirme que o site carrega logado.
2. No DevTools → **Network**, envie uma mensagem e localize `StreamGenerate`.
3. Atualize em `src/config/gemini.js`: **URL**, **body template** (`f.req`) e headers `x-goog-ext-*` se mudaram.
4. Reinicie o servidor e chame `POST /create-session` — os cookies são obtidos de novo via fetch automático.

### Prompt de sistema (`INSERT_PROMPT`)

Com `INSERT_PROMPT=true`, cada mensagem do usuário é envolvida pelo conteúdo de `src/config/default_prompt.txt`, usando o placeholder `${message}`.

---

## Estrutura do projeto

```
gemini api/
├── app.js                      # Entry point
├── src/
│   ├── server.js               # Monta o app Elysia
│   ├── routes/
│   │   ├── chat.routes.js      # Rotas /create-session, /chat e /session/status
│   │   └── docs.routes.js      # GET /docs e /openapi.json
│   ├── docs/
│   │   └── openapi.js          # Especificação OpenAPI 3.0
│   ├── services/
│   │   ├── gemini-client.js    # fetch + parse do stream Gemini
│   │   ├── session-capture.js  # Monta snapshot a partir da config
│   │   ├── session-store.js    # Persistência de sessões (SQLite/memória)
│   │   └── rate-limit.js       # Rate limits por IP
│   ├── config/
│   │   ├── gemini.js           # URL, headers e body template
│   │   └── default_prompt.txt  # Template de sistema (opcional)
│   ├── errors/
│   │   └── api-errors.js       # Códigos e mensagens de erro
│   └── utils/
│       └── logger.js
├── data/
│   └── sessions.sqlite         # Banco de sessões (gerado em runtime)
└── doc/
    └── ERROR_CODES.md          # Referência completa de erros
```

---

## Erros

Todas as falhas retornam JSON padronizado:

```json
{
  "ok": false,
  "code": "SESSION_EXPIRED",
  "error": "Sessão expirada. Crie uma nova sessão em POST /create-session."
}
```

Alguns erros incluem campos extras (`retryAfterSeconds`, `expiredAt`).

Referência completa: **[doc/ERROR_CODES.md](doc/ERROR_CODES.md)**

### Tratamento recomendado no cliente

| `code` | Ação |
|--------|------|
| `SESSION_EXPIRED`, `SESSION_NOT_FOUND`, `SESSION_TOKEN_INVALID`, `INVALID_SESSION` | Chamar `POST /create-session` e repetir |
| `SESSION_COOLDOWN_ACTIVE`, `RATE_LIMIT_EXCEEDED` | Aguardar `retryAfterSeconds` |
| `GEMINI_TIMEOUT`, `GEMINI_UNAVAILABLE` | Retry com backoff |
| `CONFIG_NOT_READY` | Problema no servidor — não retry automático |

---

## O que este projeto **não** faz

- Não usa Puppeteer nem navegador headless
- Não aceita upload de arquivos ou imagens
- Não usa a API oficial `@google/genai` (pacote listado mas não utilizado no fluxo principal)
- Não renova cookies automaticamente — atualização manual em `gemini.js`
- Não mantém histórico de conversa entre chamadas `/chat` (cada prompt é independente no contexto do template)

---

## Créditos

**Felipe Estrela** — criador e mantenedor do **Free Gemini API**

- GitHub: [github.com/lipey1](https://github.com/lipey1)

---

## Licença

ISC
