import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

interface ParamsIncomingMessage extends IncomingMessage {
  params?: Record<string, string>;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const LOCALES_DIR = path.resolve(process.cwd(), "src", "locales");
const INDEX_HTML_PATH = path.join(PUBLIC_DIR, "index.html");

let cachedHtml: string | null = null;
const cachedRendered: Record<string, string> = {};
const cachedLocales: Record<string, any> = {};

export function clearLandingCache(): void {
  cachedHtml = null;
  for (const k of Object.keys(cachedRendered)) delete cachedRendered[k];
  for (const k of Object.keys(cachedLocales)) delete cachedLocales[k];
}

function getLandingHtml(): string {
  if (process.env.NODE_ENV === "production" && cachedHtml) {
    return cachedHtml;
  }
  if (fs.existsSync(INDEX_HTML_PATH)) {
    cachedHtml = fs.readFileSync(INDEX_HTML_PATH, "utf-8");
    return cachedHtml;
  }
  return "<h1>HuddlePace — 15-minute huddles that actually take 15 minutes</h1>";
}

export function getLocaleDictionary(lang: string): any {
  if (cachedLocales[lang]) return cachedLocales[lang];
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  if (fs.existsSync(file)) {
    try {
      cachedLocales[lang] = JSON.parse(fs.readFileSync(file, "utf-8"));
      return cachedLocales[lang];
    } catch {}
  }
  return null;
}

export function detectLanguage(req: IncomingMessage): { lang: "en" | "es"; explicitQuery: boolean } {
  // 1. Explicit query parameter ?lang=es or ?lang=en
  if (req.url) {
    try {
      const urlObj = new URL(req.url, "http://localhost");
      const qLang = urlObj.searchParams.get("lang");
      if (qLang === "es" || qLang === "en") {
        return { lang: qLang, explicitQuery: true };
      }
    } catch {}
  }

  // 2. Cookie huddlepace_lang=es or en
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)huddlepace_lang=(es|en)(?:;|$)/);
    if (match && (match[1] === "es" || match[1] === "en")) {
      return { lang: match[1] as "es" | "en", explicitQuery: false };
    }
  }

  // 3. RFC 9110 Accept-Language header
  const acceptLang = req.headers?.["accept-language"];
  if (acceptLang) {
    const primary = acceptLang.split(",")[0].trim().toLowerCase();
    if (primary.startsWith("es")) {
      return { lang: "es", explicitQuery: false };
    }
  }

  return { lang: "en", explicitQuery: false };
}

export function renderLocalizedHtml(baseHtml: string, lang: "en" | "es"): string {
  if (process.env.NODE_ENV === "production" && cachedRendered[lang]) {
    return cachedRendered[lang];
  }

  if (lang === "en") {
    if (process.env.NODE_ENV === "production") cachedRendered.en = baseHtml;
    return baseHtml;
  }

  const locale = getLocaleDictionary("es");
  if (!locale) return baseHtml;

  let html = baseHtml;

  // 1. Document Lang Attribute
  html = html.replace('<html lang="en">', '<html lang="es">');

  // 2. SEO Meta tags
  if (locale.meta) {
    if (locale.meta.title) {
      html = html.replace(/<title>.*?<\/title>/, `<title>${locale.meta.title}</title>`);
      html = html.replace(/<meta name="title" content=".*?">/, `<meta name="title" content="${locale.meta.title}">`);
    }
    if (locale.meta.description) {
      html = html.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${locale.meta.description}">`);
    }
    if (locale.meta.ogTitle) {
      html = html.replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${locale.meta.ogTitle}">`);
      html = html.replace(/<meta property="twitter:title" content=".*?">/, `<meta property="twitter:title" content="${locale.meta.ogTitle}">`);
    }
    if (locale.meta.ogDescription) {
      html = html.replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${locale.meta.ogDescription}">`);
      html = html.replace(/<meta property="twitter:description" content=".*?">/, `<meta property="twitter:description" content="${locale.meta.ogDescription}">`);
    }
  }

  // 3. Language button active class toggle
  html = html.replace('id="btn-en" class="lang-btn active"', 'id="btn-en" class="lang-btn"');
  html = html.replace('class="lang-btn active" id="btn-en"', 'class="lang-btn" id="btn-en"');
  html = html.replace('id="btn-es" class="lang-btn"', 'id="btn-es" class="lang-btn active"');
  html = html.replace('class="lang-btn" id="btn-es"', 'class="lang-btn active" id="btn-es"');

  // 4. Data-i18n tags replacement
  html = html.replace(/(<([a-z0-9]+)[^>]*?\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/gi, (match, openTag, tagName, key, oldContent, closeTag) => {
    const translation = locale[key];
    if (translation !== undefined) {
      return `${openTag}${translation}${closeTag}`;
    }
    return match;
  });

  if (process.env.NODE_ENV === "production") {
    cachedRendered.es = html;
  }
  return html;
}

export function handleLandingPage(req: IncomingMessage, res: ServerResponse): void {
  const { lang, explicitQuery } = detectLanguage(req);
  const baseHtml = getLandingHtml();
  const html = renderLocalizedHtml(baseHtml, lang);

  const headers: Record<string, string | number> = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
    "Content-Language": lang,
    "Vary": "Accept-Language, Cookie",
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };

  if (explicitQuery) {
    headers["Set-Cookie"] = `huddlepace_lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(html);
}

export function handleStaticAsset(
  req: ParamsIncomingMessage,
  res: ServerResponse,
  explicitFile?: string,
  subDir = ""
): void {
  const filename = explicitFile || req.params?.file;
  if (!filename) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Asset not found");
    return;
  }

  // Prevent directory traversal attacks
  const safeFilename = path.basename(filename);
  const safeSubdir = subDir ? path.basename(subDir) : "";
  const filePath = safeSubdir
    ? path.join(PUBLIC_DIR, "assets", safeSubdir, safeFilename)
    : path.join(PUBLIC_DIR, "assets", safeFilename);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Asset not found");
    return;
  }

  const ext = path.extname(safeFilename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": "public, max-age=86400, immutable",
    "X-Content-Type-Options": "nosniff",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
}

export function getWebCustomRoutes() {
  return [
    {
      path: "/",
      method: ["GET", "HEAD"],
      handler: handleLandingPage,
    },
    {
      path: "/assets/tech/:file",
      method: ["GET", "HEAD"],
      handler: (req: ParamsIncomingMessage, res: ServerResponse) => handleStaticAsset(req, res, undefined, "tech"),
    },
    {
      path: "/assets/:file",
      method: ["GET", "HEAD"],
      handler: (req: ParamsIncomingMessage, res: ServerResponse) => handleStaticAsset(req, res),
    },
    {
      path: "/favicon.ico",
      method: ["GET", "HEAD"],
      handler: (req: ParamsIncomingMessage, res: ServerResponse) => handleStaticAsset(req, res, "favicon.ico"),
    },
    {
      path: "/apple-touch-icon.png",
      method: ["GET", "HEAD"],
      handler: (req: ParamsIncomingMessage, res: ServerResponse) => handleStaticAsset(req, res, "apple-touch-icon.png"),
    },
  ];
}
