// store.js
// In-memory record of the last email sent. NOTE: on Vercel (serverless) this
// resets on cold starts / redeploys. That's an accepted trade-off for the MVP.
// To make it durable, swap these two functions for Vercel KV / a small DB.

let lastSent = null;

function setLastSent(info) {
  lastSent = info;
}

function getLastSent() {
  return lastSent;
}

module.exports = { setLastSent, getLastSent };
