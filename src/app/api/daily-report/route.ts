import { NextResponse } from "next/server";

import { generateAnalysis } from "@/lib/analyzer";
import { listSupportedCoins } from "@/lib/coins";
import { fetchCoinMarketSnapshot, fetchCoinTrend7d } from "@/lib/coingecko";
import { fetchCoinNews } from "@/lib/news";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topCoins = listSupportedCoins().slice(0, 3);
  const reports: Array<{ symbol: string; report: string }> = [];

  for (const coin of topCoins) {
    const [snapshot, trend, news] = await Promise.all([
      fetchCoinMarketSnapshot(coin.id),
      fetchCoinTrend7d(coin.id),
      fetchCoinNews(coin),
    ]);

    const report = await generateAnalysis({
      question: `${coin.symbol} 今日盘面简报`,
      coin,
      snapshot,
      trend,
      news,
    });

    reports.push({ symbol: coin.symbol, report });
  }

  return NextResponse.json({
    date: new Date().toISOString(),
    reports,
  });
}
