// ghlWebhook.js
// Sends a generated email to the GoHighLevel inbound webhook as JSON.

/**
 * POST the email payload to the GHL webhook.
 * @param {{subject,body,preview,topic,type,generatedAt}} email
 * @returns {Promise<{ok:boolean, status:number, body:string}>}
 */
async function sendToGhl(email) {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) {
    throw new Error("GHL_WEBHOOK_URL is not set. Add your GoHighLevel inbound webhook URL.");
  }

  // The payload shape the GHL workflow expects. locationId is added when present.
  const payload = {
    subject: email.subject,
    body: email.body,
    preview: email.preview,
    topic: email.topic,
    type: email.type,
    generatedAt: email.generatedAt,
  };
  if (process.env.GHL_LOCATION_ID) payload.locationId = process.env.GHL_LOCATION_ID;

  console.log(`[ghlWebhook] POST -> ${url} | subject="${payload.subject}"`);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[ghlWebhook] network error:", e.message);
    throw new Error(`Could not reach GHL webhook: ${e.message}`);
  }

  const text = await res.text().catch(() => "");
  console.log(`[ghlWebhook] response ${res.status}`);
  if (!res.ok) {
    throw new Error(`GHL webhook returned ${res.status}: ${text || res.statusText}`);
  }
  return { ok: true, status: res.status, body: text };
}

module.exports = { sendToGhl };
