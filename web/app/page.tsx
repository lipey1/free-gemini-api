"use client";

/*
  THESIS: This page is a distributed trace of one request. It refuses the dev-tool
  landing (centered gradient hero, tabbed snippet, three icon cards) by making the
  product's own weakness, that 99.5% of the wall clock belongs to Google rather
  than to this code, into the literal page structure. Honesty is the layout.
  OWN-WORLD: Terminal Dark, per brand/brand-guide.html. Void #0A0A0B ground,
  hairline #26262C rules, Inter + JetBrains Mono. Accent #4F8CFF marks only what
  the API owns; external work is drawn hatched and colorless, exactly as the
  logo's two chevrons split.
  STORY: A dev sees a real trace, understands where time goes, trusts the honesty,
  and opens the playground to prove it.
  FIRST VIEWPORT: Trace header rules the top, headline left, runnable cURL right
  waiting the real 4.4s, one accent CTA under it.
  FORM: Latency-trace waterfall, candidate 5 of 7, staged as one unbroken route
  (scroll axis = time axis). Seed key 70b14ad6.
*/

import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { TraceMotion } from "@/components/TraceMotion";
import { HeroTerminal } from "@/components/HeroTerminal";
import { T } from "@/components/T";
import { useLang } from "@/lib/i18n";
import { API_BASE } from "@/lib/api";

/* Measured inside the server with process.hrtime on 31 Jul 2026, six /chat
   calls. StreamGenerate is the median (range 3.9s to 27.5s); the internal
   steps barely varied. drawMs feeds the motion: each bar takes time to draw in
   proportion to how long it really took, so the striped one crawls. */
const TOTAL_MS = 7321.42;

const SPANS = [
  { op: "POST /chat", ms: TOTAL_MS, dur: "7.32 s", x: 0, w: 100, hot: true, root: true },
  { op: "auth.verify_jwt", ms: 1.0, dur: "1.0 ms", x: 0, w: 0.014 },
  { op: "session.load", note: "sqlite", ms: 0.7, dur: "0.7 ms", x: 0.014, w: 0.01 },
  { op: "payload.inject_prompt", ms: 0.02, dur: "0.02 ms", x: 0.024, w: 0.003 },
  { op: "gemini.StreamGenerate", ext: true, ms: 7319, dur: "7.32 s", x: 0.027, w: 99.96, hot: true },
  { op: "stream.parse", note: "wrb.fr", ms: 0.3, dur: "0.3 ms", x: 99.99, w: 0.004 },
  { op: "session.save_cookies", ms: 0.4, dur: "0.4 ms", x: 99.994, w: 0.006 },
];

const QUOTAS = [
  { name: "POST /create-session", env: "RATE_LIMIT_CREATE_SESSION_INTERVAL_SEC", fill: 8, val: "1 / 15 s" },
  { name: "POST /chat", env: "RATE_LIMIT_CHAT_PER_MINUTE", fill: 50, val: "30 / min" },
  { name: "GET · POST /session/status", env: "RATE_LIMIT_STATUS_PER_MINUTE", fill: 100, val: "60 / min" },
];

