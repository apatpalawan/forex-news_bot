// Logic หลัก: จับกรอบราคาก่อนข่าว แล้วเช็คว่าหลังข่าวออก ราคา break กรอบนั้นแบบยืนยันแล้วหรือยัง
const { RANGE_LOOKBACK_MINUTES, BREAKOUT_BUFFER_PCT } = require("../config");
const { getIntradayCandles } = require("./priceData");

async function computePreNewsRange(symbol, eventTimeUtc) {
  const candles = await getIntradayCandles(symbol, "5m", "1d", 3);
  if (!candles || candles.length === 0) return null;

  const windowStart = new Date(eventTimeUtc.getTime() - RANGE_LOOKBACK_MINUTES * 60000);
  let windowCandles = candles.filter(
    (c) => c.time >= windowStart && c.time < eventTimeUtc
  );

  if (windowCandles.length === 0) {
    // เผื่อไม่มีแท่งในช่วงนั้น (เช่นตลาดเงียบ) ใช้ 10 แท่งล่าสุดก่อนข่าวแทน
    windowCandles = candles.filter((c) => c.time < eventTimeUtc).slice(-10);
  }
  if (windowCandles.length === 0) return null;

  return {
    high: Math.max(...windowCandles.map((c) => c.high)),
    low: Math.min(...windowCandles.map((c) => c.low)),
  };
}

async function checkBreakoutConfirmed(symbol, preNewsRange) {
  const candles = await getIntradayCandles(symbol, "5m", "1d", 3);
  if (!candles || candles.length < 2) {
    return { direction: null, price: null, level: null };
  }

  // แท่งสุดท้ายอาจยังไม่ปิดสมบูรณ์ ใช้แท่งก่อนหน้าที่ปิดแล้วแทน
  const lastClosed = candles[candles.length - 2];
  const closePrice = lastClosed.close;

  const { high, low } = preNewsRange;
  const upLevel = high * (1 + BREAKOUT_BUFFER_PCT);
  const downLevel = low * (1 - BREAKOUT_BUFFER_PCT);

  if (closePrice > upLevel) return { direction: "up", price: closePrice, level: high };
  if (closePrice < downLevel) return { direction: "down", price: closePrice, level: low };
  return { direction: null, price: closePrice, level: null };
}

module.exports = { computePreNewsRange, checkBreakoutConfirmed };
