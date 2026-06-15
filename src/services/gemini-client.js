const {
  GEMINI_URL_TEMPLATE,
  GEMINI_BODY_TEMPLATE,
  GEMINI_HEADERS,
} = require("../config/gemini");
const logger = require("../utils/logger");

function extractTextFromWrbPayload(payloadString) {
  try {
    const parsed = JSON.parse(payloadString);
    const candidates = parsed?.[4];
    if (!Array.isArray(candidates)) {
      return null;
    }

    for (const candidate of candidates) {
      const maybeText = candidate?.[1]?.[0];
      if (typeof maybeText === "string" && maybeText.trim()) {
        return maybeText;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractBardErrorCodeFromEvent(event) {
  const TARGET = "type.googleapis.com/assistant.boq.bard.application.BardErrorInfo";

  const stack = [event];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    if (Array.isArray(cur)) {
      if (
        cur.length >= 2 &&
        cur[0] === TARGET &&
        Array.isArray(cur[1]) &&
        typeof cur[1][0] === "number"
      ) {
        return cur[1][0];
      }
      for (const item of cur) stack.push(item);
      continue;
    }

    for (const v of Object.values(cur)) stack.push(v);
  }

  return null;
}

function parseGeminiStream(rawText) {
  const clean = rawText.replace(")]}'", "").trimStart();
  const lines = clean.split(/\r?\n/);
  let i = 0;
  let latestText = null;
  let bardErrorCode = null;

  while (i < lines.length) {
    const sizeLine = lines[i]?.trim();
    if (!sizeLine) {
      i += 1;
      continue;
    }

    const size = Number(sizeLine);
    if (!Number.isFinite(size)) {
      i += 1;
      continue;
    }

    const payloadLine = lines[i + 1];
    if (!payloadLine) {
      break;
    }

    try {
      const envelope = JSON.parse(payloadLine);
      for (const event of envelope) {
        if (event?.[0] !== "wrb.fr") {
          continue;
        }

        const wrbPayload = event?.[2];
        if (typeof wrbPayload === "string") {
          const extracted = extractTextFromWrbPayload(wrbPayload);
          if (extracted) latestText = extracted;
        } else if (bardErrorCode == null) {
          bardErrorCode = extractBardErrorCodeFromEvent(event);
        }
      }
    } catch {
      // Ignore malformed chunk and continue parsing.
    }

    i += 2;
  }

  return { text: latestText, bardErrorCode };
}

function compactSnippet(text, limit = 600) {
  return text.replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeReplyText(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function normalizeHeaders(headers) {
  const out = { ...headers };
  if (out.Referer && !out.referer) {
    out.referer = out.Referer;
  }
  delete out.Referer;
  return out;
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const raw = response.headers.raw?.();
  if (raw?.["set-cookie"]) {
    return Array.isArray(raw["set-cookie"])
      ? raw["set-cookie"]
      : [raw["set-cookie"]];
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookieHeader(existingCookie, setCookies) {
  const jar = new Map();

  for (const pair of String(existingCookie || "").split(";")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }

  for (const setCookie of setCookies) {
    const first = String(setCookie).split(";")[0].trim();
    const eq = first.indexOf("=");
    if (eq === -1) continue;
    jar.set(first.slice(0, eq), first.slice(eq + 1));
  }

  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function tryReplacePromptInFReq(bodyTemplate, prompt) {
  try {
    const params = new URLSearchParams(bodyTemplate);
    const rawFReq = params.get("f.req");
    if (!rawFReq) return null;

    const outer = JSON.parse(rawFReq);
    const innerRaw = outer?.[1];
    if (typeof innerRaw !== "string") return null;

    const inner = JSON.parse(innerRaw);
    if (!Array.isArray(inner) || !Array.isArray(inner[0])) return null;

    inner[0][0] = prompt;
    outer[1] = JSON.stringify(inner);
    params.set("f.req", JSON.stringify(outer));

    return params.toString();
  } catch {
    return null;
  }
}

function buildRequestBody(prompt, bodyTemplate, promptMarkerEncoded) {
  const template = bodyTemplate || GEMINI_BODY_TEMPLATE;
  const rebuilt = tryReplacePromptInFReq(template, prompt);
  if (rebuilt) return rebuilt;

  const encodedPrompt = `%5C%22${encodeURIComponent(prompt)}%5C%22`;

  if (promptMarkerEncoded && template.includes(promptMarkerEncoded)) {
    return template.replace(promptMarkerEncoded, encodedPrompt);
  }

  if (template.includes("%5C%22oii%5C%22")) {
    return template.replace("%5C%22oii%5C%22", encodedPrompt);
  }

  if (template.includes("%5C%22oie%5C%22")) {
    return template.replace("%5C%22oie%5C%22", encodedPrompt);
  }

  return template;
}

function buildRequestUrl(urlTemplate) {
  const reqId = Date.now().toString().slice(-7);
  const template = urlTemplate || GEMINI_URL_TEMPLATE;
  return template
    .replace("{REQID}", reqId)
    .replace(encodeURIComponent("{REQID}"), reqId);
}

async function callGemini(prompt, sessionSnapshot = null, options = {}) {
  const headers = normalizeHeaders(sessionSnapshot?.headers || GEMINI_HEADERS);
  const allowEmptyCookie = options.allowEmptyCookie === true;

  if (!allowEmptyCookie && !headers.cookie?.trim()) {
    throw new Error("Sessão sem cookies. Crie uma nova sessão em /create-session.");
  }

  if (!headers.cookie?.trim()) {
    delete headers.cookie;
  }
  const timeoutMs = 120_000;
  const requestUrl = buildRequestUrl(sessionSnapshot?.urlTemplate);
  const requestBody = buildRequestBody(
    prompt,
    sessionSnapshot?.bodyTemplate,
    sessionSnapshot?.promptMarkerEncoded,
  );

  logger.info(`Gemini endpoint: ${requestUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  let raw;
  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers,
      body: requestBody,
      signal: controller.signal,
    });
    raw = await response.text();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        `Timeout ao chamar Gemini após ${Math.round(timeoutMs / 1000)}s.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const setCookies = getSetCookieHeaders(response);
  const cookie = mergeCookieHeader(headers.cookie || "", setCookies);

  return {
    response,
    raw,
    headers: {
      ...headers,
      cookie,
    },
  };
}

async function askGemini(prompt, sessionSnapshot = null) {
  const { response, raw, headers } = await callGemini(prompt, sessionSnapshot);

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}: ${raw.slice(0, 300)}`);
  }

  const parsed = parseGeminiStream(raw);
  if (!parsed?.text) {
    const code = parsed?.bardErrorCode;
    if (typeof code === "number") {
      const hint =
        code === 1100
          ? " (provável sessão inválida/expirada; crie uma nova sessão com /create-session)"
          : "";
      throw new Error(`Gemini retornou BardErrorInfo=${code}${hint}.`);
    }

    throw new Error(
      `Nao foi possivel extrair o texto da resposta. Raw snippet: ${compactSnippet(raw)}`,
    );
  }

  if (sessionSnapshot?.headers) {
    sessionSnapshot.headers = headers;
  }

  return normalizeReplyText(parsed.text);
}

async function warmupSession(snapshot, seedPrompt) {
  const { response, raw, headers } = await callGemini(seedPrompt, snapshot, {
    allowEmptyCookie: true,
  });

  if (!headers.cookie?.trim()) {
    throw new Error("Gemini não retornou cookies na resposta do StreamGenerate.");
  }

  if (!response.ok) {
    throw new Error(
      `Falha ao validar sessão no Gemini (HTTP ${response.status}): ${raw.slice(0, 300)}`,
    );
  }

  const parsed = parseGeminiStream(raw);
  if (!parsed?.text) {
    const code = parsed?.bardErrorCode;
    if (typeof code === "number") {
      throw new Error(`Gemini retornou BardErrorInfo=${code} ao criar sessão.`);
    }
    throw new Error(
      `Nao foi possivel validar sessão no Gemini. Raw snippet: ${compactSnippet(raw)}`,
    );
  }

  logger.success(
    `Sessão criada via StreamGenerate; ${headers.cookie.split(";").length} cookie(s) capturados.`,
  );

  return {
    ...snapshot,
    headers,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  askGemini,
  warmupSession,
};
