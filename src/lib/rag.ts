import { createLocalEmbedding, toPgVectorLiteral } from "@/lib/rag-embed";
import type { RAGChunk } from "@/lib/rag-types";
import { getSupabaseAdminClient } from "@/lib/supabase";

const DEFAULT_SOURCE_URL =
  "https://www.binance.com/zh-CN/support/faq/detail/ea9bacf82b9e4ddfae50ebc98565241b";

const FALLBACK_SEED_TEXT = `
幣安帶單用戶分潤及反佣（發布於 2023-08-22 12:13）
帶單用戶可以獲得：最高30%跟單用戶的分潤，以及10%跟單用戶的手續費返佣。

請知悉：
每週分潤機制於2024年9月23日更新，分潤計算由原先基於已實現盈虧的規則調整為基於總盈虧。
系統將於東八區時間每週一8:00 AM開始進行跟單項目總盈虧快照。
每週分潤僅在快照時帶單項目未實現盈虧大於 -20,000 USDT 進行結算。
當跟單項目可用餘額低於分潤金額時不進行分潤，返佣不受影響。
在每週一分潤計算結束之前，新開始的跟單項目可能會被收取分潤。
分潤將於每週一自動分發，劃轉到帶單用戶的幣安現貨錢包。

帶單員每週一可以獲得未結束跟單項目的交易手續費返佣。
每週10%手續費返佣獎勵有上限設置，系統於每週一08:00（東八區時間）開始進行跟單項目保證金餘額快照。
獎勵上限為 Min[跟單項目手續費 * 10%, 跟單項目保證金餘額 * 3% * 10%]。

除此以外，當出現以下情況時，也會進行分潤分發：
跟單用戶停止跟單；
帶單用戶結束投資組合；
跟單用戶提取盈利。

分潤計算公式：
待分潤金額 = Max[(投資組合總實現盈利 + 投資組合未實現盈利) * 分潤比例 - 已分潤金額, 0]

如何計算跟單投資組合的分潤金額：
分潤金額是根據整個投資組合的盈虧統計，系統會計算每個跟單投資組合的總盈利。

示例（初始跟單金額 1,000 USDT，分潤比例 10%）：
第一週：PNL變化 +200，累計PNL +200，總分潤金額 20，已分潤金額 0，待分潤金額 20。
第二週：PNL變化 -150，累計PNL +50，總分潤金額 5，已分潤金額 20，待分潤金額 0。
第三週：PNL變化 +100，累計PNL +150，總分潤金額 15，已分潤金額 20，待分潤金額 0。
第四週：PNL變化 +150，累計PNL +300，總分潤金額 30，已分潤金額 20，待分潤金額 10。

說明：
PNL變化指當週已實現和未實現的總盈虧；
累計PNL指該跟單投資組合當前的已實現和未實現總盈虧；
累計盈利已扣除了所有產生的費用；
第二週和第三週的總分潤金額小於已分潤金額，因此這兩週的待分潤金額為 0。
`;

