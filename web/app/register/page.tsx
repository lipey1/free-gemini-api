"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import {
  Field,
  FormStatus,
  SubmitButton,
  useFormSubmit,
} from "@/components/AuthForm";
import { registerAccount } from "@/lib/auth";
import {
  EMAIL_MAX,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  firstError,
  validateRegistration,
} from "@/lib/credentials";

gsap.registerPlugin(useGSAP);

export default function RegisterPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const form = useFormSubmit(async () => {
    const check = validateRegistration({ email, password, name });
    if (!check.ok) {
      const err = new Error(firstError(check.errors)) as Error & {
        errors?: Record<string, string>;
      };
      err.errors = check.errors;
      throw err;
    }
    return registerAccount({
      email: check.email,
      password: check.password,
      name: check.name,
    });
  }, () => router.push("/account/"));


  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-login-reveal]", { clearProps: "all" });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.fromTo(
          "[data-login-panel], [data-login-card]",
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.55, stagger: 0.08, clearProps: "transform" },
        ).fromTo(
          "[data-login-line], [data-login-term] .term-line",
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: 0.35,
            stagger: 0.045,
            clearProps: "transform",
          },
          "-=0.25",
        );
      });
    },
    { scope: rootRef },
  );

  return (
    <>
      <TopBar active="account" />
      <main className="auth-stage-shell wrap" ref={rootRef}>
        <div className="auth-stage">
        <aside className="auth-aside" data-login-panel data-login-reveal>
          <h1 className="auth-aside-title">
            Create your
            <span className="off"> account.</span>
          </h1>
          <p className="auth-aside-body">
            Start on Free with 20 req/min, mint an API key, and upgrade when
            traffic asks for more — same terminal surface as the API.
          </p>

          <div className="term auth-term" data-login-term>
            <div className="term-bar">
              <span className="d" style={{ background: "#ff5f57" }} />
              <span className="d" style={{ background: "#febc2e" }} />
              <span className="d" style={{ background: "#28c840" }} />
              <span className="term-title">session · register</span>
            </div>
            <div className="term-body">
              <pre>
                <span className="term-line">
                  <span className="p">$</span> curl -X POST /auth/register \
                </span>
                {"\n"}
                <span className="term-line">
                  {"  "}
                  <span className="fl">-H</span>{" "}
                  <span className="st">&apos;content-type: application/json&apos;</span>{" "}
                  \
                </span>
                {"\n"}
                <span className="term-line">
                  {"  "}
                  <span className="fl">-d</span>{" "}
                  <span className="st">
                    &apos;{"{"}&quot;email&quot;:&quot;…&quot;{"}"}&apos;
                  </span>
                </span>
                {"\n"}
                <span className="term-line">
                  <span className="ok">→</span>{" "}
                  <span className="ky">ok</span>
                  <span className="dm">: true · plan: free · key ready</span>
                </span>
              </pre>
            </div>
          </div>

          <ul className="auth-points">
            <li data-login-line>
              <b>Free</b> — 20 req/min, no card required
            </li>
            <li data-login-line>
              <b>API keys</b> — create and rotate in Account
            </li>
            <li data-login-line>
              <b>Upgrade</b> — Pro → Ultra when you need rpm
            </li>
          </ul>
        </aside>

        <section className="auth-panel" data-login-card data-login-reveal>
          <header className="auth-panel-head" data-login-line>
            <h2>Get started</h2>
            <p className="auth-sub">
              Name is optional. Password: {PASSWORD_MIN}–{PASSWORD_MAX} chars,
              with a letter and a number.
            </p>
          </header>

          <form className="auth-form" onSubmit={form.onSubmit}>
            <FormStatus error={form.error} />

            <div data-login-line>
              <Field
                id="name"
                label="Name"
                autoComplete="name"
                value={name}
                onChange={setName}
                maxLength={NAME_MAX}
                error={form.fieldErrors.name}
              />
            </div>

            <div data-login-line>
              <Field
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={setEmail}
                maxLength={EMAIL_MAX}
                error={form.fieldErrors.email}
              />
            </div>

            <div data-login-line>
              <label className="field" htmlFor="password">
                <span className="field-label">Password *</span>
                <div className="field-password">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={PASSWORD_MIN}
                    maxLength={PASSWORD_MAX}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value.slice(0, PASSWORD_MAX))
                    }
                  />
                  <button
                    type="button"
                    className="field-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {form.fieldErrors.password ? (
                  <span className="field-error">{form.fieldErrors.password}</span>
                ) : (
                  <span className="field-hint">
                    {PASSWORD_MIN}–{PASSWORD_MAX} characters, letter + number.
                  </span>
                )}
              </label>
            </div>

            <div className="auth-actions" data-login-line>
              <SubmitButton loading={form.loading} loadingLabel="Creating…">
                Create account
              </SubmitButton>
            </div>
          </form>

          <p className="auth-foot" data-login-line>
            Already registered? <Link href="/login/">Sign in</Link>
            {" · "}
            <Link href="/pricing/">View plans</Link>
          </p>
        </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
