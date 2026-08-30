// สคริปต์ทดสอบก่อนใช้งานจริง (ทดลองก่อนรันจริงเสมอ)
// รันด้วย: DRY_RUN=true node test-local.js
process.env.DRY_RUN = process.env.DRY_RUN || "true";

const config = require("./config");
const { analyzeH1, analyzeM1, breakoutFrom } = require("./lib/priceAction");
const { runScan } = require("./lib/scanRunner");

function printAnalysis(label, a) {
  console.log(`--- ${label} ---`);
  if (!a.ok) {
    console.log(`  ดึงข้อมูลไม่สำเร็จ: ${a.reason}`);
    return;
  }
  console.log(`  sideway: ${a.sideway}`);
  if (a.range) {
    console.log(`  range: ${a.range.low.toFixed(2)} - ${a.range.high.toFixed(2)}`);
  }
  if (a.atr != null) console.log(`  ATR: ${a.atr.toFixed(3)}`);
  if (a.rangeSize != null) console.log(`  rangeSize: ${a.rangeSize.toFixed(3)}`);
  if (a.latestClosed) {
    console.log(`  แท่งล่าสุด (ปิดแล้ว): ${a.latestClosed.time.toISOString()} close=${a.latestClosed.close}`);
  }
  console.log();
}

async function main() {
  console.log(`=== ทดสอบ ${config.SYMBOL_LABEL} (${config.SYMBOL}) ===\n`);

  console.log("=== ทดสอบ H1 sideway ===");
  const h1 = await analyzeH1();
  printAnalysis("H1", h1);
  if (h1.ok) {
    const bH1 = breakoutFrom(h1);
    console.log(`  breakout H1: direction=${bH1.direction} price=${bH1.price}\n`);
  }

  console.log("=== ทดสอบ M1 sideway ===");
  const m1 = await analyzeM1();
  printAnalysis("M1", m1);
  if (m1.ok) {
    const bM1 = breakoutFrom(m1);
    console.log(`  breakout M1: direction=${bM1.direction} price=${bM1.price}\n`);
  }

  console.log("=== ทดสอบ runScan() แบบเต็ม (DRY_RUN, ไม่ยิง LINE จริง) ===");
  const result = await runScan();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
