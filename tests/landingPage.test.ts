import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  handleLandingPage,
  handleStaticAsset,
  getWebCustomRoutes,
  detectLanguage,
  renderLocalizedHtml,
  clearLandingCache,
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

  describe("detectLanguage negotiation protocol", () => {
    test("detects explicit ?lang=es query param", () => {
      const req: any = { url: "/?lang=es" };
      const { lang, explicitQuery } = detectLanguage(req);
      assert.strictEqual(lang, "es");
      assert.strictEqual(explicitQuery, true);
    });

    test("detects explicit ?lang=en query param", () => {
      const req: any = { url: "/?lang=en" };
      const { lang, explicitQuery } = detectLanguage(req);
      assert.strictEqual(lang, "en");
      assert.strictEqual(explicitQuery, true);
    });

    test("falls back safely to cookie when query is missing", () => {
      const req: any = { url: "/", headers: { cookie: "huddlepace_lang=es" } };
      const { lang, explicitQuery } = detectLanguage(req);
      assert.strictEqual(lang, "es");
      assert.strictEqual(explicitQuery, false);
    });

    test("falls back safely to RFC 9110 Accept-Language header", () => {
      const req: any = { url: "/", headers: { "accept-language": "es-ES,es;q=0.9,en;q=0.8" } };
      const { lang, explicitQuery } = detectLanguage(req);
      assert.strictEqual(lang, "es");
      assert.strictEqual(explicitQuery, false);
    });

    test("defaults to 'en' when unsupported language or no header provided (negative control)", () => {
      const req: any = { url: "/", headers: { "accept-language": "fr-FR,fr;q=0.9" } };
      const { lang, explicitQuery } = detectLanguage(req);
      assert.strictEqual(lang, "en");
      assert.strictEqual(explicitQuery, false);
    });
  });

  describe("handleLandingPage", () => {
    test("serves default English page with protocol headers, Vector avatar, and Meet Vector section", () => {
      const req: any = { url: "/" };
      const res = new MockResponse();

      handleLandingPage(req, res as any);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers["Content-Type"], "text/html; charset=utf-8");
      assert.strictEqual(res.headers["Content-Language"], "en");
      assert.strictEqual(res.headers["Vary"], "Accept-Language, Cookie");
      assert.strictEqual(
        res.headers["Cache-Control"],
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600"
      );
      assert.match(res.body, /<html lang="en">/);
      assert.match(res.body, /HuddlePace/);
      assert.match(res.body, /Meet Vector/);
      assert.match(res.body, /The timekeeper for your Slack workspace/);
      assert.match(res.body, /src="\/assets\/avatar\.png"/);
      assert.match(res.body, /src="\/assets\/vectorfull\.png"/);
    });

    test("serves pre-rendered Spanish page when ?lang=es is requested", () => {
      const req: any = { url: "/?lang=es" };
      const res = new MockResponse();

      handleLandingPage(req, res as any);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers["Content-Language"], "es");
      assert.match(String(res.headers["Set-Cookie"]), /huddlepace_lang=es/);
      assert.match(res.body, /<html lang="es">/);
      assert.match(res.body, /Reuniones de 15 minutos que/);
      assert.match(res.body, /Conoce a Vector/);
      assert.match(res.body, /El guardián del tiempo en tu workspace/);
    });

    test("serves pre-rendered Spanish page when Accept-Language: es is sent", () => {
      const req: any = { url: "/", headers: { "accept-language": "es-CO,es;q=0.9" } };
      const res = new MockResponse();

      handleLandingPage(req, res as any);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers["Content-Language"], "es");
      assert.match(res.body, /<html lang="es">/);
      assert.match(res.body, /Reuniones de 15 minutos que/);
      assert.match(res.body, /Conoce a Vector/);
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
        assert.strictEqual(res.headers["Cache-Control"], "public, max-age=86400, immutable");
        done();
      });

      handleStaticAsset(req, res as any);
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
});
