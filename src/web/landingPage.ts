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

// Cache the landing page HTML in memory on server boot for sub-millisecond delivery
const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const INDEX_HTML_PATH = path.join(PUBLIC_DIR, "index.html");

let cachedHtml: string | null = null;

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

export function handleLandingPage(req: IncomingMessage, res: ServerResponse): void {
  const html = getLandingHtml();
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(html);
}

export function handleStaticAsset(req: ParamsIncomingMessage, res: ServerResponse, explicitFile?: string): void {
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
