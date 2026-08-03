"use client";

import { useState } from "react";
import { createApiKey, fetchUsage, revokeApiKey } from "@/lib/auth";
import { testApiKey } from "@/lib/api";
import { API_KEY_NAME_MAX, validateApiKeyName } from "@/lib/limits";
import { useToast } from "@/components/Toast";

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  active: boolean;
};

function formatWhen(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export function ApiKeysPanel({
  keys,
  active,
  max,
  onChanged,
}: {
  keys: ApiKeyRow[];
  active: number;
  max: number;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState("Default");
  const [nameError, setNameError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [testKey, setTestKey] = useState("");
  const [prompt, setPrompt] = useState("Say hello in one short sentence.");
  const [reply, setReply] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  async function generate() {
    const check = validateApiKeyName(name);
    if (!check.ok) {
      setNameError(check.error);
      toast.error(check.error);
      return;
    }
    setBusy(true);
    setNameError(null);
    try {
      const res = await createApiKey(check.value);
      setFreshKey(res.key.key);
      setTestKey(res.key.key);
      setName(check.value);
      setShowKey(false);
      toast.ok("API key created — copy it now.");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create key.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, label: string) {
    if (!window.confirm(`Revoke “${label}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await revokeApiKey(id);
      setFreshKey(null);
      toast.ok("Key revoked.");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke key.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.ok("Copied to clipboard.");
    } catch {
      toast.error("Could not copy.");
    }
  }

  function runTest() {
    setTesting(true);
    setReply(null);
    setTestError(null);
    setElapsed(null);
    testApiKey(testKey, prompt)
      .then((res) => {
        setReply(res.reply);
        setElapsed(res.elapsedMs);
        toast.ok(`Test ok · ${res.elapsedMs}ms`);
        fetchUsage().catch(() => {});
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Request failed.";
        setTestError(msg);
        toast.error(msg);
      })
      .finally(() => setTesting(false));
  }

  const activeKeys = keys.filter((k) => k.active);
  const revokedKeys = keys.filter((k) => !k.active);

  return (
    <div className="ak">
      <div className="ak-bar">
        <p className="ak-lede">
          Authenticate <code>/chat</code> with header <code>X-API-Key</code>.
          The full secret is shown only once.
        </p>
        <p className="ak-count mono" title="Active keys / account cap">
          <b>{active}</b>
          <span>/{max}</span>
        </p>
      </div>

      <section className="ak-block">
        <div className="ak-block-head">
          <h2>Create</h2>
        </div>
        <div className="ak-create">
          <label className="field ak-name">
            <span className="field-label">
              Name
              <span
                className="ak-chars"
                data-warn={name.length >= API_KEY_NAME_MAX - 5}
              >
                {name.length}/{API_KEY_NAME_MAX}
              </span>
            </span>
            <input
              value={name}
              maxLength={API_KEY_NAME_MAX}
              placeholder="production, staging…"
              aria-invalid={Boolean(nameError)}
              onChange={(e) => {
                setName(e.target.value.slice(0, API_KEY_NAME_MAX));
                setNameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void generate();
                }
              }}
            />
            {nameError ? <span className="field-error">{nameError}</span> : null}
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || active >= max}
            onClick={() => void generate()}
          >
            Generate
          </button>
        </div>

        {freshKey ? (
          <div className="ak-reveal" aria-live="polite">
            <div className="ak-reveal-head">
              <span>New secret — copy before you leave this page</span>
              <button
                type="button"
                className="ak-link"
                onClick={() => setFreshKey(null)}
              >
                Dismiss
              </button>
            </div>
            <div className="ak-reveal-row">
              <code className="ak-secret">{freshKey}</code>
              <div className="ak-reveal-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void copy(freshKey)}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setTestKey(freshKey);
                    toast.info("Key loaded into Test.");
                  }}
                >
                  Use in test
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="ak-block">
        <div className="ak-block-head">
          <h2>Keys</h2>
          <span className="mono">
            {activeKeys.length} active
            {revokedKeys.length ? ` · ${revokedKeys.length} revoked` : ""}
          </span>
        </div>

        {keys.length === 0 ? (
          <div className="ak-empty">No keys yet. Generate one above.</div>
        ) : (
          <ul className="ak-rows">
            {keys.map((k) => (
              <li key={k.id} data-active={k.active}>
                <div className="ak-row-main">
                  <div className="ak-row-title">
                    <strong>{k.name}</strong>
                    <span className="ak-badge" data-on={k.active}>
                      {k.active ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <code className="mono">{k.keyPrefix}…</code>
                  <p className="ak-row-meta muted">
                    Created {formatWhen(k.createdAt)}
                    {" · "}
                    {k.lastUsedAt
                      ? `Last used ${formatWhen(k.lastUsedAt)}`
                      : "Never used"}
                  </p>
                </div>
                {k.active ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => void revoke(k.id, k.name)}
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ak-block ak-test">
        <div className="ak-block-head">
          <h2>Test</h2>
          <span className="mono">POST /create-session → POST /chat</span>
        </div>
        <p className="ak-test-hint muted">
          Counts against your plan RPM. Paste a full <code>fga_…</code> key
          (prefix alone will not work).
        </p>
        <div className="ak-test-fields">
          <label className="field">
            <span className="field-label">
              API key
              <button
                type="button"
                className="ak-link"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </span>
            <input
              className="mono"
              type={showKey ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="fga_…"
              value={testKey}
              onChange={(e) => setTestKey(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Prompt</span>
            <textarea
              className="ak-prompt"
              rows={3}
              maxLength={2000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
        </div>
        <div className="ak-test-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={testing || !testKey.trim() || !prompt.trim()}
            onClick={runTest}
          >
            {testing ? "Running…" : "Send"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={testing || (!reply && !testError)}
            onClick={() => {
              setReply(null);
              setTestError(null);
              setElapsed(null);
            }}
          >
            Clear output
          </button>
          {elapsed != null && !testError ? (
            <span className="ak-elapsed mono">{elapsed}ms</span>
          ) : null}
        </div>
        <pre
          className="ak-out"
          data-tone={testError ? "error" : reply ? "ok" : "idle"}
        >
          {testError
            ? testError
            : reply
              ? reply
              : testing
                ? "Calling API…"
                : "Response will show here."}
        </pre>
      </section>
    </div>
  );
}
