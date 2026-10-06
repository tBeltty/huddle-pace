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

const SITE_ORIGIN = "https://huddlepace.com";

type Lang = "en" | "es";

// Static pages served by the site, keyed by the canonical URL path that serves them.
// `metaKey` is the top-level key in the locale JSON holding that page's SEO meta block.
// Language is decided by the URL alone (`/es/...` is Spanish) so every language
// version is a distinct, crawlable, cacheable URL.
interface PageDef {
  file: string;
  metaKey: string;
  lang: Lang;
  enPath: string;
  esPath: string;
}

// One entry per (page, language). The English and Spanish URLs of a page are listed
// together so hreflang pairs, the sitemap and internal-link rewriting stay in sync.
const PAGE_PAIRS: Array<{ file: string; metaKey: string; enPath: string; esPath: string }> = [
  { file: "index.html", metaKey: "meta", enPath: "/", esPath: "/es/" },
  { file: "slack-huddle-timer.html", metaKey: "huddleTimerMeta", enPath: "/slack-huddle-timer", esPath: "/es/temporizador-huddle-slack" },
  { file: "daily-standup-timer-slack.html", metaKey: "standupMeta", enPath: "/daily-standup-timer-slack", esPath: "/es/temporizador-daily-standup-slack" },
  { file: "engineering-managers-meeting-timer.html", metaKey: "emMeta", enPath: "/engineering-managers-meeting-timer", esPath: "/es/temporizador-reuniones-engineering-managers" },
  { file: "client-call-timer-slack.html", metaKey: "agencyMeta", enPath: "/client-call-timer-slack", esPath: "/es/temporizador-llamadas-clientes-slack" },
  { file: "sprint-retrospective-agenda.html", metaKey: "retroMeta", enPath: "/sprint-retrospective-agenda", esPath: "/es/agenda-retrospectiva-sprint" },
  { file: "privacy.html", metaKey: "privacyMeta", enPath: "/privacy", esPath: "/es/privacy" },
  { file: "terms.html", metaKey: "termsMeta", enPath: "/terms", esPath: "/es/terms" },
];

const PAGES: Record<string, PageDef> = {};
for (const pair of PAGE_PAIRS) {
  PAGES[pair.enPath] = { ...pair, lang: "en" };
  PAGES[pair.esPath] = { ...pair, lang: "es" };
}

const cachedHtml: Record<string, string> = {};
const cachedRendered: Record<string, { html: string }> = {};
const cachedLocales: Record<string, any> = {};

export function clearLandingCache(): void {
  for (const k of Object.keys(cachedHtml)) delete cachedHtml[k];
  for (const k of Object.keys(cachedRendered)) delete cachedRendered[k];
  for (const k of Object.keys(cachedLocales)) delete cachedLocales[k];
}

export function getAppVersion(): string {
  try {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.version) return pkg.version;
    }
  } catch {}
  return "1.1.0";
}

function getPageHtml(file: string): string {
  if (process.env.NODE_ENV === "production" && cachedHtml[file]) {
    return cachedHtml[file];
  }

  const filePath = path.join(PUBLIC_DIR, file);
  if (!fs.existsSync(filePath)) {
    return "<h1>HuddlePace — 15-minute huddles that actually take 15 minutes</h1>";
  }

  let html = fs.readFileSync(filePath, "utf-8");
  // BEACON_WIDGET_KEY is a public, origin-restricted client-side key.
  // It is declared in env.ts for type coverage but read here directly because
  // this module runs before Slack credentials are validated.
  html = html.replaceAll("__BEACON_WIDGET_KEY__", process.env.BEACON_WIDGET_KEY ?? "");
  html = html.replaceAll("__APP_VERSION__", getAppVersion());

  if (process.env.NODE_ENV === "production") {
    cachedHtml[file] = html;
  }
  return html;
}

export function getLocaleDictionary(lang: string): any {
  if (cachedLocales[lang]) return cachedLocales[lang];
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, "utf-8").replaceAll("__APP_VERSION__", getAppVersion());
      cachedLocales[lang] = JSON.parse(raw);
      return cachedLocales[lang];
    } catch {}
  }
  return null;
}

