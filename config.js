'use strict';

module.exports = {
  // --- Symbols (Yahoo Finance tickers). Gold + major forex pairs. ---
  // NOTE: 'XAUUSD=X' does not serve 1-minute intraday chart data on Yahoo
  // Finance (confirmed live: HTTP 404) - 'GC=F' (COMEX gold futures,
  // continuous contract) tracks spot gold closely and does support M1 data,
  // so it's used here instead. Alert messages still display it as "XAUUSD".
  SYMBOLS: [
    'GC=F',
    'EURUSD=X',
    'GBPUSD=X',
    'USDJPY=X',
    'USDCHF=X',
    'AUDUSD=X',
    'USDCAD=X',
    'NZDUSD=X',
  ],

  // --- Timeframe: M1 only, everywhere. ---
  INTERVAL: '1m',
  RANGE: '5d', // Yahoo's max lookback at 1m resolution; plenty for EMA100 warm-up

  // --- EMAs ---
  EMA_FAST: 9,
  EMA_SLOW: 20,
  EMA_MED: 50,
  EMA_LONG: 100,

  // How many M1 bars after the EMA50x100 cross the EMA9x20 cross is still
  // considered a valid pullback-confirmation trigger.
  MAX_BARS_BETWEEN_CROSSES: 30,

  // --- RSI ---
  RSI_PERIOD: 14,
  RSI_MIDLINE: 50,
  RSI_SLOPE_LOOKBACK: 3, // bars back to check RSI is still sloping the same way

  // --- Runtime ---
  DRY_RUN: process.env.DRY_RUN === 'true',
  CRON_SECRET: process.env.CRON_SECRET || '',
  REDIS_KEY_PREFIX: 'emacross:',
  REDIS_STATE_TTL_SECONDS: 60 * 60 * 24 * 3, // 3 days

  // Small delay between symbols to be gentle on Yahoo Finance rate limits.
  INTER_SYMBOL_DELAY_MS: 300,
};
