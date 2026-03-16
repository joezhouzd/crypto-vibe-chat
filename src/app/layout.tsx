import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Crypto Vibe Chat",
  description: "AI 驱动的加密货币实时行情分析网站",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
