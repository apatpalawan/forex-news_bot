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

  // --- Timeframe: H1 only, everywhere. ---
  INTERVAL: '60m',
  RANGE: '730d', // Yahoo's max lookback at 60m resolution; plenty for EMA100 warm-up

  // --- EMAs ---
  EMA_FAST: 9,
  EMA_SLOW: 20,
  EMA_MED: 50,
  EMA_LONG: 100,

  // How many H1 bars after the EMA50x100 cross the EMA9x20 cross is still
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
