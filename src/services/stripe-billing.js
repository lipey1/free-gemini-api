const Stripe = require("stripe");
const crypto = require("node:crypto");
const { listPlans, getPlan, planIdFromStripePrice } = require("../config/plans");
const {
  findUserById,
  updateUserFields,
  upsertSubscription,
  getSubscriptionForUser,
  markStripeEventProcessed,
} = require("./user-store");
const { publicBaseUrl } = require("./mail");

function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return null;
  return new Stripe(key);
}

function stripeConfigured() {
  return Boolean(String(process.env.STRIPE_SECRET_KEY || "").trim());
}

async function ensureCustomer(user) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  if (user.stripe_customer_id || user.stripeCustomerId) {
    return user.stripe_customer_id || user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: user.id },
  });

  await updateUserFields(user.id, { stripeCustomerId: customer.id });
  return customer.id;
}

async function createCheckoutSession(user, planId) {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, status: 503, code: "STRIPE_NOT_CONFIGURED", error: "Pagamentos não configurados." };
  }

  const plan = getPlan(planId);
  if (!plan || plan.id === "free" || !plan.stripePriceEnv) {
    return { ok: false, status: 400, code: "INVALID_PLAN", error: "Plano inválido para checkout." };
  }

  const priceId = String(process.env[plan.stripePriceEnv] || "").trim();
  if (!priceId) {
    return {
      ok: false,
      status: 503,
      code: "STRIPE_PRICE_MISSING",
      error: `Price ID do plano ${plan.id} não configurado (${plan.stripePriceEnv}).`,
    };
  }

  const full = await findUserById(user.id);
  const customerId = await ensureCustomer(full);
  const base = publicBaseUrl();

  const sessionParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/account/?checkout=success&plan=${plan.id}`,
    cancel_url: `${base}/pricing/?checkout=cancel`,
    client_reference_id: user.id,
    metadata: { userId: user.id, planId: plan.id },
    subscription_data: {
      metadata: { userId: user.id, planId: plan.id },
    },
  };

  // Optional on API ≥ 2026-03-25.dahlia; ignore if the account rejects it.
  try {
    sessionParams.integration_identifier = `fga_sub_${crypto.randomBytes(4).toString("hex")}`;
  } catch {
    /* noop */
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    if (sessionParams.integration_identifier && /integration_identifier/i.test(err.message)) {
      delete sessionParams.integration_identifier;
      session = await stripe.checkout.sessions.create(sessionParams);
    } else {
      throw err;
    }
  }

  return { ok: true, url: session.url, sessionId: session.id };
}

async function createBillingPortal(user) {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, status: 503, code: "STRIPE_NOT_CONFIGURED", error: "Pagamentos não configurados." };
  }

  const full = await findUserById(user.id);
  if (!full?.stripe_customer_id) {
    return {
      ok: false,
      status: 400,
      code: "NO_CUSTOMER",
      error: "Nenhuma assinatura encontrada para gerenciar.",
    };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: full.stripe_customer_id,
    return_url: `${publicBaseUrl()}/account/`,
  });

  return { ok: true, url: session.url };
}

async function cancelSubscription(user, { atPeriodEnd = true } = {}) {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, status: 503, code: "STRIPE_NOT_CONFIGURED", error: "Pagamentos não configurados." };
  }

  const sub = await getSubscriptionForUser(user.id);
  if (!sub?.stripeSubscriptionId) {
    return {
      ok: false,
      status: 400,
      code: "NO_SUBSCRIPTION",
      error: "Você não tem uma assinatura ativa.",
    };
  }

  if (atPeriodEnd) {
    const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await syncSubscriptionRecord(updated, user.id);
    return { ok: true, cancelAtPeriodEnd: true, subscription: await getSubscriptionForUser(user.id) };
  }

  const canceled = await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  await syncSubscriptionRecord(canceled, user.id);
  return { ok: true, cancelAtPeriodEnd: false, subscription: await getSubscriptionForUser(user.id) };
}

async function syncSubscriptionRecord(subscription, fallbackUserId) {
  const userId =
    subscription.metadata?.userId ||
    fallbackUserId ||
    null;
  if (!userId) return;

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const plan =
    subscription.metadata?.planId ||
    planIdFromStripePrice(priceId) ||
    "free";

  const periodEnd = subscription.current_period_end
    ? subscription.current_period_end * 1000
    : null;

  await upsertSubscription({
    userId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    plan,
    status: subscription.status,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  });
}

async function handleStripeWebhook(rawBody, signature) {
  const stripe = getStripe();
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!stripe || !secret) {
    return { ok: false, status: 503, code: "STRIPE_NOT_CONFIGURED" };
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    return { ok: false, status: 400, code: "WEBHOOK_SIGNATURE_INVALID", error: err.message };
  }

  const first = await markStripeEventProcessed(event.id, event.type);
  if (!first) {
    return { ok: true, duplicate: true };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await syncSubscriptionRecord(sub, session.metadata?.userId || session.client_reference_id);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscriptionRecord(event.data.object);
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      if (invoice.subscription) {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        await syncSubscriptionRecord(sub);
      }
      break;
    }
    default:
      break;
  }

  return { ok: true };
}

function publicPlanCatalog() {
  return {
    ok: true,
    currency: "BRL",
    stripeEnabled: stripeConfigured(),
    plans: listPlans().map((p) => ({
      id: p.id,
      name: p.name,
      rpm: p.rpm,
      priceBrl: p.priceBrl,
      priceBrlCents: p.priceBrlCents,
      priceUsd: p.priceUsd,
      priceUsdCents: p.priceUsdCents,
      highlight: Boolean(p.highlight),
      popular: Boolean(p.popular),
      features: p.features,
      checkoutAvailable: p.id !== "free" && Boolean(p.stripePriceId) && stripeConfigured(),
    })),
  };
}

module.exports = {
  getStripe,
  stripeConfigured,
  createCheckoutSession,
  createBillingPortal,
  cancelSubscription,
  handleStripeWebhook,
  publicPlanCatalog,
  syncSubscriptionRecord,
};
