require("dotenv").config();

const { buildServer } = require("./src/server");
const { execSync } = require("node:child_process");
const net = require("node:net");
const logger = require("./src/utils/logger");

const PORT = Number(process.env.PORT || 3333);
const app = buildServer();

function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once("error", (err) => {
      probe.close();
      reject(err);
    });

    probe.once("listening", () => {
      probe.close(() => resolve());
    });

    probe.listen({ port, host: "0.0.0.0", exclusive: true });
  });
}

function isPortListening(port) {
  try {
    if (process.platform === "win32") {
      const output = execSync("netstat -ano -p tcp", { encoding: "utf8" });
      return output
        .split(/\r?\n/)
        .some(
          (line) =>
            line.includes("LISTENING") &&
            (line.includes(`:${port} `) || line.trimEnd().endsWith(`:${port}`)),
        );
    }

    const output = execSync("netstat -an -p tcp", { encoding: "utf8" });
    return output
      .split(/\r?\n/)
      .some((line) => line.includes("LISTEN") && line.includes(`:${port} `));
  } catch {
    return false;
  }
}

async function start() {
  try {
    if (isPortListening(PORT)) {
      throw Object.assign(
        new Error(`Porta ${PORT} já está em uso por outro processo.`),
        { code: "EADDRINUSE" },
      );
    }

    await assertPortAvailable(PORT);
    const runtime = await app.listen(PORT);
    const address = runtime?.server?.address?.();
    const boundPort =
      address && typeof address === "object" && "port" in address
        ? address.port
        : PORT;

    logger.success(`API Elysia online em http://localhost:${boundPort}`);
  } catch (err) {
    if (err && (err.code === "EADDRINUSE" || err.code === "EACCES")) {
      logger.error(
        `Falha ao iniciar: porta ${PORT} indisponível (${err.code}). Feche o processo que está usando a porta ou defina PORT.`,
      );
      process.exit(1);
      return;
    }

    logger.error(`Falha ao iniciar servidor: ${err?.message || String(err)}`);
    process.exit(1);
  }
}

start();
process.stdin.resume();

function shutdown(signal) {
  logger.warn(`Recebido ${signal}. Encerrando API...`);
  if (app?.stop) {
    app.stop();
  }
  logger.info("Servidor encerrado.");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
