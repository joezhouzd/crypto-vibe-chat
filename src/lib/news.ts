import { memoryCache } from "@/lib/cache";
import type { CoinNews, SupportedCoin } from "@/lib/types";

function normalizeNews(items: CoinNews[]): CoinNews[] {
  return items
    .filter((item) => item.title && item.url)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, 5);
}

async function fetchFromCryptoPanic(coin: SupportedCoin): Promise<CoinNews[]> {
  const token = process.env.CRYPTOPANIC_API_KEY;
  if (!token) {
    return [];
  }

  const url = new URL("https://cryptopanic.com/api/v1/posts/");
  url.searchParams.set("auth_token", token);
  url.searchParams.set("currencies", coin.symbol);
  url.searchParams.set("kind", "news");
  url.searchParams.set("public", "true");

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 * 10 },
  });

  if (!res.ok) {
    return [];
  }

  const json = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      published_at?: string;
      source?: { title?: string };
      metadata?: { description?: string };
    }>;
  };

  const list = (json.results ?? []).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    source: item.source?.title ?? "CryptoPanic",
    publishedAt: item.published_at ?? new Date().toISOString(),
    summary: item.metadata?.description,
  }));

  return normalizeNews(list);
}

async function fetchFromNewsApi(coin: SupportedCoin): Promise<CoinNews[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) {
    return [];
  }

  const query = `${coin.name} OR ${coin.symbol} OR crypto`;
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "8");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 * 10 },
  });

  if (!res.ok) {
    return [];
  }

  const json = (await res.json()) as {
    articles?: Array<{
      title?: string;
      url?: string;
      publishedAt?: string;
      source?: { name?: string };
      description?: string;
    }>;
  };

  const list = (json.articles ?? []).map((item) => ({
    title: item.title ?? "",
    url: item.url ?? "",
    source: item.source?.name ?? "NewsAPI",
    publishedAt: item.publishedAt ?? new Date().toISOString(),
    summary: item.description,
  }));

  return normalizeNews(list);
}

export async function fetchCoinNews(coin: SupportedCoin): Promise<CoinNews[]> {
  const cacheKey = `news:${coin.id}`;
  const cached = memoryCache.get<CoinNews[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const panicNews = await fetchFromCryptoPanic(coin);
  const news = panicNews.length > 0 ? panicNews : await fetchFromNewsApi(coin);

  memoryCache.set(cacheKey, news, 10 * 60 * 1000);
  return news;
}
