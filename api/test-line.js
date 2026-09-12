'use strict';

const config = require('../config');

module.exports = async (req, res) => {
  if (config.CRON_SECRET) {
    const secret = req.query && req.query.secret;
    if (secret !== config.CRON_SECRET) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_TO_USER_ID;
  if (!token || !to) {
    res.status(500).json({
      error: 'LINE_CHANNEL_ACCESS_TOKEN or LINE_TO_USER_ID missing in env vars',
    });
    return;
  }

  const message =
    `✅ ทดสอบระบบ forex-news_bot v2\n` +
    `EMA100x300 + RSI (M5)\n` +
    `เวลา: ${new Date().toISOString()}`;

  try {
    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
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

    if (!lineRes.ok) {
      const body = await lineRes.text();
      res.status(502).json({ error: `LINE push failed HTTP ${lineRes.status}`, body });
      return;
    }

    res.status(200).json({ status: 'ok', sent: true, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
