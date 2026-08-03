/**
 * Account / billing / admin client. Always sends credentials so the HttpOnly
 * auth cookie rides along on same-origin requests.
 */

import { API_BASE } from "./api";

export type PlanId = "free" | "pro" | "mega" | "max" | "ultra";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  plan: PlanId;
  planRpm: number;
  totpEnabled: boolean;
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Plan = {
  id: PlanId;
  name: string;
  rpm: number;
  priceBrl: number;
  priceBrlCents: number;
  priceUsd: number;
  priceUsdCents: number;
  highlight: boolean;
  popular: boolean;
  features: string[];
  checkoutAvailable: boolean;
};

export type Subscription = {
  id: string;
  plan: PlanId;
  status: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
} | null;

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fieldErrors =
      data?.errors && typeof data.errors === "object"
        ? (data.errors as Record<string, string>)
        : undefined;
    const message =
      data?.error ||
      (fieldErrors && Object.values(fieldErrors)[0]) ||
      `HTTP ${res.status}`;
    const err = new Error(message) as Error & {
      code?: string;
      status?: number;
      errors?: Record<string, string>;
      totpRequired?: boolean;
    };
    err.code = data?.code;
    err.status = res.status;
    err.errors = fieldErrors;
    err.totpRequired = data?.totpRequired;
    throw err;
  }
  return data;
}

function opts(init: RequestInit = {}): RequestInit {
  return {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    ...init,
  };
}

export async function fetchMe(): Promise<{
  user: PublicUser;
  subscription: Subscription;
} | null> {
  const res = await fetch(`${API_BASE}/auth/me`, opts());
  if (res.status === 401) return null;
  const data = await parse(res);
  return { user: data.user, subscription: data.subscription };
}

export async function registerAccount(input: {
  email: string;
  password: string;
  name?: string;
}) {
  return parse(
    await fetch(
      `${API_BASE}/auth/register`,
      opts({ method: "POST", body: JSON.stringify(input) }),
    ),
  );
}

export async function loginAccount(input: {
  email: string;
  password: string;
  totpCode?: string;
}) {
  return parse(
    await fetch(
      `${API_BASE}/auth/login`,
      opts({ method: "POST", body: JSON.stringify(input) }),
    ),
  );
}

export async function logoutAccount() {
  return parse(
    await fetch(`${API_BASE}/auth/logout`, opts({ method: "POST", body: "{}" })),
  );
}

export async function forgotPassword(email: string) {
  return parse(
    await fetch(
      `${API_BASE}/auth/forgot-password`,
      opts({ method: "POST", body: JSON.stringify({ email }) }),
    ),
  );
}

export async function resetPassword(token: string, password: string) {
  return parse(
    await fetch(
      `${API_BASE}/auth/reset-password`,
      opts({ method: "POST", body: JSON.stringify({ token, password }) }),
    ),
  );
}

export async function fetchPlans(): Promise<{
  plans: Plan[];
  stripeEnabled: boolean;
}> {
  const data = await parse(await fetch(`${API_BASE}/plans`, opts()));
  return { plans: data.plans, stripeEnabled: data.stripeEnabled };
}

export async function startCheckout(planId: PlanId) {
  return parse(
    await fetch(
      `${API_BASE}/billing/checkout`,
      opts({ method: "POST", body: JSON.stringify({ planId }) }),
    ),
  ) as Promise<{ ok: true; url: string }>;
}

export async function openBillingPortal() {
  return parse(
    await fetch(`${API_BASE}/billing/portal`, opts({ method: "POST", body: "{}" })),
  ) as Promise<{ ok: true; url: string }>;
}

export async function cancelBilling(atPeriodEnd = true) {
  return parse(
    await fetch(
      `${API_BASE}/billing/cancel`,
      opts({ method: "POST", body: JSON.stringify({ atPeriodEnd }) }),
    ),
  );
}

export async function listApiKeys() {
  const data = await parse(await fetch(`${API_BASE}/account/api-keys`, opts()));
  return data as {
    ok: true;
    keys: Array<{
      id: string;
      name: string;
      keyPrefix: string;
      createdAt: number;
      lastUsedAt: number | null;
      revokedAt: number | null;
      active: boolean;
    }>;
    active: number;
    max: number;
  };
}

export async function fetchUsage() {
  const data = await parse(await fetch(`${API_BASE}/account/usage`, opts()));
  return data as {
    ok: true;
    rate: {
      used: number;
      remaining: number | null;
      limit: number;
      windowSeconds: number;
      resetAt: number | null;
      planId: PlanId;
    };
    keys: { active: number; max: number };
    usage: {
      hourly: Array<{ ts: number; count: number }>;
      lastHour: Array<{ ts: number; count: number }>;
      todayTotal: number;
      last24hTotal: number;
      hours: number;
    };
  };
}

export async function createApiKey(name: string) {
  return parse(
    await fetch(
      `${API_BASE}/account/api-keys`,
      opts({ method: "POST", body: JSON.stringify({ name }) }),
    ),
  ) as Promise<{
    ok: true;
    key: { id: string; name: string; keyPrefix: string; key: string; createdAt: number };
    warning: string;
  }>;
}

export async function revokeApiKey(id: string) {
  return parse(
    await fetch(
      `${API_BASE}/account/api-keys/${id}/revoke`,
      opts({ method: "POST", body: "{}" }),
    ),
  );
}

export async function setup2fa() {
  return parse(
    await fetch(`${API_BASE}/auth/2fa/setup`, opts({ method: "POST", body: "{}" })),
  ) as Promise<{ ok: true; secret: string; qrDataUrl: string; otpauth: string }>;
}

export async function confirm2fa(code: string) {
  return parse(
    await fetch(
      `${API_BASE}/auth/2fa/confirm`,
      opts({ method: "POST", body: JSON.stringify({ code }) }),
    ),
  );
}

export async function disable2fa(password: string, totpCode: string) {
  return parse(
    await fetch(
      `${API_BASE}/auth/2fa/disable`,
      opts({ method: "POST", body: JSON.stringify({ password, totpCode }) }),
    ),
  );
}

export async function adminListUsers(q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const data = await parse(await fetch(`${API_BASE}/admin/users${qs}`, opts()));
  return data as { ok: true; users: PublicUser[]; total: number };
}

export async function adminPatchUser(
  id: string,
  patch: Partial<{ name: string; role: string; plan: PlanId; disabled: boolean }>,
) {
  return parse(
    await fetch(
      `${API_BASE}/admin/users/${id}`,
      opts({ method: "PATCH", body: JSON.stringify(patch) }),
    ),
  );
}
