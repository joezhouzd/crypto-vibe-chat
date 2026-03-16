import type { SupportedCoin } from "@/lib/types";

const SUPPORTED_COINS: SupportedCoin[] = [
  {
    symbol: "BTC",
    id: "bitcoin",
    name: "Bitcoin",
    aliases: ["btc", "bitcoin", "比特币", "大饼"],
  },
  {
    symbol: "ETH",
    id: "ethereum",
    name: "Ethereum",
    aliases: ["eth", "ethereum", "以太坊", "姨太"],
  },
  {
    symbol: "SOL",
    id: "solana",
    name: "Solana",
    aliases: ["sol", "solana", "索拉纳"],
  },
  {
    symbol: "XRP",
    id: "ripple",
    name: "XRP",
    aliases: ["xrp", "ripple", "瑞波", "瑞波币"],
  },
  {
    symbol: "DOGE",
    id: "dogecoin",
    name: "Dogecoin",
    aliases: ["doge", "dogecoin", "狗狗币"],
  },
  {
    symbol: "TON",
    id: "the-open-network",
    name: "Toncoin",
    aliases: ["ton", "toncoin", "the open network", "吨币"],
  },
];

const aliasToCoin = new Map<string, SupportedCoin>();

for (const coin of SUPPORTED_COINS) {
  aliasToCoin.set(coin.symbol.toLowerCase(), coin);
  aliasToCoin.set(coin.id.toLowerCase(), coin);
  aliasToCoin.set(coin.name.toLowerCase(), coin);
  for (const alias of coin.aliases) {
    aliasToCoin.set(alias.toLowerCase(), coin);
  }
}

export function resolveCoinFromText(input: string): SupportedCoin | null {
  const lower = input.toLowerCase().trim();

  for (const [alias, coin] of aliasToCoin.entries()) {
    if (lower === alias || lower.includes(alias)) {
      return coin;
    }
  }

  return null;
}

export function listSupportedCoins(): SupportedCoin[] {
  return SUPPORTED_COINS;
}
