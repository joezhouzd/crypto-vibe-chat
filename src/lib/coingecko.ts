import { memoryCache } from "@/lib/cache";
import type { CoinMarketSnapshot, CoinTrendPoint } from "@/lib/types";

const GECKO_BASE = "https://api.coingecko.com/api/v3";
const BINANCE_BASE = "https://api.binance.com/api/v3";
const OKX_BASE = "https://www.okx.com/api/v5/market";

const COIN_META: Record<string, { symbol: string; name: string }> = {
  bitcoin: { symbol: "BTC", name: "Bitcoin" },
  ethereum: { symbol: "ETH", name: "Ethereum" },
  solana: { symbol: "SOL", name: "Solana" },
  ripple: { symbol: "XRP", name: "XRP" },
  dogecoin: { symbol: "DOGE", name: "Dogecoin" },
  "the-open-network": { symbol: "TON", name: "Toncoin" },
};

function getSymbol(coinId: string): string {
  return COIN_META[coinId]?.symbol ?? coinId.toUpperCase();
}

function getName(coinId: string): string {
  return COIN_META[coinId]?.name ?? coinId;
}

async function fetchWithTimeout(url: string, revalidateSeconds: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    return await fetch(url, {
      next: { revalidate: revalidateSeconds },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时");
    }
    throw new Error("网络连接失败");
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromCoinGeckoSnapshot(coinId: string): Promise<CoinMarketSnapshot> {
  const url = `${GECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coinId)}&price_change_percentage=24h`;
  const res = await fetchWithTimeout(url, 60);

  if (!res.ok) {
    throw new Error(`CoinGecko HTTP ${res.status}`);
  }

  const json = (await res.json()) as Array<Record<string, unknown>>;
  const item = json[0];
  if (!item) {
    throw new Error("CoinGecko 返回空数据");
  }

  return {
    id: String(item.id ?? coinId),
    symbol: String(item.symbol ?? "").toUpperCase(),
    name: String(item.name ?? coinId),
    currentPrice: Number(item.current_price ?? 0),
    marketCap: Number(item.market_cap ?? 0),
    volume24h: Number(item.total_volume ?? 0),
    high24h: Number(item.high_24h ?? 0),
    low24h: Number(item.low_24h ?? 0),
    priceChange24hPct: Number(item.price_change_percentage_24h ?? 0),
    marketCapRank: item.market_cap_rank ? Number(item.market_cap_rank) : null,
  };
}

async function fetchFromBinanceSnapshot(coinId: string): Promise<CoinMarketSnapshot> {
  const symbol = `${getSymbol(coinId)}USDT`;
  const url = `${BINANCE_BASE}/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetchWithTimeout(url, 60);

  if (!res.ok) {
    throw new Error(`Binance HTTP ${res.status}`);
  }

  const item = (await res.json()) as {
    lastPrice?: string;
    quoteVolume?: string;
    highPrice?: string;
    lowPrice?: string;
    priceChangePercent?: string;
  };

  return {
    id: coinId,
    symbol: getSymbol(coinId),
    name: getName(coinId),
    currentPrice: Number(item.lastPrice ?? 0),
    marketCap: 0,
    volume24h: Number(item.quoteVolume ?? 0),
    high24h: Number(item.highPrice ?? 0),
    low24h: Number(item.lowPrice ?? 0),
    priceChange24hPct: Number(item.priceChangePercent ?? 0),
    marketCapRank: null,
  };
}

async function fetchFromOkxSnapshot(coinId: string): Promise<CoinMarketSnapshot> {
  const instId = `${getSymbol(coinId)}-USDT`;
  const url = `${OKX_BASE}/ticker?instId=${encodeURIComponent(instId)}`;
  const res = await fetchWithTimeout(url, 60);

  if (!res.ok) {
    throw new Error(`OKX HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: Array<{
      last?: string;
      high24h?: string;
      low24h?: string;
      volCcy24h?: string;
      open24h?: string;
    }>;
  };

  const item = json.data?.[0];
  if (!item) {
    throw new Error("OKX 返回空数据");
  }

  const last = Number(item.last ?? 0);
  const open24h = Number(item.open24h ?? 0);
  const pct = open24h > 0 ? ((last - open24h) / open24h) * 100 : 0;

  return {
    id: coinId,
    symbol: getSymbol(coinId),
    name: getName(coinId),
    currentPrice: last,
    marketCap: 0,
    volume24h: Number(item.volCcy24h ?? 0),
    high24h: Number(item.high24h ?? 0),
    low24h: Number(item.low24h ?? 0),
    priceChange24hPct: pct,
    marketCapRank: null,
  };
}

async function fetchFromCoinGeckoTrend(coinId: string): Promise<CoinTrendPoint[]> {
  const url = `${GECKO_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=7&interval=daily`;
  const res = await fetchWithTimeout(url, 60 * 5);

  if (!res.ok) {
    throw new Error(`CoinGecko trend HTTP ${res.status}`);
  }

  const json = (await res.json()) as { prices?: [number, number][] };
  return (json.prices ?? []).map(([timestamp, price]) => ({ timestamp, price }));
}

async function fetchFromBinanceTrend(coinId: string): Promise<CoinTrendPoint[]> {
  const symbol = `${getSymbol(coinId)}USDT`;
  const url = `${BINANCE_BASE}/klines?symbol=${encodeURIComponent(symbol)}&interval=1d&limit=8`;
  const res = await fetchWithTimeout(url, 60 * 5);

  if (!res.ok) {
    throw new Error(`Binance trend HTTP ${res.status}`);
  }

  const rows = (await res.json()) as Array<[number, string, string, string, string, string, number, string, number, string, string, string]>;
  return rows.map((row) => ({
    timestamp: Number(row[0]),
    price: Number(row[4]),
  }));
}

async function fetchFromOkxTrend(coinId: string): Promise<CoinTrendPoint[]> {
  const instId = `${getSymbol(coinId)}-USDT`;
  const url = `${OKX_BASE}/history-candles?instId=${encodeURIComponent(instId)}&bar=1Dutc&limit=8`;
  const res = await fetchWithTimeout(url, 60 * 5);

  if (!res.ok) {
    throw new Error(`OKX trend HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: string[][] };
  return (json.data ?? [])
    .slice()
    .reverse()
    .map((row) => ({
      timestamp: Number(row[0]),
      price: Number(row[4]),
    }));
}

export async function fetchCoinMarketSnapshot(coinId: string): Promise<CoinMarketSnapshot> {
  const cacheKey = `market:snapshot:${coinId}`;
  const cached = memoryCache.get<CoinMarketSnapshot>(cacheKey);
  if (cached) {
    return cached;
  }

  const errors: string[] = [];

  try {
    const data = await fetchFromCoinGeckoSnapshot(coinId);
    memoryCache.set(cacheKey, data, 60 * 1000);
    return data;
  } catch (error) {
    errors.push(`CoinGecko: ${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const data = await fetchFromBinanceSnapshot(coinId);
    memoryCache.set(cacheKey, data, 60 * 1000);
    return data;
  } catch (error) {
    errors.push(`Binance: ${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const data = await fetchFromOkxSnapshot(coinId);
    memoryCache.set(cacheKey, data, 60 * 1000);
    return data;
  } catch (error) {
    errors.push(`OKX: ${error instanceof Error ? error.message : "unknown"}`);
  }

  throw new Error(`行情源不可用（CoinGecko/Binance/OKX）。${errors.join(" | ")}`);
}

export async function fetchCoinTrend7d(coinId: string): Promise<CoinTrendPoint[]> {
  const cacheKey = `market:trend7d:${coinId}`;
  const cached = memoryCache.get<CoinTrendPoint[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const errors: string[] = [];

  try {
    const data = await fetchFromCoinGeckoTrend(coinId);
    memoryCache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  } catch (error) {
    errors.push(`CoinGecko: ${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const data = await fetchFromBinanceTrend(coinId);
    memoryCache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  } catch (error) {
    errors.push(`Binance: ${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const data = await fetchFromOkxTrend(coinId);
    memoryCache.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  } catch (error) {
    errors.push(`OKX: ${error instanceof Error ? error.message : "unknown"}`);
  }

  throw new Error(`趋势数据源不可用（CoinGecko/Binance/OKX）。${errors.join(" | ")}`);
}
