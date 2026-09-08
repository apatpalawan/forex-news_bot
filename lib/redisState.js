'use strict';

const BASE_URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function configured() {
  return Boolean(BASE_URL && TOKEN);
}

async function call(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Upstash HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Returns true if this exact signal (symbol + direction + trigger bar time)
 * has already been alerted, and records it if not.
 * Fails "open" (treats as not-yet-alerted) if Redis isn't configured or
 * errors out, so a Redis hiccup never silently swallows a real signal.
 */
async function alreadyAlerted(key, ttlSeconds) {
  if (!configured()) return false;
  try {
    const getResult = await call(`/get/${encodeURIComponent(key)}`);
    if (getResult.result) return true;
    await call(`/set/${encodeURIComponent(key)}/1/EX/${ttlSeconds}`);
    return false;
  } catch (err) {
    console.error('Redis state check failed, proceeding without dedup:', err.message);
    return false;
  }
}

module.exports = { alreadyAlerted, configured };
