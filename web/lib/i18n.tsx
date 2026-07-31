"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "pt";

const STORAGE_KEY = "fga.lang";

export const dict = {
  // ── chrome ────────────────────────────────────────────
  "nav.playground": { en: "Console", pt: "Console" },
  "nav.docs": { en: "/docs", pt: "/docs" },
  "nav.github": { en: "GitHub", pt: "GitHub" },
  "skip": { en: "Skip to content", pt: "Pular para o conteúdo" },

  // ── hero ──────────────────────────────────────────────
  "hero.tagline": {
    en: "REST interface for Gemini web · Node.js 18 · Elysia",
    pt: "Interface REST para o Gemini web · Node.js 18 · Elysia",
  },
  "hero.title.a": { en: "REST access to Gemini,", pt: "Acesso REST ao Gemini," },
  "hero.title.b": {
    en: "without an SDK or a browser.",
    pt: "sem SDK e sem navegador.",
  },
  "hero.body": {
    en: "Free Gemini API is a thin HTTP proxy. It reproduces the StreamGenerate request issued by the Gemini web client, parses the response stream, and returns plain JSON. Built on Node.js 18 and Elysia, with no Puppeteer, no headless browser, and no official SDK in the request path.",
    pt: "A Free Gemini API é um proxy HTTP fino. Ela reproduz a requisição StreamGenerate emitida pelo cliente web do Gemini, faz o parse do stream de resposta e retorna JSON puro. Construída sobre Node.js 18 e Elysia, sem Puppeteer, sem navegador headless e sem SDK oficial no caminho da requisição.",
  },
  "hero.cta.primary": { en: "Open the console", pt: "Abrir o console" },
  "hero.cta.secondary": { en: "View source", pt: "Ver o código-fonte" },
  "hero.term.waiting": { en: "awaiting response…", pt: "aguardando resposta…" },

  // ── trace ─────────────────────────────────────────────
  "trace.kicker": { en: "Performance", pt: "Desempenho" },
  "trace.title": {
    en: "Response time composition",
    pt: "Composição do tempo de resposta",
  },
  "trace.body": {
    en: "Breakdown of a single /chat call. All processing performed by this project (JWT verification, session lookup, prompt substitution and stream parsing) totals approximately 2.4 ms. The remainder is the upstream Gemini response. Framework choice affects the blue segments only.",
    pt: "Composição de uma única chamada /chat. Todo o processamento realizado por este projeto (verificação do JWT, leitura da sessão, substituição do prompt e parse do stream) soma aproximadamente 2,4 ms. O restante é a resposta do Gemini. A escolha do framework afeta apenas os segmentos azuis.",
  },
  "trace.col.op": { en: "operation", pt: "operação" },
  "trace.col.span": { en: "span", pt: "span" },
  "trace.col.dur": { en: "duration", pt: "duração" },
  "trace.foot.split": {
    en: "this project ≈ 2.4 ms · upstream ≈ 7.3 s",
    pt: "este projeto ≈ 2,4 ms · upstream ≈ 7,3 s",
  },
  "trace.foot.share": {
    en: "attributable to this project",
    pt: "atribuível a este projeto",
  },
  "trace.legend.ours": { en: "This project", pt: "Este projeto" },
  "trace.legend.theirs": { en: "Google, upstream", pt: "Google, upstream" },
  "trace.note": {
    en: "Measured server-side on 31 July 2026 using process.hrtime across six /chat calls. Each segment is a direct measurement rather than an estimate. StreamGenerate ranged from 3.9 s to 27.5 s and the chart shows the median; the internal steps varied negligibly. Sample size is six, so these figures are indicative and do not constitute a published benchmark. No load testing has been performed.",
    pt: "Medição realizada no servidor em 31 de julho de 2026 com process.hrtime, em seis chamadas /chat. Cada segmento é uma medição direta, não uma estimativa. O StreamGenerate variou de 3,9 s a 27,5 s e o gráfico apresenta a mediana; os passos internos tiveram variação desprezível. A amostra é de seis execuções, portanto os valores são indicativos e não constituem benchmark publicado. Não foram realizados testes de carga.",
  },
  "trace.op.external": { en: "upstream", pt: "upstream" },
  "trace.median": { en: "median of 6", pt: "mediana de 6" },
  "trace.range": { en: "range 3.9 s to 27.5 s", pt: "faixa 3,9 s a 27,5 s" },

  // ── flow ──────────────────────────────────────────────
  "flow.kicker": { en: "Architecture", pt: "Arquitetura" },
  "flow.title": { en: "Request flow", pt: "Fluxo da requisição" },
  "flow.body": {
    en: "The client does not communicate with Google directly. The proxy maintains session state (a signed JWT, a cookie jar and a captured request snapshot) and forwards each prompt upstream on the client's behalf.",
    pt: "O cliente não se comunica diretamente com o Google. O proxy mantém o estado da sessão (um JWT assinado, um conjunto de cookies e um snapshot da requisição capturada) e encaminha cada prompt em nome do cliente.",
  },
  "flow.client.title": { en: "Client", pt: "Cliente" },
  "flow.api.title": { en: "Proxy", pt: "Proxy" },
  "flow.gemini.title": { en: "StreamGenerate", pt: "StreamGenerate" },
  "flow.api.1": {
    en: "verify JWT · load session",
    pt: "verifica JWT · carrega sessão",
  },
  "flow.api.2": { en: "substitute prompt in f.req", pt: "substitui o prompt no f.req" },
  "flow.api.3": {
    en: "parse stream · persist cookies",
    pt: "parse do stream · persiste cookies",
  },
  "flow.gemini.2": { en: "chunked response · wrb.fr", pt: "resposta chunked · wrb.fr" },
  "flow.gemini.3": { en: "Set-Cookie on each response", pt: "Set-Cookie a cada resposta" },

  // ── endpoints ─────────────────────────────────────────
  "ep.kicker": { en: "API surface", pt: "Superfície da API" },
  "ep.title": { en: "Endpoints", pt: "Endpoints" },
  "ep.create.body": {
    en: "Issues one cookieless StreamGenerate request, retains the returned Set-Cookie values, persists the snapshot to SQLite and returns a signed JWT.",
    pt: "Emite uma requisição StreamGenerate sem cookie, retém os valores de Set-Cookie retornados, persiste o snapshot em SQLite e retorna um JWT assinado.",
  },
  "ep.create.note": { en: "~4.4 s · 1 req / 15 s per IP", pt: "~4,4 s · 1 req / 15 s por IP" },
  "ep.chat.body": {
    en: "Accepts a prompt, substitutes it into the captured f.req body, forwards the request using the session cookies and returns the parsed text. The token may be supplied in the Authorization header or the request body.",
    pt: "Recebe um prompt, substitui-o no corpo f.req capturado, encaminha a requisição com os cookies da sessão e retorna o texto processado. O token pode ser informado no cabeçalho Authorization ou no corpo da requisição.",
  },
  "ep.chat.note": {
    en: "3.9 to 27.5 s observed · 30 req / min per IP · 20 000 character limit",
    pt: "3,9 a 27,5 s observado · 30 req / min por IP · limite de 20 000 caracteres",
  },
  "ep.status.body": {
    en: "Validates the token against the session store without contacting Google. Always returns HTTP 200; an expired session is reported in the response body rather than as a protocol error.",
    pt: "Valida o token contra o armazenamento de sessões sem contatar o Google. Retorna sempre HTTP 200; uma sessão expirada é informada no corpo da resposta, não como erro de protocolo.",
  },
  "ep.status.note": { en: "<5 ms · 60 req / min per IP", pt: "<5 ms · 60 req / min por IP" },
  "ep.docs.body": {
    en: "Swagger UI backed by a static OpenAPI 3.0 specification. Authorise with a session token to execute requests directly from the browser.",
    pt: "Swagger UI apoiado em uma especificação OpenAPI 3.0 estática. Autorize com um session token para executar requisições diretamente do navegador.",
  },
  "ep.docs.note": {
    en: "static specification, as @elysiajs/swagger is unreliable with the Node adapter",
    pt: "especificação estática, pois o @elysiajs/swagger é instável com o adapter Node",
  },

  // ── quota ─────────────────────────────────────────────
  "quota.kicker": { en: "Limits", pt: "Limites" },
  "quota.title": {
    en: "Rate limits and session lifetime",
    pt: "Rate limits e duração da sessão",
  },
  "quota.body": {
    en: "Fixed windows per IP address, held in memory. Each limit is configurable through an environment variable, and a value of 0 disables it. After 45 minutes /chat returns SESSION_EXPIRED and a new session must be created.",
    pt: "Janelas fixas por endereço IP, mantidas em memória. Cada limite é configurável por variável de ambiente, e o valor 0 o desativa. Após 45 minutos, /chat retorna SESSION_EXPIRED e uma nova sessão deve ser criada.",
  },
  "quota.ttl": { en: "session lifetime", pt: "duração da sessão" },

  // ── out of scope ──────────────────────────────────────
  "none.kicker": { en: "Scope", pt: "Escopo" },
  "none.title": { en: "Out of scope", pt: "Fora do escopo" },
  "none.body": {
    en: "The following capabilities are intentionally not implemented. They are documented here so suitability can be assessed before integration.",
    pt: "As capacidades a seguir não são implementadas por decisão de projeto. Estão documentadas aqui para que a adequação possa ser avaliada antes da integração.",
  },
  "none.1": {
    en: "no headless browser is used at any stage",
    pt: "nenhum navegador headless é utilizado em qualquer etapa",
  },
  "none.2": {
    en: "text prompts only; file and image uploads are not supported",
    pt: "apenas prompts de texto; upload de arquivos e imagens não é suportado",
  },
  "none.3": {
    en: "conversation history is not retained between /chat calls",
    pt: "o histórico de conversa não é retido entre chamadas /chat",
  },
  "none.4": {
    en: "the request template in src/config/gemini.js requires manual updates",
    pt: "o template em src/config/gemini.js exige atualização manual",
  },
  "none.5": {
    en: "@google/genai is not used in the request path",
    pt: "@google/genai não é utilizado no caminho da requisição",
  },

  // ── notices ───────────────────────────────────────────
  "disc.title": { en: "Important notices", pt: "Avisos importantes" },
  "disc.1": {
    en: "Independent project. Not affiliated with, endorsed by, or connected to Google.",
    pt: "Projeto independente. Sem afiliação, endosso ou vínculo com o Google.",
  },
  "disc.2": {
    en: "The service depends on an internal endpoint of gemini.google.com rather than a public documented API. Any change to that protocol will interrupt operation until the request template is updated.",
    pt: "O serviço depende de um endpoint interno do gemini.google.com, não de uma API pública documentada. Qualquer alteração nesse protocolo interrompe o funcionamento até que o template da requisição seja atualizado.",
  },
  "disc.3": {
    en: "No uptime target, automated test suite or support commitment is provided. The project was built as a study of the protocol and is published to be read as source.",
    pt: "Não há meta de disponibilidade, suíte de testes automatizados ou compromisso de suporte. O projeto foi construído como estudo do protocolo e é publicado para ser lido como código-fonte.",
  },
  "disc.4": {
    en: "For production workloads, use the official Google Gemini API.",
    pt: "Para cargas de trabalho em produção, utilize a API oficial do Google Gemini.",
  },

  // ── close ─────────────────────────────────────────────
  "close.title": {
    en: "The complete source is available on GitHub.",
    pt: "O código-fonte completo está disponível no GitHub.",
  },
  "close.cta": { en: "API documentation", pt: "Documentação da API" },
  "footer.by": { en: "developed by", pt: "desenvolvido por" },

  // ── console ───────────────────────────────────────────
  "pg.kicker": { en: "Interactive console", pt: "Console interativo" },
  "pg.title": { en: "Test the API", pt: "Teste a API" },
  "pg.body": {
    en: "Requests are issued directly from your browser to the live instance, so rate limits apply to your own IP address. Each message is transmitted independently, as the API does not retain conversation history.",
    pt: "As requisições são emitidas diretamente do seu navegador para a instância pública, portanto os rate limits se aplicam ao seu próprio endereço IP. Cada mensagem é transmitida de forma independente, pois a API não retém histórico de conversa.",
  },
  "pg.placeholder": { en: "Enter a prompt", pt: "Digite um prompt" },
  "pg.send": { en: "Send", pt: "Enviar" },
  "pg.stop": { en: "Cancel", pt: "Cancelar" },
  "pg.clear": { en: "Clear session", pt: "Limpar sessão" },
  "pg.hint": {
    en: "Enter to send · Shift+Enter for a new line",
    pt: "Enter para enviar · Shift+Enter para nova linha",
  },
  "pg.empty.title": { en: "No active session", pt: "Nenhuma sessão ativa" },
  "pg.empty.body": {
    en: "The first message creates one, adding approximately 4 seconds to that request. Subsequent messages call /chat only.",
    pt: "A primeira mensagem cria uma, acrescentando cerca de 4 segundos àquela requisição. As mensagens seguintes chamam apenas /chat.",
  },
  "pg.try": { en: "Example prompts", pt: "Prompts de exemplo" },
  "pg.sample.1": {
    en: "Explain streams in Node.js in two sentences.",
    pt: "Explique streams em Node.js em duas frases.",
  },
  "pg.sample.2": {
    en: "Write a curl command that posts JSON with a bearer token.",
    pt: "Escreva um comando curl que envia JSON com bearer token.",
  },
  "pg.sample.3": {
    en: "What is the difference between a JWT and a session cookie?",
    pt: "Qual a diferença entre um JWT e um cookie de sessão?",
  },
  "pg.thinking": { en: "awaiting response", pt: "aguardando resposta" },
  "pg.you": { en: "client", pt: "cliente" },
  "pg.session.none": { en: "no active session", pt: "sem sessão ativa" },
  "pg.session.valid": { en: "session valid for", pt: "sessão válida por" },
  "pg.session.min": { en: "min", pt: "min" },
  "pg.stopped": { en: "Request cancelled.", pt: "Requisição cancelada." },
  "pg.retry": { en: "Retry", pt: "Repetir" },
  "pg.nohistory": {
    en: "Each message is transmitted independently. The API retains no history, so earlier messages in this session are not sent as context.",
    pt: "Cada mensagem é transmitida de forma independente. A API não retém histórico, portanto as mensagens anteriores desta sessão não são enviadas como contexto.",
  },

  // ── errors ────────────────────────────────────────────
  "err.RATE_LIMIT_EXCEEDED": {
    en: "Rate limit exceeded. The API permits 30 requests per minute per IP address.",
    pt: "Rate limit excedido. A API permite 30 requisições por minuto por endereço IP.",
  },
  "err.SESSION_COOLDOWN_ACTIVE": {
    en: "Session cooldown active. One session may be created every 15 seconds.",
    pt: "Cooldown de sessão ativo. É permitida a criação de uma sessão a cada 15 segundos.",
  },
  "err.GEMINI_TIMEOUT": {
    en: "The upstream request exceeded the 120 second timeout. A shorter prompt may succeed.",
    pt: "A requisição upstream excedeu o timeout de 120 segundos. Um prompt mais curto pode ser bem-sucedido.",
  },
  "err.GEMINI_UNAVAILABLE": {
    en: "No response from the upstream service. This usually indicates that the captured request template requires updating.",
    pt: "Sem resposta do serviço upstream. Isso normalmente indica que o template de requisição capturado precisa ser atualizado.",
  },
  "err.SESSION_CREATE_FAILED": {
    en: "Session creation failed. The request template in src/config/gemini.js may be out of date.",
    pt: "Falha ao criar a sessão. O template em src/config/gemini.js pode estar desatualizado.",
  },
  "err.CONFIG_NOT_READY": {
    en: "The server is not correctly configured. No client-side action is available.",
    pt: "O servidor não está corretamente configurado. Não há ação disponível no lado do cliente.",
  },
  "err.NETWORK": {
    en: "The API could not be reached. The service may be unavailable or the request was blocked by the network.",
    pt: "Não foi possível alcançar a API. O serviço pode estar indisponível ou a requisição foi bloqueada pela rede.",
  },
  "err.UNKNOWN": {
    en: "An unexpected error occurred.",
    pt: "Ocorreu um erro inesperado.",
  },
  "err.retryIn": { en: "Retry in", pt: "Repetir em" },
  "err.seconds": { en: "s", pt: "s" },
} as const;

export type Key = keyof typeof dict;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string };

const LangContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (k) => dict[k].en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  // Starts as "en" to match the pre-rendered markup, then adopts whatever the
  // inline <head> script already stamped on <html>. Visible text does not wait
  // for this: it is rendered in both languages and switched by CSS (see T.tsx).
  // This state only drives things CSS cannot reach, such as placeholders,
  // aria-labels and the strings passed to the API.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stamped = document.documentElement.getAttribute("data-lang");
    if (stamped === "pt" || stamped === "en") {
      setLangState(stamped);
      return;
    }
    let next: Lang = "en";
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "pt") next = saved;
      else if (navigator.language?.toLowerCase().startsWith("pt")) next = "pt";
    } catch {
      /* ignore */
    }
    setLangState(next);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    const d = document.documentElement;
    d.setAttribute("data-lang", l);
    d.lang = l === "pt" ? "pt-BR" : "en";
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((k: Key) => dict[k][lang], [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
