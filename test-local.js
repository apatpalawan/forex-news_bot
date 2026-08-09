// สคริปต์ทดสอบก่อนใช้งานจริง (ทดลองก่อนรันจริงเสมอ)
// รันด้วย: DRY_RUN=true node test-local.js
process.env.DRY_RUN = process.env.DRY_RUN || "true";

const config = require("./config");
const { fetchCalendarEvents, eventsRelevantToPair } = require("./lib/calendarSource");
const { runScan } = require("./lib/scanRunner");

async function main() {
  console.log("=== ทดสอบดึงปฏิทินข่าว ===");
  const events = await fetchCalendarEvents();
  console.log(`พบ ${events.length} event impact=${config.MIN_IMPACT} ในสัปดาห์นี้\n`);

  for (const [pair, info] of Object.entries(config.TRACKED_PAIRS)) {
    const relevant = eventsRelevantToPair(events, info.currencies);
    if (relevant.length > 0) {
      console.log(`--- ${pair} (${relevant.length} events) ---`);
      for (const e of relevant.slice(0, 5)) {
        console.log(`  ${e.datetimeUtc.toLocaleString("th-TH")} | ${e.title} (${e.currency}, ${e.impact})`);
      }
      console.log();
    }
  }

  console.log("=== ทดสอบ runScan() แบบเต็ม (DRY_RUN, ไม่ยิง LINE จริง) ===");
  const result = await runScan();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
