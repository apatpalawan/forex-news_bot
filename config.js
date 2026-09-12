'use strict';

module.exports = {
  // --- Symbols (Yahoo Finance tickers). Gold + major forex pairs. ---
  // NOTE: 'GC=F' (COMEX gold futures, continuous contract) is used instead of
  // 'XAUUSD=X' - it tracks spot gold closely and reliably serves intraday
  // chart data on Yahoo Finance. Alert messages still display it as "XAUUSD".
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

  // --- Timeframe: M5 only, everywhere. ---
  INTERVAL: '5m',
  RANGE: '60d', // Yahoo's max lookback at 5m resolution; plenty for EMA300 warm-up

  // --- EMAs (single condition: EMA100 crosses EMA300) ---
  EMA_MED: 100,
  EMA_LONG: 300,

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
