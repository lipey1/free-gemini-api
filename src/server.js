const { Elysia } = require("elysia");
const { node } = require("@elysiajs/node");
const { registerDocsRoutes } = require("./routes/docs.routes");
const { registerChatRoutes } = require("./routes/chat.routes");

function buildServer() {
  const app = new Elysia({ adapter: node() });
  return registerDocsRoutes(registerChatRoutes(app));
}

module.exports = {
  buildServer,
};
