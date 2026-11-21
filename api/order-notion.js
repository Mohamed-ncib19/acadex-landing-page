"use strict";

const DEFAULT_DATABASE_ID = "418e4528-63d8-807f-b5e9-df3bdd3a9ccb";
const DEFAULT_PAGE_ID = "418e4528-63d8-8008-973d-d75810cc4ebd";

// A real request is a few hundred bytes.
const MAX_BODY_BYTES = 4096;

// How many requests one visitor may have saved: 5 a minute, 20 an hour.
// Counted in the memory of the running function: the count starts again when the
// host restarts it, and each running copy counts on its own. It stops a loop or a
// crude bot; it does not replace a shared counter.
const LIMITS = [
  { windowMs: 60 * 1000, max: 5 },
  { windowMs: 60 * 60 * 1000, max: 20 },
];
const LONGEST_WINDOW = Math.max(...LIMITS.map((limit) => limit.windowMs));
const saves = new Map(); // visitor → times of the requests of the last hour

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/** The visitor's address as the host reports it. Kept in memory for an hour, never stored. */
function visitorOf(req) {
  const headers = req.headers || {};
  const address = String(headers["x-real-ip"] || headers["x-forwarded-for"] || "").split(",")[0].trim();
  return address || (req.socket && req.socket.remoteAddress) || "unknown";
}

/** Seconds to wait when the visitor is over a limit. Otherwise 0, and the request is counted. */
function secondsToWait(visitor, now = Date.now()) {
  const recent = (saves.get(visitor) || []).filter((time) => now - time < LONGEST_WINDOW);
  for (const { windowMs, max } of LIMITS) {
    const inWindow = recent.filter((time) => now - time < windowMs);
    if (inWindow.length >= max) {
      saves.set(visitor, recent);
      return Math.max(1, Math.ceil((inWindow[0] + windowMs - now) / 1000));
    }
  }
  recent.push(now);
  saves.set(visitor, recent);
  if (saves.size > 2000) {
    for (const [key, times] of saves) if (!times.some((time) => now - time < LONGEST_WINDOW)) saves.delete(key);
  }
  return 0;
}

