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

// Static pages served by the site, keyed by the URL path that serves them.
// `metaKey` is the top-level key in the locale JSON holding that page's SEO meta block.
const PAGES: Record<string, { file: string; metaKey: string }> = {
  "/": { file: "index.html", metaKey: "meta" },
  "/privacy": { file: "privacy.html", metaKey: "privacyMeta" },
  "/terms": { file: "terms.html", metaKey: "termsMeta" },
};

const cachedHtml: Record<string, string> = {};
const cachedRendered: Record<string, Record<string, string>> = {};
const cachedLocales: Record<string, any> = {};

export function clearLandingCache(): void {
  for (const k of Object.keys(cachedHtml)) delete cachedHtml[k];
  for (const k of Object.keys(cachedRendered)) delete cachedRendered[k];
  for (const k of Object.keys(cachedLocales)) delete cachedLocales[k];
}

function getPageHtml(pagePath: string): string {
  const page = PAGES[pagePath];
  if (!page) return "<h1>Not Found</h1>";

  if (process.env.NODE_ENV === "production" && cachedHtml[pagePath]) {
    return cachedHtml[pagePath];
  }

  const filePath = path.join(PUBLIC_DIR, page.file);
  if (!fs.existsSync(filePath)) {
    return "<h1>HuddlePace — 15-minute huddles that actually take 15 minutes</h1>";
  }

  let html = fs.readFileSync(filePath, "utf-8");
  html = html.replaceAll("__BEACON_WIDGET_KEY__", process.env.BEACON_WIDGET_KEY ?? "");

  if (process.env.NODE_ENV === "production") {
    cachedHtml[pagePath] = html;
  }
  return html;
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

export function renderLocalizedHtml(baseHtml: string, lang: "en" | "es", metaKey: string = "meta"): string {
  if (lang === "en") {
    return baseHtml;
  }

  const locale = getLocaleDictionary("es");
  if (!locale) return baseHtml;

  let html = baseHtml;

  // 1. Document Lang Attribute
  html = html.replace('<html lang="en">', '<html lang="es">');

  // 2. SEO Meta tags
  const meta = locale[metaKey];
  if (meta) {
    if (meta.title) {
      html = html.replace(/<title>.*?<\/title>/, `<title>${meta.title}</title>`);
      html = html.replace(/<meta name="title" content=".*?">/, `<meta name="title" content="${meta.title}">`);
    }
    if (meta.description) {
      html = html.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${meta.description}">`);
    }
    if (meta.ogTitle) {
      html = html.replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${meta.ogTitle}">`);
      html = html.replace(/<meta property="twitter:title" content=".*?">/, `<meta property="twitter:title" content="${meta.ogTitle}">`);
    }
    if (meta.ogDescription) {
      html = html.replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${meta.ogDescription}">`);
      html = html.replace(/<meta property="twitter:description" content=".*?">/, `<meta property="twitter:description" content="${meta.ogDescription}">`);
    }
  }

  // 3. Language button active class toggle (home page's client-side EN/ES toggle)
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

  return html;
}

function renderPage(pagePath: string, req: IncomingMessage): { html: string; lang: "en" | "es"; explicitQuery: boolean } {
  const page = PAGES[pagePath];
  const { lang, explicitQuery } = detectLanguage(req);

  if (process.env.NODE_ENV === "production") {
    cachedRendered[pagePath] = cachedRendered[pagePath] || {};
    if (cachedRendered[pagePath][lang]) {
      return { html: cachedRendered[pagePath][lang], lang, explicitQuery };
    }
  }

  const baseHtml = getPageHtml(pagePath);
  const html = renderLocalizedHtml(baseHtml, lang, page?.metaKey ?? "meta");

  if (process.env.NODE_ENV === "production") {
    cachedRendered[pagePath] = cachedRendered[pagePath] || {};
    cachedRendered[pagePath][lang] = html;
  }

  return { html, lang, explicitQuery };
}

function handleStaticPage(pagePath: string) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const { html, lang, explicitQuery } = renderPage(pagePath, req);

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
  };
}

export const handleLandingPage = handleStaticPage("/");

export function handleStaticAsset(
  req: ParamsIncomingMessage,
  res: ServerResponse,
  explicitFile?: string
): void {
  const filename = explicitFile || req.params?.file;
  if (!filename) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Asset not found");
    return;
  }

  // Prevent directory traversal attacks
  const safeFilename = path.basename(filename);
  const filePath = path.join(PUBLIC_DIR, "assets", safeFilename);

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
      path: "/privacy",
      method: ["GET", "HEAD"],
      handler: handleStaticPage("/privacy"),
    },
    {
      path: "/terms",
      method: ["GET", "HEAD"],
      handler: handleStaticPage("/terms"),
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
