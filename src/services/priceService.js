import { appLog } from "./logger";
import { getExpectedCurrency, isSupportedExchange } from "./xtbImporter";

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

// Yahoo quote normalizálás + szigorú devizaellenőrzés.
// London Yahoo quote: GBX (pence) → GBP (font) / 100.
export function normalizeYahooQuote({ price, currency, exchange }, expectedCurrency = null) {
  let normalizedPrice = price;
  let normalizedCurrency = currency;

  if (currency === "GBX") {
    normalizedPrice = price / 100;
    normalizedCurrency = "GBP";
  }

  if (expectedCurrency && normalizedCurrency && normalizedCurrency !== expectedCurrency) {
    throw new Error(`Deviza eltérés: várt ${expectedCurrency}, kapott ${normalizedCurrency}`);
  }

  return {
    price: normalizedPrice,
    currency: normalizedCurrency,
    exchange,
    rawPrice: price,
    rawCurrency: currency,
  };
}

export async function fetchYahooPrice(ticker, expectedCurrency = null) {
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

      const quote = normalizeYahooQuote(
        { price, currency: meta.currency, exchange: meta.exchangeName },
        expectedCurrency,
      );
      appLog.info(`✓ ${ticker} = ${quote.price} ${quote.currency}`);
      return quote;
    } catch (e) {
      appLog.error(`✗ ${ticker} (${host}) sikertelen`, e.message);
      lastError = e;
    }
  }
  throw lastError;
}

// Frankfurter API (ECB alapú, CORS-proxy nélkül) az elsődleges devizaforrás
async function fetchFxRatesFrankfurter() {
  const res = await fetch(
    "https://api.frankfurter.dev/v1/latest?base=HUF&symbols=USD,EUR,GBP,PLN,SEK,DKK,NOK",
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const r = data.rates; // { USD: 0.00267, EUR: 0.00247, GBP: 0.00205 }
  if (!r?.USD) throw new Error("Üres Frankfurter válasz");
  return {
    HUF: 1,
    USD: Math.round(1 / r.USD),
    EUR: Math.round(1 / r.EUR),
    GBP: Math.round(1 / r.GBP),
    PLN: Math.round(1 / r.PLN * 10000) / 10000,
    SEK: Math.round(1 / r.SEK * 10000) / 10000,
    DKK: Math.round(1 / r.DKK * 10000) / 10000,
    NOK: Math.round(1 / r.NOK * 10000) / 10000,
  };
}

// Yahoo Finance fallback az FX lekéréshez
async function fetchFxRatesYahoo() {
  const pairs = ["USDHUF=X", "EURHUF=X", "GBPHUF=X", "PLNHUF=X", "SEKHUF=X", "DKKHUF=X", "NOKHUF=X"];
  const rates  = { USD: null, EUR: null, GBP: null, PLN: null, SEK: null, DKK: null, NOK: null, HUF: 1 };
  for (const pair of pairs) {
    try {
      const data     = await fetchYahooPrice(pair);
      const currency = pair.replace("HUF=X", "");
      rates[currency] = data.price;
      appLog.info(`✓ Yahoo FX ${currency}/HUF = ${data.price}`);
    } catch (e) {
      appLog.warn(`✗ Yahoo FX sikertelen: ${pair}`, e.message);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return rates;
}

export async function fetchFxRates() {
  try {
    const rates = await fetchFxRatesFrankfurter();
    appLog.info(`✓ Frankfurter FX: USD=${rates.USD}, EUR=${rates.EUR}, GBP=${rates.GBP}`);
    return rates;
  } catch (e) {
    appLog.warn(`Frankfurter FX hiba, Yahoo fallback: ${e.message}`);
    return fetchFxRatesYahoo();
  }
}

export async function refreshAllPrices(investments, onProgress) {
  const withTicker = investments.filter(i => i.ticker?.trim());
  const results    = new Map();
  const errors     = [];

  onProgress?.("Devizaárfolyamok...");
  const fxRates = await fetchFxRates();
  appLog.info(`FX rates: USD=${fxRates.USD}, EUR=${fxRates.EUR}, GBP=${fxRates.GBP}, PLN=${fxRates.PLN}, SEK=${fxRates.SEK}, DKK=${fxRates.DKK}, NOK=${fxRates.NOK}`);

  for (let i = 0; i < withTicker.length; i++) {
    const inv = withTicker[i];
    onProgress?.(`${inv.ticker} (${i + 1}/${withTicker.length})`);
    try {
      if (inv.xtbTicker && !isSupportedExchange(inv.xtbTicker)) {
        throw new Error(`Nem támogatott XTB tőzsde: ${inv.xtbTicker}`);
      }

      // Imported holdings must match their mapped exchange currency.
      // Manual HUF holdings may intentionally fetch a foreign quote and convert it.
      const expectedCurrency = inv.xtbTicker
        ? getExpectedCurrency(inv.xtbTicker)
        : (inv.currency === "HUF" ? null : inv.currency);
      const data = await fetchYahooPrice(inv.ticker, expectedCurrency);
      let finalPrice = data.price;

      // For HUF-denominated positions: convert normalized native price to HUF.
      if (inv.currency === "HUF" && data.currency && data.currency !== "HUF") {
        const yahooFx = fxRates[data.currency];
        if (!Number.isFinite(yahooFx) || yahooFx <= 0) {
          throw new Error(`Nincs ${data.currency}/HUF árfolyam`);
        }
        finalPrice = data.price * yahooFx;
        appLog.info(`✓ ${inv.ticker}: ${data.price} ${data.currency} × ${yahooFx} = ${finalPrice.toFixed(0)} HUF`);
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
  return { results, errors, fxRates };
}
