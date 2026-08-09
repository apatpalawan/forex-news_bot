// ดึงราคา intraday จาก Yahoo Finance chart API ตรงๆ ผ่าน fetch (ไม่ต้องพึ่ง library ภายนอก)

async function getIntradayCandles(symbol, interval = "5m", range = "1d", retries = 3) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=${interval}&range=${range}`;

  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const result = data?.chart?.result?.[0];
      if (!result) throw new Error("empty result");

      const timestamps = result.timestamp;
      const quote = result.indicators?.quote?.[0];
      if (!timestamps || !quote) throw new Error("missing timestamp/quote");

      const candles = timestamps.map((ts, i) => ({
        time: new Date(ts * 1000), // UTC
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
      })).filter((c) => c.close != null); // ตัดแท่งที่ข้อมูลไม่ครบ

      if (candles.length === 0) throw new Error("no valid candles");
      return candles;
    } catch (e) {
      lastErr = e;
      // jitter delay กันโดน rate limit ซ้ำๆ
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
    }
  }
  console.error(`[priceData] failed to fetch ${symbol} after ${retries} tries:`, lastErr?.message);
  return null;
}

async function getLatestPrice(symbol) {
  const candles = await getIntradayCandles(symbol, "1m", "1d", 3);
  if (!candles || candles.length === 0) return null;
  return candles[candles.length - 1].close;
}

module.exports = { getIntradayCandles, getLatestPrice };
