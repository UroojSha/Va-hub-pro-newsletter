# VA Hub Pro — Weekly Email System

Automated weekly email generator and sender for VA Hub Pro.

- **Every Monday at 9am US Eastern**, it generates a weekly email with the Claude API (following the VA Hub PRO email skill) and POSTs it to a GoHighLevel webhook.
- A **simple password-protected web page** lets Lawrence type a topic (or pick auto), generate, preview, and send instantly.

## How it works

```
Web page  ──┐
            ├─▶  /api routes (Express)  ──▶  emailAgent.js (Claude API)  ──▶  ghlWebhook.js  ──▶  GHL webhook
Vercel cron ┘        every Monday 9am ET → /api/cron → generate + send automatically
```

## Files

| File | Purpose |
|------|---------|
| `index.js` | Express server + all API routes + auth + cron handler |
| `emailAgent.js` | Claude API call; the full VA Hub PRO email skill is embedded as the system prompt |
| `ghlWebhook.js` | POSTs the generated email to the GHL webhook |
| `store.js` | In-memory record of the last sent email |
| `scheduler.js` | node-cron weekly job (used only when self-hosting; Vercel uses `vercel.json` crons) |
| `vercel.json` | Vercel build + weekly cron config |
| `public/index.html` | The web UI |
| `.env.example` | All environment variables |

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/generate` | Generate an email (preview only). Body: `{ topic?, type? }` |
| POST | `/api/send` | Send an email to GHL. Body: `{ subject, body, preview, topic, type, generatedAt }` |
| POST | `/api/generate-and-send` | Generate and send in one call |
| GET | `/api/status` | Last sent email info |
| GET/POST | `/api/cron` | The scheduled endpoint Vercel calls every Monday 9am ET |
| POST | `/api/login` | Validate the page password |

All routes except `/api/login` and `/api/cron` require the `x-app-password` header (the web page sends it automatically). `/api/cron` is protected by `CRON_SECRET`.

## Environment variables

See `.env.example`. The required ones:

| Variable | What it is |
|----------|-----------|
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `ANTHROPIC_MODEL` | Model (default `claude-sonnet-4-6`) |
| `GHL_WEBHOOK_URL` | GoHighLevel inbound webhook URL |
| `GHL_LOCATION_ID` | GHL location id (optional; added to payload when set) |
| `CRON_SECRET` | Protects the scheduled endpoint |
| `PAGE_PASSWORD` | Password for the web page |

## GHL webhook payload

```json
{
  "subject": "email subject here",
  "body": "full email body here",
  "preview": "preview text here",
  "topic": "topic used",
  "type": "issue type",
  "generatedAt": "timestamp"
}
```
(`locationId` is also included when `GHL_LOCATION_ID` is set.)

## Run locally

```sh
cp .env.example .env     # then fill in your keys
npm install
npm start                # http://localhost:3000
```

When self-hosting (not Vercel), `scheduler.js` runs the Monday 9am job in-process.

## Deploy to Vercel

1. Push this folder to a GitHub repo and import it into Vercel (or run `vercel`).
2. In **Project Settings → Environment Variables**, add all the variables from `.env.example`.
3. Deploy. Vercel reads `vercel.json` and registers the weekly cron automatically.

### About the cron time

Vercel crons run in **UTC** and do not follow daylight saving. The schedule is set to `0 13 * * 1` = **13:00 UTC**, which is **9am Eastern during EDT** (mid-March to early-November) and 8am Eastern during EST (winter). For winter-accurate 9am, change it to `0 14 * * 1`.

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to the cron path, so set `CRON_SECRET` in your Vercel env.

## Notes

- The email skill (format, voice rules, topic rotation, engagement devices, quality checklist, and worked examples) is embedded directly in `emailAgent.js`, so no external files are needed at runtime.
- "Last sent" status is in-memory and resets on redeploy/cold start. To make it durable, swap `store.js` for Vercel KV.
