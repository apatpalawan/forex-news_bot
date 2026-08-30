// Config สำหรับ Gold Sideway-Breakout Bot (H1 + M1)
// ตรรกะ: เช็ค H1 sideway ก่อน -> ถ้าใช่เช็ค M1 sideway -> ถ้า sideway ทั้งคู่ เช็คทิศทางเบรคเอาท์
// ถ้า H1 กับ M1 เบรคไปทางเดียวกัน -> แจ้งเตือนทันที (แจ้งซ้ำได้ถ้าเจอ sideway+breakout ใหม่อีกรอบ)

const SYMBOL = "GC=F"; // Gold futures (ใช้แทน XAUUSD บน Yahoo Finance)
const SYMBOL_LABEL = "GOLD (XAUUSD)";

// ----- H1 -----
const H1_INTERVAL = "60m";
const H1_FETCH_RANGE = "10d"; // ดึงมาเยอะพอสำหรับ lookback + ATR period
const H1_LOOKBACK = 20; // จำนวนแท่ง H1 ที่ใช้หากรอบ sideway
const H1_ATR_PERIOD = 14;
const H1_SIDEWAY_ATR_MULT = 2.5; // กรอบ (high-low) ต้อง <= ATR*ตัวคูณนี้ ถึงจะนับว่า sideway

// ----- M1 -----
const M1_INTERVAL = "1m";
const M1_FETCH_RANGE = "1d"; // Yahoo จำกัด 1m ไว้ไม่กี่วัน
const M1_LOOKBACK = 30; // จำนวนแท่ง M1 ที่ใช้หากรอบ sideway
const M1_ATR_PERIOD = 14;
const M1_SIDEWAY_ATR_MULT = 2.5;

// ----- Breakout -----
const BREAKOUT_BUFFER_PCT = 0.0005; // ต้อง break เกินกรอบกี่% ถึงนับว่าเบรคจริง (0.05%)

const STATE_PREFIX = "goldsw:";
const LAST_ALERT_STATE_KEY = "last_alert"; // เก็บ timestamp แท่ง M1 ล่าสุดที่แจ้งไปแล้ว กันแจ้งซ้ำแท่งเดิม
const STATE_TTL_SECONDS = 60 * 60 * 6; // 6 ชั่วโมง

const DRY_RUN = (process.env.DRY_RUN || "false").toLowerCase() === "true";

module.exports = {
  SYMBOL,
  SYMBOL_LABEL,
  H1_INTERVAL,
  H1_FETCH_RANGE,
  H1_LOOKBACK,
  H1_ATR_PERIOD,
  H1_SIDEWAY_ATR_MULT,
  M1_INTERVAL,
  M1_FETCH_RANGE,
  M1_LOOKBACK,
  M1_ATR_PERIOD,
  M1_SIDEWAY_ATR_MULT,
  BREAKOUT_BUFFER_PCT,
  STATE_PREFIX,
  LAST_ALERT_STATE_KEY,
  STATE_TTL_SECONDS,
  DRY_RUN,
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  LINE_TO_USER_ID: process.env.LINE_TO_USER_ID || "",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  CRON_SECRET: process.env.CRON_SECRET || "",
};
