const { Elysia } = require("elysia");
const { node } = require("@elysiajs/node");
const { cors } = require("@elysiajs/cors");
const { registerDocsRoutes } = require("./routes/docs.routes");
const { registerChatRoutes } = require("./routes/chat.routes");
const { registerAuthRoutes } = require("./routes/auth.routes");
const { registerBillingRoutes } = require("./routes/billing.routes");
const { registerAdminRoutes } = require("./routes/admin.routes");
const { registerStaticSite } = require("./static");
const { initAppDb } = require("./db/app-db");

function buildServer() {
  // Ensure SaaS tables exist before the first auth/billing request.
  initAppDb().catch(() => {});

  const app = new Elysia({ adapter: node() }).use(
    cors({
      origin: true,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-FGA-Key",
        "Stripe-Signature",
      ],
      credentials: true,
      maxAge: 86400,
    }),
  );

  // Order matters: the static site is a catch-all, so it must come after every
  // API route or it would swallow them.
  return registerStaticSite(
    registerAdminRoutes(
      registerBillingRoutes(
        registerAuthRoutes(registerDocsRoutes(registerChatRoutes(app))),
      ),
    ),
  );
}

module.exports = {
  buildServer,
};
