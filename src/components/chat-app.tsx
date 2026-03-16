"use client";

import { ArrowUp, Bot, LoaderCircle, Sparkles, User } from "lucide-react";
import { useMemo, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCompactNumber, formatUsd } from "@/lib/utils";

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatApiSuccess = {
  analysis: string;
  snapshot?: {
    currentPrice: number;
    priceChange24hPct: number;
    marketCap: number;
    volume24h: number;
  };
  coin?: {
    symbol: string;
    name: string;
  };
};

type MarketMeta = {
  snapshot: {
    currentPrice: number;
    priceChange24hPct: number;
    marketCap: number;
    volume24h: number;
  };
  coin: {
    symbol: string;
    name: string;
  };
};

const starters = [
  "btc 现在怎么样",
  "eth 今天趋势如何",
  "solana 最近新闻热点是什么",
];

export function ChatApp() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [marketMeta, setMarketMeta] = useState<MarketMeta | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "你好，我是你的币圈行情助手。你可以问我：\n- btc 现在怎么样\n- eth 今天趋势如何\n- doge 最近风险点是什么",
    },
  ]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function sendMessage(raw: string) {
    const message = raw.trim();
    if (!message || loading) {
      return;
    }

    setError("");
    setInput("");
    setLoading(true);

    const userMsg: LocalMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = (await res.json()) as ChatApiSuccess & { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "请求失败");
      }

      if (data.snapshot && data.coin) {
        setMarketMeta({
          snapshot: data.snapshot,
          coin: data.coin,
        });
      } else {
        setMarketMeta(null);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.analysis,
        },
      ]);
    } catch (err) {
      const text = err instanceof Error ? err.message : "发生未知错误";
      setError(text);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `抱歉，本次分析失败：${text}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_45%,_#eef2ff_100%)] px-4 py-6 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_#0f172a_0%,_#020617_60%,_#000000_100%)] dark:text-slate-100 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Card className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-lg font-semibold">Crypto Vibe Chat</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">实时行情 + 新闻驱动的 AI 分析</p>
          </div>
          <ThemeToggle />
        </Card>

        {marketMeta && (
          <Card className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">币种</p>
              <p className="font-medium">
                {marketMeta.coin.name} ({marketMeta.coin.symbol})
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">价格</p>
              <p className="font-medium">{formatUsd(marketMeta.snapshot.currentPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">24h 涨跌</p>
              <p className={marketMeta.snapshot.priceChange24hPct >= 0 ? "font-medium text-emerald-500" : "font-medium text-rose-500"}>
                {marketMeta.snapshot.priceChange24hPct.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">24h 成交量</p>
              <p className="font-medium">{formatCompactNumber(marketMeta.snapshot.volume24h)}</p>
            </div>
          </Card>
        )}

        <Card className="flex min-h-[60vh] flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[75%] ${
                    msg.role === "user"
                      ? "bg-cyan-600 text-white"
                      : "border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs opacity-70">
                    {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    {msg.role === "assistant" ? "分析助手" : "你"}
                  </div>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在抓取实时行情与新闻并分析...
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-slate-800 sm:p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:text-slate-300"
                >
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  {s}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
            >
              <Input
                placeholder="输入币种问行情，例如：btc 现在怎么样"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <Button type="submit" disabled={!canSend} className="h-10 w-10 rounded-xl p-0">
                <ArrowUp className="h-4 w-4" />
              </Button>
            </form>

            {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
