'use strict';

const config = require('../config');
const { fetchCandles } = require('../lib/dataFetcher');
const { evaluate } = require('../lib/strategy');
const { alreadyAlerted } = require('../lib/redisState');
const { buildMessage, sendLine } = require('../lib/lineNotify');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runScan() {
  const checked = [];
  const alerts = [];

  for (const symbol of config.SYMBOLS) {
    try {
      const candles = await fetchCandles(symbol, config);
      const { signal, reason } = evaluate(candles, config);
      checked.push({ symbol, bars: candles.length, reason });

      if (signal) {
        const key = `${config.REDIS_KEY_PREFIX}${symbol}:${signal.direction}:${signal.time}`;
        const dup = await alreadyAlerted(key, config.REDIS_STATE_TTL_SECONDS);
        if (!dup) {
          const message = buildMessage(symbol, signal);
          const result = await sendLine(message, config);
          alerts.push({ symbol, direction: signal.direction, ...result });
        }
      }
    } catch (err) {
      checked.push({ symbol, error: err.message });
    }
    await sleep(config.INTER_SYMBOL_DELAY_MS);
  }

  return { status: 'ok', checked, alerts };
}

module.exports = async (req, res) => {
  if (config.CRON_SECRET) {
    const secret = req.query && req.query.secret;
    if (secret !== config.CRON_SECRET) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  try {
    const result = await runScan();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports.runScan = runScan;
