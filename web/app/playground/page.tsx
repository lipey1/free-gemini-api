"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { T } from "@/components/T";
import { useLang, type Key } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import { ApiError, apiOriginLabel, chat, clearSession, storedExpiry } from "@/lib/api";

/* The API accepts 20 000 characters. The console caps input well below that:
   a prompt this size already costs a long round trip, and the field grows to
   fit its content rather than scrolling, so it must stay bounded. */
const MAX_CHARS = 2_000;

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; elapsedMs: number };

type Failure = { code: string; message: string; retryAfter?: number; tone: "warn" | "bad" };

/** Rate limits and cooldowns are the visitor's to wait out, so amber rather than red. */
const WARN_CODES = new Set(["RATE_LIMIT_EXCEEDED", "SESSION_COOLDOWN_ACTIVE"]);

let seq = 0;
const nextId = () => `m${++seq}`;

export default function Playground() {
  const { t } = useLang();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [origin, setOrigin] = useState("");

  const logRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPrompt = useRef<string>("");

  /* session countdown in the header pill */
  useEffect(() => {
    setOrigin(apiOriginLabel());
    setExpiresAt(storedExpiry());
    const id = setInterval(() => {
      setNow(Date.now());
      setExpiresAt(storedExpiry());
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const minutesLeft = useMemo(() => {
    if (!expiresAt) return null;
    const mins = Math.max(0, Math.round((expiresAt - now) / 60_000));
    return mins > 0 ? mins : null;
  }, [expiresAt, now]);

  /* keep the newest message in view */
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, failure]);

  /* Resize the field to its content so it never shows a scrollbar. Bounded by
     MAX_CHARS above and by a share of the viewport on very small screens. */
  const grow = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = Math.max(140, Math.round(window.innerHeight * 0.4));
    el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
    el.style.overflowY = el.scrollHeight > cap ? "auto" : "hidden";
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const prompt = raw.trim();
      if (!prompt || busy || prompt.length > MAX_CHARS) return;

      lastPrompt.current = prompt;
      setFailure(null);
      setDraft("");
      setMessages((m) => [...m, { id: nextId(), role: "user", text: prompt }]);
      setBusy(true);

      requestAnimationFrame(grow);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { reply, elapsedMs } = await chat(prompt, controller.signal);
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "assistant", text: reply, elapsedMs },
        ]);
        setExpiresAt(storedExpiry());
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setFailure({ code: "ABORTED", message: t("pg.stopped"), tone: "warn" });
        } else if (err instanceof ApiError) {
          const key = `err.${err.code}` as Key;
          let message: string;
          try {
            message = t(key);
          } catch {
            message = err.message || t("err.UNKNOWN");
          }
          setFailure({
            code: err.code,
            message,
            retryAfter: err.retryAfterSeconds,
            tone: WARN_CODES.has(err.code) ? "warn" : "bad",
          });
        } else {
          setFailure({ code: "UNKNOWN", message: t("err.UNKNOWN"), tone: "bad" });
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, grow, t],
  );

  const stop = () => abortRef.current?.abort();

  const reset = () => {
    setMessages([]);
    setFailure(null);
    clearSession();
    setExpiresAt(null);
  };

  const over = draft.length > MAX_CHARS;

  return (
    <>
      <a className="skip" href="#chat"><T k="skip" /></a>
      <TopBar active="playground" />

      <main>
        <div className="wrap">
          <div className="pg-head">
            <div className="kicker"><T k="pg.kicker" /></div>
            <h2><T k="pg.title" /></h2>
            <p className="measure" style={{ marginTop: "var(--s4)" }}><T k="pg.body" /></p>

            <div className="pg-meta">
              <span className="pill" data-live={minutesLeft !== null}>
                <i />
                {minutesLeft !== null
                  ? `${t("pg.session.valid")} ${minutesLeft} ${t("pg.session.min")}`
                  : t("pg.session.none")}
              </span>
              <span>{origin}</span>
            </div>
          </div>
        </div>

        <div className="wrap">
          <div className="chat" id="chat">
            <div className="chat-log" ref={logRef}>
              {messages.length === 0 && !busy && !failure && (
                <div className="empty">
                  <h3><T k="pg.empty.title" /></h3>
                  <p><T k="pg.empty.body" /></p>
                  <div className="samples">
                    <div className="samples-label"><T k="pg.try" /></div>
                    {(["pg.sample.1", "pg.sample.2", "pg.sample.3"] as Key[]).map(
                      (k) => (
                        <button
                          key={k}
                          type="button"
                          className="sample"
                          onClick={() => send(t(k))}
                        >
                          {t(k)}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div className="msg" data-role={m.role} key={m.id}>
                  <div className="msg-who">
                    {m.role === "user" ? t("pg.you") : "gemini"}
                  </div>
                  <div>
                    {m.role === "user" ? (
                      <div className="msg-text">{m.text}</div>
                    ) : (
                      <>
                        <div
                          className="msg-text md"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
                        />
                        <div className="msg-foot">
                          <span>{(m.elapsedMs / 1000).toFixed(2)}s</span>
                          <span>·</span>
                          <span>POST /chat</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="msg pending" data-role="assistant">
                  <div className="msg-who">gemini</div>
                  <div>
                    <div className="pending-label">
                      <T k="pg.thinking" />…
                    </div>
                    <div className="track">
                      <i className="bar-live" />
                    </div>
                  </div>
                </div>
              )}

              {failure && (
                <div className="err" data-tone={failure.tone} role="alert">
                  <div className="err-code">{failure.code}</div>
                  <p>
                    {failure.message}
                    {failure.retryAfter != null && (
                      <>
                        {" "}
                        {t("err.retryIn")} {failure.retryAfter}
                        {t("err.seconds")}.
                      </>
                    )}
                  </p>
                  {failure.code !== "ABORTED" && lastPrompt.current && (
                    <div className="err-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => send(lastPrompt.current)}
                        disabled={busy}
                      ><T k="pg.retry" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="composer">
              <form
                className="composer-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(draft);
                }}
              >
                <textarea
                  ref={areaRef}
                  value={draft}
                  rows={1}
                  maxLength={MAX_CHARS}
                  placeholder={t("pg.placeholder")}
                  aria-label={t("pg.placeholder")}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    grow();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(draft);
                    }
                  }}
                />
                {busy ? (
                  <button type="button" className="btn btn-ghost" onClick={stop}><T k="pg.stop" /></button>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!draft.trim() || over}
                  ><T k="pg.send" /></button>
                )}
              </form>

              <div className="composer-foot">
                <span><T k="pg.hint" /></span>
                <span style={{ display: "flex", gap: "var(--s3)" }}>
                  {draft.length > 200 && (
                    <span className="counter" data-over={over}>
                      {draft.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                    </span>
                  )}
                  {messages.length > 0 && (
                    <button type="button" onClick={reset}><T k="pg.clear" /></button>
                  )}
                </span>
              </div>
            </div>
          </div>

          <p className="pg-note"><T k="pg.nohistory" /></p>
        </div>
      </main>

      <Footer />
    </>
  );
}
