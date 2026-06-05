// Vercel serverless entrypoint.
// Routes every /api/* request to the Express app defined in ../index.js.
// The 60s maxDuration (set in vercel.json) keeps the Claude generation call
// from being killed by Vercel's default 10-second function timeout.
// The web page (public/index.html) is served by Vercel's native static hosting.

const app = require("../index.js");

module.exports = (req, res) => {
  // Be robust to however Vercel presents the path: ensure Express sees /api/...
  if (req.url && !req.url.startsWith("/api/") && req.url !== "/api") {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  return app(req, res);
};
