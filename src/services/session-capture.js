const fs = require("node:fs/promises");
const path = require("node:path");
const {
  GEMINI_URL_TEMPLATE,
  GEMINI_BODY_TEMPLATE,
  GEMINI_HEADERS,
} = require("../config/gemini");
const { warmupSession } = require("./gemini-client");
const logger = require("../utils/logger");

async function readDefaultPrompt() {
  const file = path.resolve(__dirname, "../config/default_prompt.txt");
  try {
    const raw = await fs.readFile(file, "utf8");
    const trimmed = raw.trim();
    return trimmed || "Ola!";
  } catch {
    return "Ola!";
  }
}

function buildBaseSnapshot(seedPromptEncoded) {
  const headers = { ...GEMINI_HEADERS };
  if (headers.Referer && !headers.referer) {
    headers.referer = headers.Referer;
  }
  delete headers.Referer;

  return {
    urlTemplate: GEMINI_URL_TEMPLATE,
    headers,
    bodyTemplate: GEMINI_BODY_TEMPLATE,
    promptMarkerEncoded: seedPromptEncoded,
    createdAt: new Date().toISOString(),
  };
}

async function captureGeminiSession() {
  const seedPrompt = await readDefaultPrompt();
  const seedPromptEncoded = `%5C%22${encodeURIComponent(seedPrompt)}%5C%22`;
  const draft = buildBaseSnapshot(seedPromptEncoded);

  logger.info(
    "Criando sessão: POST StreamGenerate (cookies extraídos da resposta)...",
  );
  return warmupSession(draft, seedPrompt);
}

module.exports = {
  captureGeminiSession,
};
