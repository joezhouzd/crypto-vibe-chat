import { NextResponse } from "next/server";

import { syncSingleBinanceArticle } from "@/lib/rag";

function isAuthorized(req: Request): boolean {
  const secret = process.env.RAG_SYNC_SECRET;
  if (!secret) {
    return true;
  }

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) {
    return true;
  }

  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncSingleBinanceArticle();
    return NextResponse.json({ ok: true, ...result, syncedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "同步失败",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
