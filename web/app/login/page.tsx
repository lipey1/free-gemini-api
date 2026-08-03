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
import { loginAccount } from "@/lib/auth";
import {
  EMAIL_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  firstError,
  validateCredentials,
} from "@/lib/credentials";

gsap.registerPlugin(useGSAP);

export default function LoginPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useFormSubmit(async () => {
    const check = validateCredentials(email, password);
    if (!check.ok) {
      const err = new Error(firstError(check.errors)) as Error & {
        errors?: Record<string, string>;
      };
      err.errors = check.errors;
      throw err;
    }
    try {
      return await loginAccount({
        email: check.email,
        password: check.password,
        totpCode: needsTotp ? totpCode : undefined,
      });
    } catch (err) {
      const e = err as Error & { totpRequired?: boolean; code?: string };
      if (e.totpRequired || e.code === "TOTP_REQUIRED") {
        setNeedsTotp(true);
      }
      throw err;
    }
  }, () => {
    router.push("/account/");
  });

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-login-reveal]", { clearProps: "all" });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        // Opacity-only on columns — no x/y, so layout never looks misaligned.
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

  useGSAP(
    () => {
      if (!needsTotp) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        "[data-totp-field]",
        { autoAlpha: 0, height: 0, y: -8 },
        {
          autoAlpha: 1,
          height: "auto",
          y: 0,
          duration: 0.35,
          ease: "power2.out",
        },
      );
    },
    { scope: rootRef, dependencies: [needsTotp], revertOnUpdate: true },
  );

  return (
    <>
      <TopBar active="account" />
      <main className="auth-stage-shell wrap" ref={rootRef}>
        <div className="auth-stage">
        <aside className="auth-aside" data-login-panel data-login-reveal>
          <h1 className="auth-aside-title">
            Sign in to your
            <span className="off"> account.</span>
          </h1>
          <p className="auth-aside-body">
            Manage API keys, upgrade request limits, and keep 2FA on the same
            dark terminal surface as the rest of the product.
          </p>

          <div className="term auth-term" data-login-term>
            <div className="term-bar">
              <span className="d" style={{ background: "#ff5f57" }} />
              <span className="d" style={{ background: "#febc2e" }} />
              <span className="d" style={{ background: "#28c840" }} />
              <span className="term-title">session · auth</span>
            </div>
            <div className="term-body">
              <pre>
                <span className="term-line">
                  <span className="p">$</span> curl -X POST /auth/login \
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
                  <span className="dm">: true · plan: free · 20 rpm</span>
                </span>
              </pre>
            </div>
          </div>

          <ul className="auth-points">
            <li data-login-line>
              <b>Free</b> — 20 req/min out of the box
            </li>
            <li data-login-line>
              <b>API keys</b> — send <code>X-API-Key</code> on /chat
            </li>
            <li data-login-line>
              <b>2FA</b> — optional TOTP after sign-in
            </li>
          </ul>
        </aside>

        <section className="auth-panel" data-login-card data-login-reveal>
          <header className="auth-panel-head" data-login-line>
            <h2>Welcome back</h2>
            <p className="auth-sub">
              Email and password. API keys live in your account after login.
            </p>
          </header>

          <form className="auth-form" onSubmit={form.onSubmit}>
            <FormStatus error={form.error} />

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
                    autoComplete="current-password"
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
                ) : null}
              </label>
            </div>

            {needsTotp ? (
              <div data-totp-field data-login-line>
                <Field
                  id="totp"
                  label="2FA code"
                  autoComplete="one-time-code"
                  required
                  value={totpCode}
                  onChange={setTotpCode}
                  maxLength={8}
                  inputMode="numeric"
                  hint="Six digits from your authenticator app."
                />
              </div>
            ) : null}

            <div className="auth-actions" data-login-line>
              <SubmitButton loading={form.loading} loadingLabel="Signing in…">
                Sign in
              </SubmitButton>
              <Link className="auth-link" href="/forgot-password/">
                Forgot password?
              </Link>
            </div>
          </form>

          <p className="auth-foot" data-login-line>
            No account? <Link href="/register/">Create one</Link>
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
