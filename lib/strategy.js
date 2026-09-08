'use strict';

const { ema, rsi } = require('./indicators');

/**
 * Find every crossover between two EMA series.
 * Returns an array of { index, direction } where direction is 'up' (fast
 * crossed above slow) or 'down' (fast crossed below slow). `index` is the
 * bar where the cross is first confirmed (closed candle).
 */
function detectCrosses(fast, slow) {
  const crosses = [];
  let prevSign = null;
  for (let i = 0; i < fast.length; i++) {
    if (fast[i] === null || slow[i] === null) continue;
    const diff = fast[i] - slow[i];
    const sign = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    if (sign === 0) continue;
    if (prevSign !== null && sign !== prevSign) {
      crosses.push({ index: i, direction: sign === 1 ? 'up' : 'down' });
    }
    prevSign = sign;
  }
  return crosses;
}

/**
 * RSI direction check at `index`: must sit on the correct side of the
 * midline AND be sloping the same way, over the last `slopeLookback` bars.
 */
function rsiConfirms(rsiSeries, index, direction, midline, slopeLookback) {
  const cur = rsiSeries[index];
  const prevIdx = Math.max(0, index - slopeLookback);
  const prev = rsiSeries[prevIdx];
  if (cur === null || prev === null) return false;

  if (direction === 'up') {
    return cur > midline && cur > prev;
  }
  return cur < midline && cur < prev;
}

/**
 * Evaluate the strategy on a series of M1 candles (closed candles only —
 * caller is responsible for dropping any still-forming bar).
 *
 * candles: [{ time, open, high, low, close }, ...] oldest first.
 * `deps` optionally overrides the ema/rsi implementations - used by tests to
 * pin exact indicator values without hand-crafting hundreds of price bars.
 * Returns a signal object or null.
 */
function evaluate(candles, config, deps = {}) {
  const emaFn = deps.ema || ema;
  const rsiFn = deps.rsi || rsi;

  const n = candles.length;
  const minBars = config.EMA_LONG + config.MAX_BARS_BETWEEN_CROSSES + 5;
  if (n < minBars) {
    return { signal: null, reason: 'not_enough_bars' };
  }

  const closes = candles.map((c) => c.close);
  const emaFast = emaFn(closes, config.EMA_FAST); // 9
  const emaSlow = emaFn(closes, config.EMA_SLOW); // 20
  const emaMed = emaFn(closes, config.EMA_MED); // 50
  const emaLong = emaFn(closes, config.EMA_LONG); // 100
  const rsiSeries = rsiFn(closes, config.RSI_PERIOD);

  const latestIndex = n - 1;

  const fastSlowCrosses = detectCrosses(emaFast, emaSlow);
  const trigger = fastSlowCrosses.find((c) => c.index === latestIndex);
  if (!trigger) {
    return { signal: null, reason: 'no_fresh_ema9x20_cross' };
  }
  const direction = trigger.direction;

  const medLongCrosses = detectCrosses(emaMed, emaLong);
  const earliestAllowed = latestIndex - config.MAX_BARS_BETWEEN_CROSSES;
  const priorTrendCross = [...medLongCrosses]
    .reverse()
    .find(
      (c) =>
        c.direction === direction &&
        c.index < latestIndex &&
        c.index >= earliestAllowed
    );
  if (!priorTrendCross) {
    return { signal: null, reason: 'no_prior_ema50x100_cross', direction };
  }

  if (
    !rsiConfirms(
      rsiSeries,
      latestIndex,
      direction,
      config.RSI_MIDLINE,
      config.RSI_SLOPE_LOOKBACK
    )
  ) {
    return { signal: null, reason: 'rsi_not_aligned', direction };
  }

  return {
    signal: {
      direction,
      barsSinceTrendCross: latestIndex - priorTrendCross.index,
      trendCrossIndex: priorTrendCross.index,
      triggerIndex: latestIndex,
      close: closes[latestIndex],
      rsi: rsiSeries[latestIndex],
      time: candles[latestIndex].time,
    },
    reason: 'ok',
  };
}

module.exports = { detectCrosses, rsiConfirms, evaluate };
