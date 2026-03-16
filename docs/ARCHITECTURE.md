# 架构规划（MVP）

## 目标
构建一个聊天式币圈分析网站，用户输入任意币种别名后，系统自动识别币种，拉取实时行情和相关新闻，再调用 Gemini 输出中文中立分析。

## 技术选型
- 前端：Next.js App Router + TypeScript + Tailwind CSS
- UI：shadcn 风格组件（本项目用本地轻量组件实现）
- 后端：Next.js Route Handlers（`/api/chat`）
- 行情源：CoinGecko API
- 新闻源：CryptoPanic（优先）/ NewsAPI（兜底）
- AI：Gemini API
- 缓存：内存 TTL Cache（可升级 Vercel KV）
- 部署：Vercel + 自定义域名

## 数据流
1. 用户在首页输入问题（如“btc 现在怎么样”）
2. `/api/chat` 识别币种（BTC/ETH/SOL/XRP/DOGE/TON + 中英文别名）
3. 并发抓取：
   - CoinGecko 当前行情
   - CoinGecko 7日趋势
   - CryptoPanic/NewsAPI 最近新闻
4. 将结构化数据发送给 Gemini，生成中文分析
5. 返回前端并显示消息气泡与关键行情卡片

## 目录结构
- `src/app/page.tsx`：首页
- `src/components/chat-app.tsx`：聊天界面
- `src/app/api/chat/route.ts`：聊天分析 API
- `src/lib/coins.ts`：币种识别
- `src/lib/coingecko.ts`：行情抓取
- `src/lib/news.ts`：新闻抓取
- `src/lib/analyzer.ts`：Gemini 分析
- `src/lib/cache.ts`：TTL 缓存
- `src/app/api/daily-report/route.ts`：日报接口（供 Cron）
- `vercel.json`：Vercel Cron 配置

## 必需密钥
- 必填：`GEMINI_API_KEY`
- 可选：`CRYPTOPANIC_API_KEY` / `NEWS_API_KEY`
- 可选：`CRON_SECRET`
