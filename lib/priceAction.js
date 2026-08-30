// ตรรกะหลัก: ดึงราคา H1/M1 มาเช็ค sideway แล้วดูทิศทางเบรคเอาท์
const config = require("../config");
const { getIntradayCandles } = require("./priceData");
const { analyzeSideway, checkBreakout } = require("./indicators");

// ตัดแท่งสุดท้ายที่ยังไม่ปิด (Yahoo มักส่งแท่งปัจจุบันที่กำลังฟอร์มตัวมาด้วยเป็นแท่งท้ายสุด)
function dropFormingCandle(candles) {
  if (!candles || candles.length < 2) return candles || [];
  return candles.slice(0, candles.length - 1);
}

async function analyzeH1() {
  const raw = await getIntradayCandles(config.SYMBOL, config.H1_INTERVAL, config.H1_FETCH_RANGE, 3);
  if (!raw) return { ok: false, reason: "fetch_failed" };
  const closed = dropFormingCandle(raw);
  const result = analyzeSideway(closed, {
    lookback: config.H1_LOOKBACK,
    atrPeriod: config.H1_ATR_PERIOD,
    atrMult: config.H1_SIDEWAY_ATR_MULT,
  });
  return { ok: true, ...result };
}

async function analyzeM1() {
  const raw = await getIntradayCandles(config.SYMBOL, config.M1_INTERVAL, config.M1_FETCH_RANGE, 3);
  if (!raw) return { ok: false, reason: "fetch_failed" };
  const closed = dropFormingCandle(raw);
  const result = analyzeSideway(closed, {
    lookback: config.M1_LOOKBACK,
    atrPeriod: config.M1_ATR_PERIOD,
    atrMult: config.M1_SIDEWAY_ATR_MULT,
  });
  return { ok: true, ...result };
}

function breakoutFrom(analysis) {
  if (!analysis || !analysis.sideway) return { direction: null, price: null };
  return checkBreakout(analysis.range, analysis.latestClosed, config.BREAKOUT_BUFFER_PCT);
}

module.exports = { analyzeH1, analyzeM1, breakoutFrom };