function buildFaqJsonLd(locale: any, prefix = "faq"): string {
  const strip = (v: string) => v.replace(/<[^>]*>/g, "").trim();
  const mainEntity: any[] = [];
  for (let i = 1; locale?.[`${prefix}${i}Q`]; i++) {
    mainEntity.push({
      "@type": "Question",
      name: strip(locale[`${prefix}${i}Q`]),
      acceptedAnswer: { "@type": "Answer", text: strip(locale[`${prefix}${i}A`]) },
    });
  }
  if (mainEntity.length === 0) return "";
  const json = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity }, null, 2).replaceAll("</", "<\\/");
  return `<script type="application/ld+json">\n${json}\n  </script>`;
}

export function renderLocalizedHtml(
  baseHtml: string,
  lang: Lang,
  metaKey: string = "meta",
  paths: { enPath: string; esPath: string } = { enPath: "/", esPath: "/es/" }
): string {
  const selfPath = lang === "es" ? paths.esPath : paths.enPath;
  const selfUrl = `${SITE_ORIGIN}${selfPath}`;
  let html = baseHtml;

  // Language switcher targets: plain crawlable links, one per language version.
  html = html.replaceAll("__ALT_EN__", paths.enPath).replaceAll("__ALT_ES__", paths.esPath);

  // Canonical + social URLs point at this language's own URL, never at the other one.
  html = html.replace(/<link rel="canonical" href=".*?">/, () => {
    const alt = (hl: string, p: string) => `<link rel="alternate" hreflang="${hl}" href="${SITE_ORIGIN}${p}">`;
    return [
      `<link rel="canonical" href="${selfUrl}">`,
      alt("en", paths.enPath),
      alt("es", paths.esPath),
      alt("x-default", paths.enPath),
    ].join("\n  ");
  });
  html = html.replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${selfUrl}$2`);
  html = html.replace(/(<meta name="twitter:url" content=")[^"]*(">)/, `$1${selfUrl}$2`);
  html = html.replace(
    /<meta property="og:site_name" content="HuddlePace">/,
    `<meta property="og:site_name" content="HuddlePace">\n  <meta property="og:locale" content="${lang === "es" ? "es_ES" : "en_US"}">\n  <meta property="og:locale:alternate" content="${lang === "es" ? "en_US" : "es_ES"}">`
  );

  // FAQPage structured data is generated from the same locale strings as the visible FAQ.
  const faqLocale = getLocaleDictionary(lang);
  // `__FAQ_JSON_LD__` uses the `faq` keys; `__FAQ_JSON_LD:xx__` uses the `xxFaq` keys of a page.
  html = html.replace(/__FAQ_JSON_LD(?::([a-z]+))?__/g, (_m, page?: string) =>
    buildFaqJsonLd(faqLocale, page ? `${page}Faq` : "faq")
  );

  if (lang === "en") {
    return html;
  }

  const locale = faqLocale;
  if (!locale) return html;

  // 1. Document Lang Attribute
  html = html.replace('<html lang="en">', '<html lang="es">');

  // 2. SEO Meta tags
  const meta = locale[metaKey];
  if (meta) {
    if (meta.title) {
      html = html.replace(/<title>.*?<\/title>/, `<title>${meta.title}</title>`);
    }
    if (meta.description) {
      html = html.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${meta.description}">`);
    }
    if (meta.ogTitle) {
      html = html.replace(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${meta.ogTitle}">`);
      html = html.replace(/<meta name="twitter:title" content=".*?">/, `<meta name="twitter:title" content="${meta.ogTitle}">`);
    }
    if (meta.ogDescription) {
      html = html.replace(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${meta.ogDescription}">`);
      html = html.replace(/<meta name="twitter:description" content=".*?">/, `<meta name="twitter:description" content="${meta.ogDescription}">`);
    }
    if (meta.schemaDescription) {
      html = html.replace(/("description": ")[^"]*(")/, `$1${meta.schemaDescription}$2`);
      html = html.replace('"inLanguage": "en"', '"inLanguage": "es"');
    }
  }

  // Page-level structured data follows the page language.
  if (html.includes('"@type": "WebPage"')) {
    html = html.replaceAll('"inLanguage": "en"', '"inLanguage": "es"');
    html = html.replaceAll('"name": "Home"', '"name": "Inicio"');
    const enTitle = getLocaleDictionary("en")?.[metaKey]?.title;
    if (enTitle && meta?.title) {
      html = html.replaceAll(`"name": "${enTitle.split(" | ")[0]}"`, `"name": "${meta.title.split(" | ")[0]}"`);
    }
  }

  // 3. Language switcher active state
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

  // 5. Internal links stay inside the Spanish version of the site.
  html = html.replace(/href="\/(#[^"]*)?"/g, (_m, hash) => `href="/es/${hash ?? ""}"`);
  for (const pair of PAGE_PAIRS) {
    if (pair.enPath === "/") continue;
    html = html.replaceAll(`href="${pair.enPath}"`, `href="${pair.esPath}"`);
    html = html.replaceAll(`href="${pair.enPath}#`, `href="${pair.esPath}#`);
  }

  return html;
}

function renderPage(pagePath: string): { html: string; lang: Lang } {
  const page = PAGES[pagePath];
  const cacheKey = pagePath;

  if (process.env.NODE_ENV === "production" && cachedRendered[cacheKey]) {
    return { html: cachedRendered[cacheKey].html, lang: page.lang };
  }

  const html = renderLocalizedHtml(getPageHtml(page.file), page.lang, page.metaKey, page);

  if (process.env.NODE_ENV === "production") {
    cachedRendered[cacheKey] = { html };
  }

  return { html, lang: page.lang };
}

// Static pages answer only on their exact canonical path. Trailing-slash variants,
// `/es` and the legacy `?lang=` switch 301 to the canonical URL, so each page has a
// single indexable address per language.
function canonicalRedirect(req: IncomingMessage, pagePath: string): string | null {
  let pathname = pagePath;
  let search = "";
  try {
    const u = new URL(req.url ?? pagePath, "http://localhost");
    pathname = u.pathname;
    const qLang = u.searchParams.get("lang");
    if (qLang === "es" || qLang === "en") {
      const page = PAGES[pagePath];
      return qLang === "es" ? page.esPath : page.enPath;
    }
    search = u.search;
  } catch {}
  if (pathname !== pagePath) return pagePath + search;
  return null;
}

function handleStaticPage(pagePath: string) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const redirectTo = canonicalRedirect(req, pagePath);
    if (redirectTo) {
      res.writeHead(301, { Location: redirectTo, "Cache-Control": "public, max-age=3600" });
      res.end();
      return;
    }

    const { html, lang } = renderPage(pagePath);

    const headers: Record<string, string | number> = {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(html),
      "Content-Language": lang,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };

    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(html);
  };
}

