// Config สำหรับ News Reaction Bot (เวอร์ชัน Node.js)

const TRACKED_PAIRS = {
  "EURUSD": { currencies: ["EUR", "USD"], yfSymbol: "EURUSD=X" },
  "GBPUSD": { currencies: ["GBP", "USD"], yfSymbol: "GBPUSD=X" },
  "USDJPY": { currencies: ["USD", "JPY"], yfSymbol: "USDJPY=X" },
  "USDCHF": { currencies: ["USD", "CHF"], yfSymbol: "USDCHF=X" },
  "AUDUSD": { currencies: ["AUD", "USD"], yfSymbol: "AUDUSD=X" },
  "USDCAD": { currencies: ["USD", "CAD"], yfSymbol: "USDCAD=X" },
  "NZDUSD": { currencies: ["NZD", "USD"], yfSymbol: "NZDUSD=X" },
  "XAUUSD": { currencies: ["USD"], yfSymbol: "GC=F" }, // ทองคำ ผูกกับข่าว USD เป็นหลัก
};

const MIN_IMPACT = "High";

const WAIT_MINUTES_AFTER_NEWS = 3;      // รอกี่นาทีหลังข่าวก่อนเริ่มเช็ค breakout
const CONFIRM_WINDOW_MINUTES = 15;      // หน้าต่างเวลาที่ยังยอมรับสัญญาณ
const RANGE_LOOKBACK_MINUTES = 45;      // กรอบราคาก่อนข่าวเอามาจากกี่นาที
const BREAKOUT_BUFFER_PCT = 0.0005;     // ต้อง break เกินกรอบกี่% ถึงนับ (0.05%)

const FF_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

const STATE_PREFIX = "newsreact:";
const EVENT_STATE_TTL_SECONDS = 60 * 60 * 24; // 1 วัน
const CALENDAR_CACHE_TTL_SECONDS = 60 * 60;   // 1 ชั่วโมง

const DRY_RUN = (process.env.DRY_RUN || "false").toLowerCase() === "true";

module.exports = {
  TRACKED_PAIRS,
  MIN_IMPACT,
  WAIT_MINUTES_AFTER_NEWS,
  CONFIRM_WINDOW_MINUTES,
  RANGE_LOOKBACK_MINUTES,
  BREAKOUT_BUFFER_PCT,
  FF_CALENDAR_URL,
  STATE_PREFIX,
  EVENT_STATE_TTL_SECONDS,
  CALENDAR_CACHE_TTL_SECONDS,
  DRY_RUN,
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  LINE_TO_USER_ID: process.env.LINE_TO_USER_ID || "",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  CRON_SECRET: process.env.CRON_SECRET || "",
};