function text(value, max = 500) {
  return typeof value === "string" ? value.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function newReference() {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "ACX-O-";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

async function notionFetch(path, token, options = {}) {
  const res = await fetch(`https://api.notion.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function resolveDatabase(token, databaseId, pageId) {
  let activeDbId = databaseId;
  let db = await notionFetch(`/v1/databases/${activeDbId}`, token, { method: "GET" });
  if (!db.ok && pageId) {
    const blocks = await notionFetch(`/v1/blocks/${pageId}/children?page_size=100`, token, { method: "GET" });
    if (blocks.ok) {
      const childDb = ((blocks.data && blocks.data.results) || []).find((b) => b.type === "child_database");
      if (childDb) {
        activeDbId = childDb.id;
        db = await notionFetch(`/v1/databases/${activeDbId}`, token, { method: "GET" });
      }
    }
  }
  return { activeDbId, db: db.ok ? db.data : null };
}

function buildProperties(db, order, reference) {
  const props = (db && db.properties) || {};
  const out = {};
  let titleProp = "Name";
  let phoneProp = null;
  let packProp = null;
  let priceProp = null;
  let refProp = null;
  let dateProp = null;
  let statusProp = null;

  for (const [key, value] of Object.entries(props)) {
    const lk = key.toLowerCase().trim();
    if (value.type === "title") titleProp = key;
    else if (value.type === "phone_number" || /phone|t[eé]l|tel|هاتف/.test(lk)) phoneProp = { name: key, type: value.type };
    else if (/pack|plan|offre|باقة/.test(lk)) packProp = { name: key, type: value.type };
    else if (/price|prix|amount|montant|سعر/.test(lk)) priceProp = { name: key, type: value.type };
    else if (/ref|reference|référence|مرجع/.test(lk)) refProp = { name: key, type: value.type };
    else if (/date|created|وقت|تاريخ/.test(lk)) dateProp = { name: key, type: value.type };
    else if (/status|statut|حالة/.test(lk)) statusProp = { name: key, type: value.type };
  }

  out[titleProp] = { title: [{ text: { content: order.contact_name || "Order" } }] };

  if (phoneProp) {
    if (phoneProp.type === "phone_number") out[phoneProp.name] = { phone_number: order.phone };
    else out[phoneProp.name] = { rich_text: [{ text: { content: order.phone } }] };
  } else {
    out.Phone = { rich_text: [{ text: { content: order.phone } }] };
  }

  const packLabel = order.pack === "essentiel" ? "Essentiel" : order.pack === "plus" ? "Plus" : "Complet";
  if (packProp) {
    if (packProp.type === "select") out[packProp.name] = { select: { name: packLabel } };
    else out[packProp.name] = { rich_text: [{ text: { content: packLabel } }] };
  }

  const amountText = order.amount_text || String(order.amount_minor || "");
  if (priceProp) {
    if (priceProp.type === "number" && Number.isFinite(Number(order.amount_minor))) out[priceProp.name] = { number: Number(order.amount_minor) };
    else out[priceProp.name] = { rich_text: [{ text: { content: amountText } }] };
  }

  if (refProp) out[refProp.name] = { rich_text: [{ text: { content: reference } }] };
  if (dateProp && dateProp.type === "date") out[dateProp.name] = { date: { start: new Date().toISOString() } };
  if (statusProp && statusProp.type === "select") out[statusProp.name] = { select: { name: "Nouveau" } };

  return out;
}

async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const token = (process.env.NOTION_API_KEY || "").trim();
  const databaseId = (process.env.NOTION_DATABASE_ID || DEFAULT_DATABASE_ID).trim();
  const pageId = (process.env.NOTION_PAGE_ID || DEFAULT_PAGE_ID).trim();
  if (!token) return json(res, 503, { ok: false, error: "Notion is not configured" });

  if (Number((req.headers || {})["content-length"] || 0) > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: "Request too large" });
  let body = req.body;
  if (typeof body === "string") {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: "Request too large" });
    try { body = JSON.parse(body); } catch { return json(res, 400, { ok: false, error: "Invalid JSON" }); }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { ok: false, error: "Invalid body" });
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: "Request too large" });

  // The form carries a field that nobody sees or fills. A filled one comes from a bot:
  // nothing is saved. A person caught by mistake still gets the page's contact buttons.
  if (text(String(body.website == null ? "" : body.website), 200)) return json(res, 400, { ok: false, error: "Rejected" });

  const pack = text(body.pack, 20).toLowerCase();
  const contactName = text(body.contact_name || body.name, 120);
  const phone = text(body.phone, 40);
  if (!["essentiel", "plus", "complet"].includes(pack)) return json(res, 400, { ok: false, field: "pack", error: "Invalid pack" });
  if (contactName.length < 2) return json(res, 400, { ok: false, field: "contact_name", error: "Name is required" });
  const phoneDigits = phone.replace(/\D/g, "");
  if (!phone.startsWith("+") || phoneDigits.length < 8 || phoneDigits.length > 15) {
    return json(res, 400, { ok: false, field: "phone", error: "Invalid phone" });
  }

  // Only a request that is about to be saved is counted: a typing mistake costs nothing.
  const wait = secondsToWait(visitorOf(req));
  if (wait) {
    res.setHeader("Retry-After", String(wait));
    return json(res, 429, { ok: false, error: "Too many requests" });
  }

  const reference = newReference();
  const order = {
    pack,
    contact_name: contactName,
    phone,
    amount_minor: Number.isFinite(Number(body.amount_minor)) ? Number(body.amount_minor) : null,
    amount_text: text(body.amount_text, 60),
    currency: text(body.currency, 10).toUpperCase(),
    country: text(body.country, 2).toUpperCase(),
    lang: text(body.lang, 5).toLowerCase(),
  };

  try {
    const { activeDbId, db } = await resolveDatabase(token, databaseId, pageId);
    const properties = buildProperties(db, order, reference);
    const created = await notionFetch("/v1/pages", token, {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: activeDbId },
        properties,
        children: [
          {
            object: "block",
            type: "callout",
            callout: {
              icon: { emoji: "📦" },
              rich_text: [{ type: "text", text: { content: `Nouvelle commande Acadex\n• Référence : ${reference}\n• Client : ${order.contact_name}\n• Téléphone : ${order.phone}\n• Pack : ${pack.toUpperCase()}${order.amount_text ? ` (${order.amount_text})` : ""}\n• Pays : ${order.country || "-"}\n• Date : ${new Date().toLocaleString("fr-FR")}` } }],
            },
          },
        ],
      }),
    });

    if (!created.ok) {
      // Notion's answer names the table's columns: it goes to the host's log, not to the browser.
      console.error("order-notion: save refused", created.status, created.data && created.data.code, created.data && created.data.message);
      return json(res, 502, { ok: false, error: "Notion save failed" });
    }
    return json(res, 201, { ok: true, reference });
  } catch (err) {
    console.error("order-notion: request failed", err && err.message);
    return json(res, 500, { ok: false, error: "Notion request failed" });
  }
}

module.exports = handler;
