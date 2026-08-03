"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import {
  AuthShell,
  Field,
  FormStatus,
  SubmitButton,
  useFormSubmit,
} from "@/components/AuthForm";
import { resetPassword } from "@/lib/auth";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  validatePassword,
} from "@/lib/credentials";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");

  const form = useFormSubmit(async () => {
    const check = validatePassword(password, { strength: true });
    if (!check.ok) {
      const err = new Error(check.error) as Error & {
        errors?: Record<string, string>;
      };
      err.errors = { password: check.error };
      throw err;
    }
    return resetPassword(token, check.value);
  }, () => router.push("/login/"));

  return (
    <AuthShell title="Choose a new password" subtitle="The reset link works for one hour.">
      <form className="auth-form" onSubmit={form.onSubmit}>
        <FormStatus error={form.error} />
        {!token ? (
          <FormStatus error="Missing reset token. Open the link from your email." />
        ) : null}
        <Field
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={setPassword}
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          error={form.fieldErrors.password}
          hint={`${PASSWORD_MIN}–${PASSWORD_MAX} characters, letter + number.`}
        />
        <div className="auth-actions">
          <SubmitButton loading={form.loading}>Update password</SubmitButton>
          <Link className="auth-link" href="/login/">
            Sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <TopBar />
      <Suspense fallback={<AuthShell title="Choose a new password" />}>
        <ResetForm />
      </Suspense>
      <Footer />
    </>
  );
}
