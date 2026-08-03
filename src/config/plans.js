/**
 * SaaS plan catalog. Stripe Price IDs come from env.
 *
 * Free → Pro → Mega → Max (R$25) → Ultra (R$75, most bought).
 */
const PLANS = {
  free: {
    id: "free",
    name: "Free",
    rpm: 20,
    priceBrlCents: 0,
    priceUsdCents: 0,
    stripePriceEnv: null,
    highlight: false,
    popular: false,
    features: [
      "20 requests / minute",
      "Shared Gemini session proxy",
      "Community support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    rpm: 100,
    priceBrlCents: 500,
    priceUsdCents: 300,
    stripePriceEnv: "STRIPE_PRICE_PRO",
    highlight: false,
    popular: false,
    features: ["100 requests / minute", "API key", "Email support"],
  },
  mega: {
    id: "mega",
    name: "Mega",
    rpm: 250,
    priceBrlCents: 1500,
    priceUsdCents: 900,
    stripePriceEnv: "STRIPE_PRICE_MEGA",
    highlight: false,
    popular: false,
    features: ["250 requests / minute", "API key", "Priority support"],
  },
  max: {
    id: "max",
    name: "Max",
    rpm: 1_000,
    priceBrlCents: 2500,
    priceUsdCents: 1500,
    stripePriceEnv: "STRIPE_PRICE_MAX",
    highlight: false,
    popular: false,
    features: ["1.000 requests / minute", "API key", "Priority support"],
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    rpm: 10_000,
    priceBrlCents: 7500,
    priceUsdCents: 4500,
    stripePriceEnv: "STRIPE_PRICE_ULTRA",
    highlight: true,
    popular: true,
    features: ["10.000 requests / minute", "API key", "Priority support"],
  },
};

const PLAN_ORDER = ["free", "pro", "mega", "max", "ultra"];

function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

function listPlans() {
  return PLAN_ORDER.map((id) => {
    const plan = PLANS[id];
    return {
      ...plan,
      priceBrl: plan.priceBrlCents / 100,
      priceUsd: plan.priceUsdCents / 100,
      stripePriceId: plan.stripePriceEnv
        ? String(process.env[plan.stripePriceEnv] || "").trim() || null
        : null,
    };
  });
}

function planIdFromStripePrice(priceId) {
  if (!priceId) return null;
  for (const id of PLAN_ORDER) {
    const envName = PLANS[id].stripePriceEnv;
    if (!envName) continue;
    if (String(process.env[envName] || "").trim() === priceId) return id;
  }
  return null;
}

function formatBrl(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents || 0) / 100);
}

module.exports = {
  PLANS,
  PLAN_ORDER,
  getPlan,
  listPlans,
  planIdFromStripePrice,
  formatBrl,
};
