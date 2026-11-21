// A local stand-in for the host: serves this folder and applies the redirects
// and headers of vercel.json, so a change can be checked before it is published.
// The order endpoint is not run: the form shows its contact fallback, unless
// ORDERS=fake is set, which answers "saved" without storing anything anywhere.
//
//   node scripts/preview.mjs               http://localhost:4173
//   node scripts/preview.mjs 8080          another port
//   GEO=FR node scripts/preview.mjs        the country /api/geo answers (default TN)
//   ORDERS=fake node scripts/preview.mjs   the order form succeeds (nothing is saved)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp4": "video/mp4",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".vtt": "text/vtt; charset=utf-8", ".webmanifest": "application/manifest+json",
};

function config() {
  try { return JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")); } catch { return {}; }
}

/** Vercel path patterns ("/assets/(.*)", "/:path*") as a RegExp. */
function toRegex(source) {
  const pattern = source
    .replace(/\/:([A-Za-z0-9_]+)\*/g, "(?:/(?<$1>.*))?")
    .replace(/:([A-Za-z0-9_]+)/g, "(?<$1>[^/]+)");
  return new RegExp("^" + pattern + "$");
}

function hasMatches(rule, req, url) {
  for (const cond of rule.has || []) {
    if (cond.type === "header") {
      const value = req.headers[cond.key.toLowerCase()];
      if (value === undefined) return false;
      if (cond.value !== undefined && !new RegExp("^" + cond.value + "$").test(String(value))) return false;
    } else if (cond.type === "query") {
      if (!url.searchParams.has(cond.key)) return false;
    }
  }
  return true;
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const cfg = config();
  const pathname = decodeURIComponent(url.pathname);

  for (const rule of cfg.redirects || []) {
    if (toRegex(rule.source).test(pathname) && hasMatches(rule, req, url)) {
      // Like the host, a redirect keeps the query string (campaign links: /?utm_source=…).
      const query = rule.destination.includes("?") ? "" : url.search;
      res.writeHead(rule.permanent ? 308 : 307, { Location: rule.destination + query });
      return res.end();
    }
  }
  if (pathname === "/api/geo") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ country: process.env.GEO || "TN" }));
  }
  if (pathname === "/api/order-notion" && process.env.ORDERS === "fake") {
    req.resume();
    res.writeHead(201, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ ok: true, reference: "ACX-O-PREVIEW" }));
  }

  let file = path.join(root, pathname);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  let status = 200;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!pathname.endsWith("/")) { res.writeHead(308, { Location: pathname + "/" + url.search }); return res.end(); }
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file) && cfg.cleanUrls && fs.existsSync(file + ".html")) file += ".html";
  if (!fs.existsSync(file)) { file = path.join(root, "404.html"); status = 404; }
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end("404"); }

  const headers = { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" };
  headers["Cache-Control"] = "public, max-age=0, must-revalidate";
  for (const rule of cfg.headers || []) {
    if (toRegex(rule.source).test(pathname) && hasMatches(rule, req, url)) {
      for (const h of rule.headers) headers[h.key] = h.value;
    }
  }
  const stat = fs.statSync(file);
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
  if (range) {
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : stat.size - 1;
    res.writeHead(206, { ...headers, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  const text = /^(text\/|application\/(json|xml|manifest))/.test(headers["Content-Type"]) || headers["Content-Type"].startsWith("image/svg");
  if (text && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
    const body = zlib.gzipSync(fs.readFileSync(file));
    res.writeHead(status, { ...headers, "Content-Encoding": "gzip", "Content-Length": body.length, Vary: "Accept-Encoding" });
    return res.end(body);
  }
  res.writeHead(status, { ...headers, "Content-Length": stat.size, "Accept-Ranges": "bytes" });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