export function buildSitemapXml(): string {
  const alt = (hl: string, p: string) =>
    `    <xhtml:link rel="alternate" hreflang="${hl}" href="${SITE_ORIGIN}${p}"/>`;
  const urls = Object.values(PAGES)
    .map((page) => {
      const loc = page.lang === "es" ? page.esPath : page.enPath;
      return [
        "  <url>",
        `    <loc>${SITE_ORIGIN}${loc}</loc>`,
        alt("en", page.enPath),
        alt("es", page.esPath),
        alt("x-default", page.enPath),
        "  </url>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

export function buildRobotsTxt(): string {
  return ["User-agent: *", "Allow: /", "Disallow: /slack/", "", `Sitemap: ${SITE_ORIGIN}/sitemap.xml`, ""].join("\n");
}

function handleTextFile(contentType: string, build: () => string) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const body = build();
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
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
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
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
  const pageRoutes = Object.keys(PAGES).flatMap((canonicalPath) => {
    const routes = [{ path: canonicalPath, method: ["GET", "HEAD"], handler: handleStaticPage(canonicalPath) }];
    // Non-canonical variants (trailing slash, bare /es) 301 to the canonical path.
    const variant = canonicalPath.endsWith("/") ? canonicalPath.slice(0, -1) : `${canonicalPath}/`;
    if (variant && variant !== canonicalPath && !(variant in PAGES)) {
      routes.push({ path: variant, method: ["GET", "HEAD"], handler: handleStaticPage(canonicalPath) });
    }
    return routes;
  });
  return [
    ...pageRoutes,
    {
      path: "/sitemap.xml",
      method: ["GET", "HEAD"],
      handler: handleTextFile("application/xml; charset=utf-8", buildSitemapXml),
    },
    {
      path: "/robots.txt",
      method: ["GET", "HEAD"],
      handler: handleTextFile("text/plain; charset=utf-8", buildRobotsTxt),
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
