const {
  publicPlanCatalog,
  createCheckoutSession,
  createBillingPortal,
  cancelSubscription,
  handleStripeWebhook,
} = require("../services/stripe-billing");
const { getSubscriptionForUser } = require("../services/user-store");
const { requireUser } = require("./auth.routes");

function registerBillingRoutes(app) {
  return app
    .get("/plans", () => publicPlanCatalog())
    .post("/billing/checkout", async ({ request, body, set }) => {
      const gate = await requireUser(request, set, {});
      if (gate.error) return gate.error;
      const result = await createCheckoutSession(gate.caller.user, body?.planId);
      if (!result.ok) {
        set.status = result.status || 400;
        return result;
      }
      return result;
    })
    .post("/billing/portal", async ({ request, set }) => {
      const gate = await requireUser(request, set, {});
      if (gate.error) return gate.error;
      const result = await createBillingPortal(gate.caller.user);
      if (!result.ok) {
        set.status = result.status || 400;
        return result;
      }
      return result;
    })
    .post("/billing/cancel", async ({ request, body, set }) => {
      const gate = await requireUser(request, set, {});
      if (gate.error) return gate.error;
      const result = await cancelSubscription(gate.caller.user, {
        atPeriodEnd: body?.atPeriodEnd !== false,
      });
      if (!result.ok) {
        set.status = result.status || 400;
        return result;
      }
      return result;
    })
    .get("/billing/subscription", async ({ request, set }) => {
      const gate = await requireUser(request, set, {});
      if (gate.error) return gate.error;
      const subscription = await getSubscriptionForUser(gate.caller.user.id);
      return { ok: true, subscription, user: gate.caller.user };
    })
    .post("/billing/webhook", async ({ request, set }) => {
      const signature = request.headers.get("stripe-signature") || "";
      const rawBody = Buffer.from(await request.arrayBuffer());
      const result = await handleStripeWebhook(rawBody, signature);
      if (!result.ok) {
        set.status = result.status || 400;
        return result;
      }
      return { received: true, duplicate: Boolean(result.duplicate) };
    });
}

module.exports = {
  registerBillingRoutes,
};
