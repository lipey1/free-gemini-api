/**
 * Browser-side client for the Free Gemini API.
 *
 * The site is statically exported, so every call goes straight from the
 * visitor's browser to the live instance. That is deliberate: rate limits are
 * per IP, and proxying through a server would put every visitor behind one
 * address and burn the 30/min budget in seconds.
 */

/**
 * Empty string means "same origin", which is what happens when the Elysia
 * server serves this build from web/out. Set NEXT_PUBLIC_API_BASE at build time
 * to point a separately hosted site at a remote instance.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

/**
 * Host to show a human. Must be called after mount: when API_BASE is empty the
 * answer depends on window, and reading it during render would desync the
 * static HTML from the first client render.
 */
export function apiOriginLabel(): string {
  if (API_BASE) return API_BASE.replace(/^https?:\/\//, "");
  return typeof window !== "undefined" ? window.location.host : "";
}

const STORAGE_KEY = "fga.session";

/** Renew a bit early so a call never lands on an expiring token. */
const RENEW_MARGIN_MS = 60_000;

export type ApiErrorCode =
  | "SESSION_EXPIRED"
  | "SESSION_NOT_FOUND"
  | "SESSION_TOKEN_INVALID"
  | "SESSION_TOKEN_REQUIRED"
  | "INVALID_SESSION"
  | "SESSION_COOLDOWN_ACTIVE"
  | "RATE_LIMIT_EXCEEDED"
  | "GEMINI_TIMEOUT"
  | "GEMINI_UNAVAILABLE"
  | "SESSION_CREATE_FAILED"
  | "CONFIG_NOT_READY"
  | "NETWORK"
  | "UNKNOWN";

export class ApiError extends Error {
  code: ApiErrorCode;
  retryAfterSeconds?: number;

  constructor(code: ApiErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Codes where the fix is "get a new session and try again". */
const RECOVERABLE = new Set<ApiErrorCode>([
  "SESSION_EXPIRED",
  "SESSION_NOT_FOUND",
  "SESSION_TOKEN_INVALID",
  "SESSION_TOKEN_REQUIRED",
  "INVALID_SESSION",
]);

type StoredSession = { token: string; expiresAt: number };

function readStored(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (typeof parsed.token !== "string" || typeof parsed.expiresAt !== "number") {
      return null;
    }
    if (parsed.expiresAt - RENEW_MARGIN_MS <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(session: StoredSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode, so fall back to in-memory only */
  }
}

export function clearSession() {
  inFlight = null;
  writeStored(null);
}

export function storedExpiry(): number | null {
  return readStored()?.expiresAt ?? null;
}

/** Turn any failed response into a typed ApiError. */
async function toApiError(res: Response): Promise<ApiError> {
  let code: ApiErrorCode = "UNKNOWN";
  let message = `HTTP ${res.status}`;
  let retryAfter: number | undefined;

  try {
    const body = await res.json();
    if (typeof body?.code === "string") code = body.code as ApiErrorCode;
    if (typeof body?.error === "string") message = body.error;
    if (typeof body?.retryAfterSeconds === "number") {
      retryAfter = body.retryAfterSeconds;
    }
  } catch {
    /* non-JSON body, so keep the status line */
  }

  if (code === "UNKNOWN" && res.status === 429) code = "RATE_LIMIT_EXCEEDED";
  return new ApiError(code, message, retryAfter);
}

/** Concurrent callers share one create-session round trip. */
let inFlight: Promise<string> | null = null;

async function createSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/create-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  if (!res.ok) throw await toApiError(res);

  const data = await res.json();
  if (!data?.sessionToken) {
    throw new ApiError("SESSION_CREATE_FAILED", "No sessionToken in response.");
  }

  const ttlSeconds =
    typeof data.expiresInSeconds === "number" ? data.expiresInSeconds : 2700;

  writeStored({ token: data.sessionToken, expiresAt: Date.now() + ttlSeconds * 1000 });
  return data.sessionToken as string;
}

export async function getToken(forceNew = false): Promise<string> {
  if (!forceNew) {
    const stored = readStored();
    if (stored) return stored.token;
  } else {
    writeStored(null);
  }

  if (!inFlight) {
    inFlight = createSession().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export type ChatResult = { reply: string; elapsedMs: number };

async function postChat(
  prompt: string,
  token: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (!res.ok) throw await toApiError(res);

  const data = await res.json();
  if (typeof data?.reply !== "string") {
    throw new ApiError("UNKNOWN", "Response had no reply field.");
  }
  return data.reply;
}

/**
 * Send a prompt. Creates a session if there is none, and retries exactly once
 * when the server says the session is gone. The visitor never sees that.
 */
export async function chat(prompt: string, signal?: AbortSignal): Promise<ChatResult> {
  const started = Date.now();

  const run = async (forceNew: boolean) => {
    const token = await getToken(forceNew);
    return postChat(prompt, token, signal);
  };

  try {
    const reply = await run(false);
    return { reply, elapsedMs: Date.now() - started };
  } catch (err) {
    if (err instanceof ApiError && RECOVERABLE.has(err.code)) {
      const reply = await run(true);
      return { reply, elapsedMs: Date.now() - started };
    }
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(
      "NETWORK",
      err instanceof Error ? err.message : "Network request failed.",
    );
  }
}