export default function Home() {
  const { t } = useLang();

  return (
    <>
      <a className="skip" href="#main"><T k="skip" /></a>
      <TopBar active="home" />

      <main id="main">
        <TraceMotion>
        {/* ══ HERO · t+0 ══════════════════════════════════ */}
        <div className="wrap">
          <header
            className="row"
            data-hero
            style={{ "--pt": "var(--s9)", "--pb": "var(--s8)" } as React.CSSProperties}
          >
            <div className="t" data-stamp>
              <b>t+0ms</b>
              trace start
            </div>
            <span className="tick" data-tick data-on="api" />

            <div className="hero-grid">
              <div>
                <div className="tagline"><T k="hero.tagline" /></div>
                <h1><T k="hero.title.a" /><span className="off"><T k="hero.title.b" /></span>
                </h1>
                <p className="measure hero-body"><T k="hero.body" /></p>
                <div className="cta-row">
                  <a className="btn btn-primary" href="/playground/"><T k="hero.cta.primary" /></a>
                  <a
                    className="btn btn-ghost"
                    href="https://github.com/lipey1/free-gemini-api"
                  ><T k="hero.cta.secondary" /></a>
                </div>
              </div>

              <HeroTerminal />
            </div>
          </header>
        </div>

        {/* ══ WATERFALL ═══════════════════════════════════ */}
        <div className="wrap">
          <section
            className="row"
            style={{ "--pt": "var(--s9)", "--pb": "var(--s9)" } as React.CSSProperties}
          >
            <div className="t" data-stamp>
              <b>t+0ms</b>→ 7.32s
            </div>
            <span className="tick" data-tick data-on="ext" />

            <div className="sec-head" data-reveal>
              <div className="kicker"><T k="trace.kicker" /></div>
              <h2><T k="trace.title" /></h2>
              <p className="measure"><T k="trace.body" /></p>
            </div>

            <div className="wf" data-waterfall>
                <div className="wf-head">
                  <span><T k="trace.col.op" /></span>
                  <span><T k="trace.col.span" /></span>
                  <span><T k="trace.col.dur" /></span>
                </div>

                {SPANS.map((s, i) => (
                  <div key={s.op} className={`bar-row${s.root ? "" : " child"}`}>
                    <span className="op">
                      {s.op}
                      {s.note && <em> · {s.note}</em>}
                      {s.ext && (
                        <em>
                          {" · "}
                          <T k="trace.op.external" />
                        </em>
                      )}
                    </span>
                    <span className="track">
                      <i
                        className="bar"
                        data-bar
                        data-ms={s.ms}
                        data-root={s.root === true}
                        data-kind={s.ext ? "ext" : undefined}
                        style={
                          {
                            "--x": `${s.x}%`,
                            "--w": `${s.w}%`,
                            "--i": i,
                          } as React.CSSProperties
                        }
                      />
                    </span>
                    <span className="dur" data-dur data-hot={s.hot === true}>
                      {s.dur}
                    </span>
                  </div>
                ))}

                <div className="wf-foot">
                  <span><T k="trace.foot.split" /></span>
                  <span>
                    <b>0.03%</b> <T k="trace.foot.share" /></span>
                </div>
              </div>

            <div className="legend">
              <span>
                <i style={{ background: "#4F8CFF" }} /><T k="trace.legend.ours" /></span>
              <span>
                <i
                  style={{
                    background:
                      "repeating-linear-gradient(115deg,#34343C 0 5px,#23232A 5px 10px)",
                    border: "1px solid #43434D",
                  }}
                /><T k="trace.legend.theirs" /></span>
            </div>

            <div className="callout">
              <p><T k="trace.note" /></p>
            </div>
          </section>
        </div>

        {/* ══ FLOW ════════════════════════════════════════ */}
        <div className="wrap">
          <section
            className="row"
            style={{ "--pb": "var(--s9)" } as React.CSSProperties}
          >
            <div className="t" data-stamp>
              <b>span</b>
              topology
            </div>
            <span className="tick" data-tick />

            <div className="sec-head" data-reveal>
              <div className="kicker"><T k="flow.kicker" /></div>
              <h2><T k="flow.title" /></h2>
              <p className="measure"><T k="flow.body" /></p>
            </div>

            <div className="flow">
              <div className="node">
                <span className="who">client</span>
                <h3><T k="flow.client.title" /></h3>
                <ul>
                  <li>POST /create-session</li>
                  <li>POST /chat + prompt</li>
                  <li>Bearer &lt;sessionToken&gt;</li>
                </ul>
              </div>
              <div className="arrow" aria-hidden="true">
                →
              </div>
              <div className="node" data-own="true">
                <span className="who">free gemini api</span>
                <h3><T k="flow.api.title" /></h3>
                <ul>
                  <li><T k="flow.api.1" /></li>
                  <li><T k="flow.api.2" /></li>
                  <li><T k="flow.api.3" /></li>
                </ul>
              </div>
              <div className="arrow" aria-hidden="true">
                →
              </div>
              <div className="node">
                <span className="who">gemini web</span>
                <h3><T k="flow.gemini.title" /></h3>
                <ul>
                  <li>application/x-www-form-urlencoded</li>
                  <li><T k="flow.gemini.2" /></li>
                  <li><T k="flow.gemini.3" /></li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* ══ ENDPOINTS ═══════════════════════════════════ */}
        <div className="wrap">
          <section
            className="row"
            style={{ "--pb": "var(--s9)" } as React.CSSProperties}
            id="endpoints"
          >
            <div className="t" data-stamp>
              <b>4</b>
              endpoints
            </div>
            <span className="tick" data-tick data-on="api" />

            <div className="sec-head" data-reveal>
              <div className="kicker"><T k="ep.kicker" /></div>
              <h2><T k="ep.title" /></h2>
            </div>

            <article className="ep">
              <div className="ep-in">
                <div>
                  <div className="ep-sig">
                    <span className="verb" data-m="POST">
                      POST
                    </span>
                    <span className="path">/create-session</span>
                  </div>
                  <p className="ep-body"><T k="ep.create.body" /></p>
                  <div className="ep-note"><T k="ep.create.note" /></div>
                </div>
                <div className="snip">
                  <pre>
                    {"{ "}
                    <span className="ky">&quot;ok&quot;</span>:{" "}
                    <span className="ok">true</span>,{"\n  "}
                    <span className="ky">&quot;sessionToken&quot;</span>:{" "}
                    <span className="st">&quot;eyJhbGciOiJIUzI1NiIs…&quot;</span>,
                    {"\n  "}
                    <span className="ky">&quot;expiresInSeconds&quot;</span>:{" "}
                    <span className="st">2700</span>
                    {"\n}"}
                  </pre>
                </div>
              </div>
            </article>

            <article className="ep">
              <div className="ep-in">
                <div>
                  <div className="ep-sig">
                    <span className="verb" data-m="POST">
                      POST
                    </span>
                    <span className="path">/chat</span>
                  </div>
                  <p className="ep-body"><T k="ep.chat.body" /></p>
                  <div className="ep-note"><T k="ep.chat.note" /></div>
                </div>
                <div className="snip">
                  <pre>
                    {"{ "}
                    <span className="ky">&quot;ok&quot;</span>:{" "}
                    <span className="ok">true</span>,{"\n  "}
                    <span className="ky">&quot;reply&quot;</span>:{" "}
                    <span className="st">
                      &quot;A stream is an abstraction for…&quot;
                    </span>
                    {"\n}"}
                  </pre>
                </div>
              </div>
            </article>

            <article className="ep">
              <div className="ep-in">
                <div>
                  <div className="ep-sig">
                    <span className="verb" data-m="GET">
                      GET
                    </span>
                    <span className="verb" data-m="POST">
                      POST
                    </span>
                    <span className="path">/session/status</span>
                  </div>
                  <p className="ep-body"><T k="ep.status.body" /></p>
                  <div className="ep-note"><T k="ep.status.note" /></div>
                </div>
                <div className="snip">
                  <pre>
                    {"{ "}
                    <span className="ky">&quot;ok&quot;</span>:{" "}
                    <span className="ok">true</span>,{" "}
                    <span className="ky">&quot;valid&quot;</span>:{" "}
                    <span className="ok">false</span>,{"\n  "}
                    <span className="ky">&quot;reason&quot;</span>:{" "}
                    <span className="st">&quot;token_expired&quot;</span>
                    {"\n}"}
                  </pre>
                </div>
              </div>
            </article>

            <article className="ep">
              <div className="ep-in">
                <div>
                  <div className="ep-sig">
                    <span className="verb" data-m="GET">
                      GET
                    </span>
                    <span className="path">/docs</span>
                    <span className="path" style={{ color: "var(--faint)" }}>
                      ·
                    </span>
                    <span className="path">/openapi.json</span>
                  </div>
                  <p className="ep-body"><T k="ep.docs.body" /></p>
                  <div className="ep-note"><T k="ep.docs.note" /></div>
                </div>
                <div className="snip">
                  <pre>
                    <span className="p">$</span> curl -s .../openapi.json | jq .info
                    {"\n{ "}
                    <span className="ky">&quot;title&quot;</span>:{" "}
                    <span className="st">&quot;Free Gemini API&quot;</span>,{"\n  "}
                    <span className="ky">&quot;version&quot;</span>:{" "}
                    <span className="st">&quot;1.0.0&quot;</span>
                    {"\n}"}
                  </pre>
                </div>
              </div>
            </article>
          </section>
        </div>

        {/* ══ QUOTA ═══════════════════════════════════════ */}
        <div className="wrap">
          <section
            className="row"
            style={{ "--pb": "var(--s9)" } as React.CSSProperties}
          >
            <div className="t" data-stamp>
              <b>t+45m</b>
              ttl
            </div>
            <span className="tick" data-tick data-on="end" />

            <div className="sec-head" data-reveal>
              <div className="kicker"><T k="quota.kicker" /></div>
              <h2><T k="quota.title" /></h2>
              <p className="measure"><T k="quota.body" /></p>
            </div>

            <div className="quota" data-quota>
                {QUOTAS.map((q) => (
                  <div className="q" key={q.env}>
                    <div>
                      <div className="q-name">{q.name}</div>
                      <div className="q-env">{q.env}</div>
                    </div>
                    <div className="q-track">
                      <div className="q-fill" data-qfill style={{ width: `${q.fill}%` }} />
                    </div>
                    <div className="q-val">{q.val}</div>
                  </div>
                ))}
                <div className="q">
                  <div>
                    <div className="q-name"><T k="quota.ttl" /></div>
                    <div className="q-env">SESSION_TTL_MINUTES</div>
                  </div>
                  <div className="q-track">
                    <div
                      className="q-fill"
                      style={{ width: "75%", background: "var(--rose)" }}
                    />
                  </div>
                  <div className="q-val">45 min</div>
                </div>
              </div>
          </section>
        </div>

        {/* ══ NOT DOING ═══════════════════════════════════ */}
        <div className="wrap">
          <section
            className="row"
            style={{ "--pb": "var(--s9)" } as React.CSSProperties}
            id="limits"
          >
            <div className="t" data-stamp>
              <b>0</b>
              spans
            </div>
            <span className="tick" data-tick />

            <div className="sec-head" data-reveal>
              <div className="kicker"><T k="none.kicker" /></div>
              <h2><T k="none.title" /></h2>
              <p className="measure"><T k="none.body" /></p>
            </div>

            <div>
              {[
                ["browser.launch", "puppeteer", t("none.1")],
                ["files.upload", null, t("none.2")],
                ["history.append", null, t("none.3")],
                ["cookies.auto_refresh", null, t("none.4")],
                ["genai.official_sdk", null, t("none.5")],
              ].map(([op, note, label]) => (
                <div className="none-row" key={op as string}>
                  <span className="none-op">
                    {op}
                    {note && (
                      <em style={{ fontStyle: "normal", color: "var(--faint)" }}>
                        {" "}
                        · {note}
                      </em>
                    )}
                  </span>
                  <div className="none-track">
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ══ DISCLAIMER ══════════════════════════════════ */}
        <div className="wrap">
          <section
            className="row"
            style={{ "--pb": "var(--s9)" } as React.CSSProperties}
          >
            <div className="t" data-stamp>
              <b>note</b>
              scope
            </div>
            <span className="tick" data-tick />

            <div className="disc">
              <h3><T k="disc.title" /></h3>
              <ul>
                <li>
                  <b>01</b>
                  <span><T k="disc.1" /></span>
                </li>
                <li>
                  <b>02</b>
                  <span><T k="disc.2" /></span>
                </li>
                <li>
                  <b>03</b>
                  <span><T k="disc.3" /></span>
                </li>
                <li>
                  <b>04</b>
                  <span><T k="disc.4" /></span>
                </li>
              </ul>
            </div>
          </section>
        </div>

        {/* ══ CLOSE ═══════════════════════════════════════ */}
        <div className="wrap">
          <section
            className="row"
            style={{ "--pt": "var(--s10)", "--pb": "var(--s9)" } as React.CSSProperties}
          >
            <div className="t" data-stamp>
              <b>t+7.32s</b>
              trace end
            </div>
            <span className="tick" data-tick data-on="api" />

            <h2 style={{ maxWidth: "16ch" }}><T k="close.title" /></h2>
            <div className="cta-row" data-axis-end>
              <a
                className="btn btn-primary"
                href="https://github.com/lipey1/free-gemini-api"
              >
                github.com/lipey1/free-gemini-api
              </a>
              <a className="btn btn-ghost" href={`${API_BASE}/docs`}><T k="close.cta" /></a>
            </div>
          </section>
        </div>
        </TraceMotion>
      </main>

      <Footer />
    </>
  );
}
