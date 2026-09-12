'use strict';

/**
 * Fetch M5 candles for a symbol from Yahoo Finance's public chart API.
 * Drops the last candle unconditionally, since it is very likely still
 * forming (we only want closed candles feeding the strategy).
 *
 * Returns [{ time, open, high, low, close }, ...] oldest first, or throws.
 */
async function fetchCandles(symbol, config) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${config.INTERVAL}&range=${config.RANGE}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; forex-news_bot/1.0)' },
  });
  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status} for ${symbol}`);
  }
  const json = await res.json();

  const result = json && json.chart && json.chart.result && json.chart.result[0];
  if (!result) {
    const err = json && json.chart && json.chart.error;
    throw new Error(
      `No chart data for ${symbol}${err ? ': ' + JSON.stringify(err) : ''}`
    );
  }

  const timestamps = result.timestamp || [];
  const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
  const { open = [], high = [], low = [], close = [] } = quote;

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (
      open[i] == null ||
      high[i] == null ||
      low[i] == null ||
      close[i] == null
    ) {
      continue; // skip gaps
    }
    candles.push({
      time: timestamps[i],
      open: open[i],
      high: high[i],
      low: low[i],
      close: close[i],
    });
  }

  // Drop the last (still-forming) candle.
  if (candles.length > 0) candles.pop();

  return candles;
}

module.exports = { fetchCandles };
