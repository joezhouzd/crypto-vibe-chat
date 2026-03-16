import { NextResponse } from "next/server";

import { generateAnalysis } from "@/lib/analyzer";
import { resolveCoinFromText } from "@/lib/coins";
import { fetchCoinMarketSnapshot, fetchCoinTrend7d } from "@/lib/coingecko";
import { fetchCoinNews } from "@/lib/news";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string };
    const question = body.message?.trim();

    if (!question) {
      return NextResponse.json({ error: "请输入问题" }, { status: 400 });
    }

    const coin = resolveCoinFromText(question);
    if (!coin) {
      return NextResponse.json(
        {
          error:
            "暂时只支持 BTC、ETH、SOL、XRP、DOGE、TON。你可以输入例如：btc、bitcoin、比特币。",
        },
        { status: 400 },
      );
    }

    const [snapshot, trend, news] = await Promise.all([
      fetchCoinMarketSnapshot(coin.id),
      fetchCoinTrend7d(coin.id),
      fetchCoinNews(coin),
    ]);

    const analysis = await generateAnalysis({
      question,
      coin,
      snapshot,
      trend,
      news,
    });

    return NextResponse.json({
      coin,
      snapshot,
      trend,
      news,
      analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("/api/chat error", error);
    const message = error instanceof Error ? error.message : "服务暂时不可用，请稍后重试。";
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
