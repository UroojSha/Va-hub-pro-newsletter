// index.js
// Express server for the VA Hub PRO weekly email system.
// Routes: /api/generate, /api/send, /api/generate-and-send, /api/status,
// /api/cron (scheduled), /api/login. Serves the web UI from /public.

// Load .env for local development (no effect on Vercel, which injects env vars).
try { require("dotenv").config(); } catch (_) {}

const path = require("path");
const express = require("express");
const { generateEmail } = require("./emailAgent");
const { sendToGhl } = require("./ghlWebhook");
const { setLastSent, getLastSent } = require("./store");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- auth ----------

// Simple shared-secret auth for the web UI. The front-end sends the password in
// the "x-app-password" header on every API call. If PAGE_PASSWORD isn't set
// (e.g. local dev), the gate is open.
function requireAuth(req, res, next) {
  const pw = process.env.PAGE_PASSWORD;
  if (!pw) return next();
  const given = req.headers["x-app-password"] || (req.body && req.body.password);
  if (given === pw) return next();
  return res.status(401).json({ error: "Unauthorized. Wrong or missing password." });
}

// The cron endpoint accepts: Vercel's bearer token (CRON_SECRET), the page
// password (manual "run now" button), or ?secret= for manual curl tests.
function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  const pw = process.env.PAGE_PASSWORD;
  const auth = req.headers["authorization"] || "";
  if (secret && auth === `Bearer ${secret}`) return true;
  if (secret && req.query.secret === secret) return true;
  if (pw && req.headers["x-app-password"] === pw) return true;
  // If neither secret nor password is configured at all, allow (dev only).
  if (!secret && !pw) return true;
  return false;
}

// ---------- core pipeline ----------

async function generateAndSend({ topic, type }) {
  const email = await generateEmail({ topic, type });
  const delivery = await sendToGhl(email);
  const record = {
    subject: email.subject,
    preview: email.preview,
    topic: email.topic,
    type: email.type,
    generatedAt: email.generatedAt,
    sentAt: new Date().toISOString(),
    deliveryStatus: delivery.status,
  };
  setLastSent(record);
  return { email, delivery, record };
}

// ---------- routes ----------

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Validate the page password (used by the login screen).
app.post("/api/login", (req, res) => {
  const pw = process.env.PAGE_PASSWORD;
  if (!pw) return res.json({ ok: true, note: "No password configured." });
  if (req.body && req.body.password === pw) return res.json({ ok: true });
  return res.status(401).json({ ok: false, error: "Wrong password." });
});

// Generate an email (preview only, does not send).
app.post("/api/generate", requireAuth, async (req, res) => {
  try {
    const { topic, type } = req.body || {};
    const email = await generateEmail({ topic, type });
    res.json({ ok: true, email });
  } catch (e) {
    console.error("[/api/generate] error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Send an already-generated email to GHL.
app.post("/api/send", requireAuth, async (req, res) => {
  try {
    const { subject, body, preview, topic, type, generatedAt } = req.body || {};
    if (!subject || !body) {
      return res.status(400).json({ ok: false, error: "subject and body are required." });
    }
    const email = {
      subject,
      body,
      preview: preview || "",
      topic: topic || "(manual)",
      type: type || "manual",
      generatedAt: generatedAt || new Date().toISOString(),
    };
    const delivery = await sendToGhl(email);
    const record = {
      subject: email.subject,
      preview: email.preview,
      topic: email.topic,
      type: email.type,
      generatedAt: email.generatedAt,
      sentAt: new Date().toISOString(),
      deliveryStatus: delivery.status,
    };
    setLastSent(record);
    res.json({ ok: true, delivery, record });
  } catch (e) {
    console.error("[/api/send] error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Generate and send in one call.
app.post("/api/generate-and-send", requireAuth, async (req, res) => {
  try {
    const { topic, type } = req.body || {};
    const result = await generateAndSend({ topic, type });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[/api/generate-and-send] error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Last sent email info.
app.get("/api/status", requireAuth, (_req, res) => {
  res.json({ ok: true, lastSent: getLastSent() });
});

// Scheduled endpoint. Vercel cron hits this (GET) every Monday; also callable
// manually (POST) from the web page's "run now" test button.
async function cronHandler(req, res) {
  if (!authorizeCron(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized cron request." });
  }
  try {
    console.log("[/api/cron] weekly auto-send triggered");
    const result = await generateAndSend({ topic: "", type: "auto" });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[/api/cron] error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
}
app.get("/api/cron", cronHandler);
app.post("/api/cron", cronHandler);

// Fallback to the web UI for any other GET.
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// ---------- start (local) / export (Vercel) ----------

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`VA Hub PRO email server running on http://localhost:${port}`));

  // Start the in-process weekly scheduler ONLY when running as a long-lived
  // server (local or a VPS). On Vercel, vercel.json crons call /api/cron instead.
  if (!process.env.VERCEL) {
    try {
      require("./scheduler").start(generateAndSend);
    } catch (e) {
      console.warn("[scheduler] not started:", e.message);
    }
  }
}

module.exports = app;
