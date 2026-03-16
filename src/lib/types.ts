export type Role = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
};

export type SupportedCoin = {
  symbol: string;
  id: string;
  name: string;
  aliases: string[];
};

export type CoinMarketSnapshot = {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  priceChange24hPct: number;
  marketCapRank: number | null;
};

export type CoinTrendPoint = {
  timestamp: number;
  price: number;
};

export type CoinNews = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
};
