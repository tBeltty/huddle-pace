import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  handleLandingPage,
  handleStaticAsset,
  getWebCustomRoutes,
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
  describe("handleLandingPage", () => {
    test("serves 200 OK with Atmos UI landing page HTML", () => {
      const req: any = {};
      const res = new MockResponse();

      handleLandingPage(req, res as any);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers["Content-Type"], "text/html; charset=utf-8");
      assert.strictEqual(
        res.headers["Cache-Control"],
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600"
      );
      assert.match(res.body, /HuddlePace/);
      assert.match(res.body, /Vector/);
      assert.match(res.body, /https:\/\/huddlepace\.com\/slack\/install/);
      assert.match(res.body, /SoftwareApplication/);
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

    test("serves favicon.png with 200 OK and image/png", (t, done) => {
      const req: any = { params: { file: "favicon.png" } };
      const res = new MockResponse();

      res.on("finish", () => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers["Content-Type"], "image/png");
        done();
      });

      handleStaticAsset(req, res as any);
    });

    test("serves hero-vector.jpg with 200 OK and image/jpeg", (t, done) => {
      const req: any = { params: { file: "hero-vector.jpg" } };
      const res = new MockResponse();

      res.on("finish", () => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers["Content-Type"], "image/jpeg");
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
