'use strict';

function buildMessage(symbol, signal) {
  const arrow = signal.direction === 'up' ? '🟢 BUY' : '🔴 SELL';
  const label = symbol.replace('=X', '');
  const priceDecimals = signal.close < 50 ? 4 : 2;
  return (
    `${arrow} ${label} (M1)\n` +
    `EMA50x100 → EMA9x20 + RSI ยืนยันทิศทางเดียวกัน\n` +
    `ราคา: ${signal.close.toFixed(priceDecimals)}  RSI: ${signal.rsi.toFixed(1)}`
  );
}

async function sendLine(message, config) {
  if (config.DRY_RUN) {
    console.log('[DRY_RUN] Would send LINE message:\n' + message);
    return { sent: false, dryRun: true };
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_TO_USER_ID;
  if (!token || !to) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN or LINE_TO_USER_ID missing');
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text: message }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE push failed HTTP ${res.status}: ${body}`);
  }
  return { sent: true, dryRun: false };
}

module.exports = { buildMessage, sendLine };
