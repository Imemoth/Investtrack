import { appLog } from "./logger";

const CORS_PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  url => `https://thingproxy.freeboard.io/fetch/${url}`,
];

async function fetchWithProxyFallback(yahooUrl) {
  let lastError;
  for (const proxyFn of CORS_PROXIES) {
    const proxyUrl = proxyFn(yahooUrl);
    appLog.info(`Proxy próba: ${proxyUrl.slice(0, 60)}...`);
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.trim().startsWith("<")) throw new Error("HTML válasz – proxy hiba");
      appLog.info(`✓ Siker: ${proxyUrl.slice(0, 40)}...`);
      return JSON.parse(text);
    } catch (e) {
      appLog.warn(`✗ Proxy hiba`, `${proxyUrl.slice(0, 50)} → ${e.message}`);
      lastError = e;
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw lastError;
}

export async function fetchYahooPrice(ticker) {
  const hosts = ["query1", "query2"];
  let lastError;
  for (const host of hosts) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d&includePrePost=false`;
      appLog.info(`Yahoo lekérés: ${ticker} (${host})`);
      const data  = await fetchWithProxyFallback(url);
      const meta  = data?.chart?.result?.[0]?.meta;
      if (!meta) throw new Error("Üres chart result");
      const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
      if (!price) throw new Error(`Nincs ár a válaszban`);
      appLog.info(`✓ ${ticker} = ${price} ${meta.currency}`);
      return { price, currency: meta.currency, exchange: meta.exchangeName };
    } catch (e) {
      appLog.error(`✗ ${ticker} (${host}) sikertelen`, e.message);
      lastError = e;
    }
  }
  throw lastError;
}

async function fetchFxRates() {
  const pairs = ["USDHUF=X", "EURHUF=X", "GBPHUF=X"];
  const rates  = { USD: 1, EUR: 1, GBP: 1, HUF: 1 };
  for (const pair of pairs) {
    try {
      const data     = await fetchYahooPrice(pair);
      const currency = pair.replace("HUF=X", "");
      rates[currency] = data.price;
      appLog.info(`✓ ${currency}/HUF = ${data.price}`);
    } catch (e) {
      appLog.warn(`✗ FX lekérés sikertelen: ${pair}`, e.message);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return rates;
}

export async function refreshAllPrices(investments, onProgress) {
  const withTicker = investments.filter(i => i.ticker?.trim());
  const results    = new Map();
  const errors     = [];

  onProgress?.("Devizaárfolyamok...");
  const fxRates = await fetchFxRates();
  appLog.info(`FX rates: USD=${fxRates.USD}, EUR=${fxRates.EUR}`);

  for (let i = 0; i < withTicker.length; i++) {
    const inv = withTicker[i];
    onProgress?.(`${inv.ticker} (${i + 1}/${withTicker.length})`);
    try {
      const data       = await fetchYahooPrice(inv.ticker);
      let finalPrice   = data.price;
      if (inv.currency === "HUF" && data.currency && data.currency !== "HUF") {
        const rate = fxRates[data.currency] || 1;
        finalPrice = data.price * rate;
        appLog.info(`✓ ${inv.ticker}: ${data.price} ${data.currency} × ${rate} = ${finalPrice.toFixed(0)} HUF`);
      }
      results.set(inv.ticker.toUpperCase(), {
        nativePrice:    data.price,
        nativeCurrency: data.currency || inv.currency,
        hufPrice:       finalPrice,
      });
    } catch (e) {
      appLog.warn(`[PriceRefresh] ${inv.ticker} hiba:`, e.message);
      errors.push(inv.ticker);
    }
    if (i < withTicker.length - 1) await new Promise(r => setTimeout(r, 400));
  }
  return { results, errors };
}
