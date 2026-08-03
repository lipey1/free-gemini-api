"use client";

import { FormEvent, ReactNode, useState } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <main className="auth-page wrap">
      <div className="auth-card">
        <p className="kicker">Account</p>
        <h1>{title}</h1>
        {subtitle ? <p className="auth-sub">{subtitle}</p> : null}
        {children}
      </div>
    </main>
  );
}

export function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
  error,
  hint,
  minLength,
  maxLength,
  pattern,
  inputMode,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        inputMode={inputMode}
        onChange={(e) => {
          const next = e.target.value;
          onChange(maxLength != null ? next.slice(0, maxLength) : next);
        }}
      />
      {error ? <span className="field-error">{error}</span> : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function FormStatus({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (error) return <div className="form-banner" data-tone="error">{error}</div>;
  if (success) return <div className="form-banner" data-tone="ok">{success}</div>;
  return null;
}

export function SubmitButton({
  loading,
  loadingLabel = "Working…",
  children,
}: {
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}) {
  return (
    <button className="btn btn-primary" type="submit" disabled={loading}>
      {loading ? loadingLabel : children}
    </button>
  );
}

export function useFormSubmit<T>(
  action: () => Promise<T>,
  onSuccess?: (result: T) => void,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    try {
      const result = await action();
      onSuccess?.(result);
    } catch (err) {
      const e = err as Error & { errors?: Record<string, string> };
      if (e.errors && Object.keys(e.errors).length) {
        setFieldErrors(e.errors);
        setError(Object.values(e.errors)[0] || e.message);
      } else {
        setError(e instanceof Error ? e.message : "Request failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    fieldErrors,
    setFieldErrors,
    success,
    setSuccess,
    setError,
    onSubmit,
  };
}
