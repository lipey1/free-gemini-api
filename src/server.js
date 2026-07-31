const { Elysia } = require("elysia");
const { node } = require("@elysiajs/node");
const { cors } = require("@elysiajs/cors");
const { registerDocsRoutes } = require("./routes/docs.routes");
const { registerChatRoutes } = require("./routes/chat.routes");
const { registerStaticSite } = require("./static");

function buildServer() {
  const app = new Elysia({ adapter: node() }).use(
    cors({
      origin: true, // reflete a origem que chamou
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );

  // Order matters: the static site is a catch-all, so it must come after every
  // API route or it would swallow them.
  return registerStaticSite(registerDocsRoutes(registerChatRoutes(app)));
}

module.exports = {
  buildServer,
};
