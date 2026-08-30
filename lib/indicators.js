// ตัวช่วยคำนวณ ATR และเช็ค sideway/breakout จากชุดแท่งเทียน (candles = [{time, open, high, low, close}, ...] เรียงเก่า->ใหม่)

// คำนวณ True Range แต่ละแท่ง แล้ว average ย้อนหลัง `period` แท่ง (simple moving average ของ TR)
function computeATR(candles, period) {
  if (!candles || candles.length < period + 1) return null;

  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose)
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  const lastN = trs.slice(-period);
  return lastN.reduce((a, b) => a + b, 0) / lastN.length;
}

// เช็คว่า `lookback` แท่งล่าสุด (ไม่รวมแท่งที่กำลังฟอร์มตัว/แท่งอ้างอิงเบรคเอาท์) เคลื่อนไหวแบบ sideway หรือไม่
// คืนค่า sideway (bool), range {high, low}, atr, latestClosed (แท่งถัดจาก window ที่ใช้เช็คเบรคเอาท์)
function analyzeSideway(candles, { lookback, atrPeriod, atrMult }) {
  // candles ควรเป็นแท่งที่ปิดแล้วทั้งหมด (ตัดแท่งที่ยังฟอร์มตัวออกก่อนเรียกฟังก์ชันนี้)
  const needed = lookback + 1; // +1 สำหรับแท่งล่าสุดที่เก็บไว้เช็คเบรคเอาท์แยกจาก window
  if (!candles || candles.length < needed + atrPeriod) {
    return { sideway: false, reason: "not_enough_data" };
  }

  const latestClosed = candles[candles.length - 1];
  const windowCandles = candles.slice(-(lookback + 1), -1); // lookback แท่งก่อนหน้าแท่งล่าสุด

  const atrSource = candles.slice(0, candles.length - 1); // ไม่รวมแท่งล่าสุดที่กันไว้เช็คเบรคเอาท์
  const atr = computeATR(atrSource, atrPeriod);
  if (atr == null || atr === 0) {
    return { sideway: false, reason: "no_atr" };
  }

  const high = Math.max(...windowCandles.map((c) => c.high));
  const low = Math.min(...windowCandles.map((c) => c.low));
  const range = high - low;

  const sideway = range <= atr * atrMult;

  return { sideway, range: { high, low }, atr, rangeSize: range, latestClosed };
}

// เช็คทิศทางเบรคเอาท์ของ `latestClosed` เทียบกับกรอบ range ที่ได้จาก analyzeSideway
function checkBreakout(range, latestClosed, bufferPct) {
  if (!range || !latestClosed) return { direction: null, price: null };
  const closePrice = latestClosed.close;
  const upLevel = range.high * (1 + bufferPct);
  const downLevel = range.low * (1 - bufferPct);

  if (closePrice > upLevel) return { direction: "up", price: closePrice };
  if (closePrice < downLevel) return { direction: "down", price: closePrice };
  return { direction: null, price: closePrice };
}

module.exports = { computeATR, analyzeSideway, checkBreakout };
