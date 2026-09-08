'use strict';

const assert = require('assert');
const { ema, rsi } = require('./lib/indicators');
const { detectCrosses, rsiConfirms, evaluate } = require('./lib/strategy');
const config = require('./config');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL - ${name}`);
    console.log(`         ${err.message}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// 1. indicators.js vs. a small independent reference implementation
// ---------------------------------------------------------------------------
section('indicators: ema()');

function referenceEma(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

test('ema matches an independent reference implementation', () => {
  const values = [10, 11, 12, 11, 13, 14, 15, 14, 16, 17, 18, 17, 19, 20];
  const got = ema(values, 5);
  const want = referenceEma(values, 5);
  for (let i = 0; i < values.length; i++) {
    if (want[i] === null) {
      assert.strictEqual(got[i], null, `index ${i} should be null`);
    } else {
      assert.ok(
        Math.abs(got[i] - want[i]) < 1e-9,
        `index ${i}: got ${got[i]}, want ${want[i]}`
      );
    }
  }
});

test('ema returns all-null when there is not enough data', () => {
  const out = ema([1, 2, 3], 9);
  assert.ok(out.every((v) => v === null));
});

section('indicators: rsi()');

test('rsi is 100 for a strictly rising series with zero losses', () => {
  const values = [];
  for (let i = 0; i < 20; i++) values.push(100 + i);
  const out = rsi(values, 14);
  assert.strictEqual(out[19], 100);
});

test('rsi is 0 for a strictly falling series with zero gains', () => {
  const values = [];
  for (let i = 0; i < 20; i++) values.push(100 - i);
  const out = rsi(values, 14);
  assert.strictEqual(out[19], 0);
});

test('rsi is near 50 for a flat series', () => {
  const values = new Array(20).fill(100);
  const out = rsi(values, 14);
  assert.ok(Math.abs(out[19] - 50) < 1e-6);
});

test('rsi is null before the warm-up period', () => {
  const values = [];
  for (let i = 0; i < 10; i++) values.push(100 + i);
  const out = rsi(values, 14);
  assert.ok(out.every((v) => v === null));
});

// ---------------------------------------------------------------------------
// 2. detectCrosses() and rsiConfirms() with tiny hand-crafted arrays
// ---------------------------------------------------------------------------
section('strategy: detectCrosses()');

test('detects a single up-cross', () => {
  const fast = [1, 1, 1, 3];
  const slow = [2, 2, 2, 2];
  // ties (equal values) never count as a cross - the flip must be confirmed
  // against the last *non-tied* sign, so the cross lands where fast finally
  // clears slow, not where the diff first touches zero.
  const crosses = detectCrosses(fast, slow);
  assert.deepStrictEqual(crosses, [{ index: 3, direction: 'up' }]);
});

test('detects a single down-cross', () => {
  const fast = [3, 3, 3, 1];
  const slow = [2, 2, 2, 2];
  const crosses = detectCrosses(fast, slow);
  assert.deepStrictEqual(crosses, [{ index: 3, direction: 'down' }]);
});

test('detects multiple alternating crosses in order', () => {
  const fast = [1, 3, 1, 3, 1];
  const slow = [2, 2, 2, 2, 2];
  const crosses = detectCrosses(fast, slow);
  assert.deepStrictEqual(crosses, [
    { index: 1, direction: 'up' },
    { index: 2, direction: 'down' },
    { index: 3, direction: 'up' },
    { index: 4, direction: 'down' },
  ]);
});

test('ignores leading nulls, and a tie right after nulls establishes no prior sign', () => {
  const fast = [null, null, 2, 2, 3];
  const slow = [null, null, 2, 2, 2];
  // index 2,3 are exact ties (diff 0, skipped) right after the leading nulls,
  // so no sign is ever established before the up-move at index 4 - nothing
  // to have "crossed" from, so this does NOT count as a cross.
  const crosses = detectCrosses(fast, slow);
  assert.deepStrictEqual(crosses, []);
});

test('a real established sign followed by a tie-through then a flip is a cross', () => {
  const fast = [null, null, 1, 2, 2, 4];
  const slow = [null, null, 2, 2, 2, 2];
  // index 2: diff -1 (real sign, established); index 3: tie (skipped);
  // index 5: diff +2 -> flips from the established -1 sign -> cross at 5
  const crosses = detectCrosses(fast, slow);
  assert.deepStrictEqual(crosses, [{ index: 5, direction: 'up' }]);
});

section('strategy: rsiConfirms()');

test('up direction requires above midline AND rising', () => {
  const series = [40, 45, 55, 60];
  assert.strictEqual(rsiConfirms(series, 3, 'up', 50, 2), true);
});

test('up direction rejected when below midline even if rising', () => {
  const series = [30, 35, 40, 45];
  assert.strictEqual(rsiConfirms(series, 3, 'up', 50, 2), false);
});

test('up direction rejected when above midline but falling', () => {
  const series = [70, 65, 60, 55];
  assert.strictEqual(rsiConfirms(series, 3, 'up', 50, 2), false);
});

test('down direction requires below midline AND falling', () => {
  const series = [60, 55, 45, 40];
  assert.strictEqual(rsiConfirms(series, 3, 'down', 50, 2), true);
});

// ---------------------------------------------------------------------------
// 3. evaluate() edge cases via dependency injection (mocked ema/rsi)
// ---------------------------------------------------------------------------
section('strategy: evaluate() edge cases (mocked indicators)');

function makeCandles(count) {
  const candles = [];
  for (let i = 0; i < count; i++) {
    candles.push({ time: 1700000000 + i * 60, open: 100, high: 100, low: 100, close: 100 });
  }
  return candles;
}

test('not enough bars -> no signal', () => {
  const candles = makeCandles(50);
  const result = evaluate(candles, config);
  assert.strictEqual(result.signal, null);
  assert.strictEqual(result.reason, 'not_enough_bars');
});

test('no fresh EMA9x20 cross at the latest bar -> no signal', () => {
  const n = 200;
  const candles = makeCandles(n);
  const flat = new Array(n).fill(1);
  const deps = {
    ema: () => flat, // identical fast/slow/med/long -> diff always 0, never crosses
    rsi: () => new Array(n).fill(60),
  };
  const result = evaluate(candles, config, deps);
  assert.strictEqual(result.signal, null);
  assert.strictEqual(result.reason, 'no_fresh_ema9x20_cross');
});

test('fresh EMA9x20 cross but EMA50x100 cross too far back -> no signal', () => {
  const n = 200;
  const latest = n - 1;
  const candles = makeCandles(n);
  const deps = {
    ema: (values, period) => {
      const arr = new Array(n).fill(1);
      if (period === config.EMA_FAST || period === config.EMA_SLOW) {
        // fast/slow: cross exactly at the latest bar
        for (let i = 0; i < n; i++) arr[i] = i < latest ? -1 : 1;
        if (period === config.EMA_SLOW) return arr.map(() => 0); // slow pinned at 0
        return arr;
      }
      if (period === config.EMA_MED) {
        // med crosses up WAY earlier than the allowed window
        const outsideWindow = latest - config.MAX_BARS_BETWEEN_CROSSES - 10;
        for (let i = 0; i < n; i++) arr[i] = i < outsideWindow ? -1 : 1;
        return arr;
      }
      return new Array(n).fill(0); // long pinned at 0
    },
    rsi: () => new Array(n).fill(60),
  };
  const result = evaluate(candles, config, deps);
  assert.strictEqual(result.signal, null);
  assert.strictEqual(result.reason, 'no_prior_ema50x100_cross');
  assert.strictEqual(result.direction, 'up');
});

test('EMA crosses align but RSI does not confirm -> no signal', () => {
  const n = 200;
  const latest = n - 1;
  const trendCrossIdx = latest - 5; // well within the window
  const deps = {
    ema: (values, period) => {
      const arr = new Array(n).fill(0);
      if (period === config.EMA_FAST) {
        for (let i = 0; i < n; i++) arr[i] = i < latest ? -1 : 1;
        return arr;
      }
      if (period === config.EMA_SLOW) return new Array(n).fill(0);
      if (period === config.EMA_MED) {
        for (let i = 0; i < n; i++) arr[i] = i < trendCrossIdx ? -1 : 1;
        return arr;
      }
      return new Array(n).fill(0); // long
    },
    rsi: () => new Array(n).fill(40), // below midline -> should block an 'up' signal
  };
  const candles = makeCandles(n);
  const result = evaluate(candles, config, deps);
  assert.strictEqual(result.signal, null);
  assert.strictEqual(result.reason, 'rsi_not_aligned');
  assert.strictEqual(result.direction, 'up');
});

test('all three conditions align -> signal fires (mocked, direction up)', () => {
  const n = 200;
  const latest = n - 1;
  const trendCrossIdx = latest - 5;
  const deps = {
    ema: (values, period) => {
      if (period === config.EMA_FAST) {
        const arr = new Array(n).fill(-1);
        arr[latest] = 1;
        return arr;
      }
      if (period === config.EMA_SLOW) return new Array(n).fill(0);
      if (period === config.EMA_MED) {
        const arr = new Array(n).fill(-1);
        for (let i = trendCrossIdx; i < n; i++) arr[i] = 1;
        return arr;
      }
      return new Array(n).fill(0); // long
    },
    rsi: () => {
      const arr = new Array(n).fill(40);
      arr[latest] = 65;
      arr[latest - 1] = 55; // rising into the trigger bar
      return arr;
    },
  };
  const candles = makeCandles(n);
  const result = evaluate(candles, config, deps);
  assert.ok(result.signal, 'expected a signal');
  assert.strictEqual(result.signal.direction, 'up');
  assert.strictEqual(result.reason, 'ok');
});

// ---------------------------------------------------------------------------
// 4. evaluate() organic end-to-end scenarios (real ema()/rsi(), synthetic M1 prices)
// ---------------------------------------------------------------------------
section('strategy: evaluate() organic scenarios (real indicators)');

function buildTrendCloses(direction) {
  const sign = direction === 'up' ? 1 : -1;
  const closes = [];
  let price = 105;
  // long baseline with a tiny drift, giving EMA50/100 a well-defined starting sign
  for (let i = 0; i < 150; i++) {
    price -= sign * 0.01;
    closes.push(price);
  }
  // small impulse that flips EMA50 across EMA100
  for (let i = 0; i < 6; i++) {
    price += sign * 0.5;
    closes.push(price);
  }
  for (let i = 0; i < 2; i++) {
    price += sign * 0.05;
    closes.push(price);
  }
  // pullback against the new trend, deep enough to flip EMA9 across EMA20
  for (let i = 0; i < 6; i++) {
    price -= sign * 0.6;
    closes.push(price);
  }
  // resume in the trend direction - the fresh EMA9x20 cross lands on the last bar
  for (let i = 0; i < 4; i++) {
    price += sign * 0.65;
    closes.push(price);
  }
  return closes;
}

function toCandles(closes) {
  return closes.map((c, i) => ({
    time: 1700000000 + i * 60,
    open: c,
    high: c + 0.05,
    low: c - 0.05,
    close: c,
  }));
}

test('organic uptrend: EMA50x100 up, pullback, EMA9x20 up, RSI confirms -> BUY signal', () => {
  const candles = toCandles(buildTrendCloses('up'));
  const result = evaluate(candles, config);
  assert.ok(result.signal, `expected a signal, got reason=${result.reason}`);
  assert.strictEqual(result.signal.direction, 'up');
  assert.ok(result.signal.rsi > config.RSI_MIDLINE, 'RSI should be above midline');
  assert.ok(
    result.signal.barsSinceTrendCross <= config.MAX_BARS_BETWEEN_CROSSES,
    'trend cross should be within the allowed window'
  );
});

test('organic downtrend: EMA50x100 down, pullback, EMA9x20 down, RSI confirms -> SELL signal', () => {
  const candles = toCandles(buildTrendCloses('down'));
  const result = evaluate(candles, config);
  assert.ok(result.signal, `expected a signal, got reason=${result.reason}`);
  assert.strictEqual(result.signal.direction, 'down');
  assert.ok(result.signal.rsi < config.RSI_MIDLINE, 'RSI should be below midline');
});

test('organic uptrend rejected once the trend cross falls outside a tighter window', () => {
  const candles = toCandles(buildTrendCloses('up'));
  const tightConfig = Object.assign({}, config, { MAX_BARS_BETWEEN_CROSSES: 2 });
  const result = evaluate(candles, tightConfig);
  assert.strictEqual(result.signal, null);
  assert.strictEqual(result.reason, 'no_prior_ema50x100_cross');
});

// ---------------------------------------------------------------------------
// 5. lineNotify message formatting (no network)
// ---------------------------------------------------------------------------
section('lineNotify: buildMessage()');

test('buildMessage produces a short BUY message', () => {
  const { buildMessage } = require('./lib/lineNotify');
  const msg = buildMessage('XAUUSD=X', { direction: 'up', close: 2385.234, rsi: 61.2 });
  assert.ok(msg.includes('BUY'));
  assert.ok(msg.includes('XAUUSD'));
  assert.ok(msg.length < 200, 'message should stay short to save LINE quota');
});

test('buildMessage produces a short SELL message', () => {
  const { buildMessage } = require('./lib/lineNotify');
  const msg = buildMessage('EURUSD=X', { direction: 'down', close: 1.0821, rsi: 38.4 });
  assert.ok(msg.includes('SELL'));
  assert.ok(msg.includes('EURUSD'));
});

test('buildMessage shows gold futures ticker as XAUUSD', () => {
  const { buildMessage } = require('./lib/lineNotify');
  const msg = buildMessage('GC=F', { direction: 'up', close: 2385.2, rsi: 61.2 });
  assert.ok(msg.includes('XAUUSD'));
  assert.ok(!msg.includes('GC=F'));
});

// ---------------------------------------------------------------------------
section('Summary');
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(
    '\nNote: live Yahoo Finance / Upstash / LINE calls are not exercised here ' +
      '(this sandbox has no internet access to those hosts). Test on your machine ' +
      'with `node test-local.js` and then a real DRY_RUN=true request before going live.'
  );
  process.exit(1);
}
