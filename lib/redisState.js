// State storage ผ่าน Upstash Redis REST API (ใช้ fetch ธรรมดา ไม่ต้องพึ่ง library เพิ่ม)
const {
  UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN,
  STATE_PREFIX,
  EVENT_STATE_TTL_SECONDS,
} = require("../config");

function headers() {
  return { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };
}

function key(name) {
  return `${STATE_PREFIX}${name}`;
}

async function getJson(name) {
  if (!UPSTASH_REDIS_REST_URL) return null;
  try {
    const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key(name)}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result == null) return null;
    return JSON.parse(data.result);
  } catch (e) {
    console.error(`[redisState] getJson error for ${name}:`, e.message);
    return null;
  }
}

async function setJson(name, value, ttlSeconds = EVENT_STATE_TTL_SECONDS) {
  if (!UPSTASH_REDIS_REST_URL) {
    console.log("[redisState] UPSTASH_REDIS_REST_URL not set, skipping write");
    return false;
  }
  try {
    const payload = JSON.stringify(value);
    const setRes = await fetch(`${UPSTASH_REDIS_REST_URL}/set/${key(name)}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify([payload]),
    });
    await fetch(`${UPSTASH_REDIS_REST_URL}/expire/${key(name)}/${ttlSeconds}`, {
      method: "POST",
      headers: headers(),
    });
    return setRes.ok;
  } catch (e) {
    console.error(`[redisState] setJson error for ${name}:`, e.message);
    return false;
  }
}

module.exports = { getJson, setJson };
