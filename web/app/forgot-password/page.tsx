"use client";

import Link from "next/link";
import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import {
  AuthShell,
  Field,
  FormStatus,
  SubmitButton,
  useFormSubmit,
} from "@/components/AuthForm";
import { forgotPassword } from "@/lib/auth";
import {
  EMAIL_MAX,
  validateEmail,
} from "@/lib/credentials";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const form = useFormSubmit(async () => {
    const check = validateEmail(email);
    if (!check.ok) {
      const err = new Error(check.error) as Error & {
        errors?: Record<string, string>;
      };
      err.errors = { email: check.error };
      throw err;
    }
    const data = await forgotPassword(check.value);
    setDone(data.message || "Check your inbox.");
    return data;
  });

  return (
    <>
      <TopBar />
      <AuthShell
        title="Reset password"
        subtitle="We email a one-hour link. Without SMTP configured, the server logs the link."
      >
        <form className="auth-form" onSubmit={form.onSubmit}>
          <FormStatus error={form.error} success={done} />
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
          <div className="auth-actions">
            <SubmitButton loading={form.loading}>Send reset link</SubmitButton>
            <Link className="auth-link" href="/login/">
              Back to sign in
            </Link>
          </div>
        </form>
      </AuthShell>
      <Footer />
    </>
  );
}
