// ดึงปฏิทินข่าวเศรษฐกิจจาก Forex Factory (unofficial JSON feed, ฟรี ไม่ต้อง API key)
const { FF_CALENDAR_URL, MIN_IMPACT } = require("../config");

const IMPACT_RANK = { Low: 1, Medium: 2, High: 3 };

async function fetchCalendarEvents() {
  let raw;
  try {
    const res = await fetch(FF_CALENDAR_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (e) {
    console.error("[calendarSource] fetch error:", e.message);
    return [];
  }

  const events = [];
  for (const ev of raw) {
    try {
      const impact = ev.impact || "Low";
      if ((IMPACT_RANK[impact] || 0) < (IMPACT_RANK[MIN_IMPACT] || 3)) continue;

      const dtRaw = ev.date;
      if (!dtRaw) continue;
      const dt = new Date(dtRaw);
      if (isNaN(dt.getTime())) continue;

      const currency = ev.country || "";
      const title = ev.title || "";
      const id = `${currency}_${title}_${dt.toISOString().slice(0, 16)}`.replace(/\s+/g, "_");

      events.push({ id, title, currency, impact, datetimeUtc: dt });
    } catch (e) {
      console.error("[calendarSource] skip malformed event:", e.message);
    }
  }
  return events;
}

function eventsRelevantToPair(events, currenciesForPair) {
  return events.filter((e) => currenciesForPair.includes(e.currency));
}

module.exports = { fetchCalendarEvents, eventsRelevantToPair };
