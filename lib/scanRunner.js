// ตรรกะหลักของการ scan แต่ละรอบ (เรียกจาก api/scan.js และ test-local.js)
// 1) เช็ค H1 sideway ก่อน ถ้าไม่ sideway -> จบรอบ ไม่แจ้งเตือน
// 2) เช็ค M1 sideway ต่อ ถ้าไม่ sideway -> จบรอบ ไม่แจ้งเตือน
// 3) ถ้า sideway ทั้งคู่ เช็คทิศทางเบรคเอาท์ของ H1 และ M1 ถ้าตรงกัน -> แจ้งเตือนทันที
// 4) กันแจ้งซ้ำเฉพาะแท่ง M1 เดิม/ทิศทางเดิม ถ้าเป็นแท่งใหม่หรือทิศทางใหม่ แจ้งซ้ำได้
const config = require("../config");
const redisState = require("./redisState");
const { analyzeH1, analyzeM1, breakoutFrom } = require("./priceAction");
const { sendLineMessage } = require("./lineNotify");

function formatAlert(direction, h1, m1, breakoutM1) {
  const arrow = direction === "up" ? "🔼 ขึ้น" : "🔽 ลง";
  const price = breakoutM1.price != null ? breakoutM1.price.toFixed(2) : "-";
  return (
    `🥇 GOLD BREAKOUT ${arrow}\n` +
    `H1 + M1 sideway แล้วเบรคทางเดียวกัน\n` +
    `ราคา: ${price}`
  );
}

async function runScan() {
  const h1 = await analyzeH1();
  if (!h1.ok) {
    return { status: "ok", note: `H1 fetch failed: ${h1.reason}`, alerted: false };
  }
  if (!h1.sideway) {
    return { status: "ok", note: "H1 not sideway", alerted: false };
  }

  const m1 = await analyzeM1();
  if (!m1.ok) {
    return { status: "ok", note: `M1 fetch failed: ${m1.reason}`, alerted: false };
  }
  if (!m1.sideway) {
    return { status: "ok", note: "H1 sideway, M1 not sideway", alerted: false };
  }

  const breakoutH1 = breakoutFrom(h1);
  const breakoutM1 = breakoutFrom(m1);

  if (!breakoutH1.direction || !breakoutM1.direction || breakoutH1.direction !== breakoutM1.direction) {
    return {
      status: "ok",
      note: "both sideway but no matching breakout direction",
      h1Direction: breakoutH1.direction,
      m1Direction: breakoutM1.direction,
      alerted: false,
    };
  }

  const direction = breakoutM1.direction;
  const m1CandleTime = m1.latestClosed ? m1.latestClosed.time.toISOString() : null;

  // กันแจ้งซ้ำเฉพาะแท่ง M1 เดิม + ทิศทางเดิมที่เพิ่งแจ้งไป
  const stateKey = config.LAST_ALERT_STATE_KEY;
  const prevState = (await redisState.getJson(stateKey)) || {};
  if (prevState.m1CandleTime === m1CandleTime && prevState.direction === direction) {
    return {
      status: "ok",
      note: "already alerted for this M1 candle/direction",
      direction,
      alerted: false,
    };
  }

  const msg = formatAlert(direction, h1, m1, breakoutM1);
  const sent = await sendLineMessage(msg);

  await redisState.setJson(
    stateKey,
    { m1CandleTime, direction, sentOk: sent },
    config.STATE_TTL_SECONDS
  );

  return {
    status: "ok",
    note: "alert sent",
    direction,
    price: breakoutM1.price,
    lineSent: sent,
    alerted: true,
  };
}

module.exports = { runScan };
