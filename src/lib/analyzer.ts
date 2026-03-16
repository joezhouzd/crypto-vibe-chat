import type { CoinNews, CoinMarketSnapshot, CoinTrendPoint, SupportedCoin } from "@/lib/types";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("当前还没配置 GEMINI_API_KEY。请先在环境变量中添加后再试。");
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  };
}

function buildTrendSummary(trend: CoinTrendPoint[]): string {
  if (trend.length < 2) {
    return "7日趋势数据不足。";
  }

  const start = trend[0]?.price ?? 0;
  const end = trend[trend.length - 1]?.price ?? 0;
  const change = start === 0 ? 0 : ((end - start) / start) * 100;

  return `7日价格从 ${start.toFixed(2)} USD 到 ${end.toFixed(2)} USD，变化约 ${change.toFixed(2)}%。`;
}

function buildNewsSummary(news: CoinNews[]): string {
  if (news.length === 0) {
    return "暂无可用新闻（可配置 CryptoPanic 或 NewsAPI key）。";
  }

  return news
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.title} | 来源: ${item.source} | 时间: ${item.publishedAt} | 链接: ${item.url}`,
    )
    .join("\n");
}

export async function generateAnalysis(params: {
  question: string;
  coin: SupportedCoin;
  snapshot: CoinMarketSnapshot;
  trend: CoinTrendPoint[];
  news: CoinNews[];
}): Promise<string> {
  const { question, coin, snapshot, trend, news } = params;
  const { apiKey, model } = getGeminiConfig();

  const systemPrompt = [
    "你是专业中立的加密行情分析师。",
    "必须用中文回答，简洁但有依据。",
    "禁止给出保证收益、梭哈等投资建议。",
    "输出结构固定为：",
    "1) 结论（短句：偏多/偏空/震荡 + 理由）",
    "2) 关键数据（3-5条）",
    "3) 新闻影响（最多3条）",
    "4) 风险点（2-4条）",
    "5) 观察位（支撑/压力或关键条件）",
  ].join("\n");

  const userPrompt = [
    `用户问题: ${question}`,
    `币种: ${coin.name} (${coin.symbol})`,
    `当前价格(USD): ${snapshot.currentPrice}`,
    `24h 涨跌幅(%): ${snapshot.priceChange24hPct}`,
    `24h 最高/最低(USD): ${snapshot.high24h} / ${snapshot.low24h}`,
    `24h 成交量(USD): ${snapshot.volume24h}`,
    `市值(USD): ${snapshot.marketCap}`,
    `市值排名: ${snapshot.marketCapRank ?? "未知"}`,
    `趋势摘要: ${buildTrendSummary(trend)}`,
    `新闻列表:\n${buildNewsSummary(news)}`,
  ].join("\n");

  const endpoint = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("连接 Gemini 超时，请检查网络后重试。");
    }
    throw new Error(
      "无法连接 Gemini API。若你在中国大陆网络环境，Gemini 可能不可直连，建议改用可直连模型服务。",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini 调用失败：${message}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  return text || "抱歉，我暂时无法生成分析，请稍后重试。";
}
