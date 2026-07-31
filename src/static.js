const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const logger = require("./utils/logger");

/**
 * Serves the statically exported Next.js site (web/out) from the same process
 * as the API, so the whole thing ships as one container.
 *
 * This runs as a fallback: it is registered after every API route, so real
 * endpoints always win and only unmatched GETs reach the filesystem.
 */

const SITE_DIR = path.resolve(
  __dirname,
  "..",
  process.env.SITE_DIR || "web/out",
);

/** Paths owned by the API. Never resolved against the filesystem. */
const API_PREFIXES = [
  "/health",
  "/create-session",
  "/chat",
  "/session",
  "/docs",
  "/openapi.json",
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function siteAvailable() {
  return fs.existsSync(path.join(SITE_DIR, "index.html"));
}

/**
 * Map a URL path to a file inside SITE_DIR, or null when it escapes the
 * directory or does not exist. Next's export writes `foo/index.html` for the
 * route `/foo` (trailingSlash: true), so directories resolve to their index.
 */
async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath);

  // Reject traversal before touching the filesystem.
  if (decoded.includes("\0")) return null;

  const candidate = path.resolve(SITE_DIR, "." + decoded);
  const rel = path.relative(SITE_DIR, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;

  const attempts = [];
  if (path.extname(candidate)) {
    attempts.push(candidate);
  } else {
    attempts.push(path.join(candidate, "index.html"), candidate + ".html");
  }

  for (const file of attempts) {
    try {
      const stat = await fsp.stat(file);
      if (stat.isFile()) return { file, stat };
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

function cacheControl(urlPath) {
  // Hashed build assets are immutable; HTML must always be revalidated.
  if (urlPath.startsWith("/_next/static/")) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=0, must-revalidate";
}

function registerStaticSite(app) {
  if (!siteAvailable()) {
    logger.warn?.(
      `[static] ${SITE_DIR} has no index.html. Run "npm run build:web" to serve the site. API routes still work.`,
    );
    return app.get("/", () => ({
      ok: true,
      message: "Free Gemini API online (site not built)",
      hint: 'Run "npm run build:web" to serve the landing page at /',
      health: "/health",
      docs: "/docs",
    }));
  }

  /**
   * The exported site is a few hundred KB of small files, so each one is read
   * into a Buffer and cached. A Node ReadStream is not a valid Response body
   * here: the web Response constructor rejects it and the request dies.
   */
  const cache = new Map();

  async function readCached(file, size, mtimeMs) {
    const hit = cache.get(file);
    if (hit && hit.size === size && hit.mtimeMs === mtimeMs) return hit.body;
    const body = await fsp.readFile(file);
    cache.set(file, { body, size, mtimeMs });
    return body;
  }

  const send = async ({ request, set }) => {
    const urlPath = new URL(request.url).pathname;

    if (API_PREFIXES.some((p) => urlPath === p || urlPath.startsWith(p + "/"))) {
      set.status = 404;
      return { ok: false, code: "NOT_FOUND", error: `No route for ${urlPath}.` };
    }

    try {
      let found = await resolveFile(urlPath);
      let status = 200;

      if (!found) {
        found = await resolveFile("/404");
        status = 404;
      }

      if (!found) {
        set.status = 404;
        return { ok: false, code: "NOT_FOUND", error: `No route for ${urlPath}.` };
      }

      const type =
        MIME[path.extname(found.file).toLowerCase()] || "application/octet-stream";
      const body = await readCached(found.file, found.stat.size, found.stat.mtimeMs);

      return new Response(body, {
        status,
        headers: {
          "content-type": type,
          "content-length": String(body.length),
          "cache-control": cacheControl(urlPath),
        },
      });
    } catch (err) {
      logger.error(`[static] ${urlPath}: ${err.message}`);
      set.status = 500;
      return { ok: false, code: "STATIC_READ_FAILED", error: "Could not read the site build." };
    }
  };

  return app.get("/", send).get("/*", send);
}

module.exports = {
  registerStaticSite,
  SITE_DIR,
  siteAvailable,
};
