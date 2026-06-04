// scheduler.js
// In-process weekly scheduler for when the app runs as a long-lived server
// (local machine or a VPS). On Vercel this is NOT used — vercel.json crons call
// /api/cron instead, because serverless functions don't stay running.
//
// Schedule: every Monday at 9:00 AM US Eastern.

const cron = require("node-cron");

const SCHEDULE = process.env.CRON_SCHEDULE || "0 9 * * 1"; // Mon 09:00
const TZ = process.env.CRON_TZ || "America/New_York";

/**
 * Start the weekly job.
 * @param {(opts:{topic:string,type:string})=>Promise<any>} generateAndSend
 */
function start(generateAndSend) {
  if (!cron.validate(SCHEDULE)) {
    console.warn(`[scheduler] invalid CRON_SCHEDULE "${SCHEDULE}", not scheduling.`);
    return;
  }
  cron.schedule(
    SCHEDULE,
    async () => {
      console.log(`[scheduler] weekly auto-send firing (${SCHEDULE} ${TZ})`);
      try {
        await generateAndSend({ topic: "", type: "auto" });
        console.log("[scheduler] weekly email sent.");
      } catch (e) {
        console.error("[scheduler] failed:", e.message);
      }
    },
    { timezone: TZ }
  );
  console.log(`[scheduler] weekly job scheduled: "${SCHEDULE}" (${TZ})`);
}

module.exports = { start };
