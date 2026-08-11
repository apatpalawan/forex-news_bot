// ตรรกะหลักของการ scan แต่ละรอบ (เรียกจาก api/scan.js และ test-local.js)
const config = require("../config");
const redisState = require("./redisState");
const { fetchCalendarEvents, eventsRelevantToPair } = require("./calendarSource");
const { computePreNewsRange, checkBreakoutConfirmed } = require("./priceAction");
const { sendLineMessage } = require("./lineNotify");

const CALENDAR_CACHE_KEY = "calendar_cache";

async function getCalendarCached() {
  const cached = await redisState.getJson(CALENDAR_CACHE_KEY);
  if (cached != null) {
    return cached.map((e) => ({ ...e, datetimeUtc: new Date(e.datetimeUtc) }));
  }
  const events = await fetchCalendarEvents();
  if (events.length > 0) {
    const serializable = events.map((e) => ({ ...e, datetimeUtc: e.datetimeUtc.toISOString() }));
    await redisState.setJson(CALENDAR_CACHE_KEY, serializable, config.CALENDAR_CACHE_TTL_SECONDS);
  }
  return events;
}

function formatPreNewsAlert(pairLabels, event, minutesUntil) {
  const eventTimeLocal = event.datetimeUtc.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    `⏰ ข่าวใกล้เข้ามาแล้ว\n` +
    `คู่เงินที่เกี่ยวข้อง: ${pairLabels.join(", ")}\n` +
    `ข่าว: ${event.title} (${event.currency}, Impact: ${event.impact})\n` +
    `จะออกในอีกประมาณ ${minutesUntil} นาที (เวลา ${eventTimeLocal})\n` +
    `ℹ️ นี่เป็นการแจ้งเตือนว่ามีข่าวใกล้เข้ามาเท่านั้น ไม่ใช่การคาดการณ์ทิศทาง ` +
    `ระวังสเปรดกว้างและความผันผวนช่วงข่าวออก`
  );
}

function formatAlert(pairLabel, event, breakout) {
  const directionTh = breakout.direction === "up" ? "ขึ้น 🔼" : "ลง 🔽";
  const eventTimeLocal = event.datetimeUtc.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    `📰 News Reaction Alert\n` +
    `คู่เงิน: ${pairLabel}\n` +
    `ข่าว: ${event.title} (${event.currency}, Impact: ${event.impact})\n` +
    `เวลาข่าว: ${eventTimeLocal}\n` +
    `ราคา break ยืนยันแล้ว ทิศทาง: ${directionTh}\n` +
    `ราคาที่ break: ${breakout.price.toFixed(5)} (กรอบอ้างอิง: ${breakout.level.toFixed(5)})\n` +
    `⚠️ นี่คือการยืนยันจาก price action ที่เกิดขึ้นแล้ว ไม่ใช่การพยากรณ์ล่วงหน้า ` +
    `โปรดพิจารณาความเสี่ยง/spread ก่อนเข้าออเดอร์`
  );
}

async function runScan() {
  const now = new Date();
  const events = await getCalendarCached();
  if (!events || events.length === 0) {
    return { status: "ok", note: "no calendar events fetched", checked: 0 };
  }

  const alerts = [];

  // ===== รอบที่ 1: แจ้งเตือนล่วงหน้าแบบรวม 1 ข้อความต่อข่าว (ไม่แยกต่อคู่เงิน) =====
  for (const event of events) {
    const eventTime = event.datetimeUtc;
    const preAlertFrom = new Date(
      eventTime.getTime() - config.PRE_NEWS_ALERT_MINUTES_BEFORE * 60000
    );

    // ข้ามถ้ายังไม่ถึงช่วงแจ้งเตือน หรือข่าวออกไปแล้ว
    if (now < preAlertFrom || now >= eventTime) continue;

    // หาคู่เงินที่ track อยู่ทั้งหมดที่เกี่ยวข้องกับข่าวนี้
    const matchingPairs = Object.entries(config.TRACKED_PAIRS)
      .filter(([, pairInfo]) => pairInfo.currencies.includes(event.currency))
      .map(([pairSymbol]) => pairSymbol);
    if (matchingPairs.length === 0) continue;

    const preAlertStateKey = `preAlert:${event.id}`;
    const preState = (await redisState.getJson(preAlertStateKey)) || {};
    if (preState.sent) continue;

    const minutesUntil = Math.round((eventTime.getTime() - now.getTime()) / 60000);
    const msg = formatPreNewsAlert(matchingPairs, event, minutesUntil);
    const sent = await sendLineMessage(msg);
    preState.sent = true;
    preState.sentOk = sent;
    await redisState.setJson(preAlertStateKey, preState);
    alerts.push({
      pairs: matchingPairs,
      event: event.title,
      type: "pre_news",
      lineSent: sent,
    });
  }

  // ===== รอบที่ 2: จับกรอบราคาก่อนข่าว + ยืนยัน breakout (ต่อคู่เงิน เหมือนเดิม) =====
  for (const [pairSymbol, pairInfo] of Object.entries(config.TRACKED_PAIRS)) {
    const relevant = eventsRelevantToPair(events, pairInfo.currencies);

    for (const event of relevant) {
      const eventTime = event.datetimeUtc;
      const stateKey = `event:${pairSymbol}:${event.id}`;
      const state = (await redisState.getJson(stateKey)) || {};

      const waitUntil = new Date(eventTime.getTime() + config.WAIT_MINUTES_AFTER_NEWS * 60000);
      const confirmDeadline = new Date(eventTime.getTime() + config.CONFIRM_WINDOW_MINUTES * 60000);
      const captureFrom = new Date(eventTime.getTime() - 5 * 60000);

      // ข้าม event ที่เก่าเกินไป หรือยังไกลเกินไป (ประหยัด API calls)
      if (
        now < new Date(captureFrom.getTime() - 10 * 60000) ||
        now > new Date(confirmDeadline.getTime() + 5 * 60000)
      ) {
        continue;
      }

      // ขั้น 1: capture pre-news range (ทำครั้งเดียวต่อ event)
      if (!state.range && now >= captureFrom) {
        const rng = await computePreNewsRange(pairInfo.yfSymbol, eventTime);
        if (rng) {
          state.range = rng;
          await redisState.setJson(stateKey, state);
        }
      }

      // ขั้น 2: เช็ค breakout ถ้าอยู่ในช่วงเวลาที่เหมาะสมและยังไม่เคยยิง
      if (state.range && !state.alerted && now >= waitUntil && now <= confirmDeadline) {
        const breakout = await checkBreakoutConfirmed(pairInfo.yfSymbol, state.range);
        if (breakout.direction) {
          const msg = formatAlert(pairSymbol, event, breakout);
          const sent = await sendLineMessage(msg);
          state.alerted = true;
          state.alertSentOk = sent;
          await redisState.setJson(stateKey, state);
          alerts.push({
            pair: pairSymbol,
            event: event.title,
            direction: breakout.direction,
            lineSent: sent,
          });
        }
      }
    }
  }

  return { status: "ok", checked: events.length, alerts };
}

module.exports = { runScan };
