'use strict';

const DISPLAY_NAME_OVERRIDES = {
  'GC=F': 'XAUUSD',
};

function buildMessage(symbol, signal) {
  const dot = signal.direction === 'up' ? '🟢' : '🔴';
  const action = signal.direction === 'up' ? 'Buy' : 'Sell';
  const label = DISPLAY_NAME_OVERRIDES[symbol] || symbol.replace('=X', '');
  return `${dot} ${action} ${label}`;
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