function toReadableProxyUrl(url: string): string {
  const clean = url.replace(/^https?:\/\//, "");
  return `https://r.jina.ai/http://${clean}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitToChunks(text: string, maxLen = 520): string[] {
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n");

  const segments = normalized
    .split(/[。！？；\n]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 8);

  const chunks: string[] = [];
  let current = "";

  for (const segment of segments) {
    if ((current + segment).length > maxLen) {
      if (current) {
        chunks.push(current);
      }
      current = segment;
    } else {
      current = current ? `${current}。${segment}` : segment;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 20)
    .slice(0, 80);
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() || "Binance Support";
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 GEMINI_API_KEY");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini 调用失败：${await response.text()}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() || "";
}

export function isBinanceKnowledgeQuestion(question: string): boolean {
  const text = question.toLowerCase();
  const keywords = [
    "binance",
    "币安",
    "2fa",
    "提币",
    "限额",
    "风控",
    "合约规则",
    "身份验证",
    "重置",
    "复制交易",
    "跟单",
  ];

  return keywords.some((keyword) => text.includes(keyword));
}

export async function syncSingleBinanceArticle(): Promise<{ chunks: number; sourceUrl: string }> {
  const sourceUrl = process.env.BINANCE_RAG_SOURCE_URL ?? DEFAULT_SOURCE_URL;
  let html = "";
  let title = "";
  let text = "";

  const res = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CryptoVibeBot/1.0)",
    },
    cache: "no-store",
  });

  if (res.ok) {
    html = await res.text();
    title = extractTitle(html);
    text = stripHtml(html);
  }

  if (text.length < 200) {
    const proxyRes = await fetch(toReadableProxyUrl(sourceUrl), {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CryptoVibeBot/1.0)",
      },
    });

    if (!proxyRes.ok) {
      throw new Error(
        `抓取到的正文过短且代理抓取失败（原站HTTP ${res.status || "unknown"}，代理HTTP ${proxyRes.status}）。`,
      );
    }

    const proxyText = await proxyRes.text();
    title = title || "Binance Support (Proxy)";
    text = proxyText.replace(/\s+/g, " ").trim();
  }

  if (text.length < 200) {
    title = "Binance Support Seed (Fallback)";
    text = FALLBACK_SEED_TEXT.replace(/\s+/g, " ").trim();
  }

  const chunks = splitToChunks(text, 220);
  if (chunks.length === 0) {
    throw new Error("未能从文章提取有效段落。");
  }

  const supabase = getSupabaseAdminClient();

  const { error: deleteError } = await supabase
    .from("binance_kb_chunks")
    .delete()
    .eq("article_url", sourceUrl);

  if (deleteError) {
    throw new Error(`清理旧知识失败：${deleteError.message}`);
  }

  const rows = chunks.map((content, idx) => ({
    article_url: sourceUrl,
    article_title: title,
    chunk_index: idx,
    content,
    embedding: toPgVectorLiteral(createLocalEmbedding(content)),
  }));

  const { error: insertError } = await supabase.from("binance_kb_chunks").insert(rows);

  if (insertError) {
    throw new Error(`写入知识库失败：${insertError.message}。请先执行 docs/supabase-rag.sql`);
  }

  return {
    chunks: rows.length,
    sourceUrl,
  };
}

export async function retrieveBinanceChunks(question: string, limit = 5): Promise<RAGChunk[]> {
  const supabase = getSupabaseAdminClient();
  const queryEmbedding = toPgVectorLiteral(createLocalEmbedding(question));

  const { data, error } = await supabase.rpc("match_binance_kb_chunks", {
    query_embedding: queryEmbedding,
    match_count: limit,
    match_threshold: -1,
  });

  if (error) {
    throw new Error(`检索知识库失败：${error.message}。请确认已执行 docs/supabase-rag.sql`);
  }

  const rows = (data ?? []) as RAGChunk[];
  if (rows.length > 0) {
    return rows;
  }

  // Safety fallback: return latest chunks if similarity retrieval returns empty.
  const { data: fallbackRows, error: fallbackError } = await supabase
    .from("binance_kb_chunks")
    .select("id,article_url,article_title,chunk_index,content")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fallbackError) {
    throw new Error(`检索兜底失败：${fallbackError.message}`);
  }

  return (fallbackRows ?? []).map((row) => ({
    ...(row as Omit<RAGChunk, "similarity">),
    similarity: 0,
  }));
}

function buildFallbackAnswer(question: string, chunks: RAGChunk[]): string {
  const refs = chunks
    .map((chunk, idx) => `${idx + 1}. ${chunk.content.slice(0, 150)}...`)
    .join("\n");

  const links = Array.from(new Set(chunks.map((chunk) => chunk.article_url)))
    .map((url, idx) => `${idx + 1}. ${url}`)
    .join("\n");

  return [
    `你问的是：${question}`,
    "我已从币安帮助中心检索到相关内容（单文档知识库）。",
    "\n相关片段：",
    refs || "暂无命中片段",
    "\n参考来源：",
    links || "暂无",
    "\n提示：当前为检索直出兜底回答，建议点击来源链接核对最新规则。",
  ].join("\n");
}

export async function answerWithBinanceRAG(question: string): Promise<{ answer: string; sources: string[] }> {
  const chunks = await retrieveBinanceChunks(question, 5);

  if (chunks.length === 0) {
    return {
      answer: "当前知识库暂无匹配内容，请稍后先执行一次知识同步。",
      sources: [],
    };
  }

  const context = chunks
    .map((chunk, idx) => `片段${idx + 1}：${chunk.content}`)
    .join("\n\n");

  const uniqueSources = Array.from(new Set(chunks.map((chunk) => chunk.article_url)));

  const prompt = [
    "你是币安帮助中心问答助手。",
    "仅基于给定资料回答，不能编造。",
    "回答必须使用中文，先给结论，再给步骤/规则，最后给参考来源。",
    `用户问题：${question}`,
    `资料：\n${context}`,
  ].join("\n\n");

  try {
    const answer = await callGemini(prompt);
    return {
      answer: `${answer}\n\n参考来源：\n${uniqueSources.map((url, idx) => `${idx + 1}. ${url}`).join("\n")}`,
      sources: uniqueSources,
    };
  } catch {
    return {
      answer: buildFallbackAnswer(question, chunks),
      sources: uniqueSources,
    };
  }
}
