# Crypto Vibe Chat

一个实用的币圈聊天分析网站：输入 `btc/bitcoin/比特币` 等问题，系统自动抓取实时行情 + 最近新闻，并用 Gemini 输出中文专业分析。

## 已实现功能
- ChatGPT 风格首页聊天界面（消息气泡 + 输入框）
- 支持币种：BTC, ETH, SOL, XRP, DOGE, TON（中英别名识别）
- CoinGecko 实时数据：价格、24h 涨跌、市值、成交量、7日趋势
- 新闻数据：CryptoPanic（优先）/ NewsAPI（兜底）
- Gemini 中文分析：结论、关键数据、新闻影响、风险点、观察位
- 移动端适配 + 暗黑模式
- 内存缓存（减少重复 API 请求）
- 每日自动简报接口（Vercel Cron）

## 1) 本地运行

### 安装依赖
```bash
npm install
```

### 配置环境变量
```bash
cp .env.example .env.local
```

然后编辑 `.env.local`，至少填：
- `GEMINI_API_KEY`

### 启动
```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 2) 如何测试
1. 打开首页，发送：`btc 现在怎么样`
2. 预期：
- 出现一条用户消息
- 出现“正在抓取实时行情与新闻并分析...”
- 返回中文结构化分析
- 顶部卡片显示币种价格和 24h 涨跌
3. 再测别名：`比特币今天风险点是什么`
4. 再测错误分支：输入一个不支持币种，预期收到提示

## 3) 常见修改

### 增加支持币种
编辑 `src/lib/coins.ts` 的 `SUPPORTED_COINS`，新增：
- `symbol`
- `id`（CoinGecko coin id）
- `aliases`（中英别名）

### 调整 AI 分析风格
编辑 `src/lib/analyzer.ts` 里的 `systemPrompt`。

### 调整缓存时长
编辑 `src/lib/coingecko.ts` 和 `src/lib/news.ts` 里的 TTL。

## 4) 部署到 Vercel

### 方式 A：网页最简单（推荐）
1. 把代码推到 GitHub
2. 登录 [Vercel](https://vercel.com)
3. New Project -> 选择仓库 -> Deploy
4. 在 Project Settings -> Environment Variables 添加：
- `GEMINI_API_KEY`
- （可选）`GEMINI_MODEL`
- （可选）`CRYPTOPANIC_API_KEY`
- （可选）`NEWS_API_KEY`
- （可选）`CRON_SECRET`
5. 重新部署

部署成功后会得到：`https://<project-name>.vercel.app`

### 方式 B：Vercel CLI
```bash
npm i -g vercel
vercel
```
按提示登录并部署。

## 5) 绑定自定义域名
1. Vercel 项目 -> `Settings` -> `Domains`
2. 输入你的域名，例如 `chat.yourdomain.com`
3. 按提示在域名服务商添加 DNS 记录（通常是 CNAME 指向 `cname.vercel-dns.com`）
4. 等待生效后，Vercel 会显示 `Valid Configuration`

## 6) 日报 Cron（可选）
项目已包含 `vercel.json`：每天会调用 `/api/daily-report`。
如果你配置了 `CRON_SECRET`，请确保 cron 请求带 `Authorization: Bearer <CRON_SECRET>`。

---
如果你是零基础，建议先完成「本地运行 + 发送三条测试问题」，确认功能无误后再部署。
