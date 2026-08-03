"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DashboardShell,
  type DashSection,
} from "@/components/DashboardShell";
import { RateRing, UsageChart } from "@/components/UsageChart";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { ToastProvider, useToast } from "@/components/Toast";
import {
  cancelBilling,
  confirm2fa,
  disable2fa,
  fetchMe,
  fetchUsage,
  listApiKeys,
  logoutAccount,
  openBillingPortal,
  setup2fa,
  type PublicUser,
  type Subscription,
} from "@/lib/auth";
import { MAX_API_KEYS } from "@/lib/limits";

type KeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  active: boolean;
};

type UsagePayload = Awaited<ReturnType<typeof fetchUsage>>;

function AccountInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [section, setSection] = useState<DashSection>("overview");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [keyMeta, setKeyMeta] = useState({ active: 0, max: MAX_API_KEYS });
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [qr, setQr] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disablePw, setDisablePw] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    if (!me) {
      router.replace("/login/");
      return;
    }
    setUser(me.user);
    setSubscription(me.subscription);
    const [keyData, usageData] = await Promise.all([listApiKeys(), fetchUsage()]);
    setKeys(keyData.keys);
    setKeyMeta({ active: keyData.active, max: keyData.max });
    setUsage(usageData);
  }, [router]);

  useEffect(() => {
    refresh().catch((err) =>
      toast.error(err instanceof Error ? err.message : "Failed to load account."),
    );
    if (params.get("checkout") === "success") {
      toast.ok("Checkout completed. Plan updates after the Stripe webhook.");
      setSection("billing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast once on mount/params
  }, [params, refresh]);

  useEffect(() => {
    if (section !== "overview") return;
    const id = window.setInterval(() => {
      fetchUsage()
        .then(setUsage)
        .catch(() => {});
    }, 15_000);
    return () => window.clearInterval(id);
  }, [section]);

  async function run(fn: () => Promise<void>, okMessage?: string) {
    setBusy(true);
    try {
      await fn();
      if (okMessage) toast.ok(okMessage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="dash dash-loading">
        <p className="kicker">Account</p>
        <p>Loading dashboard…</p>
      </div>
    );
  }

  const rate = usage?.rate;
  const used = rate?.used ?? 0;
  const limit = rate?.limit ?? user.planRpm;

  return (
    <DashboardShell
      section={section}
      onSection={setSection}
      userLabel={user.name || user.email}
      planLabel={user.plan}
      rpm={user.planRpm}
      isAdmin={user.role === "admin"}
      onLogout={() =>
        run(async () => {
          await logoutAccount();
          router.push("/");
        })
      }
    >
      {section === "overview" ? (
        <div className="dash-grid">
          <section className="dash-card dash-card-rate" data-dash-animate>
            <header className="dash-card-head">
              <h2>Rate limit</h2>
              <span className="dash-chip">{user.plan}</span>
            </header>
            <div className="dash-rate-row">
              <RateRing used={used} limit={limit} />
              <div className="dash-rate-copy">
                <p>
                  Current window: <b>{used}</b> of <b>{limit}</b> req/min
                </p>
                <p className="muted">
                  Remaining{" "}
                  <b className="ink">{rate?.remaining ?? limit - used}</b>
                  {rate?.resetAt ? (
                    <>
                      {" "}
                      · resets {new Date(rate.resetAt).toLocaleTimeString()}
                    </>
                  ) : (
                    " · window idle"
                  )}
                </p>
                <div className="dash-meta-row">
                  <span className="dash-meta">
                    Endpoint <code>/chat</code>
                  </span>
                  <span className="dash-meta">Window 60s</span>
                </div>
                <Link href="/pricing/" className="btn btn-ghost">
                  Upgrade plan
                </Link>
              </div>
            </div>
          </section>

          <section className="dash-card" data-dash-animate>
            <header className="dash-card-head">
              <h2>Today</h2>
              <span className="muted mono">UTC local</span>
            </header>
            <p className="dash-stat">
              {(usage?.usage.todayTotal ?? 0).toLocaleString()}
              <small>chat requests</small>
            </p>
            <div className="dash-split">
              <div>
                <span className="dash-split-label">Last 24h</span>
                <strong>
                  {(usage?.usage.last24hTotal ?? 0).toLocaleString()}
                </strong>
              </div>
              <div>
                <span className="dash-split-label">Avg / hour</span>
                <strong>
                  {Math.round(
                    (usage?.usage.last24hTotal ?? 0) /
                      Math.max(1, usage?.usage.hours ?? 24),
                  ).toLocaleString()}
                </strong>
              </div>
            </div>
          </section>

          <section className="dash-card" data-dash-animate>
            <header className="dash-card-head">
              <h2>API keys</h2>
              <span className="dash-pill" data-on={keyMeta.active > 0}>
                {keyMeta.active > 0 ? "Ready" : "None"}
              </span>
            </header>
            <p className="dash-stat">
              {keyMeta.active}
              <small>/ {keyMeta.max} active</small>
            </p>
            <div className="dash-progress">
              <span
                style={{
                  width: `${Math.min(100, (keyMeta.active / keyMeta.max) * 100)}%`,
                }}
              />
            </div>
            <p className="muted dash-tiny">
              Cap {MAX_API_KEYS} · header <code>X-API-Key</code>
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSection("keys")}
            >
              Manage keys
            </button>
          </section>

          <section className="dash-card dash-card-wide" data-dash-animate>
            <header className="dash-card-head">
              <h2>Usage · 24 hours</h2>
              <span className="muted mono">chat endpoint</span>
            </header>
            <UsageChart
              data={usage?.usage.hourly ?? []}
              label="Requests / hour"
              height={180}
              emptyHint="No chat traffic yet. Hit /chat with your API key to start filling this graph."
            />
          </section>

          <section className="dash-card dash-card-wide" data-dash-animate>
            <header className="dash-card-head">
              <h2>Last 60 minutes</h2>
              <span className="muted mono">per minute</span>
            </header>
            <UsageChart
              data={usage?.usage.lastHour ?? []}
              label="Requests / minute"
              height={120}
              emptyHint="Live window — updates as authenticated /chat calls land."
            />
          </section>
        </div>
      ) : null}

      {section === "keys" ? (
        <ApiKeysPanel
          keys={keys}
          active={keyMeta.active}
          max={keyMeta.max}
          onChanged={refresh}
        />
      ) : null}

      {section === "security" ? (
        <div className="dash-stack">
          <section className="dash-card" data-dash-animate>
            <header className="dash-card-head">
              <h2>Two-factor authentication</h2>
              <span className="dash-pill" data-on={user.totpEnabled}>
                {user.totpEnabled ? "On" : "Off"}
              </span>
            </header>
            {!user.totpEnabled ? (
              <>
                <p className="muted">
                  Protect sign-in with a TOTP app (Authy, 1Password, Google
                  Authenticator).
                </p>
                {!qr ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const data = await setup2fa();
                        setQr({ secret: data.secret, qrDataUrl: data.qrDataUrl });
                      })
                    }
                  >
                    Set up 2FA
                  </button>
                ) : (
                  <div className="totp-setup">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr.qrDataUrl} alt="2FA QR code" width={180} height={180} />
                    <p className="mono muted">Secret: {qr.secret}</p>
                    <label className="field">
                      <span className="field-label">Confirm code</span>
                      <input
                        value={totpCode}
                        maxLength={8}
                        inputMode="numeric"
                        onChange={(e) => setTotpCode(e.target.value.slice(0, 8))}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await confirm2fa(totpCode);
                          setQr(null);
                          setTotpCode("");
                          await refresh();
                        }, "2FA enabled.")
                      }
                    >
                      Enable
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="totp-setup">
                <p className="muted">Enter password and a current code to disable.</p>
                <label className="field">
                  <span className="field-label">Password</span>
                  <input
                    type="password"
                    value={disablePw}
                    maxLength={72}
                    onChange={(e) => setDisablePw(e.target.value.slice(0, 72))}
                  />
                </label>
                <label className="field">
                  <span className="field-label">2FA code</span>
                  <input
                    value={disableCode}
                    maxLength={8}
                    inputMode="numeric"
                    onChange={(e) => setDisableCode(e.target.value.slice(0, 8))}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await disable2fa(disablePw, disableCode);
                      setDisablePw("");
                      setDisableCode("");
                      await refresh();
                    }, "2FA disabled.")
                  }
                >
                  Disable 2FA
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {section === "billing" ? (
        <div className="dash-stack">
          <section className="dash-card" data-dash-animate>
            <header className="dash-card-head">
              <h2>Plan</h2>
              <span className="mono">{user.plan}</span>
            </header>
            <p className="dash-stat">
              {user.planRpm.toLocaleString()}
              <small>req / minute</small>
            </p>
            {subscription ? (
              <p className="muted">
                Status <b>{subscription.status}</b>
                {subscription.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                {subscription.currentPeriodEnd
                  ? ` · period ends ${new Date(subscription.currentPeriodEnd).toLocaleString()}`
                  : ""}
              </p>
            ) : (
              <p className="muted">No active paid subscription.</p>
            )}
            <div className="dash-actions">
              <Link href="/pricing/" className="btn btn-primary">
                Change plan
              </Link>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const { url } = await openBillingPortal();
                    window.location.href = url;
                  })
                }
              >
                Stripe portal
              </button>
              {subscription && !subscription.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await cancelBilling(true);
                      await refresh();
                    }, "Subscription will cancel at period end.")
                  }
                >
                  Cancel at period end
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </DashboardShell>
  );
}

export default function AccountPage() {
  return (
    <ToastProvider>
      <Suspense
        fallback={
          <div className="dash dash-loading">
            <p>Loading…</p>
          </div>
        }
      >
        <AccountInner />
      </Suspense>
    </ToastProvider>
  );
}
