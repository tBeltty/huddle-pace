import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  handleLandingPage,
  handleStaticAsset,
  getWebCustomRoutes,
  buildSitemapXml,
  buildRobotsTxt,
  PAGE_PATHS,
  computePageHash,
  readPageDates,
  renderLocalizedHtml,
  clearLandingCache,
  getAppVersion,
} from "../src/web/landingPage.js";
import { Writable } from "node:stream";

class MockResponse extends Writable {
  statusCode = 0;
  headers: Record<string, string | number> = {};
  body = "";

  writeHead(status: number, headers: Record<string, string | number>) {
    this.statusCode = status;
    this.headers = headers;
    return this;
  }

  _write(chunk: any, _encoding: string, callback: () => void) {
    this.body += chunk.toString();
    callback();
  }
}

describe("Web Landing Page & Asset Delivery", () => {
  beforeEach(() => {
    clearLandingCache();
  });

  describe("handleLandingPage", () => {
    test("serves English page at / with canonical, hreflang pairs and locale tags", () => {
      const req: any = { url: "/" };
      const res = new MockResponse();

      handleLandingPage(req, res as any);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers["Content-Type"], "text/html; charset=utf-8");
      assert.strictEqual(res.headers["Content-Language"], "en");
      assert.strictEqual(res.headers["Vary"], undefined);
      assert.strictEqual(res.headers["Set-Cookie"], undefined);
      assert.match(res.body, /<html lang="en">/);
      assert.match(res.body, /Meet Vector/);
      assert.match(res.body, /src="\/assets\/avatar-96\.png"/);
      assert.match(res.body, /src="\/assets\/vectorfull\.png"/);
      assert.match(res.body, /<link rel="canonical" href="https:\/\/huddlepace\.com\/">/);
      assert.match(res.body, /hreflang="es" href="https:\/\/huddlepace\.com\/es\/"/);
      assert.match(res.body, /hreflang="x-default" href="https:\/\/huddlepace\.com\/"/);
      assert.match(res.body, /og:locale" content="en_US"/);
      assert.match(res.body, /<main id="main">/);
    });

    test("ignores Accept-Language and cookie: content depends only on the URL", () => {
      const req: any = { url: "/", headers: { "accept-language": "es-CO,es;q=0.9", cookie: "huddlepace_lang=es" } };
      const res = new MockResponse();

      handleLandingPage(req, res as any);

      assert.strictEqual(res.headers["Content-Language"], "en");
      assert.match(res.body, /<html lang="en">/);
    });

    test("serves Spanish page at /es/ with its own canonical and localized links", () => {
      const route = getWebCustomRoutes().find((r) => r.path === "/es/")!;
      const req: any = { url: "/es/" };
      const res = new MockResponse();

      route.handler(req, res as any);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers["Content-Language"], "es");
      assert.match(res.body, /<html lang="es">/);
      assert.match(res.body, /Reuniones de 15 minutos que/);
      assert.match(res.body, /Conoce a Vector/);
      assert.match(res.body, /<link rel="canonical" href="https:\/\/huddlepace\.com\/es\/">/);
      assert.match(res.body, /og:locale" content="es_ES"/);
      assert.match(res.body, /href="\/es\/privacy"/);
      assert.doesNotMatch(res.body, /href="\/privacy"/);
    });

    test("301s legacy ?lang= and non-canonical paths to the canonical URL", () => {
      const routes = getWebCustomRoutes();
      const cases: Array<[string, string, string]> = [
        ["/", "/?lang=es", "/es/"],
        ["/", "/?lang=en", "/"],
        ["/privacy", "/privacy?lang=es", "/es/privacy"],
        ["/es", "/es", "/es/"],
        ["/privacy/", "/privacy/", "/privacy"],
      ];
      for (const [routePath, url, location] of cases) {
        const route = routes.find((r) => r.path === routePath)!;
        const res = new MockResponse();
        route.handler({ url } as any, res as any);
        assert.strictEqual(res.statusCode, 301, url);
        assert.strictEqual(res.headers["Location"], location, url);
      }
    });

    test("home page carries a visible FAQ and matching FAQPage JSON-LD in each language", () => {
      const routes = getWebCustomRoutes();
      for (const [route, lang, question] of [["/", "en", "How much does HuddlePace cost?"], ["/es/", "es", "¿Cuánto cuesta HuddlePace?"]]) {
        const res = new MockResponse();
        routes.find((r) => r.path === route)!.handler({ url: route } as any, res as any);
        assert.match(res.body, /"@type": "FAQPage"/, lang);
        assert.ok(res.body.includes(`"name": "${question}"`), lang);
        assert.ok(res.body.includes(`>${question}</summary>`), lang);
        assert.doesNotMatch(res.body, /__FAQ_JSON_LD__/);
      }
    });

    test("content pages render in both languages with their own canonical and localized links", () => {
      const routes = getWebCustomRoutes();
      const cases: Array<[string, string, RegExp, RegExp]> = [
        ["/slack-huddle-timer", "en", /<h1[^>]*>A timer for your/, /canonical" href="https:\/\/huddlepace\.com\/slack-huddle-timer"/],
        ["/es/temporizador-huddle-slack", "es", /<h1[^>]*>Un temporizador para tus/, /canonical" href="https:\/\/huddlepace\.com\/es\/temporizador-huddle-slack"/],
        ["/daily-standup-timer-slack", "en", /<h1[^>]*>Daily standup timer/, /hreflang="es" href="https:\/\/huddlepace\.com\/es\/temporizador-daily-standup-slack"/],
        ["/es/temporizador-daily-standup-slack", "es", /<h1[^>]*>Temporizador de daily standup/, /"inLanguage": "es"/],
      ];
      for (const [route, lang, h1, extra] of cases) {
        const res = new MockResponse();
        routes.find((r) => r.path === route)!.handler({ url: route } as any, res as any);
        assert.strictEqual(res.statusCode, 200, route);
        assert.strictEqual(res.headers["Content-Language"], lang, route);
        assert.match(res.body, h1, route);
        assert.match(res.body, extra, route);
      }
      for (const route of ["/engineering-managers-meeting-timer", "/es/temporizador-llamadas-clientes-slack", "/es/agenda-retrospectiva-sprint"]) {
        const res = new MockResponse();
        routes.find((r) => r.path === route)!.handler({ url: route } as any, res as any);
        assert.strictEqual(res.statusCode, 200, route);
        assert.match(res.body, /<h1[^>]*>/, route);
        assert.doesNotMatch(res.body, /data-i18n="[a-zA-Z0-9]+">\s*<\/(p|li|h2)>/, route);
      }
      const es = new MockResponse();
      routes.find((r) => r.path === "/es/temporizador-huddle-slack")!.handler({ url: "/es/temporizador-huddle-slack" } as any, es as any);
      assert.match(es.body, /href="\/es\/privacy"/);
      assert.match(es.body, /href="\/es\/temporizador-daily-standup-slack"/);
    });

    test("retrospective page is a full landing page with its own FAQPage markup in each language", () => {
      const routes = getWebCustomRoutes();
      for (const [route, lang, question] of [
        ["/sprint-retrospective-agenda", "en", "How long should a sprint retrospective be?"],
        ["/es/agenda-retrospectiva-sprint", "es", "¿Cuánto debe durar una retrospectiva de sprint?"],
      ]) {
        const res = new MockResponse();
        routes.find((r) => r.path === route)!.handler({ url: route } as any, res as any);
        assert.strictEqual(res.statusCode, 200, route);
        assert.match(res.body, /class="split-bar"/, lang);
        assert.match(res.body, /class="agenda-card"/, lang);
        assert.ok(res.body.includes(`"name": "${question}"`), lang);
        assert.doesNotMatch(res.body, /__FAQ_JSON_LD/, lang);
        const text = res.body.replace(/<[^>]+>/g, " ").split(/\s+/).length;
        assert.ok(text > 600, `${lang} has ${text} words`);
      }
    });

    test("every content page is a full landing page with FAQPage markup and no stray template keys", () => {
      const routes = getWebCustomRoutes();
      const pages = [
        "/slack-huddle-timer", "/es/temporizador-huddle-slack",
        "/daily-standup-timer-slack", "/es/temporizador-daily-standup-slack",
        "/engineering-managers-meeting-timer", "/es/temporizador-reuniones-engineering-managers",
        "/client-call-timer-slack", "/es/temporizador-llamadas-clientes-slack",
      ];
      for (const route of pages) {
        const res = new MockResponse();
        routes.find((r) => r.path === route)!.handler({ url: route } as any, res as any);
        assert.strictEqual(res.statusCode, 200, route);
        assert.match(res.body, /class="split-bar"/, route);
        assert.match(res.body, /class="agenda-card"/, route);
        assert.match(res.body, /"@type": "FAQPage"/, route);
        assert.doesNotMatch(res.body, /__FAQ_JSON_LD|__ALT_/, route);
        const words = res.body.replace(/<[^>]+>/g, " ").split(/\s+/).length;
        assert.ok(words > 550, `${route} has ${words} words`);
      }
    });

    test("every page exposes exactly one main landmark and a skip link", () => {
      const routes = getWebCustomRoutes();
      for (const route of ["/", "/privacy", "/terms", "/es/privacy", "/es/terms", "/es/", "/slack-huddle-timer", "/sprint-retrospective-agenda"]) {
        const res = new MockResponse();
        routes.find((r) => r.path === route)!.handler({ url: route } as any, res as any);
        assert.strictEqual((res.body.match(/<main[\s>]/g) ?? []).length, 1, `${route} <main>`);
        assert.match(res.body, /class="skip-link" href="#main"/, route);
      }
    });

    test("every page loads Cloudflare analytics exactly once, after the load event", () => {
      const routes = getWebCustomRoutes();
      for (const route of ["/", "/es/", "/privacy", "/terms", "/slack-huddle-timer", "/es/agenda-retrospectiva-sprint", "/engineering-managers-meeting-timer", "/client-call-timer-slack", "/daily-standup-timer-slack"]) {
        const res = new MockResponse();
        routes.find((r) => r.path === route)!.handler({ url: route } as any, res as any);
        assert.strictEqual((res.body.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) ?? []).length, 1, route);
        assert.match(res.body, /4279abbc63f643ac85fd3f06f9bd2538/, route);
        assert.match(res.body, /addEventListener\('load', function \(\) \{\s+loadAnalytics\(\);/, route);
        assert.match(String(res.headers["Cache-Control"]), /no-transform/, route);
      }
    });

    test("serves legal pages in both languages", () => {
      const routes = getWebCustomRoutes();
      const es = new MockResponse();
      routes.find((r) => r.path === "/es/terms")!.handler({ url: "/es/terms" } as any, es as any);
      assert.strictEqual(es.statusCode, 200);
      assert.match(es.body, /<html lang="es">/);
      assert.match(es.body, /canonical" href="https:\/\/huddlepace\.com\/es\/terms"/);
    });

    test("handles HEAD request cleanly without body", () => {
      const req: any = { url: "/", method: "HEAD" };
      const res = new MockResponse();

      handleLandingPage(req, res as any);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body, "");
    });
  });

  describe("handleStaticAsset", () => {
    test("serves favicon.ico with 200 OK and image/x-icon", (t, done) => {
      const req: any = { params: { file: "favicon.ico" } };
      const res = new MockResponse();

      res.on("finish", () => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers["Content-Type"], "image/x-icon");
        assert.strictEqual(res.headers["Cache-Control"], "public, max-age=3600, stale-while-revalidate=86400");
        done();
      });

      handleStaticAsset(req, res as any);
    });

    test("caches ?v= versioned assets for a year as immutable", (t, done) => {
      const req: any = { url: "/assets/site.css?v=1.9.1", params: { file: "site.css" } };
      const res = new MockResponse();

      res.on("finish", () => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers["Cache-Control"], "public, max-age=31536000, immutable");
        done();
      });

      handleStaticAsset(req, res as any);
    });

    test("serves the self-hosted fonts as woff2 with a one-year immutable cache", (t, done) => {
      const req: any = { params: { file: "plus-jakarta-sans-v12-latin.woff2" } };
      const res = new MockResponse();

      res.on("finish", () => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers["Content-Type"], "font/woff2");
        assert.strictEqual(res.headers["Cache-Control"], "public, max-age=31536000, immutable");
        done();
      });

      handleStaticAsset(req, res as any);
    });

    test("pages preload the self-hosted fonts and no longer call Google Fonts", () => {
      const routes = getWebCustomRoutes();
      for (const route of ["/", "/es/", "/privacy", "/sprint-retrospective-agenda", "/es/temporizador-huddle-slack"]) {
        const res = new MockResponse();
        routes.find((r) => r.path === route)!.handler({ url: route } as any, res as any);
        assert.match(res.body, /rel="preload" as="font" type="font\/woff2" href="\/assets\/plus-jakarta-sans-v12-latin\.woff2" crossorigin/, route);
        assert.match(res.body, /rel="preload" as="font" type="font\/woff2" href="\/assets\/jetbrains-mono-v24-latin\.woff2" crossorigin/, route);
        assert.doesNotMatch(res.body, /fonts\.googleapis\.com|fonts\.gstatic\.com/, route);
      }
    });

    test("serves avatar.png with 200 OK and image/png", (t, done) => {
      const req: any = { params: { file: "avatar.png" } };
      const res = new MockResponse();

      res.on("finish", () => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers["Content-Type"], "image/png");
        done();
      });

      handleStaticAsset(req, res as any);
    });

    test("serves vectorfull.png with 200 OK and image/png", (t, done) => {
      const req: any = { params: { file: "vectorfull.png" } };
      const res = new MockResponse();

      res.on("finish", () => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers["Content-Type"], "image/png");
        done();
      });

      handleStaticAsset(req, res as any);
    });

    test("serves reminder-healthy.jpg with 200 OK and image/jpeg", (t, done) => {
      const req: any = { params: { file: "reminder-healthy.jpg" } };
      const res = new MockResponse();

      res.on("finish", () => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers["Content-Type"], "image/jpeg");
        assert.strictEqual(res.headers["Cache-Control"], "public, max-age=3600, stale-while-revalidate=86400");
        done();
      });

      handleStaticAsset(req, res as any);
    });

    test("blocks directory traversal and returns 404 for missing assets (negative control)", () => {
      const req: any = { params: { file: "../../../package.json" } };
      const res = new MockResponse();

      handleStaticAsset(req, res as any);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body, "Asset not found");
    });
  });

  describe("getWebCustomRoutes", () => {
    test("registers root, assets, favicon, and apple-touch-icon routes", () => {
      const routes = getWebCustomRoutes();
      const paths = routes.map((r) => r.path);

      assert.ok(paths.includes("/"));
      assert.ok(paths.includes("/assets/:file"));
      assert.ok(paths.includes("/favicon.ico"));
      assert.ok(paths.includes("/apple-touch-icon.png"));
    });
  });

  describe("getAppVersion", () => {
    test("returns a valid semver string from package.json", () => {
      const version = getAppVersion();
      assert.match(version, /^\d+\.\d+\.\d+$/);
      assert.ok(!version.includes("__APP_VERSION__"));
    });

    test("rendered landing page contains real version, not placeholder", async () => {
      const version = getAppVersion();
      const req = { url: "/", headers: { "accept-language": "en" } } as any;
      const res = new MockResponse();
      await handleLandingPage(req, res as any);
      assert.ok(res.body.includes(`v${version}`));
      assert.ok(!res.body.includes("__APP_VERSION__"));
    });
  });

  describe("404 page", () => {
    const notFound = () => getWebCustomRoutes().find((r) => r.path === "/*notFound")!;

    test("unknown paths get a 404 that search engines are told not to index", () => {
      const res = new MockResponse();
      notFound().handler({ url: "/does-not-exist" } as any, res as any);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.headers["X-Robots-Tag"], "noindex");
      assert.strictEqual(res.headers["Cache-Control"], "no-store, no-transform");
      assert.strictEqual(res.headers["Content-Language"], "en");
      assert.match(res.body, /<meta name="robots" content="noindex, follow">/);
      assert.match(res.body, /This page does not exist/);
      assert.doesNotMatch(res.body, /rel="canonical"/);
      assert.match(res.body, /<main id="main">/);
    });

    test("Spanish paths get a Spanish 404 whose links stay in Spanish", () => {
      const res = new MockResponse();
      notFound().handler({ url: "/es/nada-aqui" } as any, res as any);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.headers["Content-Language"], "es");
      assert.match(res.body, /<html lang="es">/);
      assert.match(res.body, /Esta página no existe/);
      assert.match(res.body, /href="\/es\/"/);
    });

    test("HEAD returns the 404 status without a body, and the catch-all is the last route", () => {
      const res = new MockResponse();
      notFound().handler({ url: "/x", method: "HEAD" } as any, res as any);
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body, "");

      const routes = getWebCustomRoutes();
      assert.strictEqual(routes[routes.length - 1].path, "/*notFound");
    });
  });

  describe("sitemap lastmod", () => {
    test("pageDates.json is current: run `pnpm page-dates` after editing a page or its strings", () => {
      const dates = readPageDates();
      for (const pagePath of PAGE_PATHS) {
        assert.ok(dates[pagePath], `${pagePath} is missing from pageDates.json`);
        assert.strictEqual(dates[pagePath].hash, computePageHash(pagePath), `${pagePath} changed since its lastmod was recorded; run pnpm page-dates`);
        assert.match(dates[pagePath].lastmod, /^\d{4}-\d{2}-\d{2}$/, pagePath);
      }
    });

    test("every sitemap url carries a lastmod and the hash ignores the release version", () => {
      const xml = buildSitemapXml();
      assert.strictEqual((xml.match(/<url>/g) ?? []).length, PAGE_PATHS.length);
      assert.strictEqual((xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) ?? []).length, PAGE_PATHS.length);
      const before = computePageHash("/");
      clearLandingCache();
      assert.strictEqual(computePageHash("/"), before);
    });
  });

  describe("sitemap.xml and robots.txt", () => {
    test("sitemap lists every page in both languages with hreflang alternates", () => {
      const xml = buildSitemapXml();
      for (const loc of ["/", "/es/", "/privacy", "/es/privacy", "/terms", "/es/terms", "/support", "/es/soporte", "/slack-huddle-timer", "/es/temporizador-huddle-slack", "/daily-standup-timer-slack", "/es/temporizador-daily-standup-slack", "/engineering-managers-meeting-timer", "/es/temporizador-reuniones-engineering-managers", "/client-call-timer-slack", "/es/temporizador-llamadas-clientes-slack", "/sprint-retrospective-agenda", "/es/agenda-retrospectiva-sprint"]) {
        assert.match(xml, new RegExp(`<loc>https://huddlepace\\.com${loc}</loc>`));
      }
      assert.match(xml, /hreflang="x-default"/);
    });

    test("robots.txt declares the sitemap and blocks Slack endpoints", () => {
      const txt = buildRobotsTxt();
      assert.match(txt, /Sitemap: https:\/\/huddlepace\.com\/sitemap\.xml/);
      assert.match(txt, /Disallow: \/slack\//);
    });
  });
});
