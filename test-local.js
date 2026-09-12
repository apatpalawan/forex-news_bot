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

test('no fresh EMA100x300 cross at the latest bar -> no signal', () => {
  const n = 400;
  const candles = makeCandles(n);
  const flat = new Array(n).fill(1);
  const deps = {
    ema: () => flat, // identical med/long -> diff always 0, never crosses
    rsi: () => new Array(n).fill(60),
  };
  const result = evaluate(candles, config, deps);
  assert.strictEqual(result.signal, null);
  assert.strictEqual(result.reason, 'no_fresh_ema100x300_cross');
});

test('fresh EMA100x300 cross but RSI does not confirm -> no signal', () => {
  const n = 400;
  const latest = n - 1;
  const candles = makeCandles(n);
  const deps = {
    ema: (values, period) => {
      if (period === config.EMA_MED) {
        const arr = new Array(n).fill(-1);
        arr[latest] = 1; // fresh up-cross exactly at the latest bar
        return arr;
      }
      return new Array(n).fill(0); // long pinned at 0
    },
    rsi: () => new Array(n).fill(40), // below midline -> should block an 'up' signal
  };
  const result = evaluate(candles, config, deps);
  assert.strictEqual(result.signal, null);
  assert.strictEqual(result.reason, 'rsi_not_aligned');
  assert.strictEqual(result.direction, 'up');
});

test('EMA cross and RSI both align -> signal fires (mocked, direction up)', () => {
  const n = 400;
  const latest = n - 1;
  const deps = {
    ema: (values, period) => {
      if (period === config.EMA_MED) {
        const arr = new Array(n).fill(-1);
        arr[latest] = 1;
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

test('EMA cross and RSI both align -> signal fires (mocked, direction down)', () => {
  const n = 400;
  const latest = n - 1;
  const deps = {
    ema: (values, period) => {
      if (period === config.EMA_MED) {
        const arr = new Array(n).fill(1);
        arr[latest] = -1;
        return arr;
      }
      return new Array(n).fill(0);
    },
    rsi: () => {
      const arr = new Array(n).fill(60);
      arr[latest] = 35;
      arr[latest - 1] = 45; // falling into the trigger bar
      return arr;
    },
  };
  const candles = makeCandles(n);
  const result = evaluate(candles, config, deps);
  assert.ok(result.signal, 'expected a signal');
  assert.strictEqual(result.signal.direction, 'down');
  assert.strictEqual(result.reason, 'ok');
});

// ---------------------------------------------------------------------------
// 4. evaluate() organic end-to-end scenarios (real ema()/rsi(), synthetic M5 prices)
// ---------------------------------------------------------------------------
section('strategy: evaluate() organic scenarios (real indicators)');

function buildTrendCloses(direction) {
  const sign = direction === 'up' ? 1 : -1;
  const closes = [];
  let price = 105;
  // long baseline with a tiny drift, giving EMA100/300 a well-defined
  // starting sign (they need 300+ bars just to warm up)
  for (let i = 0; i < 320; i++) {
    price -= sign * 0.01;
    closes.push(price);
  }
  // impulse that flips EMA100 across EMA300 exactly on the final bar,
  // with RSI already trending the same direction into that bar
  for (let i = 0; i < 17; i++) {
    price += sign * 0.6;
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

test('organic uptrend: EMA100x300 crosses up with RSI confirming -> BUY signal', () => {
  const candles = toCandles(buildTrendCloses('up'));
  const result = evaluate(candles, config);
  assert.ok(result.signal, `expected a signal, got reason=${result.reason}`);
  assert.strictEqual(result.signal.direction, 'up');
  assert.ok(result.signal.rsi > config.RSI_MIDLINE, 'RSI should be above midline');
});

test('organic downtrend: EMA100x300 crosses down with RSI confirming -> SELL signal', () => {
  const candles = toCandles(buildTrendCloses('down'));
  const result = evaluate(candles, config);
  assert.ok(result.signal, `expected a signal, got reason=${result.reason}`);
  assert.strictEqual(result.signal.direction, 'down');
  assert.ok(result.signal.rsi < config.RSI_MIDLINE, 'RSI should be below midline');
});

test('no signal once the impulse ends and the cross is no longer on the latest bar', () => {
  // one extra flat bar after the impulse -> the EMA100x300 cross is now one
  // bar in the past, not on the latest closed bar -> must not fire
  const closes = buildTrendCloses('up');
  closes.push(closes[closes.length - 1]);
  const candles = toCandles(closes);
  const result = evaluate(candles, config);
  assert.strictEqual(result.signal, null);
  assert.strictEqual(result.reason, 'no_fresh_ema100x300_cross');
});

// ---------------------------------------------------------------------------
// 5. lineNotify message formatting (no network)
// ---------------------------------------------------------------------------
section('lineNotify: buildMessage()');

test('buildMessage produces a short BUY message', () => {
  const { buildMessage } = require('./lib/lineNotify');
  const msg = buildMessage('XAUUSD=X', { direction: 'up', close: 2385.234, rsi: 61.2 });
  assert.strictEqual(msg, '🟢 Buy XAUUSD');
  assert.ok(msg.length < 30, 'message should stay very short to save LINE quota');
});

test('buildMessage produces a short SELL message', () => {
  const { buildMessage } = require('./lib/lineNotify');
  const msg = buildMessage('EURUSD=X', { direction: 'down', close: 1.0821, rsi: 38.4 });
  assert.strictEqual(msg, '🔴 Sell EURUSD');
});

test('buildMessage shows gold futures ticker as XAUUSD', () => {
  const { buildMessage } = require('./lib/lineNotify');
  const msg = buildMessage('GC=F', { direction: 'up', close: 2385.2, rsi: 61.2 });
  assert.strictEqual(msg, '🟢 Buy XAUUSD');
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
